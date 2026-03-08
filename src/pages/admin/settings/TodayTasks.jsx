import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (shopId) {
      fetchShopData();
      fetchTodayTasks();
      fetchMasterData(); // 🆕 マスター情報を取得 [cite: 2026-03-08]
    }
  }, [shopId]);

// 🆕 調整項目とカテゴリを並び順通りに取得 [cite: 2026-03-08]
const fetchMasterData = async () => {
    // 調整、店販などを取得
    const [catRes, adjRes, prodRes, servRes, optRes] = await Promise.all([
      supabase.from('service_categories').select('*').eq('shop_id', shopId).eq('is_adjustment_cat', true).order('sort_order'),
      supabase.from('admin_adjustments').select('*').eq('shop_id', shopId).is('service_id', null).order('sort_order'),
      supabase.from('products').select('*').eq('shop_id', shopId),
      supabase.from('services').select('*').eq('shop_id', shopId), // 🆕 メニューマスター
      supabase.from('service_options').select('*') // 🆕 枝分かれオプション
    ]);

    setAdjCategories(catRes.data || []);
    setAdjustments(adjRes.data || []);
    setProducts(prodRes.data || []);
    setServices(servRes.data || []); // 🆕 セット
    setServiceOptions(optRes.data || []); // 🆕 セット
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
      .in('status', ['confirmed', 'completed'])
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

  return basePrice + optPrice;
};

// 🆕 レジを開く時
  const openQuickCheckout = (task) => {
    setSelectedTask(task);
    setSelectedAdjustments([]);
    setSelectedProducts([]);
    
    // 💡 修正：集計関数を使って正しい初期値をセット
    const initialPrice = calculateInitialPrice(task);
    setFinalPrice(initialPrice); 
    
    setIsCheckoutOpen(true);
  };

// 🆕 追加：調整項目や商品が選ばれるたびに金額を再計算する [cite: 2026-03-08]
  useEffect(() => {
    if (!selectedTask) return;
    
    // 💡 修正：ここも集計関数をベースに計算を開始
    let total = calculateInitialPrice(selectedTask);

    selectedAdjustments.forEach(adj => {
      if (adj.is_percent) total = total * (1 - (adj.price / 100));
      else total += adj.is_minus ? -adj.price : adj.price;
    });

    selectedProducts.forEach(prod => total += (prod.price || 0));
    setFinalPrice(Math.max(0, Math.round(total)));
  }, [selectedAdjustments, selectedProducts, selectedTask, services]); // 💡 servicesも監視 [cite: 2026-03-08]

  // 🚀 アップグレード：お会計確定 ＆ サービス完了（売上台帳へも記録） [cite: 2026-03-08]
  const handleCompleteTask = async () => {
    try {
      // 1. 予約ステータスを完了にし、最終金額で上書きする [cite: 2026-03-08]
      const { error: resError } = await supabase
        .from('reservations')
        .update({ 
          status: 'completed', 
          total_price: finalPrice,
          options: { ...selectedTask.options, quick_checkout: true, adjustments: selectedAdjustments } 
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
                </div>

{task.status === 'completed' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10b981', fontWeight: 'bold', fontSize: '0.9rem' }}>
                    <CheckCircle size={20} /> 完了済み
                  </div>
                ) : (
                  /* ✅ 修正：即完了ではなく「クイックレジ」を開くように変更します [cite: 2026-03-08] */
                  <button 
                    onClick={() => openQuickCheckout(task)} 
                    style={{ 
                      padding: '12px 24px', 
                      background: themeColor, 
                      color: '#fff', 
                      border: 'none', 
                      borderRadius: '12px', 
                      fontWeight: 'bold', 
                      cursor: 'pointer',
                      boxShadow: `0 4px 12px ${themeColor}44`
                    }}
                  >
                    お会計 ＆ 完了
                  </button>
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

      {/* ✅ 追記：ここにお会計パネルを追加します [cite: 2026-03-08] */}
      {isCheckoutOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#fff', width: '100%', borderTopLeftRadius: '30px', borderTopRightRadius: '30px', padding: '30px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 -10px 25px rgba(0,0,0,0.2)' }}>
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
                📋 メニュー調整マスター（割引・加算）
              </div>

              {adjCategories.map(cat => (
                <div key={cat.id} style={{ marginBottom: '15px', background: '#fdfbff', padding: '12px', borderRadius: '15px', border: '1px solid #f1f5f9' }}>
                  {/* カテゴリの見出し [cite: 2026-03-08] */}
                  <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#ef4444', display: 'block', marginBottom: '10px', borderLeft: '3px solid #ef4444', paddingLeft: '8px' }}>
                    {cat.name}
                  </label>
                  
                  {/* そのカテゴリに属するボタンだけを表示 [cite: 2026-03-08] */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {adjustments.filter(a => a.category === cat.name).map(adj => {
                      const isSel = selectedAdjustments.find(a => a.id === adj.id);
                      return (
                        <button 
                          key={adj.id} 
                          onClick={() => setSelectedAdjustments(prev => isSel ? prev.filter(a => a.id !== adj.id) : [...prev, adj])}
                          style={{ 
                            padding: '10px 15px', borderRadius: '10px', 
                            border: `1px solid ${isSel ? '#ef4444' : '#e2e8f0'}`, 
                            background: isSel ? '#ef4444' : '#fff', 
                            color: isSel ? '#fff' : '#475569', 
                            fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer' 
                          }}
                        >
                          {adj.name} {adj.is_minus ? '-' : '+'}{adj.is_percent ? `${adj.price}%` : `¥${adj.price.toLocaleString()}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* 店販商品セクション（ここにつながります） */}
            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#008000', display: 'block', marginBottom: '10px' }}>🧴 店販商品</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '25px' }}>
              {products.map(prod => {
                const isSel = selectedProducts.find(p => p.id === prod.id);
                return (
                  <button 
                    key={prod.id} 
                    onClick={() => setSelectedProducts(prev => isSel ? prev.filter(p => p.id !== prod.id) : [...prev, prod])}
                    style={{ padding: '10px 15px', borderRadius: '10px', border: `1px solid ${isSel ? '#008000' : '#e2e8f0'}`, background: isSel ? '#008000' : '#fff', color: isSel ? '#fff' : '#475569', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    {prod.name} ¥{prod.price}
                  </button>
                );
              })}
            </div>

            {/* 合計表示エリア */}
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '20px', marginBottom: '25px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: '#1e293b' }}>最終合計金額</span>
                <span style={{ fontSize: '2.2rem', fontWeight: '900', color: themeColor }}>¥{finalPrice.toLocaleString()}</span>
              </div>
            </div>

            {/* 確定ボタン */}
            <button 
              onClick={handleCompleteTask} 
              style={{ width: '100%', padding: '20px', background: themeColor, color: '#fff', border: 'none', borderRadius: '18px', fontWeight: 'bold', fontSize: '1.2rem', boxShadow: `0 10px 20px ${themeColor}44`, cursor: 'pointer' }}
            >
              確定して完了 ✓
            </button>
          </div>
        </div>
      )}
    </div> // 👈 一番外側の div
  );
};

export default TodayTasks;