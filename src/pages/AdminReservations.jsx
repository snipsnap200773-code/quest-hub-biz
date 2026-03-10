import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';

// 🆕 予約者名から固有のパステルカラーを生成するロジック
const getCustomerColor = (name, type) => { // 💡 typeを引数に追加
  if (type === 'private_task') {
    // 💡 プライベート予定は落ち着いたグレー系の色にする
    return { bg: '#f8fafc', border: '#e2e8f0', line: '#94a3b8', text: '#475569' };
  }
  if (!name || name === '定休日' || name === '臨時休業' || name === 'ｲﾝﾀｰﾊﾞﾙ') 
    return { bg: '#f1f5f9', border: '#cbd5e1', line: '#94a3b8', text: '#64748b' };
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

function AdminReservations() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // --- 状態管理 ---
  const [shop, setShop] = useState(null);
  const [staffs, setStaffs] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

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
  
  // --- デザイン（スタイル）の定義をここに追加 ---
const resItemRowStyle = { 
  fontSize: '0.9rem', 
  color: '#1e293b', 
  background: '#fff', 
  padding: '8px 12px', 
  borderRadius: '8px', 
  border: '1px solid rgba(0,0,0,0.05)', 
  display: 'flex',
  alignItems: 'flex-start',
  lineHeight: '1.4',
  marginBottom: '5px'
};

const resIndexStyle = (color) => ({ 
  fontWeight: '900', 
  color: color, 
  marginRight: '10px', 
  whiteSpace: 'nowrap' 
});
// ------------------------------------------

  const [showMenuModal, setShowMenuModal] = useState(false);
  const [targetTime, setTargetTime] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
const [selectedRes, setSelectedRes] = useState(null);
const [showSlotListModal, setShowSlotListModal] = useState(false);

// 🆕 プライベート予定用のState
const [privateTasks, setPrivateTasks] = useState([]);
const [showPrivateModal, setShowPrivateModal] = useState(false);
const [privateTaskFields, setPrivateTaskFields] = useState({ title: '', note: '' });
  const [selectedSlotReservations, setSelectedSlotReservations] = useState([]);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMonth, setViewMonth] = useState(new Date(startDate)); 

  const [customers, setCustomers] = useState([]); 
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  // 他のStateと一緒に定義してください
const [mergeCandidate, setMergeCandidate] = useState(null); // 重複が見つかった「大造」さん候補
const [showMergeConfirm, setShowMergeConfirm] = useState(false); // 3択モーダルの表示フラグ
  const [customerFullHistory, setCustomerFullHistory] = useState([]);
const [editFields, setEditFields] = useState({ 
    name: '',       // ✅ 表のお名前用
    admin_name: '', // ✅ 裏のメモ名用
    furigana: '', phone: '', email: '', 
    address: '', parking: '', symptoms: '', request_details: '', 
    memo: '', line_user_id: null 
  });
    // キーボード選択用のIndex管理
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

const isPC = windowWidth > 1024;

  // 🆕 項目が有効（WebまたはLINEのいずれか）か判定し、ラベルを取得するヘルパー
  const getFieldConfig = (key) => {
    const cfg = shop?.form_config?.[key];
    if (!cfg) return { show: false, label: '' };
    return {
      show: cfg.enabled || cfg.line_enabled,
      label: cfg.label
    };
  };

// 🆕 location.search を追加することで、予約完了後にURLが変わった瞬間に再取得が走るようにします
  useEffect(() => { fetchData(); }, [shopId, startDate, location.search]);

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

// 3. 全関連店舗の予約データを合算して取得（顧客マスタの最新名も取得）
// 1. 予約データの取得
const { data: resData } = await supabase
  .from('reservations')
  .select('*, profiles(business_name), staffs(name), customers(*)')
  .in('shop_id', targetShopIds);

// 2. 🆕 プライベート予定の取得
const { data: privData } = await supabase
  .from('private_tasks')
  .select('*')
  .eq('shop_id', shopId);

setReservations(resData || []);
setPrivateTasks(privData || []); // 🆕 保存
    setLoading(false);
  };

  useEffect(() => {
    const searchCustomers = async () => {
      if (!searchTerm) { setCustomers([]); setSelectedIndex(-1); return; }
// 🆕 name（本人名）か admin_name（管理名）のどちらかにヒットすればOK
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .or(`name.ilike.%${searchTerm}%,admin_name.ilike.%${searchTerm}%`)
        .limit(5);
              setCustomers(data || []);
      setSelectedIndex(-1); // 検索ワードが変わったら選択位置をリセット
    };
    const timer = setTimeout(searchCustomers, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, shopId]);

  const openCustomerDetail = async (customer) => {
    setSelectedCustomer(customer);
setEditFields({ 
      // 管理名があればそれを、なければ本人名をセット
      name: customer.name || '', 
      // マスタ側に電話番号があればそれを、なければ今回の予約時のものを優先
      phone: customer.phone || selectedRes?.customer_phone || '', 
      // 🆕 ここが重要！マスタにメールがなくても、予約時のメールがあればそれを表示に活かす
      email: customer.email || selectedRes?.customer_email || '', 
      memo: customer.memo || '',
      line_user_id: customer.line_user_id || selectedRes?.line_user_id || null 
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

// 🆕 修正後：名寄せスカウター搭載版
const openDetail = async (res) => {
  if (res.shop_id && res.shop_id !== shopId) {
    alert(`こちらは他店舗...`);
    return;
  }
  setSelectedRes(res);

  let cust = null;

  // 🆕 修正ポイント：まず、予約データに紐付いている顧客IDがあるか確認
  if (res.customer_id) {
    const { data: matched } = await supabase
      .from('customers')
      .select('*')
      .eq('id', res.customer_id)
      .maybeSingle();
    cust = matched;
  }

  // もしIDでヒットしなかった場合のみ、電話・メールでスカウターを回す
  if (!cust) {
    const orConditions = [];
    if (res.customer_phone && res.customer_phone !== '---') orConditions.push(`phone.eq.${res.customer_phone}`);
    if (res.customer_email) orConditions.push(`email.eq.${res.customer_email}`);

    if (orConditions.length > 0) {
      const { data: matched } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .or(orConditions.join(','))
        .maybeSingle();
      cust = matched;
    }
  }

  // 以降の統合チェックロジックへ...
  if (cust) {
    if (cust.id === res.customer_id) {
      finalizeOpenDetail(res, cust);
      return;
    }
    setMergeCandidate(cust);
    setShowMergeConfirm(true);
    return;
  }
  finalizeOpenDetail(res, cust);
};
  // 🆕 共通処理：詳細モーダルを表示するための確定処理
  const finalizeOpenDetail = (res, cust) => {
    const visitInfo = res.options?.visit_info || {};

    if (cust) {
      setSelectedCustomer(cust);
      setEditFields({ 
        name: cust.name || res.customer_name, // マスタの管理名を優先
        furigana: cust.furigana || visitInfo.furigana || '',
        phone: cust.phone || '', 
        email: cust.email || '', 
        address: cust.address || visitInfo.address || '', 
        parking: cust.parking || visitInfo.parking || '', 
        symptoms: cust.symptoms || visitInfo.symptoms || '', 
        request_details: cust.request_details || visitInfo.request_details || '', 
        memo: cust.memo || '',
        line_user_id: cust.line_user_id || res.line_user_id || null
      });
    } else {
      setSelectedCustomer(null);
      setEditFields({ 
        name: res.customer_name, 
        furigana: visitInfo.furigana || '', 
        phone: res.customer_phone || '', 
        email: res.customer_email || '', 
        address: visitInfo.address || '', 
        parking: visitInfo.parking || '', 
        symptoms: visitInfo.symptoms || '', 
        request_details: visitInfo.request_details || '', 
        memo: '',
        line_user_id: res.line_user_id || null
      });
    }
    const history = reservations.filter(r => r.shop_id === shopId && r.res_type === 'normal' && r.id !== res.id && (r.customer_name === res.customer_name) && new Date(r.start_time) < new Date(res.start_time)).sort((a, b) => new Date(b.start_time) - new Date(a.start_time)).slice(0, 5);
    setCustomerHistory(history);
    setShowDetailModal(true);
}; // finalizeOpenDetail の終わり

  // 🆕 ここから追記：理想の名寄せ：名前の選択肢を持たせた統合処理
  const handleMergeAction = async (masterId, finalName) => {
    try {
      // 1. 予約データのIDと名前を、選んだ名前に書き換えてマスタに紐付ける
      const { error: resError } = await supabase
        .from('reservations')
        .update({ 
          customer_id: masterId,
          customer_name: finalName // 予約票上の表示名も統一する
        })
        .eq('id', selectedRes.id);

      if (resError) throw resError;

      // 2. 顧客マスタ側の名前も、三土手さんが選んだ「正解の名前」で更新
      const customerUpdate = { 
        name: finalName,
        updated_at: new Date().toISOString()
      };

      // Google IDがあれば紐付けを維持/追加
      if (selectedRes.auth_id) {
        customerUpdate.auth_id = selectedRes.auth_id;
      }

      const { error: custError } = await supabase
        .from('customers')
        .update(customerUpdate)
        .eq('id', masterId);

      if (custError) throw custError;

      console.log(`✅ 統合完了: 「${finalName}」様としてマスタを確定しました`);
      
      setShowMergeConfirm(false);
      fetchData(); // カレンダーの表示名を更新するために再取得
      finalizeOpenDetail(selectedRes, { ...mergeCandidate, name: finalName }); 
    } catch (err) {
      console.error("名寄せエラー:", err);
      alert("統合処理に失敗しました。");
    }
  };
// 🆕 追記ここまで

  // 🆕 追加：画面に通知を出す関数 [cite: 2026-03-08]
  const showMsg = (txt) => { setMessage(txt); setTimeout(() => setMessage(''), 3000); };

// ✅ 重複防止 ＆ メモ一本化ロジック：真・完成版 [cite: 2026-03-10]
  const handleUpdateCustomer = async () => {
    
    try {
      const normalizedName = editFields.name.replace(/　/g, ' ').trim();
      if (!normalizedName) {
        alert("お名前を入力してください。");
        return;
      }

      // 🔍 ステップ1：この名前の人がすでに名簿にいないか「名寄せ検索」を行う
      let targetCustomerId = selectedCustomer?.id;
      
      if (!targetCustomerId) {
        const { data: existingCust } = await supabase
          .from('customers')
          .select('id')
          .eq('shop_id', shopId)
          .eq('name', normalizedName)
          .maybeSingle();
        
        if (existingCust) {
          targetCustomerId = existingCust.id; // すでにいたらそのIDを使う
        }
      }

      const customerPayload = {
        shop_id: shopId,
        name: normalizedName,
        admin_name: normalizedName,
        furigana: editFields.furigana || null,
        phone: editFields.phone || null,
        email: editFields.email || null,
        address: editFields.address || null,
        parking: editFields.parking || null,
        symptoms: editFields.symptoms || null,
        request_details: editFields.request_details || null,
        memo: editFields.memo || null, // 👈 すべてのメモはここ（マスタ）へ！
        line_user_id: editFields.line_user_id || null,
        updated_at: new Date().toISOString()
      };

      if (targetCustomerId) {
        customerPayload.id = targetCustomerId;
      }

      // 🔍 ステップ2：名簿（customers）を更新。IDがあれば「上書き」、なければ「新規」になる
      const { data: savedCust, error: custError } = await supabase
        .from('customers')
        .upsert(customerPayload, { onConflict: 'id' })
        .select()
        .single();
      
      if (custError) throw custError;
      targetCustomerId = savedCust.id; // 保存後の最新IDを確保

      // 🔍 ステップ3：予約データ（reservations）を更新して「名簿ID」をガッチリ紐付ける
      const { error: resError } = await supabase
        .from('reservations')
        .update({ 
          customer_name: normalizedName,
          customer_phone: editFields.phone,
          customer_email: editFields.email,
          customer_id: targetCustomerId, // 👈 ここで紐付けるので、次からは重複しません！
          staff_id: selectedRes.staff_id,
          memo: null // 👈 予約側のメモは混乱を防ぐため空にします
        })
        .eq('id', selectedRes.id);

      if (resError) throw resError;

      // 💡 ステップ4：画面上の状態（State）も最新に更新する
      setSelectedCustomer(savedCust); // これで、連続で「保存」を押しても重複しません！
      
      showMsg('情報を保存しました！✨'); 
      setShowDetailModal(false); 
      fetchData(); 
    } catch (err) {
      console.error(err);
      alert('保存エラー: ' + err.message);
    }
}; 

  // 🆕 追加：プライベート予定(private_tasksテーブル)を保存する関数
  const handleSavePrivateTask = async () => {
    if (!privateTaskFields.title) {
      alert("予定の内容（タイトル）を入力してください。");
      return;
    }

    try {
      const start = new Date(`${selectedDate}T${targetTime}:00`);
      const interval = shop.slot_interval_min || 15;
      const end = new Date(start.getTime() + interval * 60000);

      const { error } = await supabase.from('private_tasks').insert([{
        shop_id: shopId,
        title: privateTaskFields.title,
        note: privateTaskFields.note,
        start_time: start.toISOString(),
        end_time: end.toISOString()
      }]);

      if (error) throw error;

      // 成功したらリセットして閉じる
      setShowPrivateModal(false);
      setPrivateTaskFields({ title: '', note: '' });
      showMsg("プライベート予定を追加しました☕️");
      fetchData(); // 画面を再読み込みしてカレンダーに反映
    } catch (err) {
      console.error("保存エラー:", err.message);
      alert("保存に失敗しました。");
    }
  };

// --- [330行目付近] ---
  const deleteRes = async (id) => {
    const isPrivate = selectedRes?.res_type === 'private_task';
    const isBlock = selectedRes?.res_type === 'blocked';
    
    // メッセージの出し分け
    let msg = 'この予約データを消去して予約を「可能」に戻しますか？';
    if (isPrivate) msg = 'このプライベート予定を削除しますか？';
    if (isBlock) msg = 'このブロックを解除して予約を「可能」に戻しますか？';
    
    if (window.confirm(msg)) {
      // ✅ 🆕 修正：テーブルを使い分ける
      const targetTable = isPrivate ? 'private_tasks' : 'reservations';
      const { error: deleteError } = await supabase.from(targetTable).delete().eq('id', id);

      if (deleteError) { alert('削除に失敗しました: ' + deleteError.message); return; }

      // 予約（normal）の場合のみ、顧客マスタの来店回数を減らすロジック（既存）
      if (!isPrivate && selectedRes.res_type === 'normal') {
        const { customer_name } = selectedRes;
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
      
      setShowDetailModal(false); 
      fetchData(); // 再読み込み
      showMsg(isPrivate ? "予定を削除しました" : "予約を削除しました");
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

// --- [301行目付近] ---
  const getJapanDateStr = (date) => date.toLocaleDateString('sv-SE');

const getStatusAt = (dateStr, timeStr) => {
    const dateObj = new Date(dateStr);
    const currentSlotStart = new Date(`${dateStr}T${timeStr}:00`).getTime();

    // 1. 【公】お客様の予約やブロックをチェック
    const resMatches = reservations.filter(r => {
      const start = new Date(r.start_time).getTime();
      const end = new Date(r.end_time).getTime();
      const isTimeMatch = currentSlotStart >= start && currentSlotStart < end;

      if (isTimeMatch) {
        // ブロック(✕)は店全体(null)のものだけ表示する既存ルールを維持
        if (r.res_type === 'blocked') {
          return r.staff_id === null;
        }
        return true;
      }
      return false;
    });

    // 2. 🆕【私】プライベート予定(private_tasks)をチェック
    const privMatches = privateTasks.filter(p => {
      const start = new Date(p.start_time).getTime();
      const end = new Date(p.end_time).getTime();
      return currentSlotStart >= start && currentSlotStart < end;
    }).map(p => ({ 
      ...p, 
      res_type: 'private_task', // 描画側で判別するためのフラグ
      customer_name: p.title    // 表示名を「辻 様」などの代わりに「予定名」にする
    }));

    // 3. 2つのデータを合体させる
    const matches = [...resMatches, ...privMatches];

    // 合体した結果、何か予定があれば「配列」として返す
    if (matches.length > 0) {
      return matches; 
    }

    // 4. 【次点】定休日かどうかをチェック（ここからは変更なし）
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
    <div style={{ display: 'flex', width: '100vw', height: '100dvh', background: '#fff', overflow: 'hidden', position: 'fixed', inset: 0 }}>
      {/* 🆕 追記：通知メッセージを表示するボックス [cite: 2026-03-08] */}
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '400px', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '12px', zIndex: 10001, textAlign: 'center', fontWeight: 'bold', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
          {message}
        </div>
      )}
      {isPC && (
        
        <div style={{ width: '260px', flexShrink: 0, borderRight: '0.5px solid #cbd5e1', padding: '18px', display: 'flex', flexDirection: 'column', gap: '20px', background: '#fff', zIndex: 100 }}>

{/* --- 1段目：タイトルと設定 --- */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', background: themeColor, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}>S</div>
              <h1 style={{ fontSize: '1.1rem', fontWeight: '900', margin: 0, color: '#1e293b' }}>SnipSnap Admin</h1>
            </div>
            <button 
              onClick={() => navigate(`/admin/${shopId}/dashboard`)} 
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '1.1rem', padding: '6px', display: 'flex', alignItems: 'center', color: '#64748b' }}
            >
              ⚙️
            </button>
          </div>

          {/* --- 2段目：切り替えスイッチ（カレンダーも維持！） --- */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', width: '100%', boxSizing: 'border-box' }}>
            <button style={{ ...switchBtnStyle(true), flex: 1 }}>カレンダー</button>
            <button 
              onClick={() => navigate(`/admin/${shopId}/timeline?date=${selectedDate}`)} 
              style={{ ...switchBtnStyle(false), flex: 1 }}
            >
              タイムライン
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

<div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* ✅ 追加：現場での実行用「今日のタスク」ボタン [cite: 2026-03-06] */}
            <button 
              onClick={() => navigate(`/admin/${shopId}/today-tasks`)}
              style={{ 
                padding: '15px', 
                background: '#1e293b', // カレンダーと差別化するために深い色に
                color: '#fff', 
                border: 'none', 
                borderRadius: '12px', 
                cursor: 'pointer', 
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              ⚡ 本日のタスク (実行)
            </button>

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
        <div style={{ padding: isPC ? '15px 25px' : '15px 10px', borderBottom: '0.5px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
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
<div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
  {c.admin_name || c.name} 様 {c.admin_name && c.admin_name !== c.name ? `(${c.name})` : ''}
</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{c.phone || '電話未登録'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <h2 style={{ fontSize: '1.1rem', margin: '0 0 0 auto', fontWeight: '900', color: '#1e293b' }}>{startDate.getFullYear()}年 {startDate.getMonth() + 1}月</h2>
            </div>
) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '15px', position: 'relative' }}>
              <button onClick={goPrevMonth} style={mobileArrowBtnStyle}>◀</button>
              <h2 style={{ fontSize: '1.3rem', margin: 0, fontWeight: '900', color: '#1e293b' }}>{startDate.getFullYear()}年 {startDate.getMonth() + 1}月</h2>
              <button onClick={goNextMonth} style={mobileArrowBtnStyle}>▶</button>
              
              {/* ✅ 追加：スマホ画面の右端に配置 [cite: 2026-03-06] */}
              <button 
                onClick={() => navigate(`/admin/${shopId}/today-tasks`)}
                style={{ 
                  position: 'absolute', 
                  right: '0', 
                  background: themeColor, 
                  color: '#fff', 
                  border: 'none', 
                  padding: '8px 12px', 
                  borderRadius: '10px', 
                  fontSize: '0.75rem', 
                  fontWeight: 'bold',
                  boxShadow: `0 4px 10px ${themeColor}44`
                }}
              >
                タスク
              </button>
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
    exit={{ opacity: 0 }} 
    
    // 🆕 Spring（バネ）設定
    transition={{ 
      type: "spring", 
      stiffness: 400, // バネの強さ（大きいほど速い）
      damping: 30,    // 抵抗（大きいほど揺れがすぐ止まる）
      mass: 0.2,       // 軽さ（小さいほど軽快に動く）
      opacity: { duration: 0.1 } // 透明度の変化だけは一瞬で終わらせる
    }}

drag="x" 
    dragDirectionLock={true} // 🆕 縦にスクロール中は横スワイプをロックする（iPad対策）
    dragConstraints={{ left: 0, right: 0 }}
    dragElastic={0} // 🆕 縦スクロールを邪魔しないよう弾力を0に

              onDragEnd={(e, { offset }) => {
                const swipeThreshold = 50;
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
                    <th style={{ width: isPC ? '80px' : '32px', borderBottom: '0.5px solid #cbd5e1' }}></th>
                    {weekDays.map(date => {
                      const isToday = getJapanDateStr(new Date()) === getJapanDateStr(date);
                      return (
                        /* 曜日の下の線を0.5pxに */
                        <th key={date.toString()} style={{ padding: '4px 0', borderBottom: '0.5px solid #cbd5e1' }}>
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
                      {/* 左端の時間軸 */}
                      <td style={{ borderRight: '0.5px solid #cbd5e1', borderBottom: '0.5px solid #cbd5e1', textAlign: 'center', background: '#f8fafc' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold' }}>{time}</span>
                      </td>

                      {weekDays.map(date => {
                        const dStr = getJapanDateStr(date);
                        const resAt = getStatusAt(dStr, time);
                        const isArray = Array.isArray(resAt);

                        // 🆕 判定時間を10秒に延長し、ログを出して確認できるようにします
                        const isNew = isArray && resAt.some(r => {
                          if (!r.created_at) return false;
                          const diff = (new Date().getTime() - new Date(r.created_at).getTime());
                          const hit = diff < 10000; // 10秒以内
                          if (hit) console.log("✨ 光る予約を検知！", r.customer_name);
                          return hit;
                        });
                        const hasRes = resAt !== null;
                        const firstRes = isArray ? resAt[0] : resAt;
                        const reservationCount = isArray ? resAt.length : 0;

                        // 🆕 営業時間内かどうかの判定（既存のロジックから流用）
                        const dayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()];
                        const hours = shop?.business_hours?.[dayName];
                        const isStandardTime = hours && !hours.is_closed && time >= hours.open && time < hours.close;

                        // 1. この枠で「ちょうど開始」する人を抽出
                        const startingHere = isArray ? resAt.filter(r => 
                          new Date(r.start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }) === time
                        ) : [];
                        const isStart = startingHere.length > 0;

                        // 2. デザインフラグ
                        const colors = getCustomerColor(firstRes?.customer_name);
                        const isOtherShop = isArray && resAt.some(r => r.shop_id !== shopId);
                        const isBlocked = (isArray && resAt.some(r => r.res_type === 'blocked')) || (firstRes?.res_type === 'blocked');
                        const isRegularHoliday = !isArray && firstRes?.isRegularHoliday;
                        const isSystemBlocked = !isArray && firstRes?.res_type === 'system_blocked';

                        return (
                          <td 
                            key={`${dStr}-${time}`} 
// --- [修正後] ---
onClick={() => { 
  setSelectedDate(dStr); setTargetTime(time); 
  
  // 1. 「お客様の予約」または「既に入れたプライベート予定」があるか探す
  const items = isArray ? resAt : (resAt ? [resAt] : []);
  const activeTask = items.find(r => r.res_type === 'normal' || r.res_type === 'private_task');

  // 2. 予約や予定が既にある場合は、詳細を開く（既存の編集挙動）
  if (activeTask) {
    if (isArray && items.filter(i => i.res_type === 'normal' || i.res_type === 'private_task').length > 1) {
      setSelectedSlotReservations(items); setShowSlotListModal(true);
    } else {
      openDetail(activeTask);
    }
    return;
  }

  // 3. 予約・予定がない場合（空き枠、定休日、またはブロック枠）
  // 💡 営業時間内（かつ定休日/ブロックでない）なら「予約・ブロックメニュー」
  // 💡 それ以外（営業時間外、定休日、ブロック中）なら「プライベート予定追加」
  const isHoliday = !isArray && resAt?.isRegularHoliday;
  const isBlocked = items.some(r => r.res_type === 'blocked');

  if (isStandardTime && !isHoliday && !isBlocked) {
    setShowMenuModal(true); 
  } else {
    setPrivateTaskFields({ title: '', note: '' });
    setShowPrivateModal(true); // 定休日やブロックの上から予定を書き込める！
  }
}}style={{ 
                              borderRight: `${isStandardTime ? '0.1px' : '0.1px'} solid #cbd5e1`, 
                              borderBottom: `${isStandardTime ? '0.1px' : '0.1px'} solid #cbd5e1`, 
                              position: 'relative', 
                              cursor: 'pointer', 
                              background: isStandardTime ? '#fff' : '#fffff3',
                              // 🆕 td のアニメーションは消してOK
                            }}
                          >
                            {hasRes && !isSystemBlocked && (
                              <div style={{ 
                                position: 'absolute', inset: 0, zIndex: 5, overflow: 'hidden',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: (isRegularHoliday || isBlocked) ? '#f1f5f9' : (isOtherShop ? '#f8fafc' : (isStart ? colors.bg : '#fff')),
                                borderLeft: (isRegularHoliday || isBlocked) ? 'none' : `2px solid ${isOtherShop ? '#cbd5e1' : colors.line}`,
                                // ✅ 修正ポイント：ここに animation を移動！
                                animation: (isNew && isStart) ? 'flashGold 2s ease-out' : 'none'
                              }}>
                                                                {(isRegularHoliday || isBlocked) ? (
                                  isStart && <span style={{fontSize:'0.65rem', fontWeight:'bold', color:'#94a3b8'}}>{firstRes.customer_name}</span>
                                ) : (
                                  isStart ? (
                                    <div style={{ fontWeight: 'bold', fontSize: isPC ? '0.85rem' : '0.7rem', color: isOtherShop ? '#94a3b8' : colors.text, textAlign: 'center', whiteSpace: 'nowrap', padding: '0 4px' }}>
                                      {(() => {
if (startingHere.length === 1) {
            // 🆕 予約票の名前(snapshot)ではなく、マスタ側の最新名(admin_nameがあれば最優先)を特定する
            const res = startingHere[0];
            const masterName = res.res_type === 'private_task' ? res.customer_name : (res.customers?.name || res.customer_name);
            
            const name = masterName.split(/[\s　]+/)[0];
            const countSuffix = reservationCount > 1 ? ` (${reservationCount}名)` : " 様";
            return isPC ? (`${name}${countSuffix}`) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                                              <span style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}>{name}</span>
                                              {reservationCount > 1 && <span style={{ fontSize: '0.6rem', marginTop: '2px' }}>({reservationCount})</span>}
                                            </div>
                                          );
                                        }
                                        return `👥 ${reservationCount}名`;
                                      })()}
                                    </div>
                                  ) : null
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

{/* 🆕 3択の名寄せ（マージ）確認モーダル */}
{showMergeConfirm && (
  <div 
    onClick={() => setShowMergeConfirm(false)} 
    style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 5000, 
      display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' 
    }}
  >
    <div 
      onClick={(e) => e.stopPropagation()} 
      style={{ 
        background: '#fff', width: '90%', maxWidth: '400px', borderRadius: '30px', 
        padding: '35px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' 
      }}
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
        {/* 選択肢A：店主が把握している名前（大造さん）を守る */}
        <button 
          onClick={() => handleMergeAction(mergeCandidate.id, mergeCandidate.name)}
          style={{ 
            padding: '18px', background: themeColor, color: '#fff', border: 'none', 
            borderRadius: '16px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' 
          }}
        >
          👤 既存の「{mergeCandidate?.name}」様に統合
        </button>

        {/* 選択肢B：お客様が新しく名乗った名前（ハム太郎）を正式採用してあげる */}
        <button 
          onClick={() => handleMergeAction(mergeCandidate.id, selectedRes.customer_name)}
          style={{ 
            padding: '16px', background: '#fff', color: themeColor, 
            border: `2px solid ${themeColor}`, borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer' 
          }}
        >
          🐹 今回の「{selectedRes?.customer_name}」様へ名前を更新
        </button>

        {/* 選択肢C：同姓同名の別人として新規登録 */}
        <button 
          onClick={() => {
            setShowMergeConfirm(false);
            finalizeOpenDetail(selectedRes, null); 
          }}
          style={{ padding: '12px', background: 'none', border: 'none', color: '#64748b', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          🙅 同姓同名の別人として別名簿で管理
        </button>
      </div>
          </div>
  </div>
)}

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
    
{/* 📋 予約メニュー内訳（1人ならまとめ、複数人なら分ける厳密なロジック） */}
    {selectedRes?.res_type === 'normal' && (
      <div style={{ background: themeColorLight, padding: '16px', borderRadius: '15px', marginBottom: '20px', border: `1px solid ${themeColor}` }}>
        <label style={{ fontSize: '0.75rem', fontWeight: '900', color: themeColor, display: 'block', marginBottom: '10px' }}>
          📋 予約メニュー内訳
        </label>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {(() => {
            const opt = selectedRes.options || {};
            // people配列がある場合はそれを使用し、ない場合は空配列とする
            const people = Array.isArray(opt.people) ? opt.people : [];
            // services配列は、peopleが定義されていない場合のフォールバックとして使用
            const services = Array.isArray(opt.services) ? opt.services : [];

            // 🟢 ケースA：本当に複数人の予約（people配列が2つ以上）
            if (people.length > 1) {
              return people.map((person, pIdx) => {
                // その人の全メニューとオプションを結合
                const sText = person.services?.map(s => {
                  const oNames = Object.values(person.options || {}).filter(o => o.service_id === s.id).map(o => o.option_name);
                  return oNames.length > 0 ? `${s.name}（${oNames.join(', ')}）` : s.name;
                }).join(', ');

                return (
                  <div key={pIdx} style={resItemRowStyle}>
                    <span style={resIndexStyle(themeColor)}>{pIdx + 1}人目：</span>
                    <span>{sText || 'メニュー未設定'}</span>
                  </div>
                );
              });
            }

            // ⚪ ケースB：1人予約の場合（メニューが複数あってもまとめて表示）
            // 表示すべきサービスリストを決定（people[0]のservices、またはルートのservices）
            const targetServices = (people.length > 0 && people[0].services) ? people[0].services : services;
            // オプション情報を決定（people[0]のoptions、またはルートのoptions）
            const targetOptions = (people.length > 0 && people[0].options) ? people[0].options : (opt.options || {});

            if (targetServices.length > 0) {
              // 複数のメニューをカンマ区切りで連結
              const sText = targetServices.map(s => {
                const oNames = Object.values(targetOptions).filter(o => o.service_id === s.id).map(o => o.option_name);
                return oNames.length > 0 ? `${s.name}（${oNames.join(', ')}）` : s.name;
              }).join(', ');

              return <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#1e293b', padding: '4px 8px' }}>{sText}</div>;
            }
            
            // フォールバック：メニュー情報がうまく取得できない場合
            return <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#1e293b', padding: '4px 8px' }}>{selectedRes.menu_name || 'メニュー未設定'}</div>;
          })()}
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
    
{/* 🆕 動的詳細項目エリア：FormCustomizerの設定に連動 */}
    <div style={{ marginTop: '15px', borderTop: '1px dashed #e2e8f0', paddingTop: '15px' }}>
      
      {/* ふりがな */}
      {getFieldConfig('furigana').show && (
        <>
          <label style={labelStyle}>{getFieldConfig('furigana').label}</label>
          <input type="text" value={editFields.furigana} onChange={(e) => setEditFields({...editFields, furigana: e.target.value})} style={inputStyle} />
        </>
      )}

{/* 訪問先住所 */}
      {getFieldConfig('address').show && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={labelStyle}>🏠 {getFieldConfig('address').label}</label>
            {/* 🆕 住所が入力されている場合のみマップへのリンクを表示 */}
            {editFields.address && (
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(editFields.address)}`} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ 
                  fontSize: '0.7rem', 
                  color: themeColor, 
                  textDecoration: 'underline', 
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                🗺️ Googleマップで開く
              </a>
            )}
          </div>
          <input 
            type="text" 
            value={editFields.address} 
            onChange={(e) => setEditFields({...editFields, address: e.target.value})} 
            style={inputStyle} 
            placeholder="住所を入力してください"
          />
        </>
      )}
      
      {/* 駐車場 */}
      {getFieldConfig('parking').show && (
        <>
          <label style={labelStyle}>🅿️ {getFieldConfig('parking').label}</label>
          <input type="text" value={editFields.parking} onChange={(e) => setEditFields({...editFields, parking: e.target.value})} style={inputStyle} />
        </>
      )}

      {/* 症状・お悩み */}
      {getFieldConfig('symptoms').show && (
        <>
          <label style={labelStyle}>📋 {getFieldConfig('symptoms').label}</label>
          <textarea value={editFields.symptoms} onChange={(e) => setEditFields({...editFields, symptoms: e.target.value})} style={{ ...inputStyle, height: '60px' }} />
        </>
      )}

      {/* 詳細要望 */}
      {getFieldConfig('request_details').show && (
        <>
          <label style={labelStyle}>✨ {getFieldConfig('request_details').label}</label>
          <textarea value={editFields.request_details} onChange={(e) => setEditFields({...editFields, request_details: e.target.value})} style={{ ...inputStyle, height: '60px' }} />
        </>
      )}

      {/* 会社名・団体名 */}
      {getFieldConfig('company_name').show && (
        <>
          <label style={labelStyle}>🏢 {getFieldConfig('company_name').label}</label>
          <input type="text" value={editFields.company_name || ''} onChange={(e) => setEditFields({...editFields, company_name: e.target.value})} style={inputStyle} />
        </>
      )}
    </div>


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
  {res.res_type === 'blocked' ? `🚫 ${res.customer_name}` : `👤 ${res.customers?.admin_name || res.customer_name} 様`}
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

      {/* 🆕 追加：プライベート予定入力用モーダル */}
      {showPrivateModal && (
        <div style={overlayStyle} onClick={() => setShowPrivateModal(false)}>
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ ...modalContentStyle, maxWidth: '400px', textAlign: 'center', position: 'relative', padding: '35px' }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🕒</div>
            <h3 style={{ margin: '0 0 5px 0', color: themeColor, fontWeight: '900' }}>プライベート予定</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '25px' }}>{selectedDate.replace(/-/g, '/')} {targetTime}</p>
            
            <div style={{ textAlign: 'left', marginBottom: '20px' }}>
              <label style={labelStyle}>予定の内容（必須）</label>
              <input 
                type="text" 
                placeholder="例：休憩、買い出し、銀行など" 
                value={privateTaskFields.title}
                onChange={(e) => setPrivateTaskFields({ ...privateTaskFields, title: e.target.value })}
                style={inputStyle}
              />
              
              <label style={labelStyle}>メモ (任意)</label>
              <textarea 
                placeholder="詳細な内容があれば入力してください"
                value={privateTaskFields.note}
                onChange={(e) => setPrivateTaskFields({ ...privateTaskFields, note: e.target.value })}
                style={{ ...inputStyle, height: '100px', lineHeight: '1.5' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={handleSavePrivateTask}
                style={{ width: '100%', padding: '18px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '18px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              >
                予定を保存する
              </button>
              <button 
                onClick={() => setShowPrivateModal(false)} 
                style={{ padding: '12px', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold' }}
              >
                キャンセル
              </button>
            </div>
            
            {!isPC && (
              <button onClick={() => setShowPrivateModal(false)} style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#fff', border: 'none', padding: '12px 40px', borderRadius: '50px', fontWeight: 'bold', boxShadow: '0 10px 20px rgba(0,0,0,0.3)', zIndex: 4000 }}>閉じる ✕</button>
            )}
          </div>
        </div>
      )}

      {/* 🆕 追記：予約枠をピカッと光らせるアニメーション */}
<style>{`
        @keyframes flashGold {
          0% { 
            background-color: #fdd835 !important; /* 強めの黄色 */
            box-shadow: 0 0 40px #fdd835, inset 0 0 20px #fff; 
            transform: scale(1.1); /* 少し大きく浮かび上がる */
            z-index: 100;
          }
          70% {
            transform: scale(1.05);
          }
          100% { 
            /* 最終的には元の色に戻る（アニメーション終了で style の背景色に戻ります） */
            transform: scale(1);
            box-shadow: 0 0 0px transparent;
          }
        }
      `}</style>
      
    </div> // コンポーネント全体の閉じ
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