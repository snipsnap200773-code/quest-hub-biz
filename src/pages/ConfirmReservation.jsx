import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
// ✅ 既存のインポートを維持
import { supabase, supabaseAnon } from '../supabaseClient';

function ConfirmReservation() {
  const { shopId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ 前の画面から引き継いだデータ（customShopName を追加）
  const { 
    people, 
    totalSlotsNeeded, 
    date, 
    time, 
    adminDate, 
    adminTime, 
    lineUser, 
    customShopName // 🆕 入り口別の専用屋号
  } = location.state || {};
  
  const isAdminEntry = !!adminDate; 

  const [shop, setShop] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🆕 顧客連動用State
  const [suggestedCustomers, setSuggestedCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  // 🆕 キーボード選択用のIndex
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    if (!date && !adminDate) {
      navigate(`/shop/${shopId}/reserve`); 
      return;
    }

    // ✅ 【最優先ロジック】LINE ID で名簿を照合
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

    checkLineCustomer();
    fetchShop();
  }, [lineUser, shopId]);

  const fetchShop = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (data) setShop(data);
  };

  useEffect(() => {
    const searchCustomers = async () => {
      // 🛑 管理者モード（ねじ込み予約）でない場合は、検索ロジックを停止
      if (!isAdminEntry) {
        setSuggestedCustomers([]);
        return;
      }

      if (!customerName || customerName.length < 1 || selectedCustomerId) {
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
      setSelectedIndex(-1); // リストが変わったら選択をリセット
    };
    const timer = setTimeout(searchCustomers, 300);
    return () => clearTimeout(timer);
  }, [customerName, selectedCustomerId, isAdminEntry]);

  const handleSelectCustomer = (c) => {
    setCustomerName(c.name);
    setCustomerPhone(c.phone || '');
    setCustomerEmail(c.email || '');
    setSelectedCustomerId(c.id);
    setSuggestedCustomers([]);
    setSelectedIndex(-1);
  };

  // 🆕 キーボード操作ハンドラー
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
      // ✅ 紐付けチェック
      let query = supabase.from('customers').select('id, total_visits').eq('shop_id', shopId);
      if (lineUser?.userId) {
        query = query.eq('line_user_id', lineUser.userId);
      } else {
        query = query.eq('name', customerName);
      }
      const { data: existingCust } = await query.maybeSingle();

      if (existingCust) {
        await supabase
          .from('customers')
          .update({
            phone: customerPhone || undefined,
            email: customerEmail || undefined,
            line_user_id: lineUser?.userId || undefined,
            total_visits: (existingCust.total_visits || 0) + 1,
            last_arrival_at: startDateTime.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingCust.id);
      } else {
        await supabase
          .from('customers')
          .insert([{
            shop_id: shopId,
            name: customerName,
            phone: customerPhone,
            email: customerEmail,
            line_user_id: lineUser?.userId || null,
            total_visits: 1,
            last_arrival_at: startDateTime.toISOString()
          }]);
      }

// ✅ 修正：ReservationFormで作った「fullName（合体名）」を正式採用します
      const menuLabel = people.length > 1
        ? people.map((p, i) => `${i + 1}人目: ${p.fullName}`).join(' / ')
        : (people[0]?.fullName || 'メニューなし');

      const { error: dbError } = await supabase.from('reservations').insert([
        {
          shop_id: shopId,
          customer_name: customerName,
          customer_phone: customerPhone || '---',
          customer_email: customerEmail || 'admin@example.com',
          start_at: startDateTime.toISOString(),
          end_at: endDateTime.toISOString(),
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(), 
          total_slots: totalSlotsNeeded,
          res_type: 'normal',
          line_user_id: lineUser?.userId || null,
          cancel_token: cancelToken,
          menu_name: menuLabel, // 🆕 ここで新設したmenu_nameカラムに保存！
          options: { 
            people: people,
            // 🆕 予約データにも「入り口別の屋号」を記録しておく（後で確認しやすくするため）
            applied_shop_name: customShopName || shop.business_name 
          }
        }
      ]);

      if (dbError) throw dbError;

      if (!isAdminEntry) {
        // ✅ 【重要】メール送信時の店名を customShopName で上書き
        await supabaseAnon.functions.invoke('send-reservation-email', {
          body: {
            shopId, 
            customerEmail, 
            customerName, 
            // 🆕 ここで専用屋号を優先的に使用
            shopName: customShopName || shop.business_name,
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

  // ✅ テーマカラーの取得
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

      {/* 予約内容カード */}
      <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '15px', marginBottom: '25px', border: '1px solid #e2e8f0' }}>
        {/* 🆕 屋号の表示（専用屋号があればそれを表示、なければ元の店名） */}
        <p style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: 'bold', color: themeColor }}>
          🏨 {customShopName || shop.business_name}
        </p>
        
        <p style={{ margin: '0 0 12px 0' }}>📅 <b>日時：</b> {displayDate} {displayTime} 〜</p>
<p style={{ margin: '0 0 8px 0' }}>📋 <b>選択メニュー：</b></p>
        <div style={{ background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #eee', fontSize: '0.85rem' }}>
          {people && people.map((person, idx) => (
            <div key={idx} style={{ marginBottom: idx < people.length - 1 ? '10px' : 0, paddingBottom: idx < people.length - 1 ? '10px' : 0, borderBottom: idx < people.length - 1 ? '1px dashed #eee' : 'none' }}>
              {people.length > 1 && (
                <div style={{ fontWeight: 'bold', color: themeColor, marginBottom: '4px' }}>{idx + 1}人目</div>
              )}
              {/* ✅ ここを修正：合体名(fullName)をドーンと表示します */}
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