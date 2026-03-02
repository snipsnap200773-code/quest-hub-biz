import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase, supabaseAnon } from '../supabaseClient';
import { Loader2 } from 'lucide-react';

function ConfirmReservation() {
  const { shopId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // 🆕 修正1：Stateの追加（ここに4つのStateを定義します）
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestedCustomers, setSuggestedCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [staffName, setStaffName] = useState('');
  const [customAnswers, setCustomAnswers] = useState({});

  const { 
    people, 
    totalSlotsNeeded, 
    date, 
    time, 
    adminDate, 
    adminTime, 
    lineUser, 
    customShopName,
    staffId,
    fromView,
    visitorZip,
    visitorAddress,
    travelTimeMinutes,
    authUserProfile // 🆕 前の画面から渡されたログインユーザー情報
  } = location.state || {};
  
const isAdminEntry = !!adminDate; 


  const [shop, setShop] = useState(null);

  

  // 🆕 一括管理用のStateに変更
const [customerData, setCustomerData] = useState({
    name: '', 
    furigana: '', 
    email: '', 
    phone: '', 
    zip_code: visitorZip || '', 
    address: visitorAddress || '', // 🆕 届いた住所があればそれをセット、なければ空
    parking: '', 
    building_type: '', 
    care_notes: '', 
    company_name: '', 
    symptoms: '', 
    request_details: '', 
    notes: ''
  });
    const [formConfig, setFormConfig] = useState(null); // 🆕 フォーム設定用

// 🆕 46行目付近：fetchShop
  const fetchShop = async () => {
    try {
      console.log("🔍 クエストデータ取得開始... shopId:", shopId);
      const { data, error } = await supabase.from('profiles').select('*').eq('id', shopId).single();
      
      if (error) {
        console.error("❌ Supabaseエラー:", error.message);
        return;
      }

if (data) {
        console.log("✅ クエストデータ取得成功:", data.business_name);
        setShop(data);
        const config = data.form_config || {};
        setFormConfig(config);
        
        // 🆕 カスタム質問があれば、回答Stateの初期値をセット
        if (config.custom_questions) {
          const initialAnswers = {};
          config.custom_questions.forEach(q => {
            initialAnswers[q.id] = ''; // 最初は未選択
          });
          setCustomAnswers(initialAnswers);
        }
      }
            else {
        console.warn("⚠️ データが空です。IDが間違っている可能性があります。");
      }
    } catch (err) {
      console.error("🔥 通信エラー:", err);
    }
  };

  // 🆕 修正：fetchStaffName をここに定義します！
const fetchStaffName = async () => {
    try {
      if (staffId) {
        // 1. 指名（staffId）がある場合はその人を優先
        const { data } = await supabase.from('staffs').select('name').eq('id', staffId).single();
        if (data) setStaffName(data.name);
      } else {
        // 🆕 2. 指名がない場合、店舗の全スタッフを確認
        const { data: staffs } = await supabase.from('staffs').select('name').eq('shop_id', shopId);
        
        if (staffs && staffs.length === 1) {
          // 🏆 スタッフが1人しかいないなら、その人を自動的に担当者にセット
          console.log("👤 1人営業のため担当者を自動設定:", staffs[0].name);
          setStaffName(staffs[0].name);
        }
      }
    } catch (err) {
      console.error("🔥 スタッフ取得エラー:", err);
    }
  };

// 🆕 ログイン情報・店舗データ取得の一元化
  useEffect(() => {
    const checkUserAndStore = async () => {
      // 🆕 1. Googleログインユーザー情報を優先的に入力欄へ反映
      // authUserProfile にデータがあれば、name, email, phone を初期セットします
      if (authUserProfile) {
        console.log("👤 Googleログイン情報を反映:", authUserProfile.display_name);
        setCustomerData(prev => ({
          ...prev,
          name: prev.name || authUserProfile.display_name || '',
          email: prev.email || authUserProfile.email || '',
          phone: prev.phone || authUserProfile.phone || '',
        }));
      }

      // 2. LINEユーザー情報の処理
      if (!lineUser?.userId) {
        if (lineUser?.displayName) {
          setCustomerData(prev => ({ ...prev, name: prev.name || lineUser.displayName }));
        }
      } else {
        // LINE連携済みの場合、まずLINE名を仮セット
        if (lineUser.displayName) {
          setCustomerData(prev => ({ ...prev, name: prev.name || lineUser.displayName }));
        }

        // DB（customersテーブル）から過去の保存情報を探す
        const { data: cust } = await supabase
          .from('customers')
          .select('*')
          .eq('shop_id', shopId)
          .eq('line_user_id', lineUser.userId)
          .maybeSingle();

        if (cust) {
          console.log("✅ 過去の顧客データを反映:", cust.name);
          setCustomerData(prev => ({
            ...prev,
            name: cust.name || prev.name,
            furigana: cust.furigana || '',
            phone: cust.phone || prev.phone,
            email: cust.email || prev.email,
            zip_code: visitorZip || cust.zip_code || '', 
            address: visitorAddress || cust.address || '', 
            parking: cust.parking || '', 
            building_type: cust.building_type || '',
            care_notes: cust.care_notes || '',
            company_name: cust.company_name || '',
            symptoms: cust.symptoms || '', 
            request_details: cust.request_details || '',
            notes: cust.notes || '',
            custom_answers: cust.custom_answers || {} 
          }));
          setSelectedCustomerId(cust.id);
        }
      }
    };

    checkUserAndStore();
    fetchShop();
    fetchStaffName();
  }, [lineUser, authUserProfile, shopId]); // 🆕 authUserProfile も監視対象に追加

// 🆕 顧客検索ロジックを一括State（customerData.name）に対応
  useEffect(() => {
    const searchCustomers = async () => {
      if (!isAdminEntry || !customerData.name || customerData.name.length < 1 || selectedCustomerId) {
        setSuggestedCustomers([]);
        setSelectedIndex(-1);
        return;
      }
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .ilike('name', `%${customerData.name}%`)
        .limit(5);
      
      setSuggestedCustomers(data || []);
      setSelectedIndex(-1);
    };
    const timer = setTimeout(searchCustomers, 300);
    return () => clearTimeout(timer);
  }, [customerData.name, selectedCustomerId, isAdminEntry, shopId]);

// 🆕 候補から選んだ際、一括State（customerData）を更新
  const handleSelectCustomer = (c) => {
    setCustomerData({
      ...customerData,
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '' // 住所データがあればそれもセット
    });
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

  // 🆕 2. 入力ハンドラとスタイルの追加
  // 様々な入力項目（名前、住所、備考など）を一つのStateで管理するための関数
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCustomerData(prev => ({ ...prev, [name]: value }));
    
    // 名前入力欄（name="name"）が変更された場合のみ、検索候補からの選択状態を解除する
    if (name === 'name') setSelectedCustomerId(null);
  };

  // 動的に生成される入力フォーム（input/select/textarea）で共通利用するスタイル定義
  const inputStyle = { 
    width: '100%', 
    padding: '14px', 
    borderRadius: '10px', 
    border: '1px solid #ddd', 
    boxSizing: 'border-box', 
    fontSize: '1rem' 
  };

// ✅ 修正後の保存ロジック（handleReserve）
  const handleReserve = async () => {
    // --- 1. バリデーションチェック ---
    for (const [key, config] of Object.entries(formConfig)) {
      const isEnabled = lineUser ? config.line_enabled : config.enabled;
      if (isEnabled && config.required) {
        if (isAdminEntry && key !== 'name') continue; 
        if (!customerData[key]) {
          alert(`${config.label}を入力してください`);
          return;
        }
      }
    }

    setIsSubmitting(true);

    try {
      // --- 2. 保存用のラベル作成 (ReferenceError回避のため冒頭で定義) ---
      const menuLabel = people && people.length > 1
        ? people.map((p, i) => `${i + 1}人目: ${p.fullName}`).join(' / ')
        : (people && people[0]?.fullName || 'メニューなし');

      // --- 3. 日時と終了バッファの計算 ---
      const targetDate = adminDate || date;
      const targetTime = adminTime || time;
      const startDateTime = new Date(`${targetDate}T${targetTime}:00`);
      
// 🆕 日時と終了バッファの計算（準備時間を確実に含める）
const interval = shop.slot_interval_min || 15;
    const buffer = shop.buffer_preparation_min || 0;
    // ✅ 修正：メニュー時間 ＋ 準備時間 ＋ 移動時間をすべて足して終了時刻を決定する
    const totalMinutes = (totalSlotsNeeded * interval) + buffer + (travelTimeMinutes || 0);
    const endDateTime = new Date(startDateTime.getTime() + totalMinutes * 60000);
          
      const cancelToken = crypto.randomUUID();
      const cancelUrl = `${window.location.origin}/cancel?token=${cancelToken}`;

      let finalStaffId = staffId;
      let finalStaffName = staffName;

      // スタッフ自動特定（1名のみの場合）
      if (!finalStaffId) {
        const { data: staffs } = await supabase.from('staffs').select('id, name').eq('shop_id', shopId);
        if (staffs && staffs.length === 1) {
          finalStaffId = staffs[0].id;
          finalStaffName = staffs[0].name;
        }
      }

// 既存顧客の検索（名寄せ）
      let finalCustomerId = selectedCustomerId;
      let existingCust = null;

      if (!finalCustomerId) {
        const orConditions = [];

        // ✅ a. Googleログイン済みなら、前の画面から引き継いだIDで探す（getUserを呼ばなくてOK！）
        if (authUserProfile?.id) {
          orConditions.push(`auth_id.eq.${authUserProfile.id}`);
        }
        
        // b. LINE ID で探す
        if (lineUser?.userId) {
          orConditions.push(`line_user_id.eq.${lineUser.userId}`);
        }
        
        // c. 電話番号で探す
        if (customerData.phone && customerData.phone !== '---') {
          orConditions.push(`phone.eq.${customerData.phone}`);
        }
        
        const { data: matched } = await supabase
          .from('customers')
          .select('id, total_visits')
          .or(orConditions.length > 0 ? orConditions.join(',') : `name.eq.${customerData.name}`)
          .eq('shop_id', shopId)
          .maybeSingle();

        if (matched) {
          finalCustomerId = matched.id;
          existingCust = matched;
        }
      }
      
// --- 4. 顧客名簿（customers）の保存・更新 ---
      const customerPayload = {
        shop_id: shopId,
        name: customerData.name,
        auth_id: authUserProfile?.id || null,
        furigana: customerData.furigana || null,
        phone: customerData.phone || null,
        email: customerData.email || null,
        zip_code: visitorZip || null, 
        address: customerData.address || null,
        // 🆕 業種別項目を追加
        parking: customerData.parking || null,
        building_type: customerData.building_type || null,
        care_notes: customerData.care_notes || null,
        company_name: customerData.company_name || null,
        symptoms: customerData.symptoms || null,
        request_details: customerData.request_details || null,
        notes: customerData.notes || null,
        // 🆕 カスタム質問（もしあれば）
        custom_answers: customerData.custom_answers || null,
        
        line_user_id: lineUser?.userId || null,
        total_visits: (existingCust?.total_visits || 0) + 1,
        last_arrival_at: startDateTime.toISOString(),
        updated_at: new Date().toISOString()
      };

      if (finalCustomerId) {
        await supabase.from('customers').update(customerPayload).eq('id', finalCustomerId);
      } else {
        const { data: newCust, error: insError } = await supabase.from('customers').insert([customerPayload]).select().single();
        if (insError) throw insError;
        finalCustomerId = newCust.id;
      }

// ✅ 予約データの挿入
      const { error: dbError } = await supabase.from('reservations').insert([
        {
          shop_id: shopId,
          customer_id: finalCustomerId,
          staff_id: finalStaffId,
          reservation_date: targetDate, 
          customer_name: customerData.name,
          customer_phone: customerData.phone || '---',
          customer_email: customerData.email || 'admin@example.com',
          zip_code: customerData.zip_code || null,
          // 🆕 ここを start_time と end_time の2つだけに絞ります
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(), 
          total_slots: totalSlotsNeeded,
          res_type: 'normal',
          line_user_id: lineUser?.userId || null,
          cancel_token: cancelToken,
          menu_name: menuLabel,
          options: { 
            people: people,
            applied_shop_name: customShopName || shop.business_name,
            visit_info: {
              address: customerData.address,
              parking: customerData.parking,
              custom_answers: customAnswers 
            }
          }
        }
      ]);

      if (dbError) throw dbError;

      // 通知の送信
// ✅ 修正ポイント：宛先メールアドレスと詳細データをすべて backend へ送る
      if (!isAdminEntry) {
        await supabaseAnon.functions.invoke('resend', {
          body: {
            type: 'booking', 
            shopId,
            customerName: customerData.name,
            staffName: finalStaffName || staffName,
            shopName: customShopName || shop.business_name, // 🆕 追加
            startTime: `${targetDate.replace(/-/g, '/')} ${targetTime}`,
            services: menuLabel,
            customerEmail: customerData.email, // 🆕 これがないとお客様に届きません！
            shopEmail: shop.email_contact,     // 🆕 これがないと店舗に届きません！
            lineUserId: lineUser?.userId || null,
            cancelUrl: cancelUrl,
            // 🆕 フォームの全入力データを送る
            ...customerData, 
            buildingType: customerData.building_type, // 変数名の微調整
            careNotes: customerData.care_notes,
            requestDetails: customerData.request_details
          }
        });
      }      
      alert(isAdminEntry ? '爆速ねじ込み完了！' : '予約が完了しました！');
      navigate(isAdminEntry ? `/admin/${shopId}/reservations` : '/');
      
    } catch (err) {
      console.error(err);
      alert(`エラーが発生しました: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };    
// 🆕 読み込み中であることを視覚化する
  if (!shop) {
    return (
      <div style={{ padding: '100px 20px', textAlign: 'center', color: '#64748b' }}>
        <div style={{ marginBottom: '20px', fontSize: '2rem', animation: 'spin 2s linear infinite' }}>⌛</div>
        <p style={{ fontWeight: 'bold' }}>クエスト情報を読み込み中...</p>
        <p style={{ fontSize: '0.8rem', marginTop: '10px' }}>画面が変わらない場合は、DB接続を確認してください。</p>
      </div>
    );
  }
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
        {/* --- 1. 基本項目 & 業種別項目のループ --- */}
        {formConfig && Object.entries(formConfig).map(([key, config]) => {
          const isEnabled = lineUser ? config.line_enabled : config.enabled;
          
          // 表示しない条件
          if (!isEnabled) return null;
          if (isAdminEntry && key !== 'name') return null;
          
          // ⚠️ ふりがな、備考欄、郵便番号はこのループ内では直接描画しない（位置を固定するため）
          if (key === 'furigana' || key === 'notes' || key === 'zip_code') return null;

          return (
            <React.Fragment key={key}>
              {/* 各入力項目の div */}
              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                  {config.label} {config.required && <span style={{ color: '#ef4444' }}>*</span>}
                </label>

                {key === 'name' ? (
                  <>
                    <input 
                      name="name"
                      type="text" 
                      autoComplete="off"
                      value={customerData.name} 
                      onChange={handleInputChange} 
                      onKeyDown={handleKeyDown}
                      placeholder={`${config.label}を入力`} 
                      style={inputStyle} 
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
                  </>
                ) : key === 'parking' ? (
                  <select name={key} value={customerData[key]} onChange={handleInputChange} style={inputStyle} required={config.required}>
                    <option value="">選択してください</option>
                    <option value="あり">あり</option>
                    <option value="なし">なし</option>
                  </select>
                ) : (
                  <input 
                    name={key}
                    type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} 
                    value={customerData[key]} 
                    onChange={handleInputChange} 
                    style={inputStyle} 
                    placeholder={`${config.label}を入力`}
                    required={config.required} 
                  />
                )}
              </div>

              {/* 🏆 お名前の直後に強制的に「ふりがな」を挿入 */}
              {key === 'name' && formConfig.furigana && (lineUser ? formConfig.furigana.line_enabled : formConfig.furigana.enabled) && (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                    {formConfig.furigana.label} {formConfig.furigana.required && <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                  <input 
                    name="furigana"
                    type="text" 
                    value={customerData.furigana} 
                    onChange={handleInputChange} 
                    style={inputStyle} 
                    placeholder={`${formConfig.furigana.label}を入力`}
                    required={formConfig.furigana.required} 
                  />
                </div>
              )}

              {/* 🏆 電話番号（phone）の直後に「郵便番号」を挿入するよう変更 */}
              {key === 'phone' && formConfig.zip_code && (lineUser ? formConfig.zip_code.line_enabled : formConfig.zip_code.enabled) && (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                    {formConfig.zip_code.label} {formConfig.zip_code.required && <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                  <input 
                    name="zip_code"
                    type="text" 
                    value={customerData.zip_code} 
                    onChange={handleInputChange} 
                    style={inputStyle} 
                    placeholder="例: 123-4567"
                    required={formConfig.zip_code.required} 
                  />
                </div>
              )}
            </React.Fragment>
          );
})}

        {/* 🆕 【新設】カスタム質問（ラジオボタン）の表示エリア */}
        {formConfig?.custom_questions?.map((q) => {
          const isEnabled = lineUser ? q.line_enabled : q.enabled;
          if (!isEnabled || isAdminEntry) return null; // 管理者ねじ込み時は表示しない

          return (
            <div key={q.id} style={{ marginBottom: '20px', padding: '15px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '12px', color: '#1e293b' }}>
                {q.label} {q.required && <span style={{ color: '#ef4444' }}>*</span>}
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {q.options.split(',').map((opt) => (
                  <label key={opt} style={{ 
                    flex: '1', minWidth: '100px', padding: '10px', borderRadius: '10px', border: '2px solid',
                    borderColor: customAnswers[q.id] === opt ? themeColor : '#e2e8f0',
                    background: customAnswers[q.id] === opt ? `${themeColor}05` : '#fff',
                    textAlign: 'center', cursor: 'pointer', fontSize: '0.9rem', transition: '0.2s'
                  }}>
                    <input 
                      type="radio" 
                      name={q.id} 
                      value={opt} 
                      checked={customAnswers[q.id] === opt}
                      onChange={(e) => setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })}
                      style={{ display: 'none' }} 
                    />
                    <span style={{ color: customAnswers[q.id] === opt ? themeColor : '#64748b', fontWeight: customAnswers[q.id] === opt ? 'bold' : 'normal' }}>
                      {opt}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}

        {/* --- 2. 備考欄を一番最後に固定 --- */}
                {!isAdminEntry && formConfig.notes && (lineUser ? formConfig.notes.line_enabled : formConfig.notes.enabled) && (
          <div style={{ marginTop: '10px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
              {formConfig.notes.label} {formConfig.notes.required && <span style={{ color: '#ef4444' }}>*</span>}
            </label>
            <textarea 
              name="notes" 
              value={customerData.notes} 
              onChange={handleInputChange} 
              style={{ ...inputStyle, minHeight: '100px', resize: 'none' }} 
              placeholder={`${formConfig.notes.label}があれば入力してください`}
              required={formConfig.notes.required} 
            />
          </div>
        )}

<button 
          onClick={handleReserve} 
          disabled={isSubmitting} 
          style={{ 
            marginTop: '20px', padding: '18px', 
            // 🆕 送信中は中央揃えにしてアイコンと文字を並べる
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            background: isSubmitting ? '#94a3b8' : (isAdminEntry ? '#e11d48' : themeColor), 
            color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1.1rem', 
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            boxShadow: `0 4px 12px ${themeColor}33`,
            width: '100%' // 幅を安定させる
          }}
        >
          {isSubmitting ? (
            <>
              {/* 🆕 styleに直接アニメーションを書いています。これでグルグル回ります */}
              <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
              <span>予約を確定しています...</span>
            </>
          ) : (
            isAdminEntry ? '🚀 ねじ込んで名簿登録' : '予約を確定する'
          )}
        </button>

        {/* 🆕 グルグル回すための専用のアニメーション命令（一度書けばOK） */}
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
              </div>
    </div>
  );
}

export default ConfirmReservation;