import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { 
  ArrowLeft, Sparkles, Save, Menu as MenuIcon, 
  Settings2, Plus, Edit2, Trash2, ArrowUp, ArrowDown,
  Layers, Link2, AlertCircle, CheckCircle2
} from 'lucide-react';

const MenuSettings = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const menuFormRef = useRef(null);

  // --- 1. State 管理 ---
  const [message, setMessage] = useState('');
  const [shopData, setShopData] = useState(null);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [options, setOptions] = useState([]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [slotIntervalMin, setSlotIntervalMin] = useState(30);

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
      setSlotIntervalMin(data.slot_interval_min || 30);
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

  // --- 3. アクション系ロジック (完全維持) ---
  const moveItem = async (type, list, id, direction) => {
    const idx = list.findIndex(item => item.id === id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const newList = [...list]; const [moved] = newList.splice(idx, 1); newList.splice(targetIdx, 0, moved);
    const table = type === 'category' ? 'service_categories' : 'services';
    const updates = newList.map((item, i) => ({ 
      id: item.id, shop_id: shopId, sort_order: i, name: item.name, 
      ...(type === 'service' ? { slots: item.slots, category: item.category } : {}) 
    }));
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

  const handleSave = async () => {
    const { error } = await supabase.from('profiles').update({
      allow_multiple_services: allowMultiple,
      slot_interval_min: slotIntervalMin
    }).eq('id', shopId);
    if (!error) showMsg('予約ルールを保存しました！');
    else alert('保存に失敗しました。');
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    const payload = { 
      name: newCategoryName, url_key: newUrlKey, custom_shop_name: newCustomShopName,
      custom_description: newCustomDescription, custom_official_url: newCustomOfficialUrl
    };
    if (editingCategoryId) await supabase.from('service_categories').update(payload).eq('id', editingCategoryId);
    else await supabase.from('service_categories').insert([{ ...payload, shop_id: shopId, sort_order: categories.length }]);
    setEditingCategoryId(null); setNewCategoryName(''); setNewUrlKey(''); setNewCustomShopName(''); 
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

  // --- 4. スタイル設定 ---
  const containerStyle = { fontFamily: 'sans-serif', maxWidth: '700px', margin: '0 auto', padding: '20px', paddingBottom: '120px', position: 'relative' };
  const cardStyle = { marginBottom: '20px', background: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxSizing: 'border-box', width: '100%', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem', background: '#fff' };
  const btnActiveS = (val, target) => ({ flex: 1, padding: '12px 5px', background: val === target ? themeColor : '#fff', color: val === target ? '#fff' : '#333', border: '1px solid #cbd5e1', borderRadius: '10px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' });

  return (
    <div style={containerStyle}>
      {/* 🔔 通知メッセージ */}
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '12px', zIndex: 1001, textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}>
          {message}
        </div>
      )}

      {/* 🚀 ナビゲーションヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <button 
          onClick={() => navigate(`/admin/${shopId}/dashboard`)}
          style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '10px 16px', borderRadius: '30px', fontSize: '0.85rem', fontWeight: 'bold', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
        >
          <ArrowLeft size={16} /> ダッシュボードへ
        </button>

        <button 
          onClick={() => navigate(`/admin/${shopId}/settings/menu-guide`)}
          style={{ background: themeColor, border: 'none', padding: '10px 20px', borderRadius: '30px', fontSize: '0.85rem', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: `0 4px 12px ${themeColor}44` }}
        >
          <Sparkles size={16} /> 案内人を召喚
        </button>
      </div>

      <h2 style={{ fontSize: '1.4rem', color: '#1e293b', marginBottom: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
        メニュー設定
      </h2>

      {/* ⚙️ 予約エンジンの基本 */}
      <section style={{ ...cardStyle, border: `2px solid ${themeColor}` }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem', color: themeColor, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Settings2 size={20} /> 予約エンジンの基本設定
        </h3>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px', fontSize: '0.85rem', color: '#334155' }}>1コマの単位（推奨：30分）</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[10, 15, 20, 30].map(min => (
              <button key={min} onClick={() => setSlotIntervalMin(min)} style={btnActiveS(slotIntervalMin, min)}>{min}分</button>
            ))}
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '20px' }}>
          <input type="checkbox" checked={allowMultiple} onChange={(e) => setAllowMultiple(e.target.checked)} style={{ width: '22px', height: '22px' }} />
          <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#334155' }}>複数のカテゴリ選択を許可する</span>
        </label>
        <button onClick={handleSave} style={{ width: '100%', padding: '16px', background: themeColor, color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', boxShadow: `0 4px 12px ${themeColor}33`, cursor: 'pointer' }}>
          <Save size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> 基本設定を保存
        </button>
      </section>

      {/* 📂 カテゴリ設定 */}
      <section style={cardStyle}>
        <h3 style={{ marginTop: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Layers size={20} color="#64748b" /> カテゴリ設定
        </h3>
        <form onSubmit={handleCategorySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <input placeholder="カテゴリ名 (例: カット, カラー)" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} style={inputStyle} required />
          <div style={{ display: 'flex', gap: '10px' }}>
            <input placeholder="識別キー (url用)" value={newUrlKey} onChange={(e) => setNewUrlKey(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <input placeholder="専用屋号 (任意)" value={newCustomShopName} onChange={(e) => setNewCustomShopName(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          </div>
          <button type="submit" style={{ width: '100%', padding: '14px', background: '#1e293b', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
            <Plus size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> {editingCategoryId ? 'カテゴリを更新' : '新しいカテゴリを登録'}
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {categories.map((c, idx) => (
            <div key={c.id} style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{c.name}</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => moveItem('category', categories, c.id, 'up')} disabled={idx === 0} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px' }}><ArrowUp size={16} /></button>
                  <button onClick={() => moveItem('category', categories, c.id, 'down')} disabled={idx === categories.length - 1} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px' }}><ArrowDown size={16} /></button>
                  <button onClick={() => { setEditingCategoryId(c.id); setNewCategoryName(c.name); setNewUrlKey(c.url_key || ''); setNewCustomShopName(c.custom_shop_name || ''); }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#3b82f6' }}><Edit2 size={16} /></button>
                  <button onClick={async () => { if(window.confirm('カテゴリを削除しますか？')) { await supabase.from('service_categories').delete().eq('id', c.id); fetchMenuDetails(); } }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#ef4444' }}><Trash2 size={16} /></button>
                </div>
              </div>
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={async () => { await supabase.from('service_categories').update({ allow_multiple_in_category: !c.allow_multiple_in_category }).eq('id', c.id); fetchMenuDetails(); }} style={{ fontSize: '0.75rem', padding: '6px 12px', background: c.allow_multiple_in_category ? themeColor : '#fff', color: c.allow_multiple_in_category ? '#fff' : '#475569', border: '1px solid #cbd5e1', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}>
                  {c.allow_multiple_in_category ? '複数選択可' : '1つのみ選択'}
                </button>
                <button onClick={() => setEditingDisableCatId(editingDisableCatId === c.id ? null : c.id)} style={{ fontSize: '0.75rem', padding: '6px 12px', background: editingDisableCatId === c.id ? '#1e293b' : '#fff', color: editingDisableCatId === c.id ? '#fff' : '#475569', border: '1px solid #cbd5e1', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Link2 size={14} /> 連動設定 {editingDisableCatId === c.id ? 'を閉じる' : ''}
                </button>
              </div>
              
              {editingDisableCatId === c.id && (
                <div style={{ marginTop: '16px', padding: '16px', background: '#fff', borderRadius: '16px', border: `2px solid ${themeColor}` }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#ef4444', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={14} /> 同時に選べないカテゴリ：</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                    {categories.filter(t => t.id !== c.id).map(t => {
                      const isDis = c.disable_categories?.split(',').includes(t.name);
                      return <button key={t.id} onClick={() => handleToggleDisableCat(c.id, t.name)} style={{ fontSize: '0.7rem', padding: '5px 10px', borderRadius: '15px', border: '1px solid', borderColor: isDis ? '#ef4444' : '#cbd5e1', background: isDis ? '#fee2e2' : '#fff', color: isDis ? '#ef4444' : '#475569', cursor: 'pointer' }}>{t.name}</button>
                    })}
                  </div>
                  <p style={{ fontSize: '0.75rem', fontWeight: 'bold', color: themeColor, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={14} /> セットで選ぶ必要があるカテゴリ：</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {categories.filter(t => t.id !== c.id).map(t => {
                      const isReq = c.required_categories?.split(',').includes(t.name);
                      return <button key={t.id} onClick={() => handleToggleRequiredCat(c.id, t.name)} style={{ fontSize: '0.7rem', padding: '5px 10px', borderRadius: '15px', border: '1px solid', borderColor: isReq ? themeColor : '#cbd5e1', background: isReq ? '#dbeafe' : '#fff', color: isReq ? themeColor : '#475569', cursor: 'pointer' }}>{t.name}</button>
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 📝 メニュー登録・編集 */}
      <section ref={menuFormRef} style={{ ...cardStyle, background: '#f8fafc', border: '1px solid #cbd5e1' }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Edit2 size={20} color="#64748b" /> メニュー登録・編集
        </h3>
        <form onSubmit={handleServiceSubmit}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '6px' }}>所属カテゴリ</label>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={inputStyle} required>
              <option value="">-- カテゴリを選択してください --</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '6px' }}>メニュー名</label>
            <input value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} style={inputStyle} placeholder="例: カット ＆ ブロー" required />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '10px', color: '#64748b' }}>
              必要コマ数: <span style={{ color: themeColor, fontSize: '1.1rem' }}>{newServiceSlots}コマ（{newServiceSlots * slotIntervalMin}分）</span>
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <button key={n} type="button" onClick={() => setNewServiceSlots(n)} style={{ width: '45px', height: '45px', borderRadius: '12px', border: '2px solid', borderColor: newServiceSlots === n ? themeColor : '#e2e8f0', background: newServiceSlots === n ? themeColor : 'white', color: newServiceSlots === n ? 'white' : '#1e293b', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>{n}</button>
              ))}
            </div>
          </div>
          <button type="submit" style={{ width: '100%', padding: '16px', background: themeColor, color: 'white', border: 'none', borderRadius: '16px', fontWeight: 'bold', fontSize: '1rem', boxShadow: `0 4px 12px ${themeColor}44`, cursor: 'pointer' }}>
            <Save size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> {editingServiceId ? 'メニューを更新する' : 'メニューを新規登録'}
          </button>
        </form>
      </section>

      {/* 表示エリア */}
      <div style={{ marginTop: '30px' }}>
        <h3 style={{ fontSize: '1rem', color: '#1e293b', marginBottom: '20px', fontWeight: 'bold' }}>現在のメニュー一覧</h3>
        {categories.map((cat) => (
          <div key={cat.id} style={{ marginBottom: '30px' }}>
            <h4 style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '12px', borderLeft: `4px solid ${themeColor}`, paddingLeft: '10px', fontWeight: 'bold' }}>{cat.name}</h4>
            {services.filter(s => s.category === cat.name).map((s) => (
              <div key={s.id} style={{ ...cardStyle, marginBottom: '12px', border: activeServiceForOptions?.id === s.id ? `2px solid ${themeColor}` : '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{s.name}</div>
                    <div style={{ fontSize: '0.8rem', color: themeColor, fontWeight: 'bold', marginTop: '4px' }}>{s.slots}コマ（{s.slots * slotIntervalMin}分）</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setActiveServiceForOptions(activeServiceForOptions?.id === s.id ? null : s)} style={{ padding: '6px 12px', background: activeServiceForOptions?.id === s.id ? themeColor : '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold', color: activeServiceForOptions?.id === s.id ? '#fff' : '#475569', cursor: 'pointer' }}>枝</button>
                    <button onClick={() => moveItem('service', services.filter(ser => ser.category === cat.name), s.id, 'up')} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px' }}><ArrowUp size={16} /></button>
                    <button onClick={() => moveItem('service', services.filter(ser => ser.category === cat.name), s.id, 'down')} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px' }}><ArrowDown size={16} /></button>
                    <button onClick={() => { setEditingServiceId(s.id); setNewServiceName(s.name); setNewServiceSlots(s.slots); setSelectedCategory(s.category); menuFormRef.current?.scrollIntoView({ behavior: 'smooth' }); }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#3b82f6' }}><Edit2 size={16} /></button>
                    <button onClick={async () => { if(window.confirm('メニューを削除しますか？')) { await supabase.from('services').delete().eq('id', s.id); fetchMenuDetails(); } }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#ef4444' }}><Trash2 size={16} /></button>
                  </div>
                </div>

                {/* 枝メニュー表示ロジック */}
                {activeServiceForOptions?.id === s.id && (
                  <div style={{ marginTop: '20px', background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 'bold', color: themeColor, marginBottom: '12px' }}>枝メニュー（追加オプション）の管理</p>
                    <form onSubmit={handleOptionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <input placeholder="枝カテゴリ (例: シャンプー, 指名料)" value={optGroupName} onChange={(e) => setOptGroupName(e.target.value)} style={inputStyle} />
                      <input placeholder="枝メニュー名 (例: あり, 担当 A)" value={optName} onChange={(e) => setOptName(e.target.value)} style={inputStyle} required />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>追加:</span>
                          <input type="number" value={optSlots} onChange={(e) => setOptSlots(parseInt(e.target.value))} style={{ width: '70px', ...inputStyle }} />
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>コマ</span>
                        </div>
                        <button type="submit" style={{ flex: 1, padding: '12px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>＋ 枝追加</button>
                      </div>
                    </form>
                    
                    <div style={{ marginTop: '20px' }}>
                      {Array.from(new Set(options.filter(o => o.service_id === s.id).map(o => o.group_name))).map(group => (
                        <div key={group} style={{ marginBottom: '12px' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#94a3b8', marginBottom: '6px' }}>▼ {group || '共通'}</div>
                          {options.filter(o => o.service_id === s.id && o.group_name === group).map(o => (
                            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fff', borderRadius: '8px', border: '1px solid #eee', marginBottom: '4px' }}>
                              <span style={{ fontSize: '0.85rem', color: '#1e293b' }}>{o.option_name} <span style={{ color: themeColor, fontWeight: 'bold' }}>+{o.additional_slots}コマ</span></span>
                              <button onClick={async () => { if(window.confirm('この枝メニューを削除しますか？')) { await supabase.from('service_options').delete().eq('id', o.id); fetchMenuDetails(); } }} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}><Trash2 size={16} /></button>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MenuSettings;