import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  MapPin, Plus, Trash2, Save, Image as ImageIcon, Bell, Search, 
  Filter, Store, UserCheck, ShieldAlert, Copy, ExternalLink, 
  Edit2, PlusSquare, Settings, List, LayoutDashboard, CheckCircle2, XCircle
} from 'lucide-react';

function SuperAdmin() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [inputPass, setInputPass] = useState('');

  const MASTER_PASSWORD = import.meta.env.VITE_SUPER_MASTER_PASSWORD; 
  const DELETE_PASSWORD = import.meta.env.VITE_SUPER_DELETE_PASSWORD;

  // --- 状態管理 ---
  const [createdShops, setCreatedShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('すべて');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [activeTab, setActiveTab] = useState('list');

  // --- フォームState ---
  const [newShopName, setNewShopName] = useState('');
  const [newShopKana, setNewShopKana] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerNameKana, setNewOwnerNameKana] = useState('');
  const [newBusinessType, setNewBusinessType] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newLineToken, setNewLineToken] = useState('');
  const [newLineAdminId, setNewLineAdminId] = useState('');

  const [editingShopId, setEditingShopId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editKana, setEditKana] = useState('');
  const [editOwnerName, setEditOwnerName] = useState('');
  const [editOwnerNameKana, setEditOwnerNameKana] = useState('');
  const [editBusinessType, setEditBusinessType] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPassword, setEditPassword] = useState('');

  const [newsList, setNewsList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [newNewsDate, setNewNewsDate] = useState('');
  const [newNewsCat, setNewNewsCat] = useState('お知らせ');
  const [newNewsTitle, setNewNewsTitle] = useState('');

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 1024;

  useEffect(() => { 
    if (isAuthorized) fetchAllData(); 
  }, [isAuthorized]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([fetchCreatedShops(), fetchPortalContent()]);
    setLoading(false);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (inputPass === MASTER_PASSWORD) setIsAuthorized(true);
    else alert('パスワードが違います');
  };

  const fetchCreatedShops = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setCreatedShops(data);
  };

  const fetchPortalContent = async () => {
    const { data: news } = await supabase.from('portal_news').select('*').order('publish_date', { ascending: false });
    if (news) setNewsList(news);
    const { data: cats } = await supabase.from('portal_categories').select('*').order('sort_order', { ascending: true });
    if (cats) setCategoriesList(cats);
  };

  const filteredShops = useMemo(() => {
    return createdShops.filter(shop => {
      const matchSearch = (shop.business_name || "").includes(searchTerm) || (shop.owner_name || "").includes(searchTerm) || (shop.phone || "").includes(searchTerm);
      const matchCat = activeCategory === 'すべて' || shop.business_type === activeCategory;
      return matchSearch && matchCat;
    });
  }, [createdShops, searchTerm, activeCategory]);

  const stats = useMemo(() => ({
    total: createdShops.length,
    active: createdShops.filter(s => !s.is_suspended).length,
    suspended: createdShops.filter(s => s.is_suspended).length,
    managementEnabled: createdShops.filter(s => s.is_management_enabled).length // 🆕 統計に追加
  }), [createdShops]);

  const createNewShop = async () => {
    if (!newShopName || !newShopKana || !newOwnerName) return alert('必須項目を入力してください');
    const newPass = Math.random().toString(36).slice(-8);
    const { error } = await supabase.from('profiles').insert([{ business_name: newShopName, business_name_kana: newShopKana, owner_name: newOwnerName, owner_name_kana: newOwnerNameKana, business_type: newBusinessType, email_contact: newEmail, phone: newPhone, admin_password: newPass, line_channel_access_token: newLineToken, line_admin_user_id: newLineAdminId, notify_line_enabled: true, is_management_enabled: false }]);
    if (!error) {
      alert(`「${newShopName}」作成完了！ PW: ${newPass}`);
      setNewShopName(''); setNewShopKana(''); setNewOwnerName(''); setNewOwnerNameKana(''); fetchCreatedShops(); setActiveTab('list');
    }
  };

  const updateShopInfo = async (id) => {
    const { error } = await supabase.from('profiles').update({ 
      business_name: editName, 
      business_name_kana: editKana, 
      owner_name: editOwnerName, 
      owner_name_kana: editOwnerNameKana, 
      business_type: editBusinessType, 
      email_contact: editEmail, 
      phone: editPhone, 
      admin_password: editPassword 
    }).eq('id', id);
    if (!error) { setEditingShopId(null); fetchCreatedShops(); alert('更新完了'); }
  };

  const toggleSuspension = async (shop) => {
    const { error } = await supabase.from('profiles').update({ is_suspended: !shop.is_suspended }).eq('id', shop.id);
    if (!error) fetchCreatedShops();
  };

  // ✅ 🆕 顧客・売上管理機能の許可を切り替える関数
  const toggleManagementAccess = async (shop) => {
    const nextState = !shop.is_management_enabled;
    const msg = nextState ? `「${shop.business_name}」に顧客・売上管理機能（AdminManagement）の使用を許可しますか？` : `許可を解除しますか？`;
    if (!window.confirm(msg)) return;

    const { error } = await supabase.from('profiles').update({ is_management_enabled: nextState }).eq('id', shop.id);
    if (!error) fetchCreatedShops();
  };

  const deleteShop = async (shop) => {
    const input = window.prompt("削除パスワードを入力してください：");
    if (input === DELETE_PASSWORD) {
      const { error } = await supabase.from('profiles').delete().eq('id', shop.id);
      if (!error) { fetchCreatedShops(); alert('削除完了'); }
    }
  };

  const addNews = async () => {
    if (!newNewsDate || !newNewsTitle) return alert('日付とタイトルを入力してください');
    const { error } = await supabase.from('portal_news').insert([{ publish_date: newNewsDate, category: newNewsCat, title: newNewsTitle }]);
    if (!error) { setNewNewsDate(''); setNewNewsTitle(''); fetchPortalContent(); }
  };

  const deleteNews = async (id) => {
    if (window.confirm('削除しますか？')) {
      await supabase.from('portal_news').delete().eq('id', id);
      fetchPortalContent();
    }
  };

  const updateCategory = async (id, enName, imgUrl) => {
    await supabase.from('portal_categories').update({ en_name: enName, image_url: imgUrl }).eq('id', id);
    alert('更新完了');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('コピーしました');
  };

  if (!isAuthorized) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f0f2f5' }}>
        <form onSubmit={handleLogin} style={{ background: '#fff', padding: '30px', borderRadius: '20px', textAlign: 'center', width: '300px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: '#e60012', marginBottom: '20px', fontWeight: '900' }}>ソロプレ Admin</h2>
          <input type="password" value={inputPass} onChange={(e) => setInputPass(e.target.value)} placeholder="PW" style={smallInput} autoFocus />
          <button type="submit" style={{ ...primaryBtn, marginTop: '15px' }}>ログイン</button>
        </form>
      </div>
    );
  }

  // --- レンダリングパーツ ---
  const renderShopList = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', minWidth: 0 }}>
      <div style={panelStyle}>
        <div style={{ position: 'relative', marginBottom: '15px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', opacity: 0.4 }} />
          <input type="text" placeholder="店舗・代表者・電話で検索" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ ...smallInput, paddingLeft: '40px' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '5px', WebkitOverflowScrolling: 'touch' }}>
          {['すべて', ...categoriesList.map(c => c.name)].map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} style={{ padding: '6px 12px', borderRadius: '20px', border: 'none', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', background: activeCategory === cat ? '#1e293b' : '#f1f5f9', color: activeCategory === cat ? '#fff' : '#64748b' }}>{cat}</button>
          ))}
        </div>
      </div>
      {filteredShops.map((shop, index) => (
        <ShopCard key={shop.id} shop={shop} index={createdShops.length - createdShops.findIndex(s => s.id === shop.id)} editingShopId={editingShopId} setEditingShopId={setEditingShopId} editState={{ editName, setEditName, editKana, setEditKana, editOwnerName, setEditOwnerName, editOwnerNameKana, setEditOwnerNameKana, editBusinessType, setEditBusinessType, editEmail, setEditEmail, editPhone, setEditPhone, editPassword, setEditPassword }} onUpdate={updateShopInfo} onDelete={deleteShop} onToggleSuspension={toggleSuspension} onToggleManagement={toggleManagementAccess} onCopy={copyToClipboard} categories={categoriesList} />
      ))}
      {filteredShops.length === 0 && <div style={{textAlign:'center', padding:'40px', color:'#999'}}>該当する店舗はありません</div>}
    </div>
  );

  const renderAddShop = () => (
    <div style={panelStyle}>
      <h3 style={panelTitle}><PlusSquare size={18} /> 新規店舗の発行</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={newOwnerName} onChange={(e) => setNewOwnerName(e.target.value)} placeholder="代表者名" style={{...smallInput, flex:1}} />
          <input value={newOwnerNameKana} onChange={(e) => setNewOwnerNameKana(e.target.value)} placeholder="かな" style={{...smallInput, flex:1}} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={newShopName} onChange={(e) => setNewShopName(e.target.value)} placeholder="店舗名" style={{...smallInput, flex:1}} />
          <input value={newShopKana} onChange={(e) => setNewShopKana(e.target.value)} placeholder="かな" style={{...smallInput, flex:1}} />
        </div>
        <select value={newBusinessType} onChange={(e) => setNewBusinessType(e.target.value)} style={smallInput}>
          <option value="">-- 業種を選択 --</option>
          {categoriesList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="メール" style={smallInput} />
        <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="電話" style={smallInput} />
        <button onClick={createNewShop} style={primaryBtn}>発行してリストへ戻る</button>
      </div>
    </div>
  );

  const renderPortalSettings = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      <div style={panelStyle}>
        <h3 style={panelTitle}><Bell size={18} /> トピック管理</h3>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <input value={newNewsDate} onChange={(e) => setNewNewsDate(e.target.value)} placeholder="2026.01.21" style={{...smallInput, flex:1}} />
          <select value={newNewsCat} onChange={(e) => setNewNewsCat(e.target.value)} style={{...smallInput, flex:1}}>
            <option value=""></option>
            <option value="お知らせ">お知らせ</option>
            <option value="重要">重要</option>
            <option value="新機能">新機能</option>
          </select>
        </div>
        <textarea value={newNewsTitle} onChange={(e) => setNewNewsTitle(e.target.value)} placeholder="タイトル内容" style={{...smallInput, height:'60px', marginBottom:'10px'}} />
        <button onClick={addNews} style={{ ...secondaryBtn, width: '100%' }}>お知らせ追加</button>
        <div style={{ marginTop: '15px', maxHeight: '200px', overflowY: 'auto' }}>
          {newsList.map(n => <div key={n.id} style={newsItemStyle}><span>{n.publish_date} {n.title}</span><Trash2 size={14} color="#ef4444" onClick={() => deleteNews(n.id)} style={{cursor:'pointer'}} /></div>)}
        </div>
      </div>
      <div style={panelStyle}>
        <h3 style={panelTitle}><ImageIcon size={18} /> カテゴリデザイン</h3>
        <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
          {categoriesList.map(cat => <CategoryRow key={cat.id} cat={cat} onSave={updateCategory} />)}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ backgroundColor: '#f0f2f5', minHeight: '100vh', paddingBottom: isMobile ? '100px' : '20px', boxSizing: 'border-box', overflowX: 'hidden' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '10px' : '25px' }}>
        
        {/* 統計エリア */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '5px' }}>
          <div style={statsCard}>全 {stats.total}</div>
          <div style={{ ...statsCard, color: '#10b981' }}>公開 {stats.active}</div>
          <div style={{ ...statsCard, color: '#ef4444' }}>停止 {stats.suspended}</div>
          <div style={{ ...statsCard, color: '#7c3aed', border: '1px solid #7c3aed' }}>管理許可 {stats.managementEnabled}</div>
        </div>

        {isMobile ? (
          <div style={{ width: '100%' }}>
            {activeTab === 'list' && renderShopList()}
            {activeTab === 'add' && renderAddShop()}
            {activeTab === 'config' && renderPortalSettings()}
            
            <div style={bottomNavStyle}>
              <button onClick={() => setActiveTab('list')} style={activeTab === 'list' ? navBtnActive : navBtn}><List size={20} /><span>一覧</span></button>
              <button onClick={() => setActiveTab('add')} style={activeTab === 'add' ? navBtnActive : navBtn}><PlusSquare size={20} /><span>新規</span></button>
              <button onClick={() => setActiveTab('config')} style={activeTab === 'config' ? navBtnActive : navBtn}><Settings size={20} /><span>設定</span></button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '25px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
              {renderAddShop()}
              {renderPortalSettings()}
            </div>
            <div style={{ minWidth: 0 }}>
              {renderShopList()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 🆕 店舗カード（許可トグルを追加）
function ShopCard({ shop, index, editingShopId, setEditingShopId, editState, onUpdate, onDelete, onToggleSuspension, onToggleManagement, onCopy, categories }) {
  const isEditing = editingShopId === shop.id;
  const isSuspended = shop.is_suspended;
  const isMgmtEnabled = shop.is_management_enabled; // 🆕 顧客管理機能の許可状態

  return (
    <div style={{ background: '#fff', padding: '15px', borderRadius: '16px', border: isSuspended ? '2px solid #ef4444' : (isMgmtEnabled ? '2px solid #7c3aed' : '1px solid #e2e8f0'), width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#94a3b8' }}>No.{index}</span>
          {isMgmtEnabled && <span style={{ fontSize: '0.6rem', background: '#7c3aed', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>管理機能:ON</span>}
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
          <Edit2 size={16} color="#64748b" style={{cursor:'pointer'}} onClick={() => {
            setEditingShopId(shop.id);
            editState.setEditName(shop.business_name || "");
            editState.setEditKana(shop.business_name_kana || "");
            editState.setEditOwnerName(shop.owner_name || "");
            editState.setEditOwnerNameKana(shop.owner_name_kana || "");
            editState.setEditBusinessType(shop.business_type || "");
            editState.setEditEmail(shop.email_contact || "");
            editState.setEditPhone(shop.phone || "");
            editState.setEditPassword(shop.admin_password || "");
          }} />
          <Trash2 size={16} color="#ef4444" style={{cursor:'pointer'}} onClick={() => onDelete(shop)} />
        </div>
      </div>

      {isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            <input value={editState.editOwnerName} onChange={(e) => editState.setEditOwnerName(e.target.value)} style={smallInput} placeholder="代表名" />
            <input value={editState.editOwnerNameKana} onChange={(e) => editState.setEditOwnerNameKana(e.target.value)} style={smallInput} placeholder="かな" />
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            <input value={editState.editName} onChange={(e) => editState.setEditName(e.target.value)} style={smallInput} placeholder="店舗名" />
            <input value={editState.editKana} onChange={(e) => editState.setEditKana(e.target.value)} style={smallInput} placeholder="かな" />
          </div>
          <select value={editState.editBusinessType} onChange={(e) => editState.setEditBusinessType(e.target.value)} style={smallInput}>
            <option value="">-- 業種を選択 --</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <input value={editState.editEmail} onChange={(e) => editState.setEditEmail(e.target.value)} style={smallInput} placeholder="メールアドレス" />
          <input value={editState.editPhone} onChange={(e) => editState.setEditPhone(e.target.value)} style={smallInput} placeholder="電話番号" />
          <input value={editState.editPassword} onChange={(e) => editState.setEditPassword(e.target.value)} style={smallInput} placeholder="PW" />
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => onUpdate(shop.id)} style={{ ...primaryBtn, background: '#10b981', flex: 1 }}>保存</button>
            <button onClick={() => setEditingShopId(null)} style={{ ...primaryBtn, background: '#94a3b8', flex: 1 }}>閉じる</button>
          </div>
        </div>
      ) : (
        <div style={{ width: '100%', minWidth: 0, overflow: 'hidden' }}>
          <h4 style={{ margin: '0 0 5px 0', fontSize: '1rem', fontWeight: 'bold', color: '#1e293b' }}>{shop.business_name}</h4>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '5px' }}>{shop.owner_name} / PW: <strong>{shop.admin_password}</strong></div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '15px' }}>業種: {shop.business_type || "未設定"}</div>
          
          {/* ✅ 🆕 管理機能許可スイッチ */}
          <div style={{ marginBottom: '15px', padding: '12px', background: isMgmtEnabled ? '#f5f3ff' : '#f8fafc', borderRadius: '12px', border: `1px dashed ${isMgmtEnabled ? '#7c3aed' : '#cbd5e1'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LayoutDashboard size={16} color={isMgmtEnabled ? '#7c3aed' : '#64748b'} />
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: isMgmtEnabled ? '#7c3aed' : '#64748b' }}>顧客・売上管理機能</span>
            </div>
            <button onClick={() => onToggleManagement(shop)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              {isMgmtEnabled ? <CheckCircle2 size={24} color="#7c3aed" /> : <XCircle size={24} color="#cbd5e1" />}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <UrlBox label="管理" url={`${window.location.origin}/admin/${shop.id}`} onCopy={onCopy} />
            <UrlBox label="予約" url={`${window.location.origin}/shop/${shop.id}/reserve`} onCopy={onCopy} />
          </div>
          <button onClick={() => onToggleSuspension(shop)} style={{ width: '100%', marginTop: '15px', padding: '10px', borderRadius: '10px', border: 'none', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', background: isSuspended ? '#10b981' : '#fee2e2', color: isSuspended ? '#fff' : '#ef4444' }}>
            {isSuspended ? '公開を再開する' : '公開を一時停止する'}
          </button>
        </div>
      )}
    </div>
  );
}

function UrlBox({ label, url, onCopy }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#1e293b', minWidth: '30px' }}>{label}</span>
      <input readOnly value={url} style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '0.65rem', color: '#64748b', minWidth: 0, width: '100%', outline: 'none', textOverflow: 'ellipsis' }} />
      <button onClick={() => onCopy(url)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
        <Copy size={16} color="#2563eb" />
      </button>
    </div>
  );
}

function CategoryRow({ cat, onSave }) {
  const [imgUrl, setImgUrl] = useState(cat.image_url || "");
  return (
    <div style={{ padding: '12px', border: '1px solid #f0f0f0', borderRadius: '12px', background: '#fcfcfc' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px', color: '#1e293b' }}>{cat.name}</div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} placeholder="Image URL" style={{ ...smallInput, flex: 1, fontSize: '0.75rem', padding: '8px' }} />
        <button onClick={() => onSave(cat.id, cat.en_name, imgUrl)} style={{ background: '#10b981', border: 'none', borderRadius: '8px', color: '#fff', padding: '8px 12px', cursor:'pointer' }}><Save size={16}/></button>
      </div>
    </div>
  );
}

// スタイル定数
const smallInput = { padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box', outline: 'none' };
const panelStyle = { background: '#fff', padding: '20px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', boxSizing: 'border-box', width: '100%' };
const panelTitle = { marginTop: 0, fontSize: '1rem', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' };
const primaryBtn = { width: '100%', padding: '14px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor:'pointer' };
const secondaryBtn = { padding: '10px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 'bold', cursor:'pointer' };
const statsCard = { background: '#fff', padding: '10px 18px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' };
const newsItemStyle = { display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '10px 0', borderBottom: '1px dashed #eee' };
const bottomNavStyle = { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', display: 'flex', justifyContent: 'space-around', padding: '12px 0', borderTop: '1px solid #e2e8f0', boxShadow: '0 -4px 15px rgba(0,0,0,0.05)', zIndex: 9999 };
const navBtn = { background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#94a3b8', cursor: 'pointer', flex: 1 };
const navBtnActive = { ...navBtn, color: '#e60012' };

export default SuperAdmin;