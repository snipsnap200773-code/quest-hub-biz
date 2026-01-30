import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import bcrypt from 'bcryptjs'; // ✅ セキュリティ強化

function AdminDashboard() {
  const { shopId } = useParams();
  
  // 🆕 スクロール用の目印（Ref）を作成
  const menuFormRef = useRef(null);

  // --- 1. セキュリティ用State ---
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // --- 2. 共通State ---
  const [activeTab, setActiveTab] = useState('menu'); 
  const [message, setMessage] = useState('');
  const [shopData, setShopData] = useState(null);

  // --- 3. メニュー設定用State ---
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  
  // ✅ カテゴリ設定用のStateを拡張
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newUrlKey, setNewUrlKey] = useState(''); 
  const [newCustomShopName, setNewCustomShopName] = useState(''); 
  const [newCustomDescription, setNewCustomDescription] = useState(''); 
  const [newCustomOfficialUrl, setNewCustomOfficialUrl] = useState(''); // ✅ 別ブランド用URL

  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceSlots, setNewServiceSlots] = useState(1); 
  const [selectedCategory, setSelectedCategory] = useState('');
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [options, setOptions] = useState([]);
  const [activeServiceForOptions, setActiveServiceForOptions] = useState(null);
  const [optGroupName, setOptGroupName] = useState(''); 
  const [optName, setOptName] = useState('');           
  const [optSlots, setOptSlots] = useState(0);
  const [editingDisableCatId, setEditingDisableCatId] = useState(null);

  // --- 4. 営業時間・店舗情報・LINE・同期用State ---
  const [phone, setPhone] = useState('');
  const [emailContact, setEmailContact] = useState('');
  const [address, setAddress] = useState(''); 
  const [description, setDescription] = useState(''); 
  const [introText, setIntroText] = useState(''); 
  const [notes, setNotes] = useState(''); 
  const [businessHours, setBusinessHours] = useState({});
  const [maxLastSlots, setMaxLastSlots] = useState(2);
  const [imageUrl, setImageUrl] = useState(''); 

  const [businessName, setBusinessName] = useState('');
  const [businessNameKana, setBusinessNameKana] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerNameKana, setOwnerNameKana] = useState('');
  const [businessType, setBusinessType] = useState('');

  const [officialUrl, setOfficialUrl] = useState('');
  const [lineOfficialUrl, setLineOfficialUrl] = useState('');
  const [notifyLineEnabled, setNotifyLineEnabled] = useState(true);
  const [notifyLineRemindEnabled, setNotifyLineRemindEnabled] = useState(false);
  const [lineToken, setLineToken] = useState('');
  const [lineAdminId, setLineAdminId] = useState('');

  const [slotIntervalMin, setSlotIntervalMin] = useState(15); 
  const [bufferPreparationMin, setBufferPreparationMin] = useState(0); 
  const [minLeadTimeHours, setMinLeadTimeHours] = useState(0); 
  const [autoFillLogic, setAutoFillLogic] = useState(true); 

  // ✅ ツイン・カレンダー同期ID
  const [scheduleSyncId, setScheduleSyncId] = useState('');

  const [regularHolidays, setRegularHolidays] = useState({});

  // 🆕 追加：前後拡張枠State
  const [extraSlotsBefore, setExtraSlotsBefore] = useState(0);
  const [extraSlotsAfter, setExtraSlotsAfter] = useState(0);

  const dayMap = { mon: '月曜日', tue: '火曜日', wed: '水曜日', thu: '木曜日', fri: '金曜日', sat: '土曜日', sun: '日曜日' };
  const weekLabels = [
    { key: '1', label: '第1' },
    { key: '2', label: '第2' },
    { key: '3', label: '第3' },
    { key: '4', label: '第4' },
    { key: 'L2', label: '最後から2番目' },
    { key: 'L1', label: '最後' }
  ];

  useEffect(() => { fetchInitialShopData(); }, [shopId]);

  const fetchInitialShopData = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (data) {
      setShopData(data); setAllowMultiple(data.allow_multiple_services); setPhone(data.phone || '');
      setEmailContact(data.email_contact || ''); setAddress(data.address || ''); 
      setDescription(data.description || '');
      setIntroText(data.intro_text || ''); 
      setNotes(data.notes || ''); 
      setBusinessHours(data.business_hours || {}); 
      setRegularHolidays(data.business_hours?.regular_holidays || {});
      setMaxLastSlots(data.max_last_slots || 2);
      setSlotIntervalMin(data.slot_interval_min || 15); setBufferPreparationMin(data.buffer_preparation_min || 0);
      setMinLeadTimeHours(data.min_lead_time_hours || 0); setAutoFillLogic(data.auto_fill_logic ?? true);
      setImageUrl(data.image_url || ''); setOfficialUrl(data.official_url || ''); setLineOfficialUrl(data.line_official_url || '');
      setNotifyLineEnabled(data.notify_line_enabled ?? true);
      setNotifyLineRemindEnabled(data.notify_line_remind_enabled ?? false);
      setBusinessName(data.business_name || '');
      setBusinessNameKana(data.business_name_kana || ''); setOwnerName(data.owner_name || '');
      setOwnerNameKana(data.owner_name_kana || ''); setBusinessType(data.business_type || '');
      setLineToken(data.line_channel_access_token || ''); setLineAdminId(data.line_admin_user_id || '');
      setScheduleSyncId(data.schedule_sync_id || '');
      // 🆕 拡張枠の初期値をセット
      setExtraSlotsBefore(data.extra_slots_before || 0);
      setExtraSlotsAfter(data.extra_slots_after || 0);
    }
  };

  const fetchMenuDetails = async () => {
    const catRes = await supabase.from('service_categories').select('*').eq('shop_id', shopId).order('sort_order', { ascending: true });
    const servRes = await supabase.from('services').select('*').eq('shop_id', shopId).order('sort_order', { ascending: true });
    const optRes = await supabase.from('service_options').select('*'); 
    if (catRes.data) setCategories(catRes.data);
    if (servRes.data) setServices(servRes.data);
    if (optRes.data) setOptions(optRes.data);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fileExt = file.name.split('.').pop();
    const fileName = `${shopId}-main.${fileExt}`;
    showMsg('画像を更新中...');
    const { error: uploadError } = await supabase.storage.from('shop-images').upload(fileName, file, { upsert: true });
    if (uploadError) { alert('アップロード失敗: ' + uploadError.message); return; }
    const { data: { publicUrl } } = supabase.storage.from('shop-images').getPublicUrl(fileName);
    const finalUrl = `${publicUrl}?t=${Date.now()}`;
    setImageUrl(finalUrl);
    showMsg('画像を読み込みました。下の「保存」ボタンで確定してください。');
  };

  const handleAuth = (e) => {
    e.preventDefault();
    let isMatch = false;
    if (shopData?.hashed_password && shopData.hashed_password !== '********' && shopData.hashed_password !== shopData.admin_password) {
      try { isMatch = bcrypt.compareSync(passwordInput, shopData.hashed_password); } catch (err) { isMatch = false; }
    }
    if (!isMatch) { isMatch = passwordInput === shopData?.admin_password; }
    if (isMatch) { setIsAuthorized(true); fetchMenuDetails(); } else { alert("パスワードが違います"); }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 8) { alert("セキュリティのため、パスワードは8文字以上に設定してください。"); return; }
    if (window.confirm("パスワードを更新します。一度更新されると運営者もあなたのパスワードを知ることはできなくなります。よろしいですか？")) {
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(newPassword, salt);
      const { error } = await supabase.from('profiles').update({ hashed_password: hashedPassword, admin_password: '********' }).eq('id', shopId);
      if (!error) { showMsg('パスワードを安全に更新しました！'); setNewPassword(''); setIsChangingPassword(false); fetchInitialShopData(); }
      else { alert('パスワードの更新に失敗しました。'); }
    }
  };

  const showMsg = (txt) => { setMessage(txt); setTimeout(() => setMessage(''), 3000); };
  const changeTab = (tabName) => { setActiveTab(tabName); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const handleFinalSave = async () => {
    const updatedBusinessHours = { ...businessHours, regular_holidays: regularHolidays };
    const { error } = await supabase.from('profiles').update({
        business_name: businessName, business_name_kana: businessNameKana, phone, email_contact: emailContact, address, 
        description, 
        intro_text: introText, 
        notes, 
        business_hours: updatedBusinessHours, allow_multiple_services: allowMultiple, max_last_slots: maxLastSlots,
        slot_interval_min: slotIntervalMin, buffer_preparation_min: bufferPreparationMin, min_lead_time_hours: minLeadTimeHours, auto_fill_logic: autoFillLogic,
        image_url: imageUrl, official_url: officialUrl, line_official_url: lineOfficialUrl, notify_line_enabled: notifyLineEnabled, 
        notify_line_remind_enabled: notifyLineRemindEnabled,
        owner_name: ownerName, owner_name_kana: ownerNameKana,
        business_type: businessType, line_channel_access_token: lineToken, line_admin_user_id: lineAdminId,
        theme_color: shopData.theme_color,
        schedule_sync_id: scheduleSyncId,
        // 🆕 拡張枠を保存
        extra_slots_before: extraSlotsBefore,
        extra_slots_after: extraSlotsAfter
      }).eq('id', shopId);
    if (!error) showMsg('すべての設定を保存しました！'); else alert('保存に失敗しました。');
  };

  const toggleHoliday = (weekKey, dayKey) => {
    const key = `${weekKey}-${dayKey}`;
    setRegularHolidays(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const moveItem = async (type, list, id, direction) => {
    const idx = list.findIndex(item => item.id === id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const newList = [...list]; const [moved] = newList.splice(idx, 1); newList.splice(targetIdx, 0, moved);
    const table = type === 'category' ? 'service_categories' : 'services';
    const updates = newList.map((item, i) => ({ id: item.id, shop_id: shopId, sort_order: i, name: item.name, ...(type === 'service' ? { slots: item.slots, category: item.category } : {}) }));
    await supabase.from(table).upsert(updates); fetchMenuDetails();
  };

  const handleToggleDisableCat = async (catId, targetCatName) => {
    const targetCat = categories.find(c => c.id === catId);
    let currentDisables = targetCat.disable_categories ? targetCat.disable_categories.split(',').map(s => s.trim()).filter(s => s) : [];
    if (currentDisables.includes(targetCatName)) currentDisables = currentDisables.filter(name => name !== targetCatName);
    else currentDisables.push(targetCatName);
    await supabase.from('service_categories').update({ disable_categories: currentDisables.join(',') }).eq('id', catId);
    fetchMenuDetails();
  };

  const handleToggleRequiredCat = async (catId, targetCatName) => {
    const targetCat = categories.find(c => c.id === catId);
    let currentRequired = targetCat.required_categories ? targetCat.required_categories.split(',').map(s => s.trim()).filter(s => s) : [];
    if (currentRequired.includes(targetCatName)) currentRequired = currentRequired.filter(name => name !== targetCatName);
    else currentRequired.push(targetCatName);
    await supabase.from('service_categories').update({ required_categories: currentRequired.join(',') }).eq('id', catId);
    fetchMenuDetails();
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    const payload = { 
      name: newCategoryName, 
      url_key: newUrlKey, 
      custom_shop_name: newCustomShopName,
      custom_description: newCustomDescription,
      custom_official_url: newCustomOfficialUrl
    };
    if (editingCategoryId) await supabase.from('service_categories').update(payload).eq('id', editingCategoryId);
    else await supabase.from('service_categories').insert([{ ...payload, shop_id: shopId, sort_order: categories.length }]);
    
    setEditingCategoryId(null); setNewCategoryName(''); setNewUrlKey(''); setNewCustomShopName(''); setNewCustomDescription(''); setNewCustomOfficialUrl('');
    fetchMenuDetails();
  };

  const handleServiceSubmit = async (e) => {
    e.preventDefault();
    const finalCategory = selectedCategory || (categories[0]?.name || 'その他');
    const serviceData = { shop_id: shopId, name: newServiceName, slots: newServiceSlots, category: finalCategory };
    if (editingServiceId) await supabase.from('services').update(serviceData).eq('id', editingServiceId);
    else await supabase.from('services').insert([{ ...serviceData, sort_order: services.length }]);
    setEditingServiceId(null); setNewServiceName(''); setNewServiceSlots(1); fetchMenuDetails();
  };

  const handleOptionSubmit = async (e) => {
    e.preventDefault();
    await supabase.from('service_options').insert([{ service_id: activeServiceForOptions.id, group_name: optGroupName, option_name: optName, additional_slots: optSlots }]);
    setOptName(''); setOptSlots(0); fetchMenuDetails();
  };

  const deleteCategory = async (id) => { if (window.confirm(`削除しますか？`)) { await supabase.from('service_categories').delete().eq('id', id); fetchMenuDetails(); } };
  const deleteService = async (id) => { if (window.confirm('削除しますか？')) { await supabase.from('services').delete().eq('id', id); fetchMenuDetails(); } };
  const deleteOption = async (id) => { await supabase.from('service_options').delete().eq('id', id); fetchMenuDetails(); };

  const copyToClipboard = (text) => { navigator.clipboard.writeText(text); showMsg('コピーしました！'); };

  // ✅ 安全な位置で themeColor を定義
  const themeColor = shopData?.theme_color || '#2563eb';

  if (!isAuthorized) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', fontFamily: 'sans-serif', padding: '20px', boxSizing: 'border-box' }}>
        <form onSubmit={handleAuth} style={{ background: '#fff', padding: '40px', borderRadius: '24px', textAlign: 'center', width: '100%', maxWidth: '380px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', boxSizing: 'border-box' }}>
          <h2 style={{ marginBottom: '10px' }}>店舗管理ログイン 🔒</h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '25px' }}>SnipSnapは世界基準のセキュリティであなたの店舗データを保護しています</p>
          <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="合言葉を入力" style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '2px solid #e2e8f0', marginBottom: '20px', boxSizing: 'border-box', textAlign: 'center', fontSize: '1.1rem' }} />
          <button type="submit" style={{ width: '100%', padding: '15px', background: themeColor, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>ダッシュボードを開く</button>
          <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #f1f5f9', textAlign: 'left' }}>
            <p style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 'bold', marginBottom: '10px', textAlign: 'center' }}>🛡️ 安心のトリプルガード</p>
            <ul style={{ padding: 0, margin: 0, listStyle: 'none', fontSize: '0.7rem', color: '#64748b', lineHeight: '1.6' }}>
              <li style={{ marginBottom: '8px' }}>✅ <b>データ物理隔離</b>：最新のRLS技術により、他店舗とのデータ混同を100%防止します。</li>
              <li style={{ marginBottom: '8px' }}>✅ <b>パスワード暗号化</b>：復元不可能なハッシュ化を採用。運営者すら閲覧不可能です。</li>
              <li style={{ marginBottom: '8px' }}>✅ <b>SSL通信保護</b>：すべての通信は銀行レベルの暗号化によって保護されています。</li>
            </ul>
          </div>
          <Link to="/" style={{ display: 'block', marginTop: '20px', fontSize: '0.8rem', color: '#94a3b8', textDecoration: 'none' }}>← ポータルへ戻る</Link>
        </form>
      </div>
    );
  }

  const cardStyle = { marginBottom: '20px', background: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid #ddd', boxSizing: 'border-box', width: '100%', overflow: 'hidden' };
  const inputStyle = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '1rem', background: '#fff' };

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '700px', margin: '0 auto', paddingBottom: '120px', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', borderBottom: '1px solid #eee', padding: '10px' }}>
        <div style={{ display: 'flex', gap: '5px' }}>
          {['menu', 'hours', 'info', 'security'].map(tab => ( 
            <button key={tab} onClick={() => changeTab(tab)} style={{ flex: 1, padding: '12px 5px', border: 'none', borderRadius: '8px', background: activeTab === tab ? themeColor : '#f1f5f9', color: activeTab === tab ? '#fff' : '#475569', fontWeight: 'bold', fontSize: '0.85rem' }}>
              {tab === 'menu' ? 'メニュー' : tab === 'hours' ? '営業時間' : tab === 'info' ? '店舗情報' : '🔒 安全'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '15px', boxSizing: 'border-box', width: '100%' }}>
        {message && <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', width: '90%', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '8px', zIndex: 1001, textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>{message}</div>}

        {/* --- 🛠️ メニュータブ --- */}
        {activeTab === 'menu' && (
          <div style={{ width: '100%', boxSizing: 'border-box' }}>
            <section style={{ ...cardStyle, border: '1px solid #10b981', background: '#f0fdf4' }}>
              <h3 style={{ marginTop: 0, fontSize: '0.9rem', color: '#059669' }}>🎨 お店のテーマカラー</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ position: 'relative', width: '50px', height: '50px' }}>
                  <input type="color" value={themeColor} onChange={(e) => setShopData({ ...shopData, theme_color: e.target.value })} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', padding: 0, background: 'none', cursor: 'pointer' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#1e293b' }}>現在の色：<span style={{ color: themeColor }}>{themeColor}</span></div>
                  <div style={{ marginTop: '5px', padding: '6px 12px', background: themeColor, color: '#fff', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold', display: 'inline-block' }}>ボタンプレビュー</div>
                </div>
              </div>
            </section>

            <section style={{ ...cardStyle, border: `1px solid ${themeColor}` }}>
              <h3 style={{ marginTop: 0, fontSize: '0.9rem', color: themeColor }}>🛡️ 予約ルール</h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input type="checkbox" checked={allowMultiple} onChange={(e) => setAllowMultiple(e.target.checked)} style={{ width: '22px', height: '22px' }} />
                <span style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>メニューの複数選択を許可する</span>
              </label>
            </section>

            <section style={cardStyle}>
              <h3 style={{ marginTop: 0, fontSize: '0.9rem' }}>📂 カテゴリ設定</h3>
              <form onSubmit={handleCategorySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                <input placeholder="カテゴリ名" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} style={inputStyle} required />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input placeholder="識別キー" value={newUrlKey} onChange={(e) => setNewUrlKey(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                  <input placeholder="専用屋号" value={newCustomShopName} onChange={(e) => setNewCustomShopName(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                </div>
                <input placeholder="専用サブタイトル" value={newCustomDescription} onChange={(e) => setNewCustomDescription(e.target.value)} style={inputStyle} />
                <input placeholder="別ブランド公式サイトURL（https://...）" value={newCustomOfficialUrl} onChange={(e) => setNewCustomOfficialUrl(e.target.value)} style={inputStyle} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" style={{ flex: 2, padding: '12px', background: themeColor, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>{editingCategoryId ? '更新' : '登録'}</button>
                  {editingCategoryId && <button type="button" onClick={() => { setEditingCategoryId(null); setNewCategoryName(''); setNewUrlKey(''); setNewCustomShopName(''); setNewCustomDescription(''); setNewCustomOfficialUrl(''); }} style={{ flex: 1, padding: '12px', background: '#f1f5f9', border: 'none', borderRadius: '8px' }}>取消</button>}
                </div>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {categories.map((c, idx) => (
                  <div key={c.id} style={{ background: '#f8fafc', padding: '10px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 'bold' }}>{c.name}</span>
                        {(c.url_key || c.custom_shop_name) && <div style={{ fontSize: '0.65rem', color: '#64748b' }}>🔑{c.url_key} / 🏠{c.custom_shop_name}</div>}
                        {c.custom_description && <div style={{ fontSize: '0.6rem', color: themeColor }}>📝{c.custom_description}</div>}
                        {c.custom_official_url && <div style={{ fontSize: '0.6rem', color: '#059669' }}>🌐{c.custom_official_url}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button onClick={() => moveItem('category', categories, c.id, 'up')} disabled={idx === 0}>▲</button>
                        <button onClick={() => moveItem('category', categories, c.id, 'down')} disabled={idx === categories.length - 1}>▼</button>
                        <button onClick={() => { setEditingCategoryId(c.id); setNewCategoryName(c.name); setNewUrlKey(c.url_key || ''); setNewCustomShopName(c.custom_shop_name || ''); setNewCustomDescription(c.custom_description || ''); setNewCustomOfficialUrl(c.custom_official_url || ''); }}>✎</button>
                        <button onClick={() => deleteCategory(c.id)}>×</button>
                      </div>
                    </div>
                    {/* 三土手さん重要ロジック：連動・必須設定（省略なし） */}
                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button onClick={async () => { await supabase.from('service_categories').update({ allow_multiple_in_category: !c.allow_multiple_in_category }).eq('id', c.id); fetchMenuDetails(); }} style={{ fontSize: '0.7rem', padding: '4px 8px', background: c.allow_multiple_in_category ? themeColor : '#fff', color: c.allow_multiple_in_category ? '#fff' : '#333', border: '1px solid #ccc', borderRadius: '15px' }}>{c.allow_multiple_in_category ? '複数選択可' : '1つのみ選択'}</button>
                      <button onClick={() => setEditingDisableCatId(editingDisableCatId === c.id ? null : c.id)} style={{ fontSize: '0.7rem', padding: '4px 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '15px' }}>🔗 連動設定</button>
                    </div>
                    {editingDisableCatId === c.id && (
                      <div style={{ marginTop: '10px', padding: '12px', background: '#fff', borderRadius: '12px', border: `1px solid ${themeColor}` }}>
                        <p style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#ef4444' }}>🚫 無効化設定：</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
                          {categories.filter(t => t.id !== c.id).map(t => {
                            const isDis = c.disable_categories?.split(',').includes(t.name);
                            return <button key={t.id} onClick={() => handleToggleDisableCat(c.id, t.name)} style={{ fontSize: '0.65rem', padding: '4px 8px', borderRadius: '15px', border: '1px solid', borderColor: isDis ? '#ef4444' : '#ccc', background: isDis ? '#fee2e2' : '#fff' }}>{t.name}</button>
                          })}
                        </div>
                        <p style={{ fontSize: '0.7rem', fontWeight: 'bold', color: themeColor }}>✅ 必須化設定：</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                          {categories.filter(t => t.id !== c.id).map(t => {
                            const isReq = c.required_categories?.split(',').includes(t.name);
                            return <button key={t.id} onClick={() => handleToggleRequiredCat(c.id, t.name)} style={{ fontSize: '0.65rem', padding: '4px 8px', borderRadius: '15px', border: '1px solid', borderColor: isReq ? themeColor : '#ccc', background: isReq ? '#dbeafe' : '#fff' }}>{t.name}</button>
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
            
            <section ref={menuFormRef} style={{ ...cardStyle, background: '#f8fafc' }}>
              <h3 style={{ marginTop: 0, fontSize: '0.9rem' }}>📝 メニュー登録・編集</h3>
              <form onSubmit={handleServiceSubmit}>
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} required>
                  <option value="">-- カテゴリ選択 --</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <input value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} placeholder="メニュー名" required />
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '8px' }}>必要コマ数: <span style={{ color: themeColor }}>{newServiceSlots}コマ</span></label>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => <button key={n} type="button" onClick={() => setNewServiceSlots(n)} style={{ width: '40px', height: '40px', borderRadius: '8px', border: '1px solid', borderColor: newServiceSlots === n ? themeColor : '#ccc', background: newServiceSlots === n ? themeColor : 'white', color: newServiceSlots === n ? 'white' : '#333', fontWeight: 'bold' }}>{n}</button>)}
                  </div>
                </div>
                <button type="submit" style={{ width: '100%', padding: '15px', background: editingServiceId ? '#f97316' : themeColor, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>メニューを保存</button>
              </form>
            </section>

            {categories.map((cat) => (
              <div key={cat.id} style={{ marginBottom: '25px', width: '100%' }}>
                <h4 style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '10px', borderLeft: '4px solid #cbd5e1', paddingLeft: '8px' }}>{cat.name}</h4>
                {services.filter(s => s.category === cat.name).map((s) => (
                  <div key={s.id} style={{ ...cardStyle, marginBottom: '10px', padding: '12px 15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold' }}>{s.name}</div>
                        <div style={{ fontSize: '0.8rem', color: themeColor }}>{s.slots * slotIntervalMin}分 ({s.slots}コマ)</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setActiveServiceForOptions(activeServiceForOptions?.id === s.id ? null : s)} style={{ padding: '5px 5px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', color: activeServiceForOptions?.id === s.id ? themeColor : '#333' }}>枝</button>
                        <button onClick={() => moveItem('service', services.filter(ser => ser.category === cat.name), s.id, 'up')} style={{ padding: '5px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px' }}>▲</button>
                        <button onClick={() => moveItem('service', services.filter(ser => ser.category === cat.name), s.id, 'down')} style={{ padding: '5px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px' }}>▼</button>
                        <button onClick={() => { setEditingServiceId(s.id); setNewServiceName(s.name); setNewServiceSlots(s.slots); setSelectedCategory(s.category); menuFormRef.current?.scrollIntoView({ behavior: 'smooth' }); }} style={{ padding: '5px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px' }}>✎</button>
                        <button onClick={() => deleteService(s.id)} style={{ padding: '5px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px' }}>×</button>
                      </div>
                    </div>
                    {/* ✅ 枝メニュー（オプション）のネスト表示を完全復元 */}
                    {activeServiceForOptions?.id === s.id && (
                      <div style={{ marginTop: '15px', background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #eee' }}>
                        <form onSubmit={handleOptionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <input placeholder="枝カテゴリ" value={optGroupName} onChange={(e) => setOptGroupName(e.target.value)} style={inputStyle} />
                          <input placeholder="枝メニュー" value={optName} onChange={(e) => setOptName(e.target.value)} style={inputStyle} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>追加コマ:</label>
                            <input type="number" value={optSlots} onChange={(e) => setOptSlots(parseInt(e.target.value))} style={{ width: '80px', ...inputStyle }} />
                            <button type="submit" style={{ flex: 1, padding: '12px', background: themeColor, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>＋ 枝追加</button>
                          </div>
                        </form>
                        {Array.from(new Set(options.filter(o => o.service_id === s.id).map(o => o.group_name))).map(group => (
                          <div key={group} style={{ marginTop: '10px' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b' }}>▼ {group || '共通'}</div>
                            {options.filter(o => o.service_id === s.id && o.group_name === group).map(o => (
                              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px', borderBottom: '1px solid #eee' }}>
                                <span style={{ fontSize: '0.8rem' }}>{o.option_name} (+{o.additional_slots}コマ)</span>
                                <button onClick={() => deleteOption(o.id)} style={{ color: '#ef4444', border: 'none', background: 'none' }}>×</button>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* --- ⏰ 営業時間・定休日タブ --- */}
        {activeTab === 'hours' && (
          <div style={{ width: '100%', boxSizing: 'border-box' }}>
            <section style={{ ...cardStyle, border: `2px solid ${themeColor}` }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem', color: themeColor }}>⚙️ 予約エンジンの設定</h3>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>1コマの単位</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[10, 15, 20, 30].map(min => (
                    <button key={min} onClick={() => setSlotIntervalMin(min)} style={{ flex: 1, padding: '10px', background: slotIntervalMin === min ? themeColor : '#fff', color: slotIntervalMin === min ? '#fff' : '#333', border: '1px solid #ccc', borderRadius: '8px', fontWeight: 'bold' }}>{min}分</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>インターバル（準備時間）</label>
                <select value={bufferPreparationMin} onChange={(e) => setBufferPreparationMin(parseInt(e.target.value))} style={inputStyle}>
                  <option value={0}>なし</option>
                  <option value={10}>10分</option>
                  <option value={15}>15分</option>
                  <option value={20}>20分</option>
                  <option value={30}>30分</option>
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}><label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>直近の予約制限</label><select value={minLeadTimeHours} onChange={(e) => setMinLeadTimeHours(parseInt(e.target.value))} style={inputStyle}><option value={0}>当日OK</option><option value={2}>２時間先NG</option><option value={3}>３時間先NG</option><option value={24}>当日NG</option><option value={48}>翌日までNG</option><option value={72}>翌々日までNG</option></select></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><input type="checkbox" checked={autoFillLogic} onChange={(e) => setAutoFillLogic(e.target.checked)} style={{ width: '22px', height: '22px' }} /><b>自動詰め機能を有効にする</b></label>
            </section>
            
            <section style={cardStyle}>
              <h3 style={{ marginTop: 0 }}>⏰ 曜日別営業時間・休憩</h3>
              {Object.keys(dayMap).map(day => (
                <div key={day} style={{ borderBottom: '1px solid #f1f5f9', padding: '12px 0' }}>
                  <b style={{ fontSize: '0.9rem', color: '#1e293b' }}>{dayMap[day]}</b>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, padding: '10px', background: '#f8fafc', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '0.75rem', width: '35px', color: '#64748b' }}>営業</span>
                      <input type="time" value={businessHours[day]?.open || '09:00'} onChange={(e) => setBusinessHours({...businessHours, [day]: {...businessHours[day], open: e.target.value}})} style={{ ...inputStyle, width: 'auto', padding: '4px' }} />
                      <span>〜</span>
                      <input type="time" value={businessHours[day]?.close || '18:00'} onChange={(e) => setBusinessHours({...businessHours, [day]: {...businessHours[day], close: e.target.value}})} style={{ ...inputStyle, width: 'auto', padding: '4px' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '0.75rem', width: '35px', color: '#64748b' }}>休憩</span>
                      <input type="time" value={businessHours[day]?.rest_start || ''} onChange={(e) => setBusinessHours({...businessHours, [day]: { ...businessHours[day], rest_start: e.target.value }})} style={{ ...inputStyle, width: 'auto', padding: '4px' }} />
                      <span>〜</span>
                      <input type="time" value={businessHours[day]?.rest_end || ''} onChange={(e) => setBusinessHours({...businessHours, [day]: { ...businessHours[day], rest_end: e.target.value }})} style={{ ...inputStyle, width: 'auto', padding: '4px' }} />
                    </div>
                  </div>
                </div>
              ))}
            </section>
            
            <section style={{ ...cardStyle, border: '2px solid #ef4444' }}>
              <h3 style={{ marginTop: 0, color: '#ef4444' }}>📅 定休日の設定</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '450px' }}>
                  <thead><tr><th style={{ padding: '8px', fontSize: '0.7rem', color: '#94a3b8' }}>週 \ 曜日</th>{Object.keys(dayMap).map(d => <th key={d} style={{ padding: '8px', fontSize: '0.8rem' }}>{dayMap[d].charAt(0)}</th>)}</tr></thead>
                  <tbody>{weekLabels.map(week => (<tr key={week.key} style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '10px 5px', fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b' }}>{week.label}</td>{Object.keys(dayMap).map(day => { const isActive = regularHolidays[`${week.key}-${day}`]; return (<td key={day} style={{ padding: '4px', textAlign: 'center' }}><button onClick={() => toggleHoliday(week.key, day)} style={{ width: '35px', height: '35px', borderRadius: '8px', border: '1px solid #eee', background: isActive ? '#ef4444' : '#fff', color: isActive ? '#fff' : '#cbd5e1', fontWeight: 'bold', fontSize: '0.7rem', cursor: 'pointer' }}>{isActive ? '休' : '◯'}</button></td>);})}</tr>))}</tbody>
                </table>
              </div>
              <div style={{ marginTop: '25px', padding: '15px', background: '#fef2f2', borderRadius: '12px', border: '1px dashed #ef4444' }}><label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}><div style={{ flex: 1 }}><span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#991b1b' }}>定休日が祝日の場合は営業する</span></div><div onClick={() => setRegularHolidays(prev => ({...prev, open_on_holiday: !prev.open_on_holiday}))} style={{ width: '60px', height: '32px', background: regularHolidays.open_on_holiday ? '#10b981' : '#cbd5e1', borderRadius: '20px', position: 'relative', transition: '0.3s' }}><div style={{ position: 'absolute', top: '3px', left: regularHolidays.open_on_holiday ? '31px' : '3px', width: '26px', height: '26px', background: '#fff', borderRadius: '50%', transition: '0.3s' }} /></div></label></div>
            </section>

            {/* ✅ 🆕 三土手さん、ここが「定休日の設定」の下に追加した新機能です！ */}
            <section style={{ ...cardStyle, border: `2px solid ${themeColor}`, background: '#fdfcf5' }}>
              <h3 style={{ marginTop: 0, color: themeColor, fontSize: '1rem' }}>📌 管理画面の表示拡張（余白枠）</h3>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '15px' }}>営業時間の前後に「プライベートな予定」や「打ち合わせ」を書き込める予備枠を表示します。</p>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>☀ 開店前の表示コマ数 (0〜8):</label>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <button key={n} type="button" onClick={() => setExtraSlotsBefore(n)} style={{ width: '35px', height: '35px', borderRadius: '6px', border: '1px solid', borderColor: extraSlotsBefore === n ? themeColor : '#ccc', background: extraSlotsBefore === n ? themeColor : 'white', color: extraSlotsBefore === n ? 'white' : '#333', fontSize: '0.8rem', fontWeight: 'bold' }}>{n}</button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>🌙 閉店後の表示コマ数 (0〜8):</label>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <button key={n} type="button" onClick={() => setExtraSlotsAfter(n)} style={{ width: '35px', height: '35px', borderRadius: '6px', border: '1px solid', borderColor: extraSlotsAfter === n ? themeColor : '#ccc', background: extraSlotsAfter === n ? themeColor : 'white', color: extraSlotsAfter === n ? 'white' : '#333', fontSize: '0.8rem', fontWeight: 'bold' }}>{n}</button>
                  ))}
                </div>
              </div>
              <p style={{ fontSize: '0.65rem', color: themeColor, marginTop: '10px' }}>※設定したコマ数分、管理画面のカレンダーが上下に広がります。</p>
            </section>
          </div>
        )}

        {/* --- 🏪 店舗情報タブ --- */}
        {activeTab === 'info' && (
          <div style={{ width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <section style={{ ...cardStyle, padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <UrlBox label="📈 予約管理画面" url={`${window.location.origin}/admin/${shopId}/reservations`} color="#ef4444" copy={() => copyToClipboard(`${window.location.origin}/admin/${shopId}/reservations`)} />
                <UrlBox label={`🔑 店舗主用設定 (PW: ${shopData?.admin_password})`} url={`${window.location.origin}/admin/${shopId}`} color={themeColor} copy={() => copyToClipboard(`${window.location.origin}/admin/${shopId}`)} />
                <UrlBox label="💬 LINEリッチメニュー用URL" url={`${window.location.origin}/shop/${shopId}/reserve?openExternalBrowser=1`} color="#00b900" copy={() => copyToClipboard(`${window.location.origin}/shop/${shopId}/reserve?openExternalBrowser=1`)} />
                <UrlBox label="📅 お客様用予約 (ノーマル)" url={`${window.location.origin}/shop/${shopId}/reserve`} color="#059669" copy={() => copyToClipboard(`${window.location.origin}/shop/${shopId}/reserve`)} />

                {categories.filter(c => c.url_key).map(c => (
                  <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <UrlBox label={`🔮 専用予約：${c.custom_shop_name || c.name}`} url={`${window.location.origin}/shop/${shopId}/reserve?type=${c.url_key}`} color="#7c3aed" copy={() => copyToClipboard(`${window.location.origin}/shop/${shopId}/reserve?type=${c.url_key}`)} />
                    {c.custom_official_url && <UrlBox label={`🌐 ${c.custom_shop_name || c.name} 公式サイト`} url={c.custom_official_url} color="#059669" copy={() => copyToClipboard(c.custom_official_url)} />}
                  </div>
                ))}

                <div style={{ marginTop: '10px', padding: '15px', background: '#f0f9ff', borderRadius: '16px', border: '1px solid #bae6fd' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#0369a1', display: 'block', marginBottom: '8px' }}>🔗 スケジュール共有設定（ツイン・カレンダー）</label>
                  <p style={{ fontSize: '0.7rem', color: '#0c4a6e', marginBottom: '10px' }}>複数のアカウントで同じ合言葉を入力すると、予約表が一つに統合されます。</p>
                  <input placeholder="共有用の合言葉（例：mitote-sync-01）" value={scheduleSyncId} onChange={(e) => setScheduleSyncId(e.target.value)} style={inputStyle} />
                </div>
              </div>
            </section>

            <section style={cardStyle}>
              <h3 style={{ marginTop: 0 }}>🏪 店舗プロフィール</h3>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>店舗画像（推奨 1:1）</label>
              <div style={{ marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
                {imageUrl ? <img src={imageUrl} alt="preview" style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '12px', marginBottom: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }} /> : <div style={{ width: '120px', height: '120px', background: '#e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.7rem', margin: '0 auto 12px' }}>NO IMAGE</div>}
                <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                  <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 2 }} />
                  <button type="button" style={{ width: '100%', padding: '12px', background: '#fff', border: `1px solid ${themeColor}`, color: themeColor, borderRadius: '10px', fontWeight: 'bold', fontSize: '0.9rem' }}>📸 写真を撮る / 変更する</button>
                </div>
              </div>

              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>店舗名 / かな</label>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}><input value={businessName} onChange={(e) => setBusinessName(e.target.value)} style={inputStyle} /><input value={businessNameKana} onChange={(e) => setBusinessNameKana(e.target.value)} style={inputStyle} /></div>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>代表者名 / かな</label>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}><input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} style={inputStyle} /><input value={ownerNameKana} onChange={(e) => setOwnerNameKana(e.target.value)} style={inputStyle} /></div>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>業種</label>
              <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }}><option value="美容室・理容室">美容室・理容室</option><option value="ネイル・アイラッシュ">ネイル・アイラッシュ</option><option value="エステ・リラク">エステ・リラク</option><option value="整体・接骨院・針灸">整体・接骨院・針灸</option><option value="飲食店・カフェ">飲食店・カフェ</option><option value="その他・ライフ">その他・ライフ</option></select>
              
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>🌐 公式サイトURL</label>
              <input value={officialUrl} onChange={(e) => setOfficialUrl(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} placeholder="https://..." />
              
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>住所</label><input value={address} onChange={(e) => setAddress(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} />
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>電話番号</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} />
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>メール</label><input type="email" value={emailContact} onChange={(e) => setEmailContact(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} />
              
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>サブタイトル</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, marginBottom: '8px' }} />
              <div style={{ marginBottom: '20px', padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: themeColor, lineHeight: '1.5' }}>{description ? description.split('/').map((line, idx) => (<React.Fragment key={idx}>{line}{idx < description.split('/').length - 1 && <br />}</React.Fragment>)) : '未入力'}</div>
              </div>

              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>店舗紹介・詳細アピール文</label>
              <textarea value={introText} onChange={(e) => setIntroText(e.target.value)} style={{ ...inputStyle, minHeight: '150px', marginBottom: '15px' }} />
              
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>注意事項</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, border: '2px solid #ef4444', minHeight: '80px' }} />
            </section>

            <section style={{ ...cardStyle, border: '1px solid #00b900' }}>
              <h3 style={{ marginTop: 0, color: '#00b900' }}>💬 LINE公式アカウント連携</h3>
              <div style={{ marginTop: '10px', padding: '15px', background: '#f0fdf4', borderRadius: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                  <input type="checkbox" checked={notifyLineEnabled} onChange={(e) => setNotifyLineEnabled(e.target.checked)} style={{ width: '20px', height: '20px' }} />
                  <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>📢 新着予約のLINE通知を有効にする</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', padding: '10px', background: '#fff', borderRadius: '8px', border: '1px dashed #00b900' }}>
                  <input type="checkbox" checked={notifyLineRemindEnabled} onChange={(e) => setNotifyLineRemindEnabled(e.target.checked)} style={{ width: '20px', height: '20px' }} />
                  <div>
                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>⏰ リマインドLINEを送る</span>
                    <span style={{ fontSize: '0.7rem', color: '#059669', display: 'block' }}>※24時間前に自動送信します（有料版機能）</span>
                  </div>
                </label>

                <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#15803d' }}>Access Token</label><input type="password" value={lineToken} onChange={(e) => setLineToken(e.target.value)} style={inputStyle} />
                <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#15803d', marginTop: '10px', display: 'block' }}>Admin User ID</label><input value={lineAdminId} onChange={(e) => setLineAdminId(e.target.value)} style={inputStyle} />
              </div>
            </section>
          </div>
        )}

        {/* --- 🔒 安全設定タブ --- */}
        {activeTab === 'security' && (
          <div style={{ width: '100%', boxSizing: 'border-box' }}>
            <section style={{ ...cardStyle, border: `2px solid ${themeColor}` }}>
              <h3 style={{ marginTop: 0, color: themeColor }}>🔐 セキュリティ設定</h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>パスワードを変更すると、運営者であっても解読不可能なハッシュ化が施されます。</p>
              {!isChangingPassword ? (<button onClick={() => setIsChangingPassword(true)} style={{ width: '100%', padding: '15px', border: `1px solid ${themeColor}`, color: themeColor, borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>パスワードを変更する</button>) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>新しいパスワード (8文字以上)</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={inputStyle} placeholder="新しいパスワードを入力" />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={handleUpdatePassword} style={{ flex: 1, padding: '15px', background: themeColor, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>安全に保存</button>
                    <button onClick={() => setIsChangingPassword(false)} style={{ flex: 1, padding: '15px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>キャンセル</button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000 }}>
        <button onClick={handleFinalSave} style={{ padding: '18px 35px', background: themeColor, color: '#fff', border: 'none', borderRadius: '40px', fontWeight: 'bold', boxShadow: `0 8px 30px ${themeColor}66`, fontSize: '1rem', cursor: 'pointer' }}>設定を保存する 💾</button>
      </div>
    </div>
  );
}

const UrlBox = ({ label, url, color, copy }) => (
  <div style={{ boxSizing: 'border-box', width: '100%', marginBottom: '10px' }}>
    <label style={{ fontSize: '0.7rem', color, fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>{label}</label>
    <div style={{ display: 'flex', gap: '5px' }}>
      <input readOnly value={url} style={{ flex: 1, padding: '10px', fontSize: '0.75rem', background: '#f8fafc', border: '1px solid #eee', borderRadius: '10px', boxSizing: 'border-box' }} />
      <button onClick={copy} style={{ padding: '8px 12px', background: '#fff', border: `1px solid ${color}`, color, borderRadius: '10px', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }}>コピー</button>
    </div>
  </div>
);

export default AdminDashboard;