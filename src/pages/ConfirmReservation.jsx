import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase, supabaseAnon } from '../supabaseClient';

function ConfirmReservation() {
  const { shopId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { 
    people, 
    totalSlotsNeeded, 
    date, 
    time, 
    adminDate, 
    adminTime, 
    lineUser, 
    customShopName,
    staffId 
  } = location.state || {};
  
  const isAdminEntry = !!adminDate; 

  const [shop, setShop] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestedCustomers, setSuggestedCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [staffName, setStaffName] = useState('');

  useEffect(() => {
    if (!date && !adminDate) {
      navigate(`/shop/${shopId}/reserve`); 
      return;
    }

    const checkLineCustomer = async () => {
      if (lineUser?.userId) {
        const { data: cust } = await supabase
          .from('customers')
          .select('*')
          .eq('shop_id', shopId)
          .eq('line_user_id', lineUser.userId)
          .maybeSingle();

        if (cust) {
          setCustomerName(cust.name);
          setCustomerPhone(cust.phone || '');
          setCustomerEmail(cust.email || '');
          setSelectedCustomerId(cust.id);
          return; 
        }
      }
      
      if (lineUser && lineUser.displayName) {
        setCustomerName(lineUser.displayName);
      }
    };

    // 🆕 担当スタッフ名を取得する関数を追加
    const fetchStaffName = async () => {
      if (staffId) {
        const { data } = await supabase
          .from('staffs')
          .select('name')
          .eq('id', staffId)
          .single();
        if (data) setStaffName(data.name);
      }
    };

    checkLineCustomer();
    fetchShop();
    fetchStaffName(); // 🆕 ここで実行！
  }, [lineUser, shopId, date, adminDate, navigate]);

  const fetchShop = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (data) setShop(data);
  };

  useEffect(() => {
    const searchCustomers = async () => {
      if (!isAdminEntry || !customerName || customerName.length < 1 || selectedCustomerId) {
        setSuggestedCustomers([]);
        setSelectedIndex(-1);
        return;
      }
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .ilike('name', `%${customerName}%`)
        .limit(5);
      
      setSuggestedCustomers(data || []);
      setSelectedIndex(-1);
    };
    const timer = setTimeout(searchCustomers, 300);
    return () => clearTimeout(timer);
  }, [customerName, selectedCustomerId, isAdminEntry, shopId]);

  const handleSelectCustomer = (c) => {
    setCustomerName(c.name);
    setCustomerPhone(c.phone || '');
    setCustomerEmail(c.email || '');
    setSelectedCustomerId(c.id);
    setSuggestedCustomers([]);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (suggestedCustomers.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < suggestedCustomers.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0) {
        e.preventDefault();
        handleSelectCustomer(suggestedCustomers[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setSuggestedCustomers([]);
      setSelectedIndex(-1);
    }
  };

  const handleReserve = async () => {
    if (!customerName) { alert('お客様名を入力してください'); return; }
    if (!isAdminEntry) {
      if (!customerPhone || !customerEmail) { alert('電話番号とメールアドレスを入力してください'); return; }
    }

    setIsSubmitting(true);

    const targetDate = adminDate || date;
    const targetTime = adminTime || time;
    const startDateTime = new Date(`${targetDate}T${targetTime}`);
    const interval = shop.slot_interval_min || 15;
    const buffer = shop.buffer_preparation_min || 0;
    const totalMinutes = (totalSlotsNeeded * interval) + buffer;
    const endDateTime = new Date(startDateTime.getTime() + totalMinutes * 60000);

    const cancelToken = crypto.randomUUID();
    const cancelUrl = `${window.location.origin}/cancel?token=${cancelToken}`;

    try {
      // ✅ 顧客紐付け・更新
      let query = supabase.from('customers').select('id, total_visits').eq('shop_id', shopId);
      if (lineUser?.userId) {
        query = query.eq('line_user_id', lineUser.userId);
      } else {
        query = query.eq('name', customerName);
      }
      const { data: existingCust } = await query.maybeSingle();

      if (existingCust) {
        await supabase.from('customers').update({
          phone: customerPhone || undefined,
          email: customerEmail || undefined,
          line_user_id: lineUser?.userId || undefined,
          total_visits: (existingCust.total_visits || 0) + 1,
          last_arrival_at: startDateTime.toISOString(),
          updated_at: new Date().toISOString()
        }).eq('id', existingCust.id);
      } else {
        await supabase.from('customers').insert([{
          shop_id: shopId,
          name: customerName,
          phone: customerPhone,
          email: customerEmail,
          line_user_id: lineUser?.userId || null,
          total_visits: 1,
          last_arrival_at: startDateTime.toISOString()
        }]);
      }

      const menuLabel = people.length > 1
        ? people.map((p, i) => `${i + 1}人目: ${p.fullName}`).join(' / ')
        : (people[0]?.fullName || 'メニューなし');

      // ✅ 予約データの挿入
      const { error: dbError } = await supabase.from('reservations').insert([
        {
          shop_id: shopId,
          staff_id: staffId,           // 🆕 送られてきたスタッフIDを保存
          reservation_date: targetDate, // 🆕 カレンダー表示を高速化するための日付
          customer_name: customerName,
          customer_phone: customerPhone || '---',
          customer_email: customerEmail || 'admin@example.com',
          // ... (以下、既存の項目はそのまま)
          start_at: startDateTime.toISOString(),
          end_at: endDateTime.toISOString(),
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(), 
          total_slots: totalSlotsNeeded,
          res_type: 'normal',
          line_user_id: lineUser?.userId || null,
          cancel_token: cancelToken,
          menu_name: menuLabel,
          options: { 
            people: people,
            applied_shop_name: customShopName || shop.business_name 
          }
        }
      ]);

      if (dbError) throw dbError;

      // ✅ 通知メール送信 (resend 関数を呼び出し)
      if (!isAdminEntry) {
        await supabaseAnon.functions.invoke('resend', {
          body: {
            type: 'booking', 
            shopId, 
            customerEmail, 
            customerName, 
            shopName: customShopName || shop.business_name,
            staffName: staffName,
            shopEmail: shop.email_contact, 
            startTime: `${targetDate.replace(/-/g, '/')} ${targetTime}`,
            services: menuLabel, 
            cancelUrl, 
            lineUserId: lineUser?.userId || null,
            notifyLineEnabled: shop.notify_line_enabled
          }
        });
      }

      alert(isAdminEntry ? '爆速ねじ込み完了！' : '予約が完了しました！');
      if (isAdminEntry) {
        navigate(`/admin/${shopId}/reservations?date=${targetDate}`);
      } else {
        navigate('/');
      }

    } catch (err) {
      console.error(err);
      alert(`エラーが発生しました: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!shop) return null;
  const themeColor = shop?.theme_color || '#2563eb';
  const displayDate = (adminDate || date).replace(/-/g, '/');
  const displayTime = adminTime || time;

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif', color: '#333' }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: '20px', border: 'none', background: 'none', color: '#666', cursor: 'pointer', fontWeight: 'bold' }}>← 戻る</button>
      
      <h2 style={{ borderLeft: isAdminEntry ? '4px solid #e11d48' : `4px solid ${themeColor}`, paddingLeft: '10px', fontSize: '1.2rem', marginBottom: '25px' }}>
        {isAdminEntry ? '⚡ 店舗ねじ込み予約（入力短縮）' : '予約内容の確認'}
      </h2>

      {lineUser && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', padding: '12px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
          <img src={lineUser.pictureUrl} style={{ width: '40px', height: '40px', borderRadius: '50%' }} alt="LINE" />
          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#166534' }}>LINE連携：{lineUser.displayName} 様</div>
        </div>
      )}

      <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '15px', marginBottom: '25px', border: '1px solid #e2e8f0' }}>
  <p style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: 'bold', color: themeColor }}>
    🏨 {customShopName || shop.business_name}
  </p>
  <p style={{ margin: '0 0 12px 0' }}>📅 <b>日時：</b> {displayDate} {displayTime} 〜</p>
  
  {/* 🆕 ここに担当者名を追加！ */}
  {staffName && (
    <p style={{ margin: '0 0 12px 0' }}>👤 <b>担当：</b> {staffName}</p>
  )}

  <p style={{ margin: '0 0 8px 0' }}>📋 <b>選択メニュー：</b></p>
        <div style={{ background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #eee', fontSize: '0.85rem' }}>
          {people && people.map((person, idx) => (
            <div key={idx} style={{ marginBottom: idx < people.length - 1 ? '10px' : 0, paddingBottom: idx < people.length - 1 ? '10px' : 0, borderBottom: idx < people.length - 1 ? '1px dashed #eee' : 'none' }}>
              {people.length > 1 && (
                <div style={{ fontWeight: 'bold', color: themeColor, marginBottom: '4px' }}>{idx + 1}人目</div>
              )}
              <div style={{ fontWeight: 'bold' }}>{person.fullName}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ position: 'relative' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>お客様名 (必須)</label>
          <input 
            type="text" 
            value={customerName} 
            onChange={(e) => { setCustomerName(e.target.value); setSelectedCustomerId(null); }} 
            onKeyDown={handleKeyDown}
            placeholder="お名前を入力" 
            style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box', fontSize: '1rem' }} 
          />
          {isAdminEntry && suggestedCustomers.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', borderRadius: '10px', zIndex: 100, border: '1px solid #eee', overflow: 'hidden' }}>
              {suggestedCustomers.map((c, index) => (
                <div 
                  key={c.id} 
                  onClick={() => handleSelectCustomer(c)} 
                  style={{ 
                    padding: '12px', 
                    borderBottom: '1px solid #f8fafc', 
                    cursor: 'pointer', 
                    fontSize: '0.9rem',
                    background: index === selectedIndex ? `${themeColor}15` : 'transparent'
                  }}
                >
                  <b>{c.name} 様</b> <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>({c.phone || '電話なし'})</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {!isAdminEntry && (
          <>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>メールアドレス</label>
              <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>電話番号</label>
              <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
            </div>
          </>
        )}

        <button 
          onClick={handleReserve} 
          disabled={isSubmitting} 
          style={{ 
            marginTop: '10px', padding: '18px', 
            background: isSubmitting ? '#94a3b8' : (isAdminEntry ? '#e11d48' : themeColor), 
            color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer' 
          }}
        >
          {isSubmitting ? '処理中...' : (isAdminEntry ? '🚀 ねじ込んで名簿登録' : '予約を確定する')}
        </button>
      </div>
    </div>
  );
}

export default ConfirmReservation;