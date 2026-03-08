import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  ChevronLeft, ChevronRight, Users, Calendar as CalendarIcon, 
  X, Clipboard, User, FileText, History, CheckCircle, Trash2 
} from 'lucide-react';

// 🆕 予約者名から固有のパステルカラーを生成するロジック
const getCustomerColor = (name) => {
  if (!name || name === '定休日' || name === '臨時休業') return { bg: '#f1f5f9', border: '#cbd5e1', line: '#94a3b8', text: '#64748b' };
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return {
    bg: `hsl(${h}, 85%, 94%)`,
    border: `hsl(${h}, 60%, 80%)`,
    line: `hsl(${h}, 60%, 60%)`,
    text: `hsl(${h}, 70%, 25%)`
  };
};

function AdminTimeline() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const scrollRef = useRef(null);

  // --- 状態管理 ---
  const [shop, setShop] = useState(null);
  const [staffs, setStaffs] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('sv-SE'));
  
// モーダル・操作用
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [targetTime, setTargetTime] = useState('');
  const [targetStaffId, setTargetStaffId] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRes, setSelectedRes] = useState(null);

  // 🆕 重複予約リスト用
  const [showSlotListModal, setShowSlotListModal] = useState(false);
  const [selectedSlotReservations, setSelectedSlotReservations] = useState([]);

  // 👤 顧客詳細用（ここがコメントアウトされていました）
const [selectedCustomer, setSelectedCustomer] = useState(null); 
  const [customerHistory, setCustomerHistory] = useState([]);
  // 🆕 管理用氏名(admin_name)を追加
  const [editFields, setEditFields] = useState({ 
    name: '', 
    admin_name: '', 
    phone: '', 
    email: '', 
    memo: '', 
    line_user_id: null 
  });
  
  // 🆕 名寄せ（マージ）確認用
  const [mergeCandidate, setMergeCandidate] = useState(null); 
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);

  // ドラッグスクロール用
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [hasMoved, setHasMoved] = useState(false);

  useEffect(() => { fetchData(); }, [shopId, selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    // 1. 店舗プロフィール取得
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (profile) setShop(profile);

    // 2. スタッフ一覧取得
    const { data: staffsData } = await supabase.from('staffs').select('*').eq('shop_id', shopId).order('created_at', { ascending: true });
    setStaffs(staffsData || []);

    // 3. 予約データ取得（担当者名結合）
const { data: resData } = await supabase
      .from('reservations')
      .select('*, staffs(name), customers(name, admin_name)')
      .eq('shop_id', shopId)
      .gte('start_time', `${selectedDate}T00:00:00`)
      .lte('start_time', `${selectedDate}T23:59:59`);

    setReservations(resData || []);
    setLoading(false);
  };

// 🆕 1. スカウター発動：予約をタップした瞬間に重複を検知
  const openDetail = async (res) => {
    setSelectedRes(res);
    setTargetStaffId(res.staff_id);

    // 🔍 【スカウター】電話番号またはメールで既存客をガサ入れ
    const orConditions = [];
    if (res.customer_phone && res.customer_phone !== '---') orConditions.push(`phone.eq.${res.customer_phone}`);
    if (res.customer_email) orConditions.push(`email.eq.${res.customer_email}`);

    let cust = null;
    if (orConditions.length > 0) {
      const { data: matched } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .or(orConditions.join(','))
        .maybeSingle();
      cust = matched;
    }

    // 判定：連絡先は一致するが、紐付いているIDが違う（名寄せが必要）
    if (cust && cust.id !== res.customer_id) {
      setMergeCandidate(cust); 
      setShowMergeConfirm(true); 
      return; 
    }

    // 重複がない、または既に統合済みならそのまま表示へ
    finalizeOpenDetail(res, cust);
  };

  // 🆕 2. 統合実行：三土手さんが選んだ名前でマスタを確定
  const handleMergeAction = async (masterId, finalName) => {
    try {
      // 予約データの紐付け更新
      await supabase.from('reservations').update({ 
        customer_id: masterId,
        customer_name: finalName 
      }).eq('id', selectedRes.id);

      // マスタ側の名前も確定
      await supabase.from('customers').update({ 
        name: finalName,
        updated_at: new Date().toISOString()
      }).eq('id', masterId);

      setShowMergeConfirm(false);
      fetchData(); // 画面リロード
      finalizeOpenDetail(selectedRes, { ...mergeCandidate, name: finalName }); 
    } catch (err) {
      alert("統合に失敗しました");
    }
  };

  // 🆕 3. 表示確定：モーダルの中身をセット
  const finalizeOpenDetail = async (res, cust) => {
    if (cust) {
      setSelectedCustomer(cust);
      setEditFields({ 
        name: cust.name,
        admin_name: cust.admin_name || '',
        phone: cust.phone || res.customer_phone || '', 
        email: cust.email || res.customer_email || '', 
        memo: cust.memo || '',
        line_user_id: cust.line_user_id || res.line_user_id || null
      });
    } else {
      setSelectedCustomer(null);
      setEditFields({ 
        name: res.customer_name, 
        admin_name: '',
        phone: res.customer_phone || '', 
        email: res.customer_email || '', 
        memo: '',
        line_user_id: res.line_user_id || null
      });
    }

    // 来店履歴の取得
    const { data: history } = await supabase.from('reservations').select('*').eq('shop_id', shopId).eq('customer_name', res.customer_name).neq('id', res.id).order('start_time', { ascending: false }).limit(5);
    setCustomerHistory(history || []);
    setShowDetailModal(true);
  };

  // --- 顧客情報の更新 ---
  const handleUpdateCustomer = async () => {
    try {
      const payload = {
        shop_id: shopId,
        name: editFields.name,
        phone: editFields.phone || null,
        email: editFields.email || null,
        memo: editFields.memo || null,
        line_user_id: editFields.line_user_id || null,
        updated_at: new Date().toISOString()
      };
      if (selectedCustomer) payload.id = selectedCustomer.id;

      const { error: custError } = await supabase.from('customers').upsert(payload);
      if (custError) throw custError;

      const { error: resError } = await supabase.from('reservations').update({ 
        customer_name: editFields.name,
        customer_phone: editFields.phone,
        staff_id: selectedRes.staff_id // 変更後のスタッフIDで更新
      }).eq('id', selectedRes.id);
      if (resError) throw resError;

      alert('情報を更新しました！');
      setShowDetailModal(false);
      fetchData();
    } catch (err) {
      alert('更新に失敗しました: ' + err.message);
    }
  };

  // --- 予約の削除 ---
  const deleteRes = async (id) => {
    if (window.confirm('この予約データを消去して予約を「可能」に戻しますか？')) {
      const { error } = await supabase.from('reservations').delete().eq('id', id);
      if (error) alert('削除失敗');
      else { setShowDetailModal(false); fetchData(); }
    }
  };

  // --- 臨時休業（ブロック）の設定 ---
  const handleBlockTime = async () => {
    const reason = window.prompt("予定名（例：打ち合わせ、忘年会）を入力してください", "管理者ブロック");
    if (reason === null) return; 

    const start = new Date(`${selectedDate}T${targetTime}:00`);
    const intervalMin = shop?.slot_interval_min || 15;
    const end = new Date(start.getTime() + intervalMin * 60000);
    
    const insertData = {
      shop_id: shopId, 
      customer_name: reason, 
      res_type: 'blocked',
      staff_id: targetStaffId, // 🆕 選択したスタッフに紐付け
      start_time: start.toISOString(), 
      end_time: end.toISOString(),
      total_slots: 1, 
      customer_email: 'admin@example.com', 
      customer_phone: '---', 
      options: { type: 'admin_block' }
    };
    
    await supabase.from('reservations').insert([insertData]);
    setShowMenuModal(false); fetchData();
  };

  const handleBlockFullDay = async () => {
    const staffName = staffs.find(s => s.id === targetStaffId)?.name || 'フリー枠';
    if (!window.confirm(`${staffName} の ${selectedDate.replace(/-/g, '/')} を終日「予約不可」にしますか？`)) return;
    
    const intervalMin = shop?.slot_interval_min || 15;
    // 09:00 - 21:00 をブロック（適宜店舗時間に合わせる）
    const start = new Date(`${selectedDate}T09:00:00`);
    const end = new Date(`${selectedDate}T21:00:00`);
    const slotsCount = Math.ceil((end - start) / (intervalMin * 60000));

    const insertData = {
      shop_id: shopId, 
      customer_name: '臨時休業', 
      res_type: 'blocked',
      staff_id: targetStaffId, // 🆕 選択したスタッフに紐付け
      start_time: start.toISOString(), 
      end_time: end.toISOString(),
      total_slots: slotsCount, 
      customer_email: 'admin@example.com', 
      customer_phone: '---',
      options: { isFullDay: true }
    };
    await supabase.from('reservations').insert([insertData]);
    setShowMenuModal(false); fetchData();
  };

  // --- ドラッグ＆クリック制御 ---
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; 
    setIsDragging(true); setHasMoved(false);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    if (Math.abs(walk) > 5) setHasMoved(true);
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };
const handleCellClick = (slotMatches, time, staffId) => { // ✅ 引数を変更
  if (hasMoved) return;
  setTargetTime(time);
  const actualStaffId = staffId === 'free' ? null : staffId;
  setTargetStaffId(actualStaffId); 

  // 🆕 修正：予約が2つ以上ある場合はリストを表示、1つなら詳細、0ならメニュー
  if (slotMatches.length > 1) {
    setSelectedSlotReservations(slotMatches);
    setShowSlotListModal(true);
  } else if (slotMatches.length === 1) {
    openDetail(slotMatches[0]);
  } else {
    setShowMenuModal(true);
  }
};

  const timeSlots = useMemo(() => {
    const slots = [];
    const intervalMin = shop?.slot_interval_min || 15;
    for (let h = 8; h <= 22; h++) {
      for (let m = 0; m < 60; m += intervalMin) {
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return slots;
  }, [shop]);

  const themeColor = shop?.theme_color || '#4b2c85';

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>読み込み中...</div>;

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
      
      {/* ヘッダー */}
      <div style={{ padding: '8px 15px', borderBottom: '2px solid #94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', zIndex: 1000 }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <h1 style={{ fontSize: '1rem', fontWeight: '900', margin: 0, color: themeColor }}>Timeline</h1>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
              <button onClick={() => navigate(`/admin/${shopId}/reservations`)} style={switchBtnStyle(false)}>カレンダー</button>
              <button style={switchBtnStyle(true)}>タイムライン</button>
            </div>

            {/* 🆕 顧客・売上管理へのショートカットボタン */}
            <button 
              onClick={() => shop?.is_management_enabled && navigate(`/admin/${shopId}/management`)}
              style={{
                padding: '6px 15px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: shop?.is_management_enabled ? '#fff' : '#f1f5f9',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                cursor: shop?.is_management_enabled ? 'pointer' : 'not-allowed',
                color: shop?.is_management_enabled ? '#008000' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                transition: 'all 0.2s'
              }}
            >
              {shop?.is_management_enabled ? '📊 顧客・売上管理' : '🔒 売上管理'}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '5px' }}>
            <CalendarIcon size={22} color={themeColor} />
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }} />
          </div>
          <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toLocaleDateString('sv-SE')); }} style={navBtnStyle}><ChevronLeft size={18} /></button>
          <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d.toLocaleDateString('sv-SE')); }} style={navBtnStyle}><ChevronRight size={18} /></button>
          <button onClick={() => setSelectedDate(new Date().toLocaleDateString('sv-SE'))} style={{ ...navBtnStyle, background: themeColor, color: '#fff', fontSize: '0.8rem', padding: '6px 15px' }}>今日</button>
        </div>
      </div>

      {/* タイムライン本体 */}
      <div ref={scrollRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => setIsDragging(false)} onMouseLeave={() => setIsDragging(false)} style={{ flex: 1, overflow: 'auto', position: 'relative', background: '#fff', cursor: isDragging ? 'grabbing' : 'default', userSelect: 'none' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content', minWidth: '100%' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 100 }}>
            <tr>
              <th style={{ position: 'sticky', left: 0, zIndex: 110, background: '#e2e8f0', padding: '10px', borderRight: '3px solid #94a3b8', borderBottom: '3px solid #94a3b8', width: '140px', color: '#475569', fontSize: '0.75rem' }}>スタッフ</th>
              {timeSlots.map(time => (
                <th key={time} style={{ padding: '8px 4px', minWidth: '70px', borderRight: '1px solid #cbd5e1', borderBottom: '3px solid #94a3b8', color: '#1e293b', fontSize: '0.75rem', background: '#e2e8f0', textAlign: 'center' }}>{time}</th>
              ))}
            </tr>
          </thead>
<tbody>
  {[...staffs, { id: 'free', name: '担当なし' }].map((staff, idx) => (
    <tr key={staff.id} style={{ height: '80px', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
      <td style={{ 
        position: 'sticky', left: 0, zIndex: 90, background: idx % 2 === 0 ? '#fff' : '#f8fafc', 
        padding: '8px', borderRight: '3px solid #94a3b8', borderBottom: '1px solid #cbd5e1', fontWeight: 'bold' 
      }}><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={14} color={staff.id === 'free' ? '#94a3b8' : themeColor} /><span style={{ fontSize: '0.85rem', color: '#1e293b' }}>{staff.name}</span></div></td>{/* 👈 閉じタグの直後に中括弧を繋げる */}
{timeSlots.map(time => {
        const currentSlotStart = new Date(`${selectedDate}T${time}:00`).getTime();
        const staffIdVal = staff.id === 'free' ? null : staff.id;
        
        // 1. この枠に重なっている全予約を取得
        const matches = reservations.filter(r => (r.staff_id === staffIdVal) && currentSlotStart >= new Date(r.start_time).getTime() && currentSlotStart < new Date(r.end_time).getTime());
        const hasRes = matches.length > 0;
        
        // 🆕 2. この枠で「ちょうど開始」する予約を特定
        const startingHere = matches.filter(r => 
          new Date(r.start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }) === time
        );
        const isStart = startingHere.length > 0;

        const isMultiple = matches.length > 1;
        const firstRes = matches[0];
        const intervalMin = shop?.slot_interval_min || 15;
        const isEnd = hasRes && matches.some(r => new Date(r.end_time).getTime() === (currentSlotStart + intervalMin * 60000));
        const colors = getCustomerColor(firstRes?.customer_name);

        return (
          <td key={time} onClick={() => handleCellClick(matches, time, staffIdVal)} style={{ minWidth: '120px', borderRight: '1.5px solid #cbd5e1', borderBottom: '1.5px solid #cbd5e1', position: 'relative', background: '#fff', padding: 0, cursor: 'pointer' }}>
            {hasRes && (
              <div style={{ position: 'absolute', inset: '6px 0', background: isMultiple ? '#e0e7ff' : colors.bg, borderTop: `1.5px solid ${isMultiple ? themeColor : colors.border}`, borderBottom: `1.5px solid ${isMultiple ? themeColor : colors.border}`, borderLeft: isStart ? `1.5px solid ${isMultiple ? themeColor : colors.border}` : 'none', borderRight: isEnd ? `1.5px solid ${isMultiple ? themeColor : colors.border}` : 'none', borderRadius: `${isStart ? '8px' : '0'} ${isEnd ? '8px' : '0'} ${isEnd ? '8px' : '0'} ${isStart ? '8px' : '0'}`, display: 'flex', alignItems: 'center', justifyContent: isStart ? 'flex-start' : 'center', padding: isStart ? '0 10px' : '0', zIndex: 5, overflow: 'hidden' }}>
                {isStart ? (
                  /* 🆕 表示ロジックを強化 */
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: isMultiple ? themeColor : colors.text, whiteSpace: 'nowrap' }}>
                    {(() => {
                      // この枠で開始する人が1人だけなら名前を優先
if (startingHere.length === 1) {
                        // 🆕 マスタ側の最新名を特定する
                        const res = startingHere[0];
                        const masterName = res.customers?.admin_name || res.customers?.name || res.customer_name;
                        const name = masterName.split(/[\s　]+/)[0];
                        // 他の人と重なっていれば (人数) を追加
                        return isMultiple ? `${name} (${matches.length}名)` : `${name} 様`;
                      }
                      // 同時に2人以上が開始する場合はアイコン表示
                      return `👥 ${matches.length}名`;
                    })()}
                  </span>
                ) : (
                  /* 続きの枠は中央ライン */
                  <div style={{ width: '100%', height: '3px', background: isMultiple ? themeColor : colors.line, opacity: 0.4 }} />
                )}
              </div>
            )}
          </td>
        );
      })}
          </tr>
  ))}
</tbody>
</table>
      </div>

      {/* 🆕 ここから追記：3択の名寄せ（マージ）確認モーダル */}
      {showMergeConfirm && (
        <div 
          style={{ ...overlayStyle, zIndex: 5000 }} 
          onClick={() => setShowMergeConfirm(false)}
        >
          <div 
            style={{ 
              ...modalContentStyle, maxWidth: '400px', textAlign: 'center', 
              padding: '35px', borderRadius: '30px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' 
            }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: '3rem', marginBottom: '15px' }}>👤</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '900', marginBottom: '10px', color: '#1e293b' }}>
              同一人物の可能性があります
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: '1.6', marginBottom: '30px' }}>
              連絡先が一致するお客様が既に登録されています。<br/>
              <strong>「{mergeCandidate?.name}」</strong> 様として管理しますか？
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* 選択肢A：店側の名前を守る */}
              <button 
                onClick={() => handleMergeAction(mergeCandidate.id, mergeCandidate.name)}
                style={{ 
                  padding: '18px', background: themeColor, color: '#fff', border: 'none', 
                  borderRadius: '16px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' 
                }}
              >
                👤 既存の「{mergeCandidate?.name}」様に統合
              </button>

              {/* 選択肢B：今回の名前を採用する */}
              <button 
                onClick={() => handleMergeAction(mergeCandidate.id, selectedRes.customer_name)}
                style={{ 
                  padding: '16px', background: '#fff', color: themeColor, 
                  border: `2px solid ${themeColor}`, borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer' 
                }}
              >
                🐹 今回の「{selectedRes?.customer_name}」様へ名前を更新
              </button>

              {/* 選択肢C：別人として扱う */}
              <button 
                onClick={() => {
                  setShowMergeConfirm(false);
                  finalizeOpenDetail(selectedRes, null); 
                }}
                style={{ padding: '12px', background: 'none', border: 'none', color: '#64748b', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                🙅 同姓同名の別人として別名簿で管理
              </button>

              <button 
                onClick={() => setShowMergeConfirm(false)}
                style={{ marginTop: '10px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 🆕 追記ここまで */}

      {/* 📅 モーダル1：管理メニュー (AdminReservations完全移植) */}
      {showMenuModal && (
        <div style={overlayStyle} onClick={() => setShowMenuModal(false)}>
          <div style={{ ...modalContentStyle, maxWidth: '340px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 10px 0', color: '#64748b', fontSize: '0.9rem' }}>{selectedDate.replace(/-/g, '/')}</h3>
            <p style={{ fontWeight: '900', color: themeColor, fontSize: '2.2rem', margin: '0 0 30px 0' }}>{targetTime}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
<button 
  onClick={() => navigate(`/shop/${shopId}/reserve`, { 
    state: { 
      adminDate: selectedDate, 
      adminTime: targetTime, 
      adminStaffId: targetStaffId, // ✅ どのスタッフの枠か
      fromView: 'timeline',        // ✅ 「タイムラインから来た」という目印
      isAdminMode: true 
    } 
  })} 
  style={{ padding: '22px', background: themeColor, color: '#fff', border: 'none', borderRadius: '20px', fontWeight: '900', fontSize: '1.2rem', cursor: 'pointer' }}
>
  予約を入れる
</button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button onClick={handleBlockTime} style={{ padding: '15px', background: '#fff', color: themeColor, border: `2px solid ${themeColor}22`, borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem' }}>「✕」または予定</button>
                <button onClick={handleBlockFullDay} style={{ padding: '15px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem' }}>今日を休みにする</button>
              </div>
              <button onClick={() => setShowMenuModal(false)} style={{ padding: '15px', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer' }}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* 👤 モーダル2：予約詳細・名簿 (AdminReservations完全移植) */}
      {showDetailModal && (
        <div style={overlayStyle} onClick={() => setShowDetailModal(false)}>
          <div style={{ ...modalContentStyle, maxWidth: '650px' }} onClick={e => e.stopPropagation()}>
            {selectedRes?.res_type === 'normal' && (
<button 
  onClick={() => navigate(`/shop/${shopId}/reserve`, { 
    state: { 
      adminDate: selectedDate, 
      adminTime: targetTime, 
      adminStaffId: targetStaffId, // ✅ スタッフ情報を固定
      fromView: 'timeline',        // ✅ 戻り先を記憶
      isAdminMode: true 
    } 
  })} 
  style={{ width: '100%', padding: '16px', background: themeColor, color: '#fff', border: 'none', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
>
  ➕ この時間にさらに予約を入れる（ねじ込み）
</button>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{selectedRes?.res_type === 'blocked' ? '🚫 ブロック設定' : '📅 予約詳細・名簿更新'}</h2>
              <button onClick={() => setShowDetailModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
              <div>
                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <label style={labelStyle}>担当スタッフの変更</label>
                  <select value={selectedRes?.staff_id || ''} onChange={(e) => setSelectedRes({...selectedRes, staff_id: e.target.value || null})} style={inputStyle}>
                    <option value="">フリー（担当なし）</option>
                    {staffs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <label style={labelStyle}>お客様名（または予定名）</label>
                  <input type="text" value={editFields.name} onChange={(e) => setEditFields({...editFields, name: e.target.value})} style={inputStyle} />
                  <label style={labelStyle}>電話番号</label>
                  <input type="tel" value={editFields.phone} onChange={(e) => setEditFields({...editFields, phone: e.target.value})} style={inputStyle} placeholder="未登録" />
                  <label style={labelStyle}>顧客メモ</label>
                  <textarea value={editFields.memo} onChange={(e) => setEditFields({...editFields, memo: e.target.value})} style={{ ...inputStyle, height: '80px' }} placeholder="好み、注意事項など" />
                  <button onClick={handleUpdateCustomer} style={{ width: '100%', padding: '12px', background: themeColor, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>情報を保存</button>
                  <button onClick={() => deleteRes(selectedRes.id)} style={{ width: '100%', padding: '12px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>予約を消去 ＆ 名簿掃除</button>
                </div>
              </div>
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#64748b' }}>🕒 来店履歴</h4>
                <div style={{ height: '320px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '12px' }}>
                  {customerHistory.map(h => (
                    <div key={h.id} style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem' }}>
                      <div style={{ fontWeight: 'bold' }}>{new Date(h.start_time).toLocaleDateString('ja-JP')}</div>
                      <div style={{ color: themeColor, marginTop: '2px' }}>{h.menu_name || 'メニュー情報なし'}</div>
                    </div>
                  ))}
                  {customerHistory.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>履歴なし</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 👥 3. 予約者選択リストModal (AdminReservationsから完全移植) */}
      {showSlotListModal && (
        <div onClick={() => setShowSlotListModal(false)} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...modalContentStyle, maxWidth: '450px', textAlign: 'center', background: '#f8fafc', padding: '25px' }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 5px 0', color: '#64748b', fontSize: '0.9rem' }}>{selectedDate.replace(/-/g, '/')}</h3>
              <p style={{ fontWeight: '900', color: themeColor, fontSize: '1.8rem', margin: 0 }}>{targetTime} の予約</p>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '5px' }}>詳細を見たい方を選択してください</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '55vh', overflowY: 'auto', padding: '5px' }}>
              {/* ねじ込みボタン */}
              <div 
                onClick={() => {
                  setShowSlotListModal(false);
                  navigate(`/shop/${shopId}/reserve`, { 
                    state: { adminDate: selectedDate, adminTime: targetTime, isAdminMode: true, adminStaffId: targetStaffId, fromView: 'timeline' } 
                  });
                }}
                style={{ background: themeColor, padding: '18px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontWeight: 'bold', boxShadow: `0 4px 12px ${themeColor}44`, marginBottom: '10px' }}
              >
                ➕ 新しい予約をねじ込む
              </div>

              {selectedSlotReservations.map((res, idx) => (
                <div key={res.id || idx} onClick={() => { setShowSlotListModal(false); openDetail(res); }} style={{ background: '#fff', padding: '18px', borderRadius: '18px', border: `1px solid #e2e8f0`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ fontWeight: '900', fontSize: '1.1rem', color: '#1e293b', marginBottom: '4px' }}>
                      {res.res_type === 'blocked' ? `🚫 ${res.customer_name}` : `👤 ${res.customer_name} 様`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      <div style={{ color: themeColor, fontWeight: 'bold' }}>📋 {res.menu_name || 'メニュー未設定'}</div>
                      <div style={{ marginTop: '2px' }}>👤 担当: {res.staffs?.name || '店舗スタッフ'}</div>
                    </div>
                  </div>
                  <div style={{ color: themeColor, fontSize: '1.2rem' }}>〉</div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowSlotListModal(false)} style={{ marginTop: '25px', padding: '12px', border: 'none', background: 'none', color: '#94a3b8', fontWeight: 'bold', cursor: 'pointer' }}>キャンセル</button>
          </div>
        </div>
      )}
    </div>
  );
}

// スタイル (省略なし)
const switchBtnStyle = (active) => ({ padding: '5px 15px', borderRadius: '6px', border: 'none', background: active ? '#fff' : 'transparent', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer', boxShadow: active ? '0 2px 4px rgba(0,0,0,0.1)' : 'none', color: active ? '#1e293b' : '#64748b' });
const navBtnStyle = { background: '#f1f5f9', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' };
const modalContentStyle = { background: '#fff', width: '95%', borderRadius: '25px', padding: '30px', maxHeight: '85vh', overflowY: 'auto' };
const labelStyle = { fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', marginBottom: '5px', display: 'block' };
const inputStyle = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '12px', fontSize: '1rem', boxSizing: 'border-box' };

export default AdminTimeline;