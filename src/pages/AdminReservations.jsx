import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function AdminReservations() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // --- 状態管理 ---
  const [shop, setShop] = useState(null);
  const [staffs, setStaffs] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    if (dateParam) {
      const d = new Date(dateParam);
      return isNaN(d.getTime()) ? new Date() : d;
    }
    return new Date();
  }); 

  const [selectedDate, setSelectedDate] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    return dateParam || new Date().toLocaleDateString('sv-SE');
  }); 
  
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [targetTime, setTargetTime] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRes, setSelectedRes] = useState(null);
  const [showSlotListModal, setShowSlotListModal] = useState(false);
  const [selectedSlotReservations, setSelectedSlotReservations] = useState([]);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMonth, setViewMonth] = useState(new Date(startDate)); 

  const [customers, setCustomers] = useState([]); 
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerFullHistory, setCustomerFullHistory] = useState([]);
  const [editFields, setEditFields] = useState({ name: '', phone: '', email: '', memo: '', line_user_id: null });

  // キーボード選択用のIndex管理
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isPC = windowWidth > 1024;

  useEffect(() => { fetchData(); }, [shopId, startDate]);

  // ✅ ツイン・カレンダー対応版 fetchData
  const fetchData = async () => {
    setLoading(true);
    // 1. 自分の店舗プロフィールを取得
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (!profile) { setLoading(false); return; }
    setShop(profile);

    // 2. スケジュール共有設定（schedule_sync_id）を確認
    let targetShopIds = [shopId];
    if (profile.schedule_sync_id) {
      const { data: siblingShops } = await supabase
        .from('profiles')
        .select('id')
        .eq('schedule_sync_id', profile.schedule_sync_id);
      if (siblingShops) {
        targetShopIds = siblingShops.map(s => s.id);
      }
    }

    // 3. 全関連店舗の予約データを合算して取得（店名も一緒に取得）
    const { data: resData } = await supabase
      .from('reservations')
      .select('*, profiles(business_name), staffs(name)')
      .in('shop_id', targetShopIds);
    const { data: staffsData } = await supabase.from('staffs').select('*').eq('shop_id', shopId);
    setStaffs(staffsData || []);

    setReservations(resData || []);
    setLoading(false);
  };

  useEffect(() => {
    const searchCustomers = async () => {
      if (!searchTerm) { setCustomers([]); setSelectedIndex(-1); return; }
      const { data } = await supabase.from('customers').select('*').eq('shop_id', shopId).ilike('name', `%${searchTerm}%`).limit(5);
      setCustomers(data || []);
      setSelectedIndex(-1); // 検索ワードが変わったら選択位置をリセット
    };
    const timer = setTimeout(searchCustomers, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, shopId]);

  const openCustomerDetail = async (customer) => {
    setSelectedCustomer(customer);
    setEditFields({ 
      name: customer.name, 
      phone: customer.phone || '', 
      email: customer.email || '', 
      memo: customer.memo || '',
      line_user_id: customer.line_user_id || null 
    });
    setSearchTerm('');
    setSelectedIndex(-1);
    const { data } = await supabase.from('reservations').select('*').eq('shop_id', shopId).eq('customer_name', customer.name).order('start_time', { ascending: false });
    setCustomerFullHistory(data || []);
    setShowCustomerModal(true);
  };

  // キーボード操作用ハンドラー
  const handleKeyDown = (e) => {
    if (customers.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < customers.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0) {
        e.preventDefault();
        openCustomerDetail(customers[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setSearchTerm('');
      setCustomers([]);
    }
  };

  const openDetail = async (res) => {
    // 🆕 修正ポイント： shop_id が存在し、かつ現在の店舗と違う場合のみアラートを出す
    // (定休日などのシステムデータには shop_id がないので、スルーさせる)
    if (res.shop_id && res.shop_id !== shopId) {
      alert(`こちらは他店舗（${res.profiles?.business_name || '別ブランド'}）の予約枠です。詳細は各店舗の管理画面で確認してください。`);
      return;
    }

    setSelectedRes(res);
    let cust = null;
    if (res.line_user_id) {
      const { data } = await supabase.from('customers').select('*').eq('shop_id', shopId).eq('line_user_id', res.line_user_id).maybeSingle();
      cust = data;
    }
    if (!cust && res.customer_name) {
      const { data } = await supabase.from('customers').select('*').eq('shop_id', shopId).eq('name', res.customer_name).maybeSingle();
      cust = data;
    }

    if (cust) {
      setSelectedCustomer(cust);
      setEditFields({ 
        name: cust.name, 
        phone: cust.phone || '', 
        email: cust.email || '', 
        memo: cust.memo || '',
        line_user_id: cust.line_user_id || res.line_user_id || null
      });
    } else {
      setSelectedCustomer(null);
      setEditFields({ 
        name: res.customer_name, 
        phone: res.customer_phone || '', 
        email: res.customer_email || '', 
        memo: '',
        line_user_id: res.line_user_id || null
      });
    }
    const history = reservations.filter(r => r.shop_id === shopId && r.res_type === 'normal' && r.id !== res.id && (r.customer_name === res.customer_name) && new Date(r.start_time) < new Date(res.start_time)).sort((a, b) => new Date(b.start_time) - new Date(a.start_time)).slice(0, 5);
    setCustomerHistory(history);
    setShowDetailModal(true);
  };

  // ✅ 名簿保存 ＆ 統合（名寄せ）ロジック強化版
  const handleUpdateCustomer = async () => {
    try {
      let targetCustomerId = selectedCustomer?.id;

      // --- 🆕 名寄せ（統合）チェックロジック ---
      // 1. 編集中のID以外で、同じ名前の人がいないか探す
      const { data: duplicateNameCust } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .eq('name', editFields.name)
        .neq('id', targetCustomerId || '00000000-0000-0000-0000-000000000000') // 自分以外
        .maybeSingle();

      // 2. もし同姓同名が見つかった場合（山田花子さんケース）
      if (duplicateNameCust) {
        const confirmMerge = window.confirm(
          `「${editFields.name}」様は既に名簿に存在します。\n現在編集中のデータ（LINE連携など）を、既存の「${editFields.name}」様のデータへ統合しますか？\n\n※過去の予約履歴もすべて一つにまとまります。`
        );

        if (confirmMerge) {
          // A. 既存の顧客データ（山田花子側）を最新情報で更新
          const { error: mergeUpdateError } = await supabase
            .from('customers')
            .update({
              phone: editFields.phone || duplicateNameCust.phone,
              email: editFields.email || duplicateNameCust.email,
              memo: editFields.memo || duplicateNameCust.memo,
              line_user_id: editFields.line_user_id || duplicateNameCust.line_user_id,
              updated_at: new Date().toISOString()
            })
            .eq('id', duplicateNameCust.id);

          if (mergeUpdateError) throw mergeUpdateError;

          // B. 現在編集していた側の予約データをすべて既存顧客側に紐付け直す
          // （旧名「パナコン」で入っていた予約を「山田花子」の名前に救出する）
          if (selectedCustomer) {
             await supabase
              .from('reservations')
              .update({ customer_name: editFields.name })
              .eq('shop_id', shopId)
              .eq('customer_name', selectedCustomer.name);

            // C. 不要になった重複レコード（パナコン側）を削除
            await supabase.from('customers').delete().eq('id', selectedCustomer.id);
          }

          alert('データの統合が完了しました！');
          setShowCustomerModal(false); 
          setShowDetailModal(false); 
          fetchData();
          return;
        } else {
          // 統合しない場合は、そのまま保存（同姓同名が並存する状態。SQLで制約を外したので可能）
        }
      }
      // --- 🆕 統合チェック終了 ---

      if (!targetCustomerId) {
        let checkQuery = supabase.from('customers').select('id').eq('shop_id', shopId).eq('name', editFields.name);
        if (editFields.line_user_id) {
          checkQuery = checkQuery.eq('line_user_id', editFields.line_user_id);
        } else if (editFields.phone) {
          checkQuery = checkQuery.eq('phone', editFields.phone);
        }
        
        const { data: existingCust } = await checkQuery.maybeSingle();
        if (existingCust) {
          targetCustomerId = existingCust.id;
        }
      }

const payload = {
        shop_id: shopId,
        name: editFields.name,
        phone: editFields.phone || null,        // 👈 空なら null
        email: editFields.email || null,        // 👈 空なら null
        memo: editFields.memo || null,          // 👈 空なら null
        line_user_id: editFields.line_user_id || null, // 👈 これが 400 エラーの主犯格であることが多いです
        updated_at: new Date().toISOString()
      };

      if (targetCustomerId) {
        payload.id = targetCustomerId;
      }

      const { error: custError } = await supabase.from('customers').upsert(payload, { onConflict: 'id' });

      if (custError) { 
        alert('名簿保存エラー: ' + custError.message); 
        return;
      }

      let resQuery = supabase.from('reservations').update({ 
        customer_name: editFields.name,
        customer_phone: editFields.phone,
        customer_email: editFields.email,
        staff_id: selectedRes.staff_id
      }).eq('shop_id', shopId);

      if (editFields.line_user_id) {
        resQuery = resQuery.eq('line_user_id', editFields.line_user_id);
      } else if (selectedRes) {
        resQuery = resQuery.eq('customer_name', selectedRes.customer_name);
      }

      const { error: resSyncError } = await resQuery;

      if (resSyncError) {
        console.error('予約データの同期に失敗しましたが名簿は更新されました:', resSyncError.message);
      }

      alert('名簿情報を更新し、カレンダーにも反映しました！'); 
      setShowCustomerModal(false); 
      setShowDetailModal(false); 
      fetchData(); 
    } catch (err) {
      console.error(err);
      alert('予期せぬエラーが発生しました');
    }
  };

  const deleteRes = async (id) => {
    const isBlock = selectedRes?.res_type === 'blocked';
    const msg = isBlock ? 'このブロックを解除して予約を「可能」に戻しますか？' : 'この予約データを消去して予約を「可能」に戻しますか？';
    
    if (window.confirm(msg)) {
      const { customer_name, res_type } = selectedRes;
      const { error: deleteError } = await supabase.from('reservations').delete().eq('id', id);
      if (deleteError) { alert('削除に失敗しました: ' + deleteError.message); return; }

      if (res_type === 'normal') {
        const { count } = await supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('customer_name', customer_name);
        if (count === 0) {
          await supabase.from('customers').delete().eq('shop_id', shopId).eq('name', customer_name);
        } else {
          const { data: cust } = await supabase.from('customers').select('id, total_visits').eq('shop_id', shopId).eq('name', customer_name).maybeSingle();
          if (cust) {
            await supabase.from('customers').update({ total_visits: Math.max(0, (cust.total_visits || 1) - 1) }).eq('id', cust.id);
          }
        }
      }
      setShowDetailModal(false); fetchData();
    }
  };

  const checkIsRegularHoliday = (date) => {
    if (!shop?.business_hours?.regular_holidays) return false;
    const holidays = shop.business_hours.regular_holidays;
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayName = dayNames[date.getDay()];
    const dom = date.getDate();
    const nthWeek = Math.ceil(dom / 7);
    const tempDate = new Date(date);
    const currentMonth = tempDate.getMonth();
    const checkLast = new Date(date); checkLast.setDate(dom + 7);
    const isLastWeek = checkLast.getMonth() !== currentMonth;
    const checkSecondLast = new Date(date); checkSecondLast.setDate(dom + 14);
    const isSecondToLastWeek = (checkSecondLast.getMonth() !== currentMonth) && !isLastWeek;
    if (holidays[`${nthWeek}-${dayName}`]) return true;
    if (isLastWeek && holidays[`L1-${dayName}`]) return true;
    if (isSecondToLastWeek && holidays[`L2-${dayName}`]) return true;
    return false;
  };

  const weekDays = useMemo(() => {
    const days = [];
    const base = new Date(startDate);
    const dayOfWeek = base.getDay(); 
    base.setDate(base.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); 
    for (let i = 0; i < 7; i++) {
      const d = new Date(base); d.setDate(d.getDate() + i); days.push(d);
    }
    return days;
  }, [startDate]);

  const timeSlots = useMemo(() => {
    if (!shop?.business_hours) return [];
    let minTotalMinutes = 24 * 60;
    let maxTotalMinutes = 0;
    let hasOpenDay = false;
    Object.values(shop.business_hours).forEach(h => {
      if (typeof h === 'object' && !h.is_closed && h.open && h.close) {
        hasOpenDay = true;
        const [openH, openM] = h.open.split(':').map(Number);
        const [closeH, closeM] = h.close.split(':').map(Number);
        if (openH * 60 + openM < minTotalMinutes) minTotalMinutes = openH * 60 + openM;
        if (closeH * 60 + closeM > maxTotalMinutes) maxTotalMinutes = closeH * 60 + closeM;
      }
    });
    if (!hasOpenDay) { minTotalMinutes = 9 * 60; maxTotalMinutes = 18 * 60; }
    const slots = [];
    const interval = shop.slot_interval_min || 15;
    const extraBefore = shop.extra_slots_before || 0; // 🆕 追加
    const extraAfter = shop.extra_slots_after || 0;   // 🆕 追加

    // 🆕 拡張分を含めた開始・終了時間を計算
    const finalStart = minTotalMinutes - (extraBefore * interval);
    const finalEnd = maxTotalMinutes + (extraAfter * interval);

    for (let m = finalStart; m <= finalEnd; m += interval) {
      const h = Math.floor(m / 60); const mm = m % 60;
      slots.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
    }
    return slots;
  }, [shop]);

  const getJapanDateStr = (date) => date.toLocaleDateString('sv-SE');

const getStatusAt = (dateStr, timeStr) => {
    const dateObj = new Date(dateStr);
    const currentSlotStart = new Date(`${dateStr}T${timeStr}:00`).getTime();

// 1. 【最優先】DBにある予約や自己予定をチェック
const matches = reservations.filter(r => {
  const start = new Date(r.start_time).getTime();
  const end = new Date(r.end_time).getTime();
  const isTimeMatch = currentSlotStart >= start && currentSlotStart < end;

  if (isTimeMatch) {
    // 🆕 修正：ブロック(✕)の場合は、staff_id が null (店全体) のものだけを表示
    // これにより、スタッフ個人の「✕」や「休み」はカレンダー画面から消えます。
    if (r.res_type === 'blocked') {
      return r.staff_id === null;
    }
    // 通常の予約（normal）は担当者が誰であっても全て表示します
    return true;
  }
  return false;
});

// 絞り込まずに、該当する予約があれば「配列」としてそのまま返す
if (matches.length > 0) {
  return matches; 
}

    // 2. 【次点】定休日かどうかをチェック
    if (checkIsRegularHoliday(dateObj)) {
      return { res_type: 'blocked', customer_name: '定休日', start_time: `${dateStr}T${timeStr}:00`, isRegularHoliday: true };
    }

    // 3. 営業時間内(isStandardTime)のみ、インターバルと自動詰め(－)を表示
    const dayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dateObj.getDay()];
    const hours = shop?.business_hours?.[dayName];
    const isStandardTime = hours && !hours.is_closed && timeStr >= hours.open && timeStr < hours.close;

    if (isStandardTime) {
      const buffer = shop?.buffer_preparation_min || 0;
      const dayRes = reservations.filter(r => r.start_time.startsWith(dateStr) && r.res_type === 'normal' && r.shop_id === shopId);
      const isInBuffer = dayRes.some(r => {
        const resEnd = new Date(r.end_time).getTime();
        return currentSlotStart >= resEnd && currentSlotStart < (resEnd + buffer * 60 * 1000);
      });
      if (isInBuffer) return { res_type: 'system_blocked', customer_name: 'ｲﾝﾀｰﾊﾞﾙ', isBuffer: true };

      if (shop?.auto_fill_logic && dayRes.length > 0) {
        const primeSeats = []; const gapCandidates = [];
        dayRes.forEach(r => {
          const resEnd = new Date(r.end_time).getTime();
          const earliest = resEnd + (buffer * 60 * 1000);
          const nextPrime = timeSlots.find(s => {
            const [sh, sm] = s.split(':').map(Number);
            const sd = new Date(dateStr); sd.setHours(sh, sm, 0, 0);
            return sd.getTime() >= earliest;
          });
          if (nextPrime) {
            primeSeats.push(nextPrime);
            const pIdx = timeSlots.indexOf(nextPrime);
            if (pIdx + 1 < timeSlots.length) gapCandidates.push(timeSlots[pIdx + 1]);
          }
          const rStartStr = new Date(r.start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
          const startIdx = timeSlots.indexOf(rStartStr);
          if (startIdx >= 3) gapCandidates.push(timeSlots[startIdx - 3]);
        });
        if (gapCandidates.includes(timeStr) && !primeSeats.includes(timeStr)) {
          return { res_type: 'system_blocked', customer_name: '－', isGap: true };
        }
      }
    }
    return null;
  };
  const handleBlockTime = async () => {
    // 🆕 1. 予定の名前を入力してもらう小窓を出す
    const reason = window.prompt("予定名（例：打ち合わせ、忘年会）を入力してください", "管理者ブロック");
    
    // 🆕 2. 「キャンセル」を押されたら何もしない
    if (reason === null) return; 

    const start = new Date(`${selectedDate}T${targetTime}:00`);
    const interval = shop.slot_interval_min || 15;
    const end = new Date(start.getTime() + interval * 60000);
    
const insertData = {
  shop_id: shopId, 
  customer_name: reason, 
  res_type: 'blocked', // 👈 SQLで追加したカラム
  start_time: start.toISOString(), 
  end_time: end.toISOString(),
  total_slots: 1, 
  customer_email: 'admin@example.com', 
  customer_phone: '---', 
  options: { type: 'admin_block' } // 👈 SQLで追加したカラム
};
    
    const { error } = await supabase.from('reservations').insert([insertData]);
    if (error) alert(`エラー: ${error.message}`); 
    else { setShowMenuModal(false); fetchData(); }
  };

  const handleBlockFullDay = async () => {
    if (!window.confirm(`${selectedDate.replace(/-/g, '/')} を終日「予約不可」にしますか？`)) return;
    const interval = shop.slot_interval_min || 15;
    const dayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(selectedDate).getDay()];
    const hours = shop.business_hours?.[dayName];
    const openStr = (hours && !hours.is_closed && hours.open) ? hours.open : "09:00";
    const closeStr = (hours && !hours.is_closed && hours.close) ? hours.close : "18:00";
    const start = new Date(`${selectedDate}T${openStr}:00`);
    const end = new Date(`${selectedDate}T${closeStr}:00`);
    const [oh, om] = openStr.split(':').map(Number); const [ch, cm] = closeStr.split(':').map(Number);
    const totalMinutes = (ch * 60 + cm) - (oh * 60 + om);
    const slotsCount = Math.ceil(totalMinutes / interval);
    const insertData = {
      shop_id: shopId, customer_name: '臨時休業', res_type: 'blocked',
      start_at: start.toISOString(), end_at: end.toISOString(),
      start_time: start.toISOString(), end_time: end.toISOString(),
      total_slots: slotsCount, customer_email: 'admin@example.com', customer_phone: '---',
      options: { services: [], isFullDay: true }
    };
    const { error } = await supabase.from('reservations').insert([insertData]);
    if (error) alert(`エラー: ${error.message}`); else { setShowMenuModal(false); fetchData(); }
  };

  const miniCalendarDays = useMemo(() => {
    const year = viewMonth.getFullYear(); const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  }, [viewMonth]);

  const goPrev = () => setStartDate(new Date(new Date(startDate).setDate(new Date(startDate).getDate() - 7)));
  const goNext = () => setStartDate(new Date(new Date(startDate).setDate(new Date(startDate).getDate() + 7)));
  const goPrevMonth = () => setStartDate(new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() - 1)));
  const goNextMonth = () => setStartDate(new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + 1)));
  const goToday = () => { const today = new Date(); setStartDate(today); setSelectedDate(today.toLocaleDateString('sv-SE')); navigate(`/admin/${shopId}/reservations`, { replace: true }); };

  const themeColor = shop?.theme_color || '#2563eb';
  const themeColorLight = `${themeColor}15`; 

  const isManagementEnabled = shop?.is_management_enabled === true;

  const miniBtnStyle = { border: 'none', background: 'none', cursor: 'pointer', color: themeColor };
  const floatNavBtnStyle = { border: 'none', background: 'none', width: '60px', height: '50px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' };
  const modalContentStyle = { background: '#fff', width: '95%', borderRadius: '25px', padding: '30px', maxHeight: '85vh', overflowY: 'auto' };
  const headerBtnStylePC = { padding: '10px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer' };
  const mobileArrowBtnStyle = { background: '#f1f5f9', border: 'none', width: '40px', height: '40px', borderRadius: '50%', fontSize: '1rem', cursor: 'pointer' };
  const labelStyle = { fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', marginBottom: '5px', display: 'block' };
  const inputStyle = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '12px', fontSize: '1rem', boxSizing: 'border-box' };

  const getFamilyName = (fullName) => {
    if (!fullName) return "";
    const parts = fullName.split(/[\s\u3000]+/); 
    return parts[0];
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#fff', overflow: 'hidden', position: 'fixed', inset: 0 }}>
      {isPC && (
        <div style={{ width: '320px', flexShrink: 0, borderRight: '1px solid #e2e8f0', padding: '25px', display: 'flex', flexDirection: 'column', gap: '25px', background: '#fff', zIndex: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '35px', height: '35px', background: themeColor, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>S</div>
              <h1 style={{ fontSize: '1.2rem', fontWeight: '900', margin: 0 }}>SnipSnap Admin</h1>

            {/* 🆕 画面切り替えスイッチ（PC版） */}
  <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', marginLeft: '10px' }}>
    <button style={switchBtnStyle(true)}>カレンダー</button>
    <button onClick={() => navigate(`/admin/${shopId}/timeline?date=${selectedDate}`)} style={switchBtnStyle(false)}>タイムライン</button>
  </div>
</div>
            <button 
              onClick={() => navigate(`/admin/${shopId}`)} 
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '5px', display: 'flex', alignItems: 'center', color: '#64748b' }}
              title="店舗設定"
            >
              ⚙️
            </button>
          </div>

          <div style={{ border: '1px solid #eee', borderRadius: '12px', padding: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontWeight: 'bold' }}>
              {viewMonth.getFullYear()}年 {viewMonth.getMonth() + 1}月
              <div style={{ display: 'flex', gap: '5px' }}>
                <button onClick={() => setViewMonth(new Date(viewMonth.setMonth(viewMonth.getMonth() - 1)))} style={miniBtnStyle}>＜</button>
                <button onClick={() => setViewMonth(new Date(viewMonth.setMonth(viewMonth.getMonth() + 1)))} style={miniBtnStyle}>＞</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', fontSize: '0.8rem' }}>
              {['月','火','水','木','金','土','日'].map(d => <div key={d} style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 'bold' }}>{d}</div>)}
              {miniCalendarDays.map((date, i) => date ? <div key={i} onClick={() => { setStartDate(date); setSelectedDate(getJapanDateStr(date)); }} style={{ padding: '8px 0', cursor: 'pointer', borderRadius: '50%', background: getJapanDateStr(date) === selectedDate ? themeColor : 'none', color: getJapanDateStr(date) === selectedDate ? '#fff' : '#475569' }}>{date.getDate()}</div> : <div key={i} />)}
            </div>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              onClick={() => isManagementEnabled && navigate(`/admin/${shopId}/management`)} 
              style={{ 
                padding: '15px', 
                background: isManagementEnabled ? themeColor : '#e2e8f0', 
                color: isManagementEnabled ? '#fff' : '#94a3b8', 
                border: 'none', 
                borderRadius: '12px', 
                cursor: isManagementEnabled ? 'pointer' : 'not-allowed', 
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              disabled={!isManagementEnabled}
            >              
              {isManagementEnabled ? '📊 顧客・売上管理へ' : '🔒 顧客・売上管理 (未解放)'}
            </button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <div style={{ padding: isPC ? '15px 25px' : '15px 10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
          {isPC ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={goToday} style={headerBtnStylePC}>今日</button>
                <button onClick={goPrev} style={headerBtnStylePC}>前週</button>
                <button onClick={goNext} style={headerBtnStylePC}>次週</button>
              </div>
              <div style={{ position: 'relative', marginLeft: '10px', width: '300px' }}>
                <input type="text" placeholder="👤 顧客を検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={handleKeyDown} style={{ width: '100%', padding: '12px 15px 12px 40px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.9rem' }} />
                <span style={{ position: 'absolute', left: '12px', top: '12px', opacity: 0.4 }}>🔍</span>
                {customers.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', borderRadius: '12px', marginTop: '5px', zIndex: 1000, border: '1px solid #eee' }}>
                    {customers.map((c, index) => (
                      <div 
                        key={c.id} 
                        onClick={() => openCustomerDetail(c)} 
                        style={{ 
                          padding: '12px', 
                          borderBottom: '1px solid #f8fafc', 
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          background: index === selectedIndex ? themeColorLight : 'transparent'
                        }}
                      >
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{c.name} 様</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{c.phone || '電話未登録'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <h2 style={{ fontSize: '1.1rem', margin: '0 0 0 auto', fontWeight: '900', color: '#1e293b' }}>{startDate.getFullYear()}年 {startDate.getMonth() + 1}月</h2>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '15px' }}>
              <button onClick={goPrevMonth} style={mobileArrowBtnStyle}>◀</button>
              <h2 style={{ fontSize: '1.3rem', margin: 0, fontWeight: '900', color: '#1e293b' }}>{startDate.getFullYear()}年 {startDate.getMonth() + 1}月</h2>
              <button onClick={goNextMonth} style={mobileArrowBtnStyle}>▶</button>
            </div>
          )}
        </div>

{/* ✅ 親要素：はみ出しを隠し、高さを固定 */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          
<AnimatePresence mode="wait" initial={false}> {/* ✅ modeを"wait"にすると残像が消えます */}
  <motion.div
    key={startDate.toISOString()}
    
    // 🆕 酔い対策：移動距離を30→10へ短縮、不透明度をメインに
    initial={{ opacity: 0, x: 10 }} 
    animate={{ opacity: 1, x: 0 }} 
    exit={{ opacity: 0, x: -10 }} 
    
    // 🆕 Spring（バネ）設定
    transition={{ 
      type: "spring", 
      stiffness: 260, // バネの強さ（大きいほど速い）
      damping: 26,    // 抵抗（大きいほど揺れがすぐ止まる）
      mass: 0.5       // 軽さ（小さいほど軽快に動く）
    }}

    drag="x" 
    dragConstraints={{ left: 0, right: 0 }}
    dragElastic={0.1} // ✅ ゴムのような伸びを小さくして、ピタッと止まるように変更
    // ...あとの設定はそのまま...              
              onDragEnd={(e, { offset }) => {
                const swipeThreshold = 80;
                if (offset.x > swipeThreshold) goPrev(); // 右スワイプで前週
                else if (offset.x < -swipeThreshold) goNext(); // 左スワイプで次週
              }}

              // ✅ スタイル：縦スクロールはここで行う
              style={{ 
                flex: 1,
                width: '100%', 
                overflowY: 'auto', 
                overflowX: isPC ? 'auto' : 'hidden',
                cursor: 'grab',
                touchAction: 'pan-y' // 縦スクロールを邪魔しない
              }}
              whileTap={{ cursor: 'grabbing' }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: isPC ? '900px' : '100%' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff' }}>
                  <tr>
                    <th style={{ width: isPC ? '80px' : '32px', borderBottom: '1px solid #ddd' }}></th>
                    {weekDays.map(date => {
                      const isToday = getJapanDateStr(new Date()) === getJapanDateStr(date);
                      return (
                        <th key={date.toString()} style={{ padding: '4px 0', borderBottom: '1px solid #ddd' }}>
                          <div style={{ fontSize: '0.6rem', color: isToday ? themeColor : '#666' }}>{['日','月','火','水','木','金','土'][date.getDay()]}</div>
                          <div style={{ fontSize: isPC ? '1.5rem' : '0.9rem', fontWeight: 'bold', color: isToday ? '#fff' : '#333', background: isToday ? themeColor : 'none', width: isPC ? '40px' : '22px', height: isPC ? '40px' : '22px', borderRadius: '50%', margin: '2px auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{date.getDate()}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map(time => (
                    <tr key={time} style={{ height: '60px' }}>
                      <td style={{ borderRight: '1px solid #eee', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold' }}>{time}</span>
                      </td>
                      {weekDays.map(date => {
                        const dStr = getJapanDateStr(date);
                        const res = getStatusAt(dStr, time);
                        const isArray = Array.isArray(res);
                        const reservationCount = isArray ? res.length : 0;
                        const isStart = isArray && res.some(r => 
                          new Date(r.start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }) === time
                        );
                        const isOtherShop = isArray && res.some(r => r.shop_id !== shopId && r.res_type !== 'system_blocked' && !r.isRegularHoliday);

                        let bgColor = '#fff'; let borderColor = '#f1f5f9'; let textColor = '#cbd5e1';
                        if (res) {
                          if (!isArray && res.isRegularHoliday) { bgColor = '#f3f4f6'; textColor = '#94a3b8'; }
                          else if (isOtherShop) { bgColor = '#f1f5f9'; textColor = '#94a3b8'; borderColor = '#cbd5e1'; }
                          else if (isArray && res.some(r => r.res_type === 'blocked')) { bgColor = '#fee2e2'; textColor = '#ef4444'; borderColor = '#ef4444'; }
                          else if (!isArray && res.res_type === 'system_blocked') { bgColor = '#f8fafc'; textColor = '#cbd5e1'; }
                          else if (isStart) { bgColor = reservationCount > 1 ? '#e0e7ff' : themeColorLight; textColor = '#1e293b'; borderColor = themeColor; }
                          else { bgColor = '#fdfdfd'; textColor = '#cbd5e1'; }
                        }

                        return (
                          <td 
                            key={`${dStr}-${time}`} 
                            onClick={() => { 
                              setSelectedDate(dStr); 
                              setTargetTime(time); 
                              if (isArray) {
                                if (reservationCount > 1) { setSelectedSlotReservations(res); setShowSlotListModal(true); }
                                else { openDetail(res[0]); }
                              } else if (res && res.res_type === 'blocked' && !res.isRegularHoliday) {
                                openDetail(res);
                              } else {
                                setShowMenuModal(true); 
                              } 
                            }}
                            style={{ borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', position: 'relative', cursor: 'pointer' }}
                          >
                            {res && (
                              <div style={{ position: 'absolute', inset: '1px', background: bgColor, color: textColor, padding: '4px 8px', borderRadius: '2px', zIndex: 5, overflow: 'hidden', borderLeft: `2px solid ${borderColor}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                                {(!isArray && res.res_type === 'blocked') ? (
                                  res.isRegularHoliday ? (isStart ? <span style={{fontSize:'0.6rem', fontWeight:'bold'}}>定休日</span> : '') : 
                                  (res.customer_name === '臨時休業' && isStart ? <span style={{fontSize:'0.7rem', fontWeight:'bold'}}>臨時休業</span> : 
                                    (isStart ? (res.customer_name === '管理者ブロック' ? '✕' : <div style={{fontWeight:'bold', fontSize:'0.7rem', lineHeight:'1.1', overflow:'hidden'}}>{res.customer_name}</div>) : '✕')
                                  )
                                ) : (
                                  (!isArray && res.res_type === 'system_blocked') ? <span style={{fontSize:'0.6rem'}}>{res.customer_name}</span> : 
                                  (isStart ? (
                                    <div style={{ fontWeight: 'bold', fontSize: isPC ? '0.9rem' : 'calc(0.7rem + 0.2vw)', lineHeight: '1.1', height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                      {reservationCount > 1 ? <span style={{ fontSize: '1.1rem' }}>👥 {reservationCount}名</span> : (isPC ? `${res[0].customer_name} 様` : getFamilyName(res[0].customer_name))}
                                    </div>
                                  ) : isArray ? '・' : '')
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
            </motion.div>
          </AnimatePresence>
        </div>
        
        {!isPC && (
          <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', background: '#fff', borderRadius: '50px', boxShadow: '0 8px 30px rgba(0,0,0,0.15)', padding: '5px', zIndex: 100, border: '1px solid #eee' }}>
            <button onClick={goPrev} style={floatNavBtnStyle}>◀</button>
            <button onClick={goToday} style={{ ...floatNavBtnStyle, width: '80px', color: themeColor, fontSize: '0.9rem' }}>今日</button>
            <button onClick={goNext} style={floatNavBtnStyle}>▶</button>
          </div>
        )}
      </div>

{(showCustomerModal || showDetailModal) && (
        <div onClick={() => { if(selectedRes?.isRegularHoliday) return; setShowCustomerModal(false); setShowDetailModal(false); }} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...modalContentStyle, maxWidth: '650px', position: 'relative' }}>
            
            {/* 🆕 最上部：ねじ込み予約ボタン (通常予約がある場合のみ表示) */}
            {selectedRes?.res_type === 'normal' && (
              <button 
  onClick={() => navigate(`/shop/${shopId}/reserve`, { 
    state: { 
      adminDate: selectedDate, 
      adminTime: targetTime, 
      fromView: 'calendar', // ✅ カレンダーから来た目印
      isAdminMode: true,
      adminStaffId: staffs.length === 1 ? staffs[0].id : null
    } 
  })} 
                style={{ 
                  width: '100%', 
                  padding: '16px', 
                  background: themeColor, 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '15px', 
                  fontWeight: 'bold', 
                  cursor: 'pointer', 
                  marginBottom: '20px',
                  fontSize: '1rem',
                  boxShadow: `0 4px 12px ${themeColor}44`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                ➕ この時間にさらに予約を入れる（ねじ込み）
              </button>
            )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{showCustomerModal ? '👤 顧客マスター編集' : (selectedRes?.res_type === 'blocked' ? (selectedRes.isRegularHoliday ? '📅 定休日' : '🚫 ブロック設定') : '📅 予約詳細・名簿更新')}</h2>
              {isPC && <button onClick={() => { setShowCustomerModal(false); setShowDetailModal(false); }} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isPC ? '1fr 1fr' : '1fr', gap: '25px' }}>
{/* --- ここから入れ替え --- */}
<div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '500px', margin: '0 auto' }}>
  <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
    
    {/* 📋 予約メニューの表示（予約がある場合のみ） */}
    {selectedRes?.res_type === 'normal' && (
      <div style={{ background: themeColorLight, padding: '10px', borderRadius: '8px', marginBottom: '15px', border: `1px solid ${themeColor}` }}>
        <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: themeColor }}>📋 予約メニュー</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px' }}>
{selectedRes.options?.people ? (
  selectedRes.options.people.map((person, pIdx) => (
    person.services.map((s, sIdx) => {
      // ✅ このメニュー(s.id)に紐づくオプション名を抽出
      const optNames = Object.values(person.options || {})
        .filter(opt => opt.service_id === s.id)
        .map(opt => opt.option_name);
      const displayName = optNames.length > 0 ? `${s.name}（${optNames.join(', ')}）` : s.name;

      return (
        <span key={`${pIdx}-${sIdx}`} style={{ background: themeColor, color: '#fff', padding: '2px 10px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 'bold' }}>
          {selectedRes.options.people.length > 1 ? `(${pIdx + 1})${displayName}` : displayName}
        </span>
      );
    })
  ))
) : (
  selectedRes.options?.services?.map((s, idx) => {
    // 単名予約の場合のオプション抽出
    const optNames = Object.values(selectedRes.options.options || {})
      .filter(opt => opt.service_id === s.id)
      .map(opt => opt.option_name);
    const displayName = optNames.length > 0 ? `${s.name}（${optNames.join(', ')}）` : s.name;

    return (
      <span key={idx} style={{ background: themeColor, color: '#fff', padding: '2px 10px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 'bold' }}>{displayName}</span>
    );
  }) || <span style={{fontSize:'0.75rem', color:'#94a3b8'}}>メニュー情報なし</span>
)}
        </div>
      </div>
    )}

    {/* LINE連携バッジ */}
    {editFields.line_user_id && (
      <div style={{ background: '#f0fdf4', padding: '8px 12px', borderRadius: '8px', border: '1px solid #bbf7d0', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '1rem' }}>💬</span>
        <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 'bold' }}>LINE連携済み</span>
      </div>
    )}

    {/* 🆕 担当者情報の表示 */}
    {selectedRes?.res_type === 'normal' && (
      <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '0.9rem' }}>👤</span>
        <span style={{ fontSize: '0.8rem', color: '#475569' }}>
          <strong>担当スタッフ:</strong> {selectedRes.staffs?.name || '店舗スタッフ'}
        </span>
      </div>
    )}

    {/* 🆕 担当者の変更ドロップダウン */}
    {selectedRes?.res_type === 'normal' && (
      <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', marginBottom: '15px', border: '1px solid #e2e8f0' }}>
        <label style={labelStyle}>担当スタッフの変更</label>
        <select 
          value={selectedRes.staff_id || ''} 
          onChange={(e) => setSelectedRes({...selectedRes, staff_id: e.target.value || null})}
          style={inputStyle}
        >
          <option value="">フリー（担当なし）</option>
          {staffs.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
    )}

    {/* 📝 入力フォーム（定休日でも表示されるようになります） */}
    <label style={labelStyle}>お客様名（または予定名）</label>
    <input type="text" value={editFields.name} onChange={(e) => setEditFields({...editFields, name: e.target.value})} style={inputStyle} />
    
    <label style={labelStyle}>電話番号</label>
    <input type="tel" value={editFields.phone} onChange={(e) => setEditFields({...editFields, phone: e.target.value})} style={inputStyle} placeholder="未登録" />
    
    <label style={labelStyle}>メールアドレス</label>
    <input type="email" value={editFields.email} onChange={(e) => setEditFields({...editFields, email: e.target.value})} style={inputStyle} placeholder="未登録" />
    
    <label style={labelStyle}>顧客メモ（または詳細）</label>
    <textarea value={editFields.memo} onChange={(e) => setEditFields({...editFields, memo: e.target.value})} style={{ ...inputStyle, height: '120px' }} placeholder="好み、注意事項、予定の詳細など" />
    
    <button onClick={handleUpdateCustomer} style={{ width: '100%', padding: '12px', background: themeColor, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
      情報を保存
    </button>

    {selectedRes && (
      <button onClick={() => deleteRes(selectedRes.id)} style={{ width: '100%', padding: '12px', background: selectedRes.res_type === 'blocked' ? themeColor : '#fee2e2', color: selectedRes.res_type === 'blocked' ? '#fff' : '#ef4444', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
        {selectedRes.res_type === 'blocked' ? '🔓 ブロック解除' : '予約を消去 ＆ 名簿掃除'}
      </button>
    )}
  </div>
</div>
{/* --- ここまで入れ替え --- */}
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#64748b' }}>🕒 来店履歴</h4>
                <div style={{ height: isPC ? '350px' : '200px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '12px' }}>
                  {!selectedRes?.isRegularHoliday && (showCustomerModal ? customerFullHistory : customerHistory).map(h => (
                    <div key={h.id} style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem' }}>
                      <div style={{ fontWeight: 'bold' }}>{new Date(h.start_time).toLocaleDateString('ja-JP')}</div>
<div style={{ color: themeColor, marginTop: '2px' }}>
  {h.options?.people 
    ? h.options.people.map(p => 
        p.services.map(s => {
          const optNames = Object.values(p.options || {})
            .filter(opt => opt.service_id === s.id)
            .map(opt => opt.option_name);
          return optNames.length > 0 ? `${s.name}（${optNames.join(', ')}）` : s.name;
        }).join(', ')
      ).join(' / ')
    : h.options?.services?.map(s => {
        const optNames = Object.values(h.options.options || {})
          .filter(opt => opt.service_id === s.id)
          .map(opt => opt.option_name);
        return optNames.length > 0 ? `${s.name}（${optNames.join(', ')}）` : s.name;
      }).join(', ') || 'メニュー情報なし'}
</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {!isPC && (
              <button onClick={() => { setShowCustomerModal(false); setShowDetailModal(false); }} style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#fff', border: 'none', padding: '12px 40px', borderRadius: '50px', fontWeight: 'bold', boxShadow: '0 10px 20px rgba(0,0,0,0.3)', zIndex: 4000 }}>閉じる ✕</button>
            )}
          </div>
        </div>
      )}

{/* 👥 2. 予約者選択リストModal (複数予約がある場合に表示) */}
      {showSlotListModal && (
        <div onClick={() => setShowSlotListModal(false)} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...modalContentStyle, maxWidth: '450px', textAlign: 'center', background: '#f8fafc', padding: '25px' }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 5px 0', color: '#64748b', fontSize: '0.9rem' }}>{selectedDate.replace(/-/g, '/')}</h3>
              <p style={{ fontWeight: '900', color: themeColor, fontSize: '1.8rem', margin: 0 }}>{targetTime} の予約</p>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '5px' }}>詳細を見たい方を選択してください</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '55vh', overflowY: 'auto', padding: '5px' }}>
              {/* 🆕 最上部：ねじ込み予約ボタン (リストModal版) */}
              <div 
  onClick={() => {
    setShowSlotListModal(false);
    navigate(`/shop/${shopId}/reserve`, { 
      state: { 
        adminDate: selectedDate, 
        adminTime: targetTime, 
        fromView: 'calendar', // ✅ カレンダーから来た目印
        isAdminMode: true,
        adminStaffId: staffs.length === 1 ? staffs[0].id : null
      } 
    });
  }}
                style={{
                  background: themeColor,
                  padding: '18px',
                  borderRadius: '18px',
                  border: `2px solid ${themeColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#fff',
                  fontWeight: 'bold',
                  boxShadow: `0 4px 12px ${themeColor}44`,
                  marginBottom: '10px'
                }}
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
  {res.res_type === 'normal' ? (
    <>
      <div style={{ color: themeColor, fontWeight: 'bold' }}>📋 {res.menu_name || res.options?.services?.map(s => s.name).join(', ') || 'メニュー未設定'}</div>
      <div style={{ marginTop: '2px' }}>👤 担当: {res.staffs?.name || '店舗スタッフ'}</div>
    </>
  ) : 'スケジュールブロック'}
</div>
                  </div>
                  <div style={{ color: themeColor, fontSize: '1.2rem' }}>〉</div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowSlotListModal(false)} style={{ marginTop: '25px', padding: '12px', border: 'none', background: 'none', color: '#94a3b8', fontWeight: 'bold', cursor: 'pointer' }}>キャンセル</button>

            {!isPC && (
              <button 
                onClick={() => setShowSlotListModal(false)} 
                style={{ 
                  position: 'fixed', 
                  bottom: '30px', 
                  left: '50%', 
                  transform: 'translateX(-50%)', 
                  background: '#1e293b', 
                  color: '#fff', 
                  border: 'none', 
                  padding: '12px 40px', 
                  borderRadius: '50px', 
                  fontWeight: 'bold', 
                  boxShadow: '0 10px 20px rgba(0,0,0,0.3)', 
                  zIndex: 4000 
                }}
              >
                閉じる ✕
              </button>
            )}
          </div>
        </div>
      )}

{/* ⚙️ 3. 管理メニューModal (本家再現：ねじ込み予約・ブロック) */}
      {showMenuModal && (
        <div onClick={() => setShowMenuModal(false)} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', padding: '35px', borderRadius: '30px', width: '90%', maxWidth: '340px', textAlign: 'center', position: 'relative' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#64748b', fontSize: '0.9rem' }}>{selectedDate.replace(/-/g, '/')}</h3>
            <p style={{ fontWeight: '900', color: themeColor, fontSize: '2.2rem', margin: '0 0 30px 0' }}>{targetTime}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
<button 
  onClick={() => navigate(`/shop/${shopId}/reserve`, { 
    state: { 
      adminDate: selectedDate, 
      adminTime: targetTime, 
      fromView: 'calendar', // ✅ カレンダーから来た目印
      isAdminMode: true,
      adminStaffId: staffs.length === 1 ? staffs[0].id : null
    } 
  })} 
  style={{ padding: '22px', background: themeColor, color: '#fff', border: 'none', borderRadius: '20px', fontWeight: '900', fontSize: '1.2rem' }}
>
  予約を入れる
</button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button onClick={handleBlockTime} style={{ padding: '15px', background: '#fff', color: themeColor, border: `2px solid ${themeColorLight}`, borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem' }}>「✕」または予定</button>
                <button onClick={handleBlockFullDay} style={{ padding: '15px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem' }}>今日を休みにする</button>
              </div>
              <button onClick={() => setShowMenuModal(false)} style={{ padding: '15px', border: 'none', background: 'none', color: '#94a3b8' }}>キャンセル</button>
            </div>
            {!isPC && (
              <button onClick={() => setShowMenuModal(false)} style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#fff', border: 'none', padding: '12px 40px', borderRadius: '50px', fontWeight: 'bold', boxShadow: '0 10px 20px rgba(0,0,0,0.3)', zIndex: 4000 }}>閉じる ✕</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
// 🆕 画面切り替えスイッチ用のスタイル（これを追加してください）
const switchBtnStyle = (active) => ({ 
  padding: '5px 15px', 
  borderRadius: '6px', 
  border: 'none', 
  background: active ? '#fff' : 'transparent', 
  fontWeight: 'bold', 
  fontSize: '0.75rem', 
  cursor: 'pointer', 
  boxShadow: active ? '0 2px 4px rgba(0,0,0,0.1)' : 'none', 
  color: active ? '#1e293b' : '#64748b',
  transition: 'all 0.2s'
});
export default AdminReservations;