import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../supabaseClient';
import { 
  ChevronLeft, ChevronRight, Store, ArrowRight, Info, 
  Clock, UserCheck, Users, CheckCircle2, ArrowLeft, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FacilityKeepDate_PC = ({ facilityId, isMobile, setActiveTab }) => {
  const navigate = useNavigate();
  // --- 状態管理 ---
  const [step, setStep] = useState('calendar'); 
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [occupiedDates, setOccupiedDates] = useState([]); 
  const [keepDates, setKeepDates] = useState([]); 
  const [regularRules, setRegularRules] = useState([]);
  const [residents, setResidents] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [exclusions, setExclusions] = useState([]); 
  const [timeModal, setTimeModal] = useState({ show: false, dateStr: '', currentTime: '' });

  // 予約作成用のState
  const [selections, setSelections] = useState({}); 

  const todayStr = new Date().toLocaleDateString('sv-SE');
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 1. カレンダーの基礎計算（エラー回避のため、早期に定義）
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const days = [...Array(firstDay).fill(null), ...[...Array(lastDate).keys()].map(i => i + 1)];

  useEffect(() => { fetchInitialData(); }, [facilityId]);
  useEffect(() => { if (selectedShop) fetchData(); }, [currentDate, selectedShop]);

  const fetchInitialData = async () => {
    const [shopRes, residentRes] = await Promise.all([
      supabase.from('shop_facility_connections').select(`*, profiles (*)`).eq('facility_user_id', facilityId).eq('status', 'active'),
      supabase.from('residents').select('*').eq('facility_id', facilityId).order('room_number', { ascending: true })
    ]);
    setShops(shopRes.data || []);
    setResidents(residentRes.data || []);
    if (shopRes.data?.length > 0) setSelectedShop(shopRes.data[0].profiles);
  };

  const fetchData = async () => {
    if (!selectedShop) return;
    setLoading(true);
    const shopId = selectedShop.id;
    const startOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;

    const [resData, privData, visitData, ngData, keeps, conns, exclData] = await Promise.all([
      supabase.from('reservations').select('start_time').eq('shop_id', shopId).gte('start_time', startOfMonth).lte('start_time', endOfMonth + 'T23:59:59'),
      supabase.from('private_tasks').select('start_time').eq('shop_id', shopId).gte('start_time', startOfMonth).lte('start_time', endOfMonth + 'T23:59:59'),
      supabase.from('visit_requests').select('scheduled_date').eq('shop_id', shopId).neq('status', 'canceled'),
      supabase.from('shop_ng_dates').select('date').eq('shop_id', shopId),
      supabase.from('keep_dates').select('*').eq('shop_id', shopId),
      supabase.from('shop_facility_connections').select('facility_user_id, regular_rules').eq('shop_id', shopId),
      supabase.from('regular_keep_exclusions').select('excluded_date').eq('facility_user_id', facilityId).eq('shop_id', shopId) // 🆕 これを追加
    ]);

    const dates = new Set();
    resData.data?.forEach(r => dates.add(r.start_time.split('T')[0].split(' ')[0]));
    privData.data?.forEach(p => dates.add(p.start_time.split('T')[0].split(' ')[0]));
    visitData.data?.forEach(v => dates.add(v.scheduled_date));
    ngData.data?.forEach(n => dates.add(n.date));

    setOccupiedDates(Array.from(dates));
    setKeepDates(keeps.data || []);
    setRegularRules(conns.data || []);
    setExclusions(exclData.data?.map(e => e.excluded_date) || []); // 🆕
    setLoading(false);
  };

  const checkIsRegularKeep = (date) => {
    const day = date.getDay();
    const dom = date.getDate();
    const m = date.getMonth() + 1;
    const nthWeek = Math.ceil(dom / 7);
    const tempNext7 = new Date(date); tempNext7.setDate(dom + 7);
    const isL1 = tempNext7.getMonth() !== date.getMonth(); 

    const tempNext14 = new Date(date); tempNext14.setDate(dom + 14);
    const isL2 = tempNext14.getMonth() !== date.getMonth() && !isL1;

    let result = null;
    regularRules.forEach(rule => {
      rule.regular_rules?.forEach(r => {
        const monthMatch = (r.monthType === 0) || (r.monthType === 1 && m % 2 !== 0) || (r.monthType === 2 && m % 2 === 0);
        const dayMatch = (r.day === day);
        
        // 💡 修正：第1〜4週(1-4) or 最終週(-1) or 最後から2番目(-2) をすべて判定
        const weekMatch = (r.week === nthWeek) || 
                          (r.week === -1 && isL1) || 
                          (r.week === -2 && isL2);
        
        if (monthMatch && dayMatch && weekMatch) result = { keeperId: rule.facility_user_id, time: r.time };
      });
    });
    return result;
  };

  const getStatus = (dateStr) => {
    const d = new Date(dateStr);
    const regKeep = checkIsRegularKeep(d);
    const isExcluded = exclusions.includes(dateStr);

    if (dateStr < todayStr) return 'past';

    // 🆕 1. 長期休暇（特別休暇）の判定を追加
    if (selectedShop?.special_holidays) {
      const isSpecialHoliday = selectedShop.special_holidays.some(h => 
        dateStr >= h.start && dateStr <= h.end
      );
      if (isSpecialHoliday) return 'ng';
    }
    
    // 🆕 2. 定休日の判定（構造に合わせて修正）
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayKey = dayNames[d.getDay()];
    const nthWeek = Math.ceil(d.getDate() / 7);
    
    // 💡 第5週目に対応するため「最後」と「最後から2」を計算
    const tempNext7 = new Date(d); tempNext7.setDate(d.getDate() + 7);
    const t7 = new Date(d); t7.setDate(d.getDate() + 7);
    const checkL1 = t7.getMonth() !== d.getMonth();
    const t14 = new Date(d); t14.setDate(d.getDate() + 14);
    const checkL2 = t14.getMonth() !== d.getMonth() && !checkL1;

    const holidays = selectedShop?.business_hours?.regular_holidays || {};

    const isHoliday = 
      holidays[`${nthWeek}-${dayKey}`] ||
      (checkL1 && holidays[`L1-${dayKey}`]) || 
      (checkL2 && holidays[`L2-${dayKey}`]);

    if (isHoliday) return 'ng';

    // 定期キープ
    if (regKeep && !isExcluded) {
      return { type: regKeep.keeperId === facilityId ? 'keeping' : 'other-keep', time: regKeep.time };
    }
    
    // 手動キープ
    const manualKeep = keepDates.find(k => k.date === dateStr && k.facility_user_id === facilityId);
    if (manualKeep) return { type: 'keeping', time: manualKeep.start_time || '09:00' };

    if (occupiedDates.includes(dateStr)) return 'occupied';
    if (keepDates.some(k => k.date === dateStr)) return 'other-keep';
    return 'available';
  };

  // 🆕 ボタン表示と確定用に「手動キープ + 有効な定期キープ」を合算する
  // 💡 days の計算よりも後に定義することでエラーを解消
  const allActiveKeeps = useMemo(() => {
    const list = [...keepDates.filter(k => k.facility_user_id === facilityId)];
    days.forEach(day => {
      if (!day) return;
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const regKeep = checkIsRegularKeep(new Date(dStr));
      // 自施設の定期日であり、かつ除外されていない日をリストに追加
      if (regKeep && regKeep.keeperId === facilityId && !exclusions.includes(dStr)) {
        if (!list.some(k => k.date === dStr)) {
          list.push({ date: dStr, isRegular: true });
        }
      }
    });
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [keepDates, regularRules, exclusions, year, month, days, facilityId]);

  const handleDateClick = async (day) => {
    if (!day || !selectedShop) return;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // 🆕 定期訪問日かどうかのチェック
    const regKeep = checkIsRegularKeep(new Date(dateStr));
    if (regKeep && regKeep.keeperId === facilityId) {
      if (!exclusions.includes(dateStr)) {
        await supabase.from('regular_keep_exclusions').insert([{ 
          facility_user_id: facilityId, shop_id: selectedShop.id, excluded_date: dateStr 
        }]);
      } else {
        await supabase.from('regular_keep_exclusions').delete().match({ 
          facility_user_id: facilityId, shop_id: selectedShop.id, excluded_date: dateStr 
        });
      }
      fetchData();
      return;
    }

    const statusData = getStatus(dateStr);
    const status = typeof statusData === 'object' ? statusData.type : statusData;
    if (['past', 'ng', 'occupied', 'other-keep'].includes(status)) return;

    if (status === 'keeping') {
      // すでに選択中の場合は、時間を変更するためにポップアップを開く
      setTimeModal({ show: true, dateStr, currentTime: statusData.time || '09:00' });
    } else {
      // 新規キープ：DBに保存してから、そのままポップアップを開く
      const defaultTime = regKeep ? regKeep.time : '09:00';
      await supabase.from('keep_dates').upsert({ 
        date: dateStr, 
        facility_user_id: facilityId, 
        shop_id: selectedShop.id,
        start_time: defaultTime 
      });
      fetchData();
      setTimeModal({ show: true, dateStr, currentTime: defaultTime });
    }
  };

  // 🆕 追加：保存済みの時間を変更する関数
  const handleTimeChange = async (dateStr, newTime) => {
    await supabase.from('keep_dates')
      .update({ start_time: newTime })
      .match({ date: dateStr, facility_user_id: facilityId, shop_id: selectedShop.id });
    fetchData();
  };

  const handleFinalSubmit = async () => {
    setLoading(true);
    try {
      for (const keep of allActiveKeeps) { // 🆕 myKeepsから変更
        const date = keep.date;
        const selectedForDate = selections[date] || [];
        if (selectedForDate.length === 0) continue;

        const { data: request, error: reqErr } = await supabase
          .from('visit_requests')
          .insert([{
            scheduled_date: date,
            facility_user_id: facilityId,
            shop_id: selectedShop.id,
            status: 'pending'
          }])
          .select().single();

        if (reqErr) throw reqErr;

        const residentPayloads = selectedForDate.map(s => ({
          visit_request_id: request.id,
          resident_id: s.resident_id,
          menu_name: s.menu
        }));

        const { error: resErr } = await supabase.from('visit_request_residents').insert(residentPayloads);
        if (resErr) throw resErr;

        await supabase.from('keep_dates').delete().match({ date, facility_user_id: facilityId });
        // 💡 定期除外も一応消しておく（必要に応じて）
        await supabase.from('regular_keep_exclusions').delete().match({ excluded_date: date, facility_user_id: facilityId });
      }
      alert("予約依頼を送信しました！");
      setStep('calendar');
      fetchInitialData();
    } catch (err) { alert("エラー: " + err.message); }
    setLoading(false);
  };

  const toggleResident = (date, residentId) => {
    const current = selections[date] || [];
    const exists = current.find(c => c.resident_id === residentId);
    if (exists) {
      setSelections({ ...selections, [date]: current.filter(c => c.resident_id !== residentId) });
    } else {
      setSelections({ ...selections, [date]: [...current, { resident_id: residentId, menu: 'カット' }] });
    }
  };

  const updateMenu = (date, residentId, menu) => {
    const current = selections[date] || [];
    setSelections({ ...selections, [date]: current.map(c => c.resident_id === residentId ? { ...c, menu } : c) });
  };

  // --- 描画 ---
  if (step === 'selection') {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        {/* 上部ナビゲーション */}
        <button onClick={() => setStep('calendar')} style={backBtn}>
          <ArrowLeft size={18} /> カレンダーへ戻る
        </button>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#3d2b1f', marginBottom: '20px', marginTop: '10px' }}>
          利用者様の選択
        </h2>
        
        {/* 確保した日付ごとのカードを表示 */}
        {allActiveKeeps.map(keep => (
          <div key={keep.date} style={selectionCard}>
            <div style={selectionCardHeader}>
              <div style={dateBadge}>{keep.date.replace(/-/g, '/')}</div>
              <div style={{ fontSize: '0.9rem', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                {/* ✅ 修正：inline 属性を削除しました */}
                <Users size={16} style={{ marginRight: '5px' }} /> 
                選択中: <strong>{(selections[keep.date] || []).length}名</strong>
              </div>
            </div>

            <div style={residentListScroll}>
              {/* ✅ 修正：名簿の有無で表示を分岐 */}
              {residents && residents.length > 0 ? (
                residents.map(res => {
                  const isSelected = (selections[keep.date] || []).find(s => s.resident_id === res.id);
                  return (
                    <div key={res.id} style={residentRow(isSelected)}>
                      <div 
                        onClick={() => toggleResident(keep.date, res.id)} 
                        style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                      >
                        <div style={checkBox(isSelected)}>
                          {isSelected && <CheckCircle2 size={18} />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{res.name} 様</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {res.room_number ? `${res.room_number}号室` : '居室番号なし'}
                          </div>
                        </div>
                      </div>

                      {/* 選択されている場合のみメニュー選択を表示 */}
                      {isSelected && (
                        <select 
                          value={isSelected.menu} 
                          onChange={(e) => updateMenu(keep.date, res.id, e.target.value)}
                          style={menuSelect}
                        >
                          <option value="カット">カット</option>
                          <option value="顔そり">顔そり</option>
                          <option value="カット・顔そり">カット・顔そり</option>
                          <option value="カラー">カラー</option>
                          <option value="パーマ">パーマ</option>
                        </select>
                      )}
                    </div>
                  );
                })
              ) : (
                /* ✅ 案内：名簿が空の場合の表示 */
                <div style={{ 
                  textAlign: 'center', padding: '40px 20px', background: '#f8fafc', 
                  borderRadius: '15px', border: '2px dashed #e2e8f0', color: '#94a3b8' 
                }}>
                  <Users size={32} style={{ marginBottom: '10px', opacity: 0.5 }} />
                  <div style={{ fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '5px' }}>
                    利用者名簿が空っぽです
                  </div>
                  <div style={{ fontSize: '0.8rem', lineHeight: '1.5' }}>
                    先に左メニューの「あつまれ綺麗にする人」から<br />
                    利用者様を登録してください。
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* 最終確定エリア */}
        <div style={finalActionArea}>
          <p style={{ fontSize: '0.85rem', color: '#888', textAlign: 'center', marginBottom: '15px' }}>
            ※「予約を確定して依頼する」を押すと、{selectedShop?.business_name} さんへ正式な依頼が届きます。
          </p>
          <button 
            onClick={handleFinalSubmit} 
            disabled={loading || Object.values(selections).flat().length === 0}
            style={submitBtn(loading)}
          >
            {loading ? '送信中...' : '予約を確定して依頼する ➔'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle(isMobile)}>
      {!isMobile && (
        <aside style={sideListStyle}>
          <h3 style={sideTitle}><Store size={18} /> 提携業者を選択</h3>
          <div style={shopListWrapper}>
            {shops.map(con => (
              <button key={con.profiles.id} onClick={() => setSelectedShop(con.profiles)} style={shopCardBtn(selectedShop?.id === con.profiles.id, con.profiles.theme_color)}>
                <div style={shopMiniTag(con.profiles.theme_color)}>{con.profiles.business_type}</div>
                <div style={shopNameLabel}>{con.profiles.business_name}</div>
              </button>
            ))}
          </div>
        </aside>
      )}

      <main style={{ flex: 1 }}>
        {!selectedShop ? (
          <div style={noShopStyle}>提携業者がいません。</div>
        ) : (
          <>
            <div style={calHeaderStyle}>
              <div style={monthNav}>
                <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} style={navBtn}><ChevronLeft /></button>
                <h2 style={monthLabel}>{year}年 {month + 1}月</h2>
                <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} style={navBtn}><ChevronRight /></button>
                
                {/* 🆕 【ここを追加】今日に戻るボタン */}
                <button 
                  onClick={() => setCurrentDate(new Date())} 
                  style={todayBtn}
                >
                  今日
                </button>
              </div>
              <div style={statusBanner(selectedShop?.theme_color)}>
                <Info size={16} />
                <span><strong>{selectedShop?.business_name}</strong> さんの空き状況を表示中</span>
              </div>
            </div>

            <div style={calendarGrid}>
              {['日', '月', '火', '水', '木', '金', '土'].map(w => <div key={w} style={weekHeader}>{w}</div>)}
              {days.map((day, i) => {
                if (!day) return <div key={i} style={emptyDay}></div>;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const statusData = getStatus(dateStr);
                const status = typeof statusData === 'object' ? statusData.type : statusData;
                const regTime = typeof statusData === 'object' ? statusData.time : null;

                const config = {
                  keeping: { bg: '#fff9e6', border: '#c5a059', color: '#c5a059', label: '選択中', icon: '★' },
                  occupied: { bg: '#fef2f2', border: '#fee2e2', color: '#94a3b8', label: '予約あり', icon: '✕' },
                  ng: { bg: '#f8fafc', border: '#f1f5f9', color: '#94a3b8', label: '定休日', icon: '✕' },
                  other_keep: { bg: '#f8fafc', border: '#f1f5f9', color: '#94a3b8', label: '他施設', icon: '✕' },
                  past: { bg: '#fff', border: '#fff', color: '#eee', label: '-', icon: '' },
                  available: { bg: '#fff', border: '#f0f0f0', color: '#c5a059', label: '空き', icon: '◎' }
                };
                const s = config[status === 'other-keep' ? 'other_keep' : status] || config.past;

                return (
                  <div key={i} 
                    onClick={() => handleDateClick(day)} // 🆕 シンプルにクリックだけに
                    style={dayBox(s.bg, s.border, status)}
                  >
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <span style={dayNum(status)}>{day}</span>
                      
                      {/* 🆕 【ここを修正】セレクトボックスを消して時間バッジを表示 */}
                      {status === 'keeping' && (
                        <div style={timeBadgeBig}>
                          {(statusData.time || '09:00').substring(0, 5)}
                        </div>
                      )}
                      
                      <span style={{fontSize:'0.6rem', fontWeight:'bold', color: s.color}}>{s.label}</span>
                    </div>
                    <div style={statusIconArea(s.color)}>{s.icon}</div>
                  </div>
                );
              })}
            </div>

            <div style={legendArea}>
              <div style={legendItem}><span style={dot('#fffbeb', '#c5a059')}></span> ★ 選択中</div>
              <div style={legendItem}><span style={dot('#fef2f2', '#fee2e2')}></span> ✕ 予約あり</div>
              <div style={legendItem}><span style={dot('#f8fafc', '#f1f5f9')}></span> ✕ 定休日/他施設</div>
              <div style={legendItem}><span style={dot('#fff', '#eee')}></span> ◎ 空き</div>
            </div>

            {allActiveKeeps.length > 0 && (
    <div style={actionBox}>
      <div style={keepInfo}>
        確保済みの訪問日：<strong>{allActiveKeeps.length}日間</strong>
      </div>
      <button 
        onClick={() => setActiveTab('list-up')} // 🆕 navigate ではなく State を変える
        style={nextBtn}
      >
        リストアップしよう！ <ArrowRight size={18} />
      </button>
    </div>
  )}
          </>
        )}
      </main>

      {/* 🆕 【ここから追加】時間選択ポップアップ */}
      <AnimatePresence>
        {timeModal.show && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={modalOverlay}
            // 背景をクリックしたら閉じる
            onClick={() => setTimeModal({ ...timeModal, show: false })}
          >
            <motion.div 
              initial={{ y: 50, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: 50, opacity: 0 }}
              style={modalContent}
              // 🆕 コンテンツ部分のクリックが背景に突き抜けないようにする
              onClick={(e) => e.stopPropagation()}
            >
              <div style={modalHeader}>
                <h3 style={{ margin: 0, color: '#3d2b1f' }}>開始時間の選択</h3>
                <div style={{ fontSize: '0.9rem', color: '#888', marginTop: '5px' }}>
                  {timeModal.dateStr.replace(/-/g, '/')}
                </div>
              </div>
              
              <div style={timeListScroll}>
                {(() => {
                  // 🆕 その曜日の営業時間を取得
                  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                  const dayKey = dayNames[new Date(timeModal.dateStr).getDay()];
                  const hours = selectedShop?.business_hours?.[dayKey] || { open: '09:00', close: '18:00' };
                  
                  // 08:00〜18:00の全リストから、営業時間内のものだけフィルタリング
                  const allTimes = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','13:00','14:00','15:00','16:00','17:00','17:30','18:00'];
                  
                  return allTimes
                    .filter(t => t >= hours.open && t <= hours.close)
                    .map(t => (
                      <button 
                        key={t}
                        onClick={() => {
                          handleTimeChange(timeModal.dateStr, t);
                          setTimeModal({ ...timeModal, show: false });
                        }}
                        style={timeCard(timeModal.currentTime.substring(0,5) === t)}
                      >
                        <Clock size={18} /> {t}
                      </button>
                    ));
                })()}
              </div>

              <button 
                onClick={async () => {
                  await supabase.from('keep_dates').delete().match({ date: timeModal.dateStr, facility_user_id: facilityId });
                  fetchData();
                  setTimeModal({ ...timeModal, show: false });
                }}
                style={deleteKeepBtn}
              >
                <Trash2 size={16} /> この日の選択を解除する
              </button>

              <button onClick={() => setTimeModal({ ...timeModal, show: false })} style={closeBtn}>
                閉じる
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* 🆕 【ここまで追加】 */}

    </div>
  );
};

// スタイル定義 (前回のまま)
const containerStyle = (isMobile) => ({ display: 'flex', gap: '30px', width: '100%', flexDirection: isMobile ? 'column' : 'row', alignItems: 'flex-start' });
const sideListStyle = { width: '280px', flexShrink: 0, background: '#fff', padding: '20px', borderRadius: '20px', border: '1px solid #eee' };
const sideTitle = { fontSize: '0.9rem', fontWeight: 'bold', color: '#3d2b1f', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' };
const shopListWrapper = { display: 'flex', flexDirection: 'column', gap: '10px' };
const shopCardBtn = (active, color) => ({ padding: '15px', borderRadius: '12px', border: active ? `2px solid ${color}` : '1px solid #f1f5f9', background: active ? `${color}05` : '#fff', textAlign: 'left', cursor: 'pointer', width: '100%', transition: '0.2s' });
const shopMiniTag = (color) => ({ fontSize: '0.6rem', color: color, fontWeight: 'bold', marginBottom: '2px' });
const shopNameLabel = { fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b' };
const calHeaderStyle = { marginBottom: '20px' };
const monthNav = { display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '15px', justifyContent: 'center' };
const monthLabel = { fontSize: '1.8rem', fontWeight: '900', color: '#3d2b1f', margin: 0, minWidth: '180px', textAlign: 'center' };
const navBtn = { background: '#fff', border: '1px solid #ddd', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const todayBtn = {
  marginLeft: '15px',
  padding: '6px 16px',
  borderRadius: '20px',
  border: '1px solid #e2e8f0',
  background: '#fff',
  color: '#3d2b1f',
  fontSize: '0.85rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  transition: '0.2s',
  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};
const statusBanner = (color) => ({ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', background: '#fcfaf7', borderRadius: '12px', fontSize: '0.85rem', color: '#3d2b1f', border: '1px solid #f0e6d2' });
const calendarGrid = { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', background: '#fff', padding: '15px', borderRadius: '24px', border: '1px solid #eee' };
const weekHeader = { textAlign: 'center', padding: '10px', fontSize: '0.75rem', fontWeight: 'bold', color: '#94a3b8' };
const dayBox = (bg, border, status) => ({ minHeight: '90px', padding: '10px', borderRadius: '16px', cursor: status === 'available' || status === 'keeping' ? 'pointer' : 'default', background: bg, border: `2px solid ${border}`, display: 'flex', flexDirection: 'column' });
const dayNum = (status) => ({ fontSize: '1.1rem', fontWeight: '900', color: status === 'available' || status === 'keeping' ? '#1e293b' : '#cbd5e1' });
const statusIconArea = (color) => ({ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: '900', color: color });
const timeBadge = { fontSize: '0.65rem', color: '#c5a059', fontWeight: '900', marginLeft: 'auto', marginRight: '4px', background: '#fff', padding: '1px 4px', borderRadius: '4px', border: '1px solid #f0e6d2' };
const emptyDay = { minHeight: '90px' };
const noShopStyle = { textAlign: 'center', padding: '100px', background: '#fff', borderRadius: '24px', color: '#999' };
const actionBox = { marginTop: '20px', background: '#3d2b1f', padding: '20px 40px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' };
const keepInfo = { color: '#fff', fontSize: '1rem' };
const nextBtn = { background: '#c5a059', color: '#3d2b1f', border: 'none', padding: '15px 30px', borderRadius: '12px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' };
const legendArea = { display: 'flex', gap: '15px', justifyContent: 'center', background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #eee', marginTop: '15px' };
const legendItem = { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', color: '#666', fontWeight: 'bold' };
const dot = (bg, border) => ({ width: '10px', height: '10px', borderRadius: '3px', background: bg, border: `1px solid ${border}` });
const backBtn = { background: 'none', border: 'none', color: '#c5a059', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' };
const selectionCard = { background: '#fff', borderRadius: '24px', padding: '25px', border: '1px solid #eee', marginBottom: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' };
const selectionCardHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '15px', marginBottom: '15px' };
const dateBadge = { background: '#3d2b1f', color: '#fff', padding: '6px 15px', borderRadius: '10px', fontWeight: 'bold', fontSize: '1rem' };
const residentListScroll = { maxHeight: '300px', overflowY: 'auto', paddingRight: '10px' };
const residentRow = (active) => ({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', borderRadius: '12px', marginBottom: '8px', background: active ? '#fff9e6' : '#f8fafc', border: active ? '1px solid #c5a059' : '1px solid transparent', transition: '0.2s' });
const checkBox = (active) => ({ width: '22px', height: '22px', borderRadius: '6px', border: active ? 'none' : '2px solid #ddd', background: active ? '#c5a059' : '#fff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' });
const menuSelect = { padding: '8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.85rem', fontWeight: 'bold', outline: 'none' };
const finalActionArea = { marginTop: '40px', paddingBottom: '100px' };
const submitBtn = (loading) => ({ width: '100%', padding: '20px', background: loading ? '#ccc' : '#c5a059', color: '#3d2b1f', border: 'none', borderRadius: '15px', fontSize: '1.2rem', fontWeight: '900', cursor: loading ? 'default' : 'pointer', boxShadow: '0 10px 20px rgba(197, 160, 89, 0.3)' });

const timeBadgeBig = {
  fontSize: '0.75rem', background: '#3d2b1f', color: '#fff',
  padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold',
  marginLeft: 'auto', marginRight: '6px'
};

// 🆕 背景自体を「真ん中寄せの箱」にします
const modalOverlay = {
  position: 'fixed', 
  top: 0, 
  left: 0, 
  width: '100vw', 
  height: '100vh',
  background: 'rgba(0,0,0,0.6)', 
  zIndex: 1000, 
  backdropFilter: 'blur(4px)',
  // ↓ 追加：中身を上下左右中央に配置
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

// 🆕 位置指定（top/left/transform）を削除してスッキリさせます
const modalContent = {
  width: '90%', 
  maxWidth: '380px', 
  background: '#fff', 
  borderRadius: '30px',
  padding: '30px', 
  boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
  // 高くなりすぎた場合に備えて
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column'
};

const modalHeader = { textAlign: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px', flexShrink: 0 };

const timeListScroll = {
  maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', padding: '5px'
};

const timeCard = (active) => ({
  width: '100%', padding: '16px', borderRadius: '15px', border: active ? '2px solid #c5a059' : '1px solid #eee',
  background: active ? '#fff9e6' : '#fff', color: active ? '#c5a059' : '#1e293b',
  fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', transition: '0.2s'
});

const deleteKeepBtn = {
  width: '100%', marginTop: '20px', padding: '12px', background: '#fff', color: '#ef4444',
  border: '1px solid #fee2e2', borderRadius: '15px', fontSize: '0.9rem', fontWeight: 'bold',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
};

const closeBtn = {
  width: '100%', marginTop: '10px', padding: '12px', background: '#f1f5f9', color: '#64748b',
  border: 'none', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer'
};

export default FacilityKeepDate_PC;