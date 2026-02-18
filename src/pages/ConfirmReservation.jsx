import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase, supabaseAnon } from '../supabaseClient';

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
    visitorAddress
  } = location.state || {};
  
const isAdminEntry = !!adminDate; 


  const [shop, setShop] = useState(null);

  

  // 🆕 一括管理用のStateに変更
const [customerData, setCustomerData] = useState({
    name: '', 
    furigana: '', 
    email: '', 
    phone: '', 
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
        console.log("🔍 スタッフデータ取得開始... staffId:", staffId);
        const { data, error } = await supabase
          .from('staffs')
          .select('name')
          .eq('id', staffId)
          .single();
          
        if (error) {
          console.error("❌ スタッフ取得エラー:", error.message);
          return;
        }

        if (data) {
          console.log("✅ スタッフ名取得成功:", data.name);
          setStaffName(data.name);
        }
      }
    } catch (err) {
      console.error("🔥 スタッフ取得通信エラー:", err);
    }
  };
  
  // 🆕 LINE連携チェック ＋ 店舗データ取得を一元化
  useEffect(() => {
// 1. LINEユーザー情報から顧客を特定する関数
    const checkLineCustomer = async () => {
      if (!lineUser?.userId) {
        // LINEアプリ内からのアクセス（未連携）で名前だけある場合
        if (lineUser?.displayName) {
          console.log("👤 LINE表示名をセット:", lineUser.displayName);
          setCustomerData(prev => ({ ...prev, name: lineUser.displayName }));
        }
        return;
      }

      // LINE連携済みの場合、まずLINEの表示名を「仮」でセットしておく（即時反映のため）
      if (lineUser.displayName) {
        setCustomerData(prev => ({ ...prev, name: lineUser.displayName }));
      }

      const { data: cust, error } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .eq('line_user_id', lineUser.userId)
        .maybeSingle();

      if (cust) {
        console.log("✅ 過去の顧客データを反映:", cust.name);
        // 過去データがある場合は、LINE名よりもDBの登録名を優先して上書き
setCustomerData(prev => ({
          ...prev,
          name: cust.name || lineUser.displayName || '',
          furigana: cust.furigana || '',
          phone: cust.phone || '',
          email: cust.email || '',
          // 🆕 今回入力した住所（visitorAddress）があればそれを使い、なければDBの住所を使う
          address: visitorAddress || cust.address || '', 
          company_name: cust.company_name || '',
          symptoms: cust.symptoms || '', 
          request_details: cust.request_details || ''
        }));
                setSelectedCustomerId(cust.id);
      }
    };
    
    // 2. 実行エリア
    checkLineCustomer();
    fetchShop();      // 🆕 これを呼ぶことで「読み込み中」が解除されます！
    fetchStaffName(); // 🆕 スタッフ名取得もここで行うのがスムーズです
  }, [lineUser, shopId]);

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

// 🆕 4. 保存ロジック（handleReserve）の修正
  const handleReserve = async () => {
    // 1. 動的なバリデーション（店主が「必須」とした項目をチェック）
    // 管理者ねじ込み時は「名前」のみチェックするように既存の挙動を維持
// 1. 動的なバリデーション（店主が「必須」とした項目をチェック）
    for (const [key, config] of Object.entries(formConfig)) {
      // 🆕 判定ロジック：LINE経由なら line_enabled、そうでなければ enabled を参照する
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
      let finalStaffId = staffId;
      let finalStaffName = staffName;

      if (!finalStaffId) {
        const { data: staffs } = await supabase.from('staffs').select('id, name').eq('shop_id', shopId);
        if (staffs && staffs.length === 1) {
          finalStaffId = staffs[0].id;
          finalStaffName = staffs[0].name;
        }
      }

      // --- 顧客の特定ロジック (customerDataを使用) ---
      let finalCustomerId = selectedCustomerId;
      let existingCust = null;

      if (!finalCustomerId) {
        let identifierFilter = `shop_id.eq.${shopId}`;
        const orConditions = [];
        if (lineUser?.userId) orConditions.push(`line_user_id.eq.${lineUser.userId}`);
        if (customerData.phone && customerData.phone !== '---') orConditions.push(`phone.eq.${customerData.phone}`);
        
        const { data: matchedByContact } = await supabase
          .from('customers')
          .select('id, total_visits')
          .or(orConditions.length > 0 ? orConditions.join(',') : `name.eq.${customerData.name}`)
          .eq('shop_id', shopId)
          .maybeSingle();

        if (matchedByContact) {
          finalCustomerId = matchedByContact.id;
          existingCust = matchedByContact;
        } else {
          const { data: matchedByName } = await supabase.from('customers').select('id, total_visits').eq('shop_id', shopId).eq('name', customerData.name).maybeSingle();
          if (matchedByName) {
            finalCustomerId = matchedByName.id;
            existingCust = matchedByName;
          }
        }
      } else {
        const { data } = await supabase.from('customers').select('id, total_visits').eq('id', finalCustomerId).single();
        existingCust = data;
      }

// ✅ 2. 名簿データの保存・更新
      const customerPayload = {
        shop_id: shopId,
        name: customerData.name,
        furigana: customerData.furigana || null,
        phone: customerData.phone || null,
        email: customerData.email || null,
        zip_code: visitorZip || null, // 🆕 郵便番号を名簿に保存
        address: customerData.address || null,
        company_name: customerData.company_name || null,
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

      // ✅ 3. 予約データの挿入
      const { error: dbError } = await supabase.from('reservations').insert([
        {
          shop_id: shopId,
          customer_id: finalCustomerId,
          staff_id: finalStaffId,
          reservation_date: targetDate, 
          customer_name: customerData.name,
          customer_phone: customerData.phone || '---',
          customer_email: customerData.email || 'admin@example.com',
          zip_code: visitorZip || null, // 🆕 予約データにも郵便番号を紐付け
          start_at: startDateTime.toISOString(),
          end_at: endDateTime.toISOString(),          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(), 
          total_slots: totalSlotsNeeded,
          res_type: 'normal',
          line_user_id: lineUser?.userId || null,
          cancel_token: cancelToken,
          menu_name: menuLabel,
          options: { 
            people: people,
            applied_shop_name: customShopName || shop.business_name,
            // 🆕 訪問特化データや備考をここに集約して保存
visit_info: {
              address: customerData.address,
              parking: customerData.parking,
              building_type: customerData.building_type,
              care_notes: customerData.care_notes,
              furigana: customerData.furigana,
              company_name: customerData.company_name,
              symptoms: customerData.symptoms,
              request_details: customerData.request_details,
              notes: customerData.notes,
              // 🆕 カスタム質問の回答をここに追加！
              custom_answers: customAnswers 
            }
                    }
        }
      ]);
      
      if (dbError) throw dbError;
      // ✅ 通知メール送信 (resend 関数を呼び出し)
// ✅ 通知メール・LINE送信 (仕分けロジック搭載のEdge Functionを呼び出し)
      if (!isAdminEntry) {
        await supabaseAnon.functions.invoke('resend', {
          body: {
            type: 'booking', 
            shopId,
            customerEmail: customerData.email,
            customerName: customerData.name,
            shopName: customShopName || shop.business_name,
            staffName: finalStaffName || '店舗スタッフ',
            shopEmail: shop.email_contact, 
            startTime: `${targetDate.replace(/-/g, '/')} ${targetTime}`,
            services: menuLabel, 
            cancelUrl, 
            lineUserId: lineUser?.userId || null,
            notifyLineEnabled: shop.notify_line_enabled,

            // 🆕 業種別カスタマイズ項目をすべて追加
            furigana: customerData.furigana,
            address: customerData.address,
            parking: customerData.parking,
            buildingType: customerData.building_type, // snake_caseをcamelCaseに変換して送信
            careNotes: customerData.care_notes,       // 同上
            companyName: customerData.company_name,   // 同上
            symptoms: customerData.symptoms,
            requestDetails: customerData.request_details, // 同上
            notes: customerData.notes
          }
        });
      }
      
      alert(isAdminEntry ? '爆速ねじ込み完了！' : '予約が完了しました！');
      if (isAdminEntry) {
        const targetPath = fromView === 'timeline' ? 'timeline' : 'reservations';
        navigate(`/admin/${shopId}/${targetPath}?date=${targetDate}`);
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
          
          // ⚠️ ふりがな と 備考欄 はこのループ内では直接描画しない（位置を固定するため）
          if (key === 'furigana' || key === 'notes') return null;

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
                ) : ['care_notes', 'symptoms', 'request_details'].includes(key) ? (
                  <textarea 
                    name={key} 
                    value={customerData[key]} 
                    onChange={handleInputChange} 
                    style={{ ...inputStyle, minHeight: '80px', resize: 'none' }} 
                    placeholder={`${config.label}を入力`}
                    required={config.required} 
                  />
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
                <div style={{ marginTop: '20px' }}>
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
            background: isSubmitting ? '#94a3b8' : (isAdminEntry ? '#e11d48' : themeColor), 
            color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer',
            boxShadow: `0 4px 12px ${themeColor}33`
          }}
        >
          {isSubmitting ? '処理中...' : (isAdminEntry ? '🚀 ねじ込んで名簿登録' : '予約を確定する')}
        </button>
      </div>
    </div>
  );
}

export default ConfirmReservation;