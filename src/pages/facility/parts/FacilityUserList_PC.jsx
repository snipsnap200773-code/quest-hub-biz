import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { UserPlus, Edit2, Trash2, Home, User } from 'lucide-react';

export default function FacilityUserList_PC({ facilityId }) {
  const [residents, setResidents] = useState([]);
  const [facilityName, setFacilityName] = useState('');
  const [loading, setLoading] = useState(true);

  const [newFloor, setNewFloor] = useState('1F');
  const [newRoom, setNewRoom] = useState('');
  const [newName, setNewName] = useState('');
  const [newKana, setNewKana] = useState(''); 
  const [newNotes, setNewNotes] = useState(''); 
  const [isBedCut, setIsBedCut] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [sortBy, setSortBy] = useState('room');
  const floors = ['1F', '2F', '3F', '4F', '5F'];

  useEffect(() => { 
    const init = async () => {
      const { data: fac } = await supabase.from('facility_users').select('facility_name').eq('id', facilityId).single();
      if (fac) {
        setFacilityName(fac.facility_name);
        fetchResidents(fac.facility_name);
      }
    };
    init();
  }, [facilityId]);

  const fetchResidents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('members')
      .select('*')
      .eq('facility_user_id', facilityId); // 👈 ここを ID 検索にしました
    setResidents(data || []);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!newRoom || !newName) {
      alert("部屋番号とお名前は必須です");
      return;
    }
    
    const userData = { 
      facility_user_id: facilityId,
      facility: facilityName,
      floor: newFloor, 
      room: newRoom, 
      name: newName, 
      kana: newKana, 
      notes: newNotes, 
      isBedCut: isBedCut,
      is_selected: false,
      menus: []
    };

    if (editingId) {
      const { error } = await supabase.from('members').update(userData).eq('id', editingId);
      if (error) {
        alert("更新に失敗しました: " + error.message);
      } else {
        setEditingId(null);
        // 🆕 await をつけて、読み込みが終わるのをしっかり待ちます
        await fetchResidents(); 
        resetForm();
      }
    } else {
      const { error } = await supabase.from('members').insert([userData]);
      if (error) {
        alert("登録に失敗しました: " + error.message);
      } else {
        // 🆕 ここで自動リロード（最新リストの取得）を実行！
        await fetchResidents(); 
        resetForm();
        alert("名簿に新しく追加しました！✨");
      }
    }
  };

  // 🆕 フォームをリセットする関数（handleSubmit の外、 trStyle の上あたりに追加してください）
  const resetForm = () => {
    setNewRoom(''); 
    setNewName(''); 
    setNewKana(''); 
    setNewNotes(''); 
    setIsBedCut(false); 
    setNewFloor('1F');
  };

  // 💡 🚀 ここから追加：消えてしまった「編集開始」関数を復活させます
  const startEdit = (res) => {
    // 編集中のIDをセット（これでボタンが「保存する」に変わります）
    setEditingId(res.id); 
    
    // 左側のフォームに、今選んだ人の情報を流し込む
    setNewFloor(res.floor || '1F');
    setNewRoom(res.room || '');
    setNewName(res.name || '');
    setNewKana(res.kana || ''); 
    setNewNotes(res.notes || ''); 
    setIsBedCut(!!res.isBedCut); // 💡 !! をつけると、確実に true か false になります
  };

  const handleDelete = async (id) => {
    if (window.confirm('この利用者を名簿から削除しますか？')) {
      const { error } = await supabase.from('members').delete().eq('id', id);
      if (!error) fetchResidents();
    }
  };

  const sortedResidents = [...residents].sort((a, b) => {
    if (sortBy === 'room') {
      const valA = (a.floor || '') + (a.room || '');
      const valB = (b.floor || '') + (b.room || '');
      return valA.localeCompare(valB, 'ja', { numeric: true });
    } else {
      return (a.kana || '').localeCompare(b.kana || '', 'ja');
    }
  });

  if (loading) return <div style={{textAlign:'center', padding:'100px'}}>読み込み中...</div>;

  return (
    <div style={containerStyle}>
      <div style={contentWrapper}>
        {/* --- 左側：登録・編集フォーム（入力は残しておきます） --- */}
        <aside style={formSideStyle}>
          <div style={formHeader}>
            {editingId ? <Edit2 size={20} /> : <UserPlus size={20} />}
            <h3 style={{margin:0, fontSize: '1.1rem'}}>{editingId ? '情報を変更' : '新しく登録'}</h3>
          </div>
          
          <div style={formGroup}>
            <label style={labelStyle}>階数</label>
            <div style={floorBtnGroup}>
              {floors.map(f => (
                <button key={f} onClick={() => setNewFloor(f)} style={floorBtn(newFloor === f)}>{f}</button>
              ))}
            </div>
          </div>

          <div style={formGroup}>
            <label style={labelStyle}>部屋番号</label>
            <div style={inputWithIcon}><Home size={18} color="#94a3b8" /><input type="text" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} style={inputStyle} placeholder="例: 101" /></div>
          </div>

          <div style={formGroup}>
            <label style={labelStyle}>お名前</label>
            <div style={inputWithIcon}><User size={18} color="#94a3b8" /><input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} style={inputStyle} placeholder="例: 山田 太郎" /></div>
          </div>

          <div style={formGroup}><label style={labelStyle}>ふりがな</label><input type="text" value={newKana} onChange={(e) => setNewKana(e.target.value)} style={inputStyleFull} placeholder="例: やまだ たろう" /></div>
          <div style={formGroup}><label style={labelStyle}>備考</label><textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} style={textareaStyle} placeholder="スタッフ用メモなど" /></div>

          <div style={formGroup}>
            <label style={labelStyle}>ベッドカット</label>
            <div style={toggleButtonGroup}>
              <button onClick={() => setIsBedCut(false)} style={toggleBtn(!isBedCut)}>不要</button>
              <button onClick={() => setIsBedCut(true)} style={toggleBtn(isBedCut)}>必要</button>
            </div>
          </div>

          <button onClick={handleSubmit} style={submitBtnStyle}>{editingId ? '変更を保存する' : '名簿に追加する'}</button>
          {editingId && <button onClick={() => { setEditingId(null); setNewRoom(''); setNewName(''); setNewKana(''); setNewNotes(''); setIsBedCut(false); }} style={cancelBtn}>キャンセル</button>}
        </aside>

        {/* --- 右側：一覧エリア（修正：項目を絞って見やすく） --- */}
        <div style={tableContainer}>
          <div style={tableHeader}>
            <div style={resCount}>登録数：<strong>{residents.length}名</strong></div>
            <div style={sortGroup}>
              <button onClick={() => setSortBy('room')} style={sortTab(sortBy === 'room')}>部屋順</button>
              <button onClick={() => setSortBy('name')} style={sortTab(sortBy === 'name')}>名前順</button>
            </div>
          </div>

          <div style={listScroll}>
            <table style={tableStyle}>
              <thead>
                <tr style={theadStyle}>
                  <th style={{...thStyle, width: '80px'}}>階数</th>
                  <th style={{...thStyle, width: '100px'}}>部屋</th>
                  <th style={{...thStyle}}>お名前</th>
                  <th style={{...thStyle, textAlign:'center', width: '120px'}}>操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedResidents.map(u => (
                  <tr key={u.id} style={trStyle}>
                    <td style={tdStyle}><span style={floorBadge}>{u.floor}</span></td>
                    <td style={{...tdStyle, fontWeight: 'bold'}}>{u.room}</td>
                    
                    <td style={tdStyle}>
                      <div style={nameWrapper}>
                        <div style={mainNameText}>{u.name} 様</div>
                        <div style={kanaText}>{u.kana}</div>
                      </div>
                    </td>
                    
                    <td style={tdAction}>
                      <div style={btnActions}>
                        <button onClick={() => startEdit(u)} style={editBtn}><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(u.id)} style={delBtn}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- スタイル定義 ---
const containerStyle = { width: '100%', height: '100%' };
const contentWrapper = { display: 'flex', gap: '25px', alignItems: 'flex-start' };
const formSideStyle = { width: '340px', minWidth: '340px', background: '#fff', padding: '25px', borderRadius: '24px', border: '1px solid #eee' };
const formHeader = { display: 'flex', alignItems: 'center', gap: '10px', color: '#3d2b1f', marginBottom: '20px', fontWeight: '900' };
const formGroup = { marginBottom: '15px' };
const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: '900', color: '#64748b', marginBottom: '6px' };
const floorBtnGroup = { display: 'flex', gap: '4px' };
const floorBtn = (active) => ({ flex: 1, padding: '8px 0', borderRadius: '8px', border: active ? '2px solid #3d2b1f' : '1px solid #e2e8f0', background: active ? '#3d2b1f' : '#fff', color: active ? '#fff' : '#3d2b1f', fontWeight: '900', cursor: 'pointer', fontSize: '0.8rem' });
const inputWithIcon = { display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', padding: '0 12px', borderRadius: '10px', border: '1px solid #e2e8f0' };
const inputStyle = { flex: 1, padding: '12px 0', border: 'none', background: 'transparent', outline: 'none', fontSize: '0.95rem' };
const inputStyleFull = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', outline: 'none', boxSizing: 'border-box' };
const textareaStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', outline: 'none', minHeight: '60px', resize: 'none', boxSizing: 'border-box', fontSize: '0.9rem' };
const toggleButtonGroup = { display: 'flex', gap: '8px' };
const toggleBtn = (active) => ({ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: active ? '#2d6a4f' : '#f1f5f2', color: active ? '#fff' : '#2d6a4f', fontWeight: '900', cursor: 'pointer', fontSize: '0.85rem' });
const submitBtnStyle = { width: '100%', marginTop: '10px', padding: '15px', borderRadius: '12px', border: 'none', background: '#3d2b1f', color: '#fff', fontWeight: '900', cursor: 'pointer' };
const cancelBtn = { width: '100%', marginTop: '5px', padding: '8px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.8rem' };

const tableContainer = { flex: 1, background: '#fff', borderRadius: '24px', border: '1px solid #eee', overflow: 'hidden', display: 'flex', flexDirection: 'column' };
const tableHeader = { padding: '15px 25px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const resCount = { fontSize: '0.85rem', color: '#64748b' };
const sortGroup = { display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px' };
const sortTab = (active) => ({ padding: '5px 12px', border: 'none', borderRadius: '8px', background: active ? '#fff' : 'transparent', color: active ? '#3d2b1f' : '#94a3b8', fontWeight: '900', cursor: 'pointer', fontSize: '0.8rem' });

const listScroll = { overflowY: 'auto', maxHeight: '75vh' };
const tableStyle = { width: '100%', borderCollapse: 'collapse' }; 
const theadStyle = { background: '#fcfaf7', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, zIndex: 10 };
const thStyle = { padding: '15px 25px', textAlign: 'left', fontSize: '0.7rem', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase' };
const trStyle = { borderBottom: '1px solid #f8fafc' };
const tdStyle = { padding: '18px 25px', verticalAlign: 'middle' };

const nameWrapper = { display: 'flex', flexDirection: 'column', gap: '2px' };
const mainNameText = { fontWeight: '900', fontSize: '1.2rem', color: '#1e293b', whiteSpace: 'nowrap' };
const kanaText = { fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' };

const tdAction = { padding: '15px 10px', textAlign: 'center' };
const floorBadge = { background: '#f1f5f9', color: '#3d2b1f', padding: '4px 10px', borderRadius: '8px', fontWeight: '900', fontSize: '0.8rem' };
const btnActions = { display: 'flex', gap: '8px', justifyContent: 'center' };
const editBtn = { padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer' };
const delBtn = { padding: '10px', borderRadius: '10px', border: 'none', background: '#fef2f2', color: '#ef4444', cursor: 'pointer' };