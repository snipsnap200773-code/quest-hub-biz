import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";

const MenuSettings = () => {
  const { shopId } = useParams();
  const menuFormRef = useRef(null);

  // --- 1. State 管理 (本家から完全移植) ---
  const [message, setMessage] = useState('');
  const [shopData, setShopData] = useState(null);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [options, setOptions] = useState([]);
  const [allowMultiple, setAllowMultiple] = useState(false);

  // カテゴリ用State
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newUrlKey, setNewUrlKey] = useState(''); 
  const [newCustomShopName, setNewCustomShopName] = useState(''); 
  const [newCustomDescription, setNewCustomDescription] = useState(''); 
  const [newCustomOfficialUrl, setNewCustomOfficialUrl] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingDisableCatId, setEditingDisableCatId] = useState(null);

  // メニュー用State
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceSlots, setNewServiceSlots] = useState(1); 
  const [selectedCategory, setSelectedCategory] = useState('');
  const [editingServiceId, setEditingServiceId] = useState(null);

  // 枝メニュー用State
  const [activeServiceForOptions, setActiveServiceForOptions] = useState(null);
  const [optGroupName, setOptGroupName] = useState(''); 
  const [optName, setOptName] = useState('');          
  const [optSlots, setOptSlots] = useState(0);

  const themeColor = shopData?.theme_color || '#2563eb';

  // --- 2. データ取得系 ---
  useEffect(() => {
    if (shopId) {
      fetchInitialShopData();
      fetchMenuDetails();
    }
  }, [shopId]);

  const fetchInitialShopData = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (data) {
      setShopData(data);
      setAllowMultiple(data.allow_multiple_services);
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

  const showMsg = (txt) => { setMessage(txt); setTimeout(() => setMessage(''), 3000); };

  // --- 3. アクション系ロジック (本家のものを完全維持) ---
  
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
      name: newCategoryName, url_key: newUrlKey, custom_shop_name: newCustomShopName,
      custom_description: newCustomDescription, custom_official_url: newCustomOfficialUrl
    };
    if (editingCategoryId) await supabase.from('service_categories').update(payload).eq('id', editingCategoryId);
    else await supabase.from('service_categories').insert([{ ...payload, shop_id: shopId, sort_order: categories.length }]);
    setEditingCategoryId(null); setNewCategoryName(''); setNewUrlKey(''); setNewCustomShopName(''); setNewCustomDescription(''); setNewCustomOfficialUrl('');
    fetchMenuDetails(); showMsg('カテゴリを保存しました');
  };

  const handleServiceSubmit = async (e) => {
    e.preventDefault();
    const finalCategory = selectedCategory || (categories[0]?.name || 'その他');
    const serviceData = { shop_id: shopId, name: newServiceName, slots: newServiceSlots, category: finalCategory };
    if (editingServiceId) await supabase.from('services').update(serviceData).eq('id', editingServiceId);
    else await supabase.from('services').insert([{ ...serviceData, sort_order: services.length }]);
    setEditingServiceId(null); setNewServiceName(''); setNewServiceSlots(1); fetchMenuDetails(); showMsg('メニューを保存しました');
  };

  const handleOptionSubmit = async (e) => {
    e.preventDefault();
    await supabase.from('service_options').insert([{ service_id: activeServiceForOptions.id, group_name: optGroupName, option_name: optName, additional_slots: optSlots }]);
    setOptName(''); setOptSlots(0); fetchMenuDetails(); showMsg('枝メニューを追加しました');
  };

  // --- 4. スタイル設定 (SOLOの雰囲気を維持) ---
  const cardStyle = { marginBottom: '20px', background: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid #ddd', boxSizing: 'border-box', width: '100%', overflow: 'hidden' };
  const inputStyle = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '1rem', background: '#fff' };

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '700px', margin: '0 auto', padding: '20px', paddingBottom: '120px', boxSizing: 'border-box' }}>
      {message && <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '8px', zIndex: 1001, textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>{message}</div>}

      {/* 🛡️ 予約ルール */}
      <section style={{ ...cardStyle, border: `1px solid ${themeColor}` }}>
        <h3 style={{ marginTop: 0, fontSize: '0.9rem', color: themeColor }}>🛡️ 予約ルール</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input type="checkbox" checked={allowMultiple} onChange={async (e) => {
            const val = e.target.checked;
            setAllowMultiple(val);
            await supabase.from('profiles').update({ allow_multiple_services: val }).eq('id', shopId);
            showMsg('予約ルールを更新しました');
          }} style={{ width: '22px', height: '22px' }} />
          <span style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>メニューの複数選択を許可する</span>
        </label>
      </section>

      {/* 📂 カテゴリ設定 */}
      <section style={cardStyle}>
        <h3 style={{ marginTop: 0, fontSize: '0.9rem' }}>📂 カテゴリ設定</h3>
        <form onSubmit={handleCategorySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          <input placeholder="カテゴリ名" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} style={inputStyle} required />
          <div style={{ display: 'flex', gap: '8px' }}>
            <input placeholder="識別キー" value={newUrlKey} onChange={(e) => setNewUrlKey(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <input placeholder="専用屋号" value={newCustomShopName} onChange={(e) => setNewCustomShopName(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          </div>
          <button type="submit" style={{ width: '100%', padding: '12px', background: themeColor, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>{editingCategoryId ? 'カテゴリを更新' : 'カテゴリを登録'}</button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {categories.map((c, idx) => (
            <div key={c.id} style={{ background: '#f8fafc', padding: '10px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}>{c.name}</span>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button onClick={() => moveItem('category', categories, c.id, 'up')} disabled={idx === 0} style={{ padding: '5px' }}>▲</button>
                  <button onClick={() => moveItem('category', categories, c.id, 'down')} disabled={idx === categories.length - 1} style={{ padding: '5px' }}>▼</button>
                  <button onClick={() => { setEditingCategoryId(c.id); setNewCategoryName(c.name); setNewUrlKey(c.url_key || ''); setNewCustomShopName(c.custom_shop_name || ''); }} style={{ padding: '5px' }}>✎</button>
                  <button onClick={async () => { if(window.confirm('削除しますか？')) { await supabase.from('service_categories').delete().eq('id', c.id); fetchMenuDetails(); } }} style={{ padding: '5px' }}>×</button>
                </div>
              </div>
              
              {/* 🔗 連動設定ロジック完全移植 */}
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button 
                  onClick={async () => { await supabase.from('service_categories').update({ allow_multiple_in_category: !c.allow_multiple_in_category }).eq('id', c.id); fetchMenuDetails(); }} 
                  style={{ fontSize: '0.7rem', padding: '4px 8px', background: c.allow_multiple_in_category ? themeColor : '#fff', color: c.allow_multiple_in_category ? '#fff' : '#333', border: '1px solid #ccc', borderRadius: '15px' }}
                >
                  {c.allow_multiple_in_category ? '複数選択可' : '1つのみ選択'}
                </button>
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

      {/* 📝 メニュー登録・編集 */}
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
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <button key={n} type="button" onClick={() => setNewServiceSlots(n)} style={{ width: '40px', height: '40px', borderRadius: '8px', border: '1px solid', borderColor: newServiceSlots === n ? themeColor : '#ccc', background: newServiceSlots === n ? themeColor : 'white', color: newServiceSlots === n ? 'white' : '#333', fontWeight: 'bold' }}>{n}</button>)}
            </div>
          </div>
          <button type="submit" style={{ width: '100%', padding: '15px', background: themeColor, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>メニューを保存</button>
        </form>
      </section>

      {/* 表示エリア */}
      {categories.map((cat) => (
        <div key={cat.id} style={{ marginBottom: '25px' }}>
          <h4 style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '10px', borderLeft: '4px solid #cbd5e1', paddingLeft: '8px' }}>{cat.name}</h4>
          {services.filter(s => s.category === cat.name).map((s) => (
            <div key={s.id} style={{ ...cardStyle, marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold' }}>{s.name}</div>
                  <div style={{ fontSize: '0.8rem', color: themeColor }}>{s.slots}コマ</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setActiveServiceForOptions(activeServiceForOptions?.id === s.id ? null : s)} style={{ padding: '5px 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', color: activeServiceForOptions?.id === s.id ? themeColor : '#333' }}>枝</button>
                  <button onClick={() => moveItem('service', services.filter(ser => ser.category === cat.name), s.id, 'up')} style={{ padding: '5px' }}>▲</button>
                  <button onClick={() => moveItem('service', services.filter(ser => ser.category === cat.name), s.id, 'down')} style={{ padding: '5px' }}>▼</button>
                  <button onClick={() => { setEditingServiceId(s.id); setNewServiceName(s.name); setNewServiceSlots(s.slots); setSelectedCategory(s.category); menuFormRef.current?.scrollIntoView({ behavior: 'smooth' }); }} style={{ padding: '5px' }}>✎</button>
                  <button onClick={async () => { if(window.confirm('削除しますか？')) { await supabase.from('services').delete().eq('id', s.id); fetchMenuDetails(); } }} style={{ padding: '5px' }}>×</button>
                </div>
              </div>
              
              {/* 枝メニュー完全再現 (枝カテゴリ/グループ名対応) */}
              {activeServiceForOptions?.id === s.id && (
                <div style={{ marginTop: '15px', background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #eee' }}>
                  <form onSubmit={handleOptionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input placeholder="枝カテゴリ (例: シャンプー)" value={optGroupName} onChange={(e) => setOptGroupName(e.target.value)} style={inputStyle} />
                    <input placeholder="枝メニュー名 (例: あり)" value={optName} onChange={(e) => setOptName(e.target.value)} style={inputStyle} required />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.8rem' }}>追加コマ:</span>
                      <input type="number" value={optSlots} onChange={(e) => setOptSlots(parseInt(e.target.value))} style={{ width: '60px', ...inputStyle }} />
                      <button type="submit" style={{ flex: 1, padding: '10px', background: themeColor, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>＋ 枝追加</button>
                    </div>
                  </form>
                  {/* グループ表示ロジック */}
                  {Array.from(new Set(options.filter(o => o.service_id === s.id).map(o => o.group_name))).map(group => (
                    <div key={group} style={{ marginTop: '10px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b' }}>▼ {group || '共通'}</div>
                      {options.filter(o => o.service_id === s.id && o.group_name === group).map(o => (
                        <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px', borderBottom: '1px solid #eee' }}>
                          <span style={{ fontSize: '0.8rem' }}>{o.option_name} (+{o.additional_slots}コマ)</span>
                          <button onClick={async () => { await supabase.from('service_options').delete().eq('id', o.id); fetchMenuDetails(); }} style={{ color: '#ef4444', border: 'none', background: 'none' }}>×</button>
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
  );
};

export default MenuSettings;