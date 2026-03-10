import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { 
  CheckCircle2, Clock, User, ArrowLeft, 
  Calendar, CheckCircle, AlertCircle 
} from 'lucide-react';

const TodayTasks = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // 🆕 お客様情報ポップアップ用の状態 [cite: 2026-03-08]
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [customerMemo, setCustomerMemo] = useState('');
  const [isSavingMemo, setIsSavingMemo] = useState(false);

  const [tasks, setTasks] = useState([]);
  const [shopData, setShopData] = useState(null);
  // 🆕 金額計算のためにマスターを保持する箱を追加
  const [services, setServices] = useState([]);
  const [serviceOptions, setServiceOptions] = useState([]);

  // 🆕 追加：レジ用の状態管理
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [adjustments, setAdjustments] = useState([]);
  const [adjCategories, setAdjCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedAdjustments, setSelectedAdjustments] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [finalPrice, setFinalPrice] = useState(0);
  const [openAdjCatId, setOpenAdjCatId] = useState(null);
  const [productCategories, setProductCategories] = useState([]); 
  const [openProdCatId, setOpenProdCatId] = useState(null);
  
  const [isCustomerModeOpen, setIsCustomerModeOpen] = useState(false);
  // 🆕 追加：メニュー変更ポップアップの管理 [cite: 2026-03-08]
  const [isMenuEditOpen, setIsMenuEditOpen] = useState(false);
  const [selectedServices, setSelectedServices] = useState([]); 
  const [selectedOptions, setSelectedOptions] = useState({});

  const [categories, setCategories] = useState([]);

  useEffect(() => {
      if (shopId) {
      fetchShopData();
      fetchTodayTasks();
      fetchMasterData(); // 🆕 マスター情報を取得 [cite: 2026-03-08]
    }
  }, [shopId]);

// 🆕 調整項目とカテゴリを並び順通りに取得（NULL/falseの揺れに強い版）
const fetchMasterData = async () => {
    // 1. カテゴリ、調整、店販、メニュー、オプションを並列で取得
    const [allCatsRes, adjRes, prodRes, servRes, optRes] = await Promise.all([
      // 全カテゴリをまとめて取得（並び順通り）
      supabase.from('service_categories').select('*').eq('shop_id', shopId).order('sort_order'),
      // 調整・店販・サービスも取得
      supabase.from('admin_adjustments').select('*').eq('shop_id', shopId).is('service_id', null).order('sort_order'),
      supabase.from('products').select('*').eq('shop_id', shopId).order('sort_order'),
      supabase.from('services').select('*').eq('shop_id', shopId).order('sort_order'),
      supabase.from('service_options').select('*')
    ]);

    const allCats = allCatsRes.data || [];

    // 💡 JS側で振り分けることで、DBに「null」と「false」が混ざっていても確実にキャッチします
    const normalCats = allCats.filter(c => !c.is_adjustment_cat && !c.is_product_cat);
    const adjustmentCats = allCats.filter(c => c.is_adjustment_cat === true);
    const productCats = allCats.filter(c => c.is_product_cat === true);

    // 各Stateへセット
    setCategories(normalCats);         // メニュー用
    setAdjCategories(adjustmentCats); // 調整用
    setProductCategories(productCats); // 店販用
    
    setAdjustments(adjRes.data || []);
    setProducts(prodRes.data || []);
    setServices(servRes.data || []);
    setServiceOptions(optRes.data || []);
};
  // 画面サイズ管理
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isPC = windowWidth > 900;

  useEffect(() => {
    if (shopId) {
      fetchShopData();
      fetchTodayTasks();
    }
  }, [shopId]);

  const fetchShopData = async () => {
    const { data } = await supabase.from('profiles').select('theme_color, business_name').eq('id', shopId).single();
    if (data) setShopData(data);
  };

const fetchTodayTasks = async () => {
    setLoading(true);
    
    // 🆕 1. 日本時間の「今日の日付」を確実に作る [cite: 2026-03-08]
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`; // "2026-03-08"

const { data, error } = await supabase
      .from('reservations')
      .select('*, customers(name, admin_name)') 
      .eq('shop_id', shopId)
      // 🆕 2. 文字列の「T」を抜いて、DBの timestamp 形式に合わせる [cite: 2026-03-08]
      .gte('start_time', `${todayStr} 00:00:00`)
      .lte('start_time', `${todayStr} 23:59:59`)
      // 💡 修正：ステータス制限を外し、AdminManagementと同じく'normal'予約ならすべて表示します [cite: 2026-03-08]
      .eq('res_type', 'normal') 
      .order('start_time', { ascending: true });
      
    // 💡 修正後のログ確認用
    console.log(`[デバッグ] 検索日付: ${todayStr} / 取得件数: ${data?.length || 0}`);

    if (!error) {
      setTasks(data || []);
    } else {
      console.error("取得エラー:", error.message);
    }
// ...省略 (fetchTodayTasks 関数の終わり)
    setLoading(false);
  };
    
const showMsg = (txt) => { setMessage(txt); setTimeout(() => setMessage(''), 3000); };

// 🆕 Step 3: AdminManagement.jsx から移植した「正確な金額集計」ロジック [cite: 2026-03-08]
// 予約データの JSON(options) を解読して、メニューと枝分かれの合計額を算出します
const calculateInitialPrice = (task) => {
  if (!task) return 0;
  // すでにレジで確定済み（total_priceがある）なら、その確定金額を優先して返します [cite: 2026-03-08]
  if (task.total_price && task.total_price > 0) return task.total_price;

  // 予約時の options(JSON) を解析します
  const opt = typeof task.options === 'string' ? JSON.parse(task.options) : (task.options || {});
  
  // 1人予約かグループ予約かを判定してサービス一覧を抽出します
  const items = opt.people ? opt.people.flatMap(p => p.services || []) : (opt.services || []);
  const subItems = opt.people ? opt.people.flatMap(p => Object.values(p.options || {})) : Object.values(opt.options || {});

  // 1. メニュー基本料金の集計（価格がなければマスターから補完） [cite: 2026-03-08]
  const basePrice = items.reduce((sum, item) => {
    let p = Number(item.price);
    if (!p || p === 0) {
      const master = services.find(s => s.id === item.id || s.name === item.name);
      p = master ? Number(master.price) : 0;
    }
    return sum + p;
  }, 0);

  // 2. 枝分かれオプション（シャンプー等）の追加料金を集計
  const optPrice = subItems.reduce((sum, o) => sum + (Number(o.additional_price) || 0), 0);

// (126行目付近)
  return basePrice + optPrice;
};

/* ==========================================
    🆕 追加：変更を即座にSupabaseへ同期する関数 [cite: 2026-03-08]
   ========================================== */
const syncReservationToSupabase = async (newSvcs, newOpts) => {
  if (!selectedTask) return;
  const newMenuName = newSvcs.map(s => s.name).join(', ');
  
  // 💡 変更があった瞬間にDBを更新することで、戻ってもリセットされなくなります [cite: 2026-03-08]
  const { error } = await supabase.from('reservations').update({ 
    menu_name: newMenuName,
    options: { ...selectedTask.options, services: newSvcs, options: newOpts } 
  }).eq('id', selectedTask.id);

  if (error) console.error("自動保存エラー:", error.message);
  fetchTodayTasks(); // リスト表示も最新に更新
};

// 🆕 レジを開く時 [cite: 2026-03-08]
  const openQuickCheckout = (task) => {
    setSelectedTask(task);
    setSelectedAdjustments([]);
    setSelectedProducts([]);
    
    // 🆕 予約データのJSONから、現在選ばれているメニューを抽出してセット [cite: 2026-03-08]
    const opt = typeof task.options === 'string' ? JSON.parse(task.options) : (task.options || {});
const initialSvcs = opt.services || (opt.people ? opt.people.flatMap(p => p.services || []) : []);
    setSelectedServices(initialSvcs);

    // 🆕 追加：既存の枝分かれオプションを読み込む [cite: 2026-03-08]
    const initialOpts = opt.options || (opt.people ? opt.people[0]?.options : {});
    setSelectedOptions(initialOpts || {});

    const initialPrice = calculateInitialPrice(task);
    setFinalPrice(initialPrice); 
    setIsCheckoutOpen(true);
  };
  
// 🆕 修正：有効なオプションのみを集計するロジック [cite: 2026-03-08]
  useEffect(() => {
    if (!selectedTask) return;
    
    // 💡 選択中のメニューIDに含まれるオプションだけを抽出（ゴミデータを計算に入れない） [cite: 2026-03-08]
    const validOptions = Object.entries(selectedOptions).filter(([key]) => 
      selectedServices.some(s => key.startsWith(`${s.id}-`))
    ).map(([_, val]) => val);

    const optPrice = validOptions.reduce((sum, o) => sum + (Number(o.additional_price) || 0), 0);
    let total = selectedServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0) + optPrice;

    selectedAdjustments.forEach(adj => {
      if (adj.is_percent) total = total * (1 - (adj.price / 100));
      else total += adj.is_minus ? -adj.price : adj.price;
    });

    selectedProducts.forEach(prod => total += (prod.price || 0));
    setFinalPrice(Math.max(0, Math.round(total)));
  }, [selectedServices, selectedOptions, selectedAdjustments, selectedProducts, selectedTask]);
  
  // 🚀 アップグレード：お会計確定 ＆ サービス完了（売上台帳へも記録） [cite: 2026-03-08]
  const handleCompleteTask = async () => {
    try {
// 1. 予約ステータスを完了にし、変更後のメニューと金額で上書き [cite: 2026-03-08]
      const newMenuName = selectedServices.map(s => s.name).join(', ');
      const { error: resError } = await supabase
        .from('reservations')
        .update({ 
          status: 'completed', 
          total_price: finalPrice,
          menu_name: newMenuName, // 🆕 メニュー名も最新版に更新 [cite: 2026-03-08]
          options: { 
            ...selectedTask.options, 
            services: selectedServices,
            options: selectedOptions,
            adjustments: selectedAdjustments,
            products: selectedProducts,
            quick_checkout: true 
          } 
        })
        .eq('id', selectedTask.id);

      if (resError) throw resError;

      // 2. 売上管理（salesテーブル）に自動で1件記録を追加する [cite: 2026-03-08]
      const { error: saleError } = await supabase.from('sales').insert([{
        shop_id: shopId,
        reservation_id: selectedTask.id,
        total_amount: finalPrice,
        sale_date: new Date().toLocaleDateString('sv-SE') 
      }]);

      if (saleError) console.error("売上台帳への記録に失敗:", saleError.message);

      showMsg("お会計とサービス完了を記録しました！✨");
      setIsCheckoutOpen(false);
      fetchTodayTasks(); 
    } catch (err) {
      alert("確定エラー: " + err.message);
    }
  };
/* ==========================================
      🆕 追加：完了を取り消してレジをやり直す関数
     ========================================== */
  const handleRevertTask = async (task) => {
    if (!window.confirm(`${task.customer_name} 様の「完了」を取り消して、お会計をやり直しますか？`)) return;

    try {
      // 1. 売上台帳（salesテーブル）から、この予約に紐づく記録を削除
      await supabase.from('sales').delete().eq('reservation_id', task.id);

      // 2. 予約ステータスを 'confirmed' に戻す
      const { error } = await supabase.from('reservations').update({ status: 'confirmed' }).eq('id', task.id);
      if (error) throw error;

      // ✅ 修正：余計なタグを消しました
      showMsg("完了を取り消しました。お会計を修正できます。");
      fetchTodayTasks(); 
} catch (err) {
      alert("取り消しエラー: " + err.message);
    }
  };

/* ==========================================
    🆕 お客様の詳細情報（名簿マスタからメモを取得）
   ========================================== */
const openCustomerInfo = async (task) => {
  setSelectedTask(task); // 現在のタスクを保持
  let cust = null;

  try {
    // 1. まず予約データに customer_id が紐付いているか確認
    if (task.customer_id) {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('id', task.customer_id)
        .maybeSingle();
      cust = data;
    }

    // 2. 紐付けがない場合、電話番号かメールで名簿をガサ入れ（名寄せ）
    if (!cust) {
      const orConditions = [];
      if (task.customer_phone && task.customer_phone !== '---') orConditions.push(`phone.eq.${task.customer_phone}`);
      if (task.customer_email) orConditions.push(`email.eq.${task.customer_email}`);

      if (orConditions.length > 0) {
        const { data } = await supabase
          .from('customers')
          .select('*')
          .eq('shop_id', shopId)
          .or(orConditions.join(','))
          .maybeSingle();
        cust = data;
      }
    }

    // 状態をセット
    if (cust) {
      setSelectedCustomer(cust);
      setCustomerMemo(cust.memo || '');
    } else {
      // 全くの新規客の場合
      setSelectedCustomer({ name: task.customer_name, id: null });
      setCustomerMemo('');
    }

    // 3. 過去の来店履歴を取得
    const searchId = cust?.id || task.customer_id;
    if (searchId) {
      const { data: history } = await supabase
        .from('reservations')
        .select('*')
        .eq('shop_id', shopId)
        .eq('customer_id', searchId)
        .eq('status', 'completed')
        .order('start_time', { ascending: false })
        .limit(10);
      setCustomerHistory(history || []);
    } else {
      setCustomerHistory([]);
    }

    setShowCustomerModal(true);
  } catch (err) {
    console.error("データ取得エラー:", err);
    setShowCustomerModal(true);
  }
};
/* ==========================================
    🆕 顧客メモを保存（マスタ共通 ＆ 予約と名簿を紐付け）
   ========================================== */
const handleSaveMemo = async () => {
  setIsSavingMemo(true);
  try {
    let targetId = selectedCustomer?.id;

    // 1. 名簿（customers）を更新または新規作成（upsert）
    const customerPayload = {
      shop_id: shopId,
      name: selectedCustomer?.name || selectedTask.customer_name,
      memo: customerMemo,
      updated_at: new Date().toISOString()
    };

    // 既存客ならIDを指定して上書き
    if (targetId) customerPayload.id = targetId;

    const { data: savedCust, error: custError } = await supabase
      .from('customers')
      .upsert(customerPayload, { onConflict: 'id' })
      .select()
      .single();

    if (custError) throw custError;
    targetId = savedCust.id;

    // 2. 今の予約データ（reservations）に名簿IDを書き込み、予約側のメモを空にする
    const { error: resError } = await supabase
      .from('reservations')
      .update({ 
        customer_id: targetId,
        memo: null // マスタに一本化したので予約側のメモは消去
      })
      .eq('id', selectedTask.id);

    if (resError) throw resError;

    // 画面の状態を更新
    setSelectedCustomer(savedCust);
    showMsg("名簿の共通メモを更新しました！✨");
    fetchTodayTasks(); // リスト側も最新の紐付け状態に更新
  } catch (err) {
    alert("保存エラー: " + err.message);
  } finally {
    setIsSavingMemo(false);
  }
};
  const themeColor = shopData?.theme_color || '#2563eb';

  if (loading) return <div style={{ textAlign: 'center', padding: '50px' }}>読み込み中...</div>;
  
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', paddingBottom: '100px', fontFamily: 'sans-serif' }}>
      
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '12px', zIndex: 1001, textAlign: 'center', fontWeight: 'bold', boxShadow: '0 10px 15px rgba(0,0,0,0.1)' }}>
          {message}
        </div>
      )}

<div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
        {/* ✅ 修正：ダッシュボードではなく「カレンダー画面」へ直接戻ります [cite: 2026-03-06] */}
        <button 
          onClick={() => navigate(`/admin/${shopId}/reservations`)} 
          style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '50%', cursor: 'pointer', color: '#64748b', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#1e293b' }}>今日のタスク</h2>
          <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>← カレンダーへ戻る</p>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '20px', color: '#64748b' }}>
            <Calendar size={40} style={{ marginBottom: '10px', opacity: 0.5 }} />
            <p>今日の予約タスクはありません</p>
          </div>
        ) : (
          tasks.map(task => (
            <div key={task.id} style={{ 
              background: task.status === 'completed' ? '#f8fafc' : '#fff', 
              padding: '20px', 
              borderRadius: '20px', 
              border: task.status === 'completed' ? '1px solid #e2e8f0' : `2px solid ${themeColor}22`,
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              opacity: task.status === 'completed' ? 0.7 : 1
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Clock size={16} color={themeColor} />
<span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#1e293b' }}>
  {/* ✅ 修正：start_time が NULL なら start_at を使う [cite: 2026-03-01] */}
  {new Date(task.start_time || task.start_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 〜
</span>
                  </div>
<div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
                    <User size={16} />
                    <span style={{ fontWeight: 'bold' }}>{task.customer_name || 'お客様'} 様</span>
                  </div>
                  {/* 🆕 追加：カードに予約メニューを表示 [cite: 2026-03-08] */}
                  <div style={{ fontSize: '0.85rem', color: themeColor, marginTop: '8px', fontWeight: 'bold', paddingLeft: '24px' }}>
                    {task.menu_name || 'メニュー未設定'}
                  </div>
                </div>

{task.status === 'completed' ? (
  /* 💡 完了済みバッジの横に、取り消し用のボタンを配置 [cite: 2026-03-08] */
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10b981', fontWeight: 'bold', fontSize: '0.9rem' }}>
      <CheckCircle size={20} /> 完了済み
    </div>
    {/* 🆕 修正用ボタンを追加 [cite: 2026-03-08] */}
    <button 
      onClick={() => handleRevertTask(task)}
      style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline', padding: '4px' }}
    >
      修正する（お会計を戻す）
    </button>
  </div>
) : (
  /* ✅ 修正：2列ボタンにして、左側にお客様情報ボタンを配置 [cite: 2026-03-08] */
  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
    <button
      onClick={() => openCustomerInfo(task)}
      style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
    >
      履歴
    </button>
    <button
      onClick={() => openQuickCheckout(task)}
      style={{ flex: 2, padding: '12px', background: themeColor, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem', boxShadow: `0 4px 12px ${themeColor}44` }}
    >
      お会計 ＆ 完了
    </button>
  </div>
)}
               </div>
            </div>
          ))
        )}
      </div>

{/* --- 省略 --- */}
      <div style={{ marginTop: '30px', padding: '20px', background: '#fefce8', borderRadius: '16px', border: '1px solid #fef08a', display: 'flex', gap: '12px' }}>
        <AlertCircle size={20} color="#a16207" />
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#854d0e', lineHeight: '1.6' }}>
          <b>店主様へ：</b><br />
          施術が完了したら「サービス完了」を押してください。これがトリガーとなり、お客様のマイページにアクション（卵の付与など）が発生します。[cite: 2026-03-01, 2026-03-06]
        </p>
      </div>

{/* ✅ 修正：外側タップで閉じる機能を追加 [cite: 2026-03-08] */}
      {isCheckoutOpen && (
        <div 
          onClick={() => setIsCheckoutOpen(false)} // 💡 外側をタップしたら閉じる
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', alignItems: 'flex-end' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} // 💡 中身をタップしても閉じないようにする
            style={{ background: '#fff', width: '100%', borderTopLeftRadius: '30px', borderTopRightRadius: '30px', padding: '30px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 -10px 25px rgba(0,0,0,0.2)' }}
          >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{selectedTask?.customers?.admin_name || selectedTask?.customer_name} 様</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>レジ・お会計確定</p>
              </div>
              <button onClick={() => setIsCheckoutOpen(false)} style={{ background: '#f1f5f9', border: 'none', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
            </div>

{/* 🆕 カテゴリごとに整理してボタンを表示 [cite: 2026-03-08] */}
            <div style={{ marginBottom: '25px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#4b2c85', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                メニュー調整マスター（割引・加算）
              </div>

{/* 🆕 Step 1: カテゴリを2列のスリムなタイルカードで表示 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '25px' }}>
              {adjCategories.map(cat => (
                <div 
                  key={cat.id} 
                  onClick={() => setOpenAdjCatId(cat.id)}
                  style={{ 
                    height: '48px', background: '#fff', borderRadius: '12px', textAlign: 'center',
                    border: '1px solid #e2e8f0', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px'
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {cat.name}
                  </span>
                </div>
              ))}
            </div>

            {/* 🆕 Step 2: カテゴリ専用の調整項目ポップアップ */}
            {openAdjCatId && (
              <div 
                onClick={() => setOpenAdjCatId(null)} // 💡 追加：外側タップで閉じる
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(4px)' }}
              >
                <div 
                  onClick={(e) => e.stopPropagation()} // 💡 追加：中身のタップでは閉じないようにする
                  style={{ background: '#fff', width: '100%', borderTopLeftRadius: '30px', borderTopRightRadius: '30px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -10px 25px rgba(0,0,0,0.2)' }}
                >
                  
                  {/* 【固定ヘッダー】スクロールしても常に表示 */}
                  <div style={{ padding: '20px 25px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold' }}>
                      {adjCategories.find(c => c.id === openAdjCatId)?.name} を選択
                    </h3>
                    {/* 右上の閉じるボタン */}
                    <button onClick={() => setOpenAdjCatId(null)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', color: '#64748b' }}>✕</button>
                  </div>

                  {/* 【スクロールエリア】項目を縦1列に並べる */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {adjustments
                      .filter(a => a.category === adjCategories.find(c => c.id === openAdjCatId)?.name)
                      .map(adj => {
                        const isSel = selectedAdjustments.find(a => a.id === adj.id);
                        return (
                          <button 
                            key={adj.id} 
                            onClick={() => setSelectedAdjustments(prev => isSel ? prev.filter(a => a.id !== adj.id) : [...prev, adj])}
                            style={{ 
                              width: '100%', padding: '18px', borderRadius: '15px', textAlign: 'left',
                              border: `2px solid ${isSel ? themeColor : '#f1f5f9'}`, 
                              background: isSel ? `${themeColor}15` : '#fff', 
                              color: isSel ? themeColor : '#475569', 
                              fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                            }}
                          >
                            <span>{isSel ? '✅ ' : ''}{adj.name}</span>
                            <span style={{ fontWeight: '900' }}>
                              {adj.is_minus ? '-' : '+'}{adj.is_percent ? `${adj.price}%` : `¥${adj.price.toLocaleString()}`}
                            </span>
                          </button>
                        );
                    })}
                  </div>

                  {/* 【固定フッター】常に表示される完了ボタン */}
                  <div style={{ padding: '15px 20px', borderTop: '1px solid #f1f5f9', background: '#fff' }}>
                    <button 
                      onClick={() => setOpenAdjCatId(null)} 
                      style={{ width: '100%', padding: '16px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    >
                      選択を完了して閉じる
                    </button>
                  </div>
                </div>
              </div>
            )}
                                      </div>

{/* 🆕 Step 1: 店販商品カテゴリを2列のスリムなタイルカードで表示 [cite: 2026-03-08] */}
            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#008000', marginBottom: '12px' }}>店販商品</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '25px' }}>
              {productCategories.map(cat => (
                <div 
                  key={cat.id} 
                  onClick={() => setOpenProdCatId(cat.id)}
                  style={{ 
                    height: '48px', background: '#fff', borderRadius: '12px', textAlign: 'center',
                    border: '1px solid #e2e8f0', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px'
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {cat.name}
                  </span>
                </div>
              ))}
            </div>

            {/* 🆕 Step 2: 商品カテゴリ専用の選択ポップアップ [cite: 2026-03-08] */}
{openProdCatId && (
              <div 
                onClick={() => setOpenProdCatId(null)} // 💡 追加：外側タップで閉じる
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(4px)' }}
              >
                <div 
                  onClick={(e) => e.stopPropagation()} // 💡 追加：中身のタップでは閉じないようにする
                  style={{ background: '#fff', width: '100%', borderTopLeftRadius: '30px', borderTopRightRadius: '30px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -10px 25px rgba(0,0,0,0.2)' }}
                >                  
                  <div style={{ padding: '20px 25px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold', color: '#008000' }}>
                      {productCategories.find(c => c.id === openProdCatId)?.name} を選択
                    </h3>
                    <button onClick={() => setOpenProdCatId(null)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', color: '#64748b' }}>✕</button>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {products
                      .filter(p => p.category === productCategories.find(c => c.id === openProdCatId)?.name)
                      .map(prod => {
                        const isSel = selectedProducts.find(p => p.id === prod.id);
                        return (
                          <button 
                            key={prod.id} 
                            onClick={() => setSelectedProducts(prev => isSel ? prev.filter(p => p.id !== prod.id) : [...prev, prod])}
                            style={{ 
                              width: '100%', padding: '18px', borderRadius: '15px', textAlign: 'left',
                              border: `2px solid ${isSel ? '#008000' : '#f1f5f9'}`, 
                              background: isSel ? '#f0fdf4' : '#fff', 
                              color: isSel ? '#008000' : '#475569', 
                              fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                            }}
                          >
                            <span>{isSel ? '✅ ' : ''}{prod.name}</span>
                            <span style={{ fontWeight: '900' }}>¥{(prod.price || 0).toLocaleString()}</span>
                          </button>
                        );
                    })}
                  </div>

                  <div style={{ padding: '15px 20px', borderTop: '1px solid #f1f5f9', background: '#fff' }}>
                    <button 
                      onClick={() => setOpenProdCatId(null)} 
                      style={{ width: '100%', padding: '16px', background: '#008000', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,128,0,0.1)' }}
                    >
                      商品の選択を完了して閉じる
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 合計表示エリア */}
{/* 🆕 選択内容の内訳サマリー [cite: 2026-03-08] */}
            <div style={{ marginBottom: '20px', padding: '18px', background: '#f9fafb', borderRadius: '18px', border: '1px dashed #cbd5e1', fontSize: '0.85rem', color: '#475569' }}>
              
              {/* 💡 ここ！メニュー名の横に変更ボタンを設置しました [cite: 2026-03-08] */}
              {selectedServices.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold' }}>メニュー:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#1e293b', fontWeight: 'bold' }}>
                      {selectedServices.map(s => s.name).join(', ')}
                    </span>
                    {/* 🆕 このボタンがメニュー変更ポップアップを呼び出します [cite: 2026-03-08] */}
                    <button 
                      onClick={() => setIsMenuEditOpen(true)} 
                      style={{ padding: '4px 10px', background: themeColor, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      変更
                    </button>
                  </div>
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', marginRight: '10px' }}>調整メニュー:</span>
                <span style={{ textAlign: 'right', color: '#1e293b' }}>
                  {selectedAdjustments.length > 0 ? selectedAdjustments.map(a => a.name).join(', ') : 'なし'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', marginRight: '10px' }}>店販商品:</span>
                <span style={{ textAlign: 'right', color: '#1e293b' }}>
                  {selectedProducts.length > 0 ? selectedProducts.map(p => p.name).join(', ') : 'なし'}
                </span>
              </div>
            </div>

{/* 🆕 追加：お客様提示ボタン [cite: 2026-03-08] */}
            <button 
              onClick={() => setIsCustomerModeOpen(true)}
              style={{ width: '100%', marginBottom: '15px', padding: '10px', background: '#fff', color: themeColor, border: `1px solid ${themeColor}`, borderRadius: '12px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              お客様に金額を提示する
            </button>

            {/* 合計表示エリア（ここは維持） */}
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '20px', marginBottom: '25px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: '#1e293b' }}>最終合計金額</span>
                <span style={{ fontSize: '2.2rem', fontWeight: '900', color: themeColor }}>¥{finalPrice.toLocaleString()}</span>
              </div>
            </div>

            {/* 確定ボタン */}
<button onClick={handleCompleteTask} style={{ width: '100%', padding: '20px', background: themeColor, color: '#fff', border: 'none', borderRadius: '18px', fontWeight: 'bold', fontSize: '1.2rem', boxShadow: `0 10px 20px ${themeColor}44`, cursor: 'pointer' }}>確定して完了 ✓</button>
          </div>
        </div>
      )}

{/* ==========================================
      ✨ 修正後：MenuSettingsの並び順を100%再現する書き方
    ========================================== */}
{isMenuEditOpen && (
  <div 
    onClick={() => setIsMenuEditOpen(false)} 
    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 4000, display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(4px)' }}
  >
    <div 
      onClick={(e) => e.stopPropagation()} 
      style={{ background: '#fff', width: '100%', borderTopLeftRadius: '30px', borderTopRightRadius: '30px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -10px 25px rgba(0,0,0,0.2)' }}
    >
      {/* ポップアップヘッダー */}
      <div style={{ padding: '20px 25px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold' }}>メニューの追加・変更</h3>
        <button onClick={() => setIsMenuEditOpen(false)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', color: '#64748b' }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ✅ ポイント：取得済みの categories (マスタ順) をベースにループさせる */}
        {categories.map(cat => {
          // このカテゴリに属するサービスを抽出（これらも fetchMasterData で sort_order 順に取得済み）
          const filteredServices = services.filter(s => s.category === cat.name);
          
          // メニューが1つも登録されていないカテゴリは表示しない
          if (filteredServices.length === 0) return null;

          return (
            <div key={cat.id}>
              {/* カテゴリ名の表示 */}
              <p style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', marginBottom: '10px' }}>📁 {cat.name}</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {filteredServices.map(svc => {
                  const isSel = selectedServices.find(s => s.id === svc.id);
                  return (
                    <div key={svc.id} style={{ display: 'flex', flexDirection: 'column' }}>
                      <button 
                        onClick={async () => {
                          let nextSvcs;
                          let nextOpts = { ...selectedOptions };
                          if (isSel) {
                            nextSvcs = selectedServices.filter(s => s.id !== svc.id);
                            Object.keys(nextOpts).forEach(key => {
                              if (key.startsWith(`${svc.id}-`)) delete nextOpts[key];
                            });
                          } else {
                            nextSvcs = [...selectedServices, svc];
                          }
                          setSelectedServices(nextSvcs);
                          setSelectedOptions(nextOpts);
                          await syncReservationToSupabase(nextSvcs, nextOpts);
                        }}
                        style={{ 
                          width: '100%', padding: '15px 10px', borderRadius: isSel ? '12px 12px 0 0' : '12px',
                          border: `2px solid ${isSel ? themeColor : '#f1f5f9'}`, 
                          background: isSel ? `${themeColor}15` : '#fff', 
                          color: isSel ? themeColor : '#1e293b', 
                          fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer' 
                        }}
                      >
                        {isSel ? '✅ ' : ''}{svc.name}<br />
                        <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>¥{svc.price?.toLocaleString()}</span>
                      </button>

                      {/* 枝分かれオプション（選択時のみ表示） */}
                      {isSel && (
                        <div style={{ padding: '10px', background: '#f8fafc', border: `2px solid ${themeColor}`, borderTop: 'none', borderRadius: '0 0 12px 12px', marginBottom: '10px' }}>
                          {Array.from(new Set(serviceOptions.filter(o => o.service_id === svc.id).map(o => o.group_name))).map(groupName => (
                            <div key={groupName} style={{ marginBottom: '10px' }}>
                              <p style={{ fontSize: '0.6rem', color: '#94a3b8', margin: '0 0 4px 0' }}>└ {groupName}</p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {serviceOptions.filter(o => o.service_id === svc.id && o.group_name === groupName).map(opt => {
                                  const isOptSel = selectedOptions[`${svc.id}-${groupName}`]?.id === opt.id;
                                  return (
                                    <button 
                                      key={opt.id} 
                                      onClick={async () => {
                                        const nextOpts = { ...selectedOptions, [`${svc.id}-${groupName}`]: opt };
                                        setSelectedOptions(nextOpts);
                                        await syncReservationToSupabase(selectedServices, nextOpts);
                                      }}
                                      style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 'bold', border: `1px solid ${isOptSel ? themeColor : '#cbd5e1'}`, background: isOptSel ? themeColor : '#fff', color: isOptSel ? '#fff' : '#475569', cursor: 'pointer' }}
                                    >
                                      {opt.option_name} {opt.additional_price > 0 ? `(+¥${opt.additional_price})` : ''}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '15px 20px', borderTop: '1px solid #f1f5f9', background: '#fff' }}>
        <button onClick={() => setIsMenuEditOpen(false)} style={{ width: '100%', padding: '16px', background: themeColor, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>
          メニューの選択を完了して閉じる
        </button>
      </div>
    </div>
  </div>
)}

{/* ==========================================
📱 Step 3: お客様提示用 フルスクリーン横向き画面（スクロール修正版） [cite: 2026-03-08]
========================================== */}
      {isCustomerModeOpen && (
        <div 
          onClick={() => setIsCustomerModeOpen(false)} 
          style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
        >
          {/* 回転コンテナ：高さ(height)を画面幅(85vw)に制限して固定します [cite: 2026-03-08] */}
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ width: '90vh', height: '85vw', transform: 'rotate(90deg)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '10px 0' }}
          >
            {/* 【固定ヘッダー】 */}
            <div style={{ borderBottom: `4px solid ${themeColor}`, paddingBottom: '10px', marginBottom: '10px', textAlign: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b', fontWeight: '900' }}>お会計内容のご確認</h2>
            </div>

            {/* 💡 【スクロールエリア】項目が増えてもここだけが動きます [cite: 2026-03-08] */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {selectedServices.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.4rem' }}>
                  <span style={{ fontWeight: 'bold', color: '#64748b' }}>メニュー</span>
                  <span style={{ fontWeight: '900', color: '#1e293b', textAlign: 'right' }}>
                    {selectedServices.map(s => s.name).join(', ')}
                    {/* 🆕 枝分かれも表示 [cite: 2026-03-08] */}
                    {Object.values(selectedOptions).map(o => `(${o.option_name})`).join('')}
                  </span>
                </div>
              )}

              {selectedAdjustments.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.4rem' }}>
                  <span style={{ fontWeight: 'bold', color: '#64748b' }}>調整・割引</span>
                  <span style={{ fontWeight: '900', color: '#ef4444', textAlign: 'right' }}>{selectedAdjustments.map(a => a.name).join(', ')}</span>
                </div>
              )}

              {selectedProducts.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.4rem' }}>
                  <span style={{ fontWeight: 'bold', color: '#64748b' }}>店販商品</span>
                  <span style={{ fontWeight: '900', color: '#008000', textAlign: 'right' }}>{selectedProducts.map(p => p.name).join(', ')}</span>
                </div>
              )}
            </div>

            {/* 【固定フッター】金額と戻るボタンが絶対に隠れないようにします [cite: 2026-03-08] */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', background: '#fff' }}>
              <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#1e293b' }}>合計金額</span>
                <span style={{ fontSize: '3.8rem', fontWeight: '900', color: themeColor }}>¥{finalPrice.toLocaleString()}</span>
              </div>

              <button 
                onClick={() => setIsCustomerModeOpen(false)}
                style={{ width: '100%', marginTop: '15px', padding: '10px', background: 'none', border: 'none', color: '#cbd5e1', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 'bold' }}
              >
                タップしてレジに戻る
              </button>
            </div>
          </div>
        </div>
      )}

{/* 🆕 追加：お客様情報 ＆ 来店履歴 ＆ メモのポップアップ [cite: 2026-03-08] */}
      <AnimatePresence>
        {showCustomerModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', padding: '20px' }} onClick={() => setShowCustomerModal(false)}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '25px', padding: '25px', maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900' }}>👤 {selectedCustomer?.name} 様</h3>
                <button onClick={() => setShowCustomerModal(false)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
              </div>

              {/* ✍️ メモエリア：AdminReservations / AdminManagement と共通です [cite: 2026-03-08] */}
              <div style={{ marginBottom: '25px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>📝 顧客メモ（マスタ共通）</label>
                <textarea 
                  value={customerMemo} 
                  onChange={(e) => setCustomerMemo(e.target.value)} 
                  style={{ width: '100%', height: '100px', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.9rem', boxSizing: 'border-box', lineHeight: '1.5' }}
                  placeholder="カラーの配合や、前回の会話内容、注意事項など..."
                />
                <button onClick={handleSaveMemo} disabled={isSavingMemo} style={{ width: '100%', marginTop: '8px', padding: '10px', background: themeColor, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
                  {isSavingMemo ? '保存中...' : 'メモを保存する'}
                </button>
              </div>

              {/* 🕒 履歴エリア：売上金額付き [cite: 2026-03-08] */}
              <h4 style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '12px', borderLeft: `4px solid ${themeColor}`, paddingLeft: '10px', fontWeight: 'bold' }}>🕒 直近の来店履歴</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {customerHistory.length > 0 ? customerHistory.map(h => (
                  <div key={h.id} style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '0.85rem' }}>
                      <span style={{ color: '#1e293b' }}>📅 {new Date(h.start_time).toLocaleDateString('ja-JP')}</span>
                      {/* ✅ 修正：予約データの total_price を直接見るようにしました [cite: 2026-03-10] */}
                      <span style={{ color: '#d34817' }}>¥{(h.total_price || 0).toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: themeColor, marginTop: '4px', fontWeight: 'bold' }}>
                      {h.menu_name || 'メニュー記録なし'}
                    </div>
                  </div>
                )) : (
                  <div style={{ textAlign: 'center', padding: '30px', background: '#f8fafc', borderRadius: '12px', color: '#94a3b8', fontSize: '0.85rem' }}>
                    来店履歴はありません
                  </div>
                )}
              </div>
              </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div> // 👈 ファイルの最後、一番外側の div
  );
};
export default TodayTasks;