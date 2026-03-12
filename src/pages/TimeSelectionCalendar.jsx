import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ChevronLeft, ChevronRight, Clock, User, Calendar as CalendarIcon } from 'lucide-react';

function TimeSelectionCalendar() {
  const { shopId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ 🆕 修正1：スクロール先の目印を作成
  const timeSlotsRef = useRef(null);

  const queryParams = new URLSearchParams(location.search);
  const staffIdFromUrl = queryParams.get('staff');
  const { totalSlotsNeeded, staffId: staffIdFromState } = location.state || { totalSlotsNeeded: 0 };
  const effectiveStaffId = staffIdFromUrl || staffIdFromState;

  // --- State管理 ---
  const [shop, setShop] = useState(null);
  const [allStaffs, setAllStaffs] = useState([]);
  const [targetStaff, setTargetStaff] = useState(null);
  const [existingReservations, setExistingReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false); // 🆕 認証同期完了フラグ

  const [viewDate, setViewDate] = useState(new Date()); 
  const [selectedDate, setSelectedDate] = useState(new Date()); 
  const [selectedTime, setSelectedTime] = useState(null); 
  const [travelTimeMinutes, setTravelTimeMinutes] = useState(0);
  const visitorAddress = location.state?.visitorAddress; 

  // --- 🆕 修正：データ取得ロジック（リトライ・リロードを排除） ---
  const fetchInitialData = async () => {
    setLoading(true);

    try {
      // 1. ショップ情報の取得
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', shopId).single();
      if (!profile) { setLoading(false); return; }
      setShop(profile);

      // 2. スタッフ情報の取得
      const { data: staffsData } = await supabase.from('staffs').select('*').eq('shop_id', shopId);
      setAllStaffs(staffsData || []);

      if (effectiveStaffId) {
        const staff = staffsData?.find(s => s.id === effectiveStaffId);
        if (staff) setTargetStaff(staff);
      }

      // 3. 同期対象ショップの特定
      let targetShopIds = [shopId];
      if (profile.schedule_sync_id) {
        const { data: siblingShops } = await supabase.from('profiles').select('id').eq('schedule_sync_id', profile.schedule_sync_id);
        if (siblingShops) targetShopIds = siblingShops.map(s => s.id);
      }

      // 4. 既存予約の取得（認証が確定しているため、RLSによる空配列問題を回避できます）
      const { data: resData } = await supabase
        .from('reservations')
        .select('start_time, end_time, staff_id, res_type') 
        .in('shop_id', targetShopIds);
        
      setExistingReservations(resData || []);

      // 5. 業種キーワードによる自動判定（三土手さんのロジックを完全維持）
      const VISIT_KEYWORDS = ['訪問', '出張', '代行', 'デリバリー', '清掃'];
      const businessTypeName = profile.business_type || '';
      const isVisit = VISIT_KEYWORDS.some(keyword => businessTypeName.includes(keyword));

      if (isVisit && profile.minutes_per_km) {
        const speed = profile.minutes_per_km; 
        const averageDistance = 7; 
        const calculatedBuffer = averageDistance * speed; 
        setTravelTimeMinutes(calculatedBuffer);
        console.log(`🚗 訪問予約を検知: バッファ ${calculatedBuffer}分`);
      } else {
        setTravelTimeMinutes(0);
        console.log(`✂️ 来店予約を検知: 移動バッファ 0分`);
      }
    } catch (error) {
      console.error("データ取得中にエラーが発生しました:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- 🆕 修正：認証状態の監視 ---
  useEffect(() => {
    // Supabaseのセッション確定を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // 初期セッション確認またはサインイン時に「Ready」にする
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setIsAuthReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- 🆕 修正：認証がReadyになったらデータを取得 ---
  useEffect(() => {
    if (isAuthReady) {
      fetchInitialData();
    }
  }, [isAuthReady, shopId, effectiveStaffId]);

  // --- ⚙️ エンジンロジック（三土手さんのロジックを完全継承） ---
  const checkIsRegularHoliday = (date) => {
    if (!shop?.business_hours?.regular_holidays) return false;
    const holidays = shop.business_hours.regular_holidays;
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayName = dayNames[date.getDay()];
    const dom = date.getDate();
    const nthWeek = Math.ceil(dom / 7);
    const tempDate = new Date(date);
    const currentMonth = tempDate.getMonth();
    const checkLast = new Date(date);
    checkLast.setDate(dom + 7);
    const isLastWeek = checkLast.getMonth() !== currentMonth;
    const checkSecondLast = new Date(date);
    checkSecondLast.setDate(dom + 14);
    const isSecondToLastWeek = (checkSecondLast.getMonth() !== currentMonth) && !isLastWeek;
    if (holidays[`${nthWeek}-${dayName}`]) return true;
    if (isLastWeek && holidays[`L1-${dayName}`]) return true;
    if (isSecondToLastWeek && holidays[`L2-${dayName}`]) return true;
    return false;
  };

  // ✅ 🆕 修正：長期休暇（夏休み等）の期間中か判定する関数を追加
  const checkIsSpecialHoliday = (date) => {
    // 💡 新設した special_holidays カラムを見に行きます
    if (!shop?.special_holidays || !Array.isArray(shop.special_holidays)) return false;
    
    const targetDateStr = date.toLocaleDateString('sv-SE'); // YYYY-MM-DD形式
    
    return shop.special_holidays.some(h => {
      // 💡 選択した日が「開始日」と「終了日」の間であれば true を返す
      return targetDateStr >= h.start && targetDateStr <= h.end;
    });
  };

  const isStaffOnHoliday = (date, staff) => {
    if (!staff?.weekly_holidays) return false;
    return staff.weekly_holidays.includes(date.getDay());
  };

  const timeSlots = useMemo(() => {
    if (!shop?.business_hours) return [];
    let minOpen = "23:59", maxClose = "00:00";
    Object.values(shop.business_hours).forEach(h => {
      if (typeof h === 'object' && h.is_closed) return;
      if (typeof h === 'object' && h.open && h.open < minOpen) minOpen = h.open;
      if (typeof h === 'object' && h.close && h.close > maxClose) maxClose = h.close;
    });
    const slots = [];
    const interval = shop.slot_interval_min || 15;
    let current = new Date();
    const [h, m] = minOpen.split(':').map(Number);
    current.setHours(h, m, 0, 0);
    const dayEnd = new Date();
    const [eh, em] = maxClose.split(':').map(Number);
    dayEnd.setHours(eh, em, 0, 0);
    while (current < dayEnd) {
      slots.push(current.toTimeString().slice(0, 5));
      current.setMinutes(current.getMinutes() + interval);
    }
    return slots;
  }, [shop]);

  const checkAvailability = (date, timeStr) => {
    if (!shop?.business_hours) return { status: 'none', remaining: 0 };

    // 💡 🆕 修正：定休日 または 長期休暇 なら「休」にする
    if (checkIsRegularHoliday(date) || checkIsSpecialHoliday(date)) {
      return { status: 'closed', label: '休', remaining: 0 };
    }

    const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()];
    const hours = shop.business_hours[dayOfWeek];
    const dateStr = date.toLocaleDateString('sv-SE'); 
    const now = new Date();
    const todayStr = now.toLocaleDateString('sv-SE');
    const openTime = hours?.open || "09:00";
    const closeTime = hours?.close || "18:00";

    if (timeStr < openTime || timeStr >= closeTime) return { status: 'none', remaining: 0 };
    if (hours?.rest_start && hours?.rest_end && timeStr >= hours.rest_start && timeStr < hours.rest_end) return { status: 'rest', label: '休', remaining: 0 };

    const targetDateTime = new Date(`${dateStr}T${timeStr}:00`);
    const buffer = shop.buffer_preparation_min || 0;
    const interval = shop.slot_interval_min || 15;

    const totalMinRequired = (totalSlotsNeeded * interval) + buffer + (travelTimeMinutes || 0);
    const potentialEndTime = new Date(targetDateTime.getTime() + totalMinRequired * 60 * 1000);
        
    const [closeH, closeM] = closeTime.split(':').map(Number);
    const closeDateTime = new Date(`${dateStr}T${String(closeH).padStart(2,'0')}:${String(closeM).padStart(2,'0')}:00`);

    if (potentialEndTime > closeDateTime) return { status: 'short', label: '△', remaining: 0 };

    const limitDays = Math.floor((shop.min_lead_time_hours || 0) / 24);
    const limitDate = new Date(now);
    limitDate.setHours(0,0,0,0);
    limitDate.setDate(limitDate.getDate() + limitDays);

    if (dateStr === todayStr && targetDateTime < now) return { status: 'past', label: '－', remaining: 0 };
    if (new Date(dateStr) < limitDate) return { status: 'past', label: '－', remaining: 0 };

    const storeMax = shop?.max_capacity || 1;
    const activeStaffs = allStaffs.filter(s => {
      if (targetStaff && s.id !== targetStaff.id) return false;
      if (isStaffOnHoliday(date, s)) return false;
      return true;
    });

    let minRemaining = storeMax;

    for (let t = targetDateTime.getTime(); t < potentialEndTime.getTime(); t += interval * 60 * 1000) {
      const travelBufferMs = (travelTimeMinutes || 0) * 60 * 1000;
      const prepBufferMs = (shop.buffer_preparation_min || 0) * 60 * 1000;
  
      const globalCount = existingReservations.filter(res => {
        const resStart = new Date(res.start_time).getTime();
        const resEnd = new Date(res.end_time).getTime();
        const blockedUntil = resEnd + prepBufferMs + travelBufferMs;
        return t >= resStart && t < blockedUntil;
      }).length;
        
      if (globalCount >= storeMax) return { status: 'booked', label: '×', remaining: 0 };
      minRemaining = Math.min(minRemaining, storeMax - globalCount);

      const anyStaffAvailable = activeStaffs.some(staff => {
        const staffCurrentLoad = existingReservations.filter(res => {
          if (res.staff_id !== staff.id) return false;
          const resStart = new Date(res.start_time).getTime();
          const resEnd = new Date(res.end_time).getTime();
          const blockedUntil = resEnd + prepBufferMs + travelBufferMs;
          return t >= resStart && t < blockedUntil;
        }).length;
        return staffCurrentLoad < (staff.concurrent_capacity || 1);
      });
      if (!anyStaffAvailable) return { status: 'booked', label: '×', remaining: 0 };
    }

    if (shop.auto_fill_logic && (storeMax === 1 || targetStaff)) {
      const dayRes = existingReservations.filter(r => r.start_time.startsWith(dateStr) && (!targetStaff || r.staff_id === targetStaff.id));
      if (dayRes.length > 0) {
        const specialSlots = [];
        const gapBlockCandidates = [];
        dayRes.forEach(r => {
          const resEnd = new Date(r.end_time).getTime();
          const earliestPossible = resEnd + (buffer * 60 * 1000);
          const perfectPostSlot = timeSlots.find(s => {
            const [sh, sm] = s.split(':').map(Number);
            const slotDate = new Date(dateStr); slotDate.setHours(sh, sm, 0, 0);
            return slotDate.getTime() >= earliestPossible;
          });
          if (perfectPostSlot) {
            specialSlots.push(perfectPostSlot); 
            const idx = timeSlots.indexOf(perfectPostSlot);
            if (idx + 1 < timeSlots.length) gapBlockCandidates.push(timeSlots[idx + 1]);
          }
          const resStartStr = new Date(r.start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
          const startIdx = timeSlots.indexOf(resStartStr);
          if (startIdx >= 3) gapBlockCandidates.push(timeSlots[startIdx - 3]);
        });
        if (gapBlockCandidates.includes(timeStr) && !specialSlots.includes(timeStr)) {
          return { status: 'gap', label: '✕', remaining: 0 }; 
        }
      }
    }
    return { status: 'available', label: '◎', remaining: minRemaining };
  };

// ✅ 🆕 修正：カレンダーの一部を残してゆっくりスクロールする
  const handleDateClick = (date) => {
    const isHoliday = checkIsRegularHoliday(date);
    const isPast = date < new Date(new Date().setHours(0,0,0,0));
    if (isHoliday || isPast) return;

    setSelectedDate(date);
    
    // 💡 日付を変えてから表示が切り替わるのを少し待つ
    setTimeout(() => {
      const element = timeSlotsRef.current;
      if (element) {
        // 🆕 止まる位置の調整（180pxほど上に余白を作ることでカレンダーを見せる）
        const offset = 180; 
        const bodyRect = document.body.getBoundingClientRect().top;
        const elementRect = element.getBoundingClientRect().top;
        const elementPosition = elementRect - bodyRect;
        const offsetPosition = elementPosition - offset;

        // 指定した位置へスムーズにスクロール
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth' // 💡 これでゆっくり動きます
        });
      }
    }, 100);
  };

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= lastDate; d++) days.push(new Date(year, month, d));
    return days;
  }, [viewDate]);

  // --- 🆕 修正：レンダリング条件（認証同期が終わるまで待機） ---
  if (!isAuthReady || loading) {
    return <div style={{textAlign:'center', padding:'100px', color: '#64748b'}}>読み込み中...</div>;
  }

  const themeColor = shop?.theme_color || '#2563eb';

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif', color: '#333', background: '#f8fafc', minHeight: '100vh', paddingBottom: '140px' }}>
      <div style={{ padding: '20px', background: '#fff', borderBottom: '1px solid #e2e8f0', sticky: 'top', zIndex: 10 }}>
        <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', color: '#64748b', fontSize: '0.9rem', marginBottom: '10px', cursor: 'pointer' }}>← 戻る</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>{targetStaff ? `${targetStaff.name} 指名` : '日時選択'}</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: themeColor }}>所要時間: {totalSlotsNeeded * (shop?.slot_interval_min || 15)}分</p>
          </div>
          <Clock color={themeColor} size={24} />
        </div>
      </div>

      <div style={{ padding: '15px' }}>
        <div style={{ background: '#fff', borderRadius: '20px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <button 
              onClick={() => setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} 
              style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft size={20}/>
            </button>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
              {viewDate.getFullYear()}年 {viewDate.getMonth() + 1}月
            </h3>
            <button 
              onClick={() => setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} 
              style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronRight size={20}/>
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', textAlign: 'center' }}>
            {['日','月','火','水','木','金','土'].map((d, i) => (
              <div key={d} style={{ fontSize: '0.7rem', color: i === 0 ? '#ef4444' : i === 6 ? '#2563eb' : '#94a3b8', fontWeight: 'bold', marginBottom: '10px' }}>{d}</div>
            ))}
            {calendarDays.map((date, i) => {
              if (!date) return <div key={`empty-${i}`} />;
              const isSelected = selectedDate?.toDateString() === date.toDateString();
              const isHoliday = checkIsRegularHoliday(date);
              const isPast = date < new Date(new Date().setHours(0,0,0,0));
              return (
<div 
                  key={date.toString()} 
                  onClick={() => handleDateClick(date)} // 🆕 以前の setSelectedDate を handleDateClick に変更
                  style={{
                    
                    padding: '10px 0', borderRadius: '12px', cursor: isHoliday || isPast ? 'default' : 'pointer',
                    background: isSelected ? themeColor : 'transparent',
                    color: isSelected ? '#fff' : (isHoliday || isPast ? '#cbd5e1' : '#1e293b'),
                    fontWeight: isSelected ? 'bold' : 'normal',
                    position: 'relative'
                  }}
                >
                  {date.getDate()}
                  {!isHoliday && !isPast && <div style={{ width: '4px', height: '4px', background: isSelected ? '#fff' : themeColor, borderRadius: '50%', margin: '2px auto 0' }} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      <div style={{ padding: '0 15px 20px' }}>
        {/* ✅ 🆕 ここに ref={timeSlotsRef} を追加して目印にします */}
        <h4 ref={timeSlotsRef} style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CalendarIcon size={16} /> {selectedDate.getMonth()+1}月{selectedDate.getDate()}日の空き時間
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {timeSlots.map(time => {
            const res = checkAvailability(selectedDate, time);
            if (['none', 'closed', 'rest', 'past', 'booked', 'gap', 'short'].includes(res.status)) return null;
            const isSelected = selectedTime === time;
            const isSolo = (shop?.max_capacity || 1) === 1;
            return (
              <button
                key={time}
                onClick={() => setSelectedTime(time)}
                style={{
                  padding: '15px', borderRadius: '16px', border: '2px solid',
                  borderColor: isSelected ? themeColor : '#fff',
                  background: isSelected ? `${themeColor}11` : '#fff',
                  textAlign: 'left', cursor: 'pointer', transition: '0.2s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: isSelected ? themeColor : '#1e293b' }}>{time}</div>
                {!isSolo && res.remaining === 1 && (
                  <div style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 'bold', marginTop: '4px' }}>残り1枠！</div>
                )}
                {!isSolo && res.remaining > 1 && (
                  <div style={{ fontSize: '0.7rem', color: '#10b981', marginTop: '4px' }}>残り{res.remaining}枠</div>
                )}
                {isSolo && (
                  <div style={{ fontSize: '0.7rem', color: themeColor, marginTop: '4px' }}>予約可能</div>
                )}
              </button>
            );
          })}
        </div>
        {timeSlots.every(t => ['none', 'closed', 'rest', 'past', 'booked', 'gap'].includes(checkAvailability(selectedDate, t).status)) && (
          <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '20px', color: '#94a3b8' }}>
            ごめんなさい！<br/>この日は予約がいっぱいです。
          </div>
        )}
      </div>

      {selectedTime && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', padding: '20px', borderTop: '1px solid #e2e8f0', textAlign: 'center', zIndex: 100, boxShadow: '0 -10px 20px rgba(0,0,0,0.05)' }}>
          <div style={{ marginBottom: '12px', fontSize: '0.95rem' }}>
            選択中：<span style={{ fontWeight: 'bold', color: themeColor }}>{selectedDate.toLocaleDateString('ja-JP')} {selectedTime}〜</span>
          </div>
          <button 
            style={{ width: '100%', maxWidth: '400px', padding: '18px', background: themeColor, color: '#fff', border: 'none', borderRadius: '16px', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: `0 8px 20px ${themeColor}44`, cursor: 'pointer' }} 
            onClick={() => navigate(`/shop/${shopId}/confirm`, { 
              state: { ...location.state, date: selectedDate.toLocaleDateString('sv-SE'), time: selectedTime, staffId: targetStaff?.id || staffIdFromUrl || location.state?.staffId } 
            })}
          >
            予約内容の確認へ進む
          </button>
        </div>
      )}
    </div>
  );
}

export default TimeSelectionCalendar;