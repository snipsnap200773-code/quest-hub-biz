import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  Save, Clipboard, Calendar, FolderPlus, PlusCircle, Trash2, 
  Tag, ChevronDown, RefreshCw, ChevronLeft, ChevronRight, Settings, Users, Percent, Plus, Minus, X, CheckCircle, User, FileText, History, ShoppingBag, Edit3, BarChart3
} from 'lucide-react';

function AdminManagement() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const cleanShopId = shopId?.trim();

  // --- 画面管理・日付 ---
  const [activeMenu, setActiveMenu] = useState('work');
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('sv-SE'));
  const [viewMonth, setViewMonth] = useState(new Date());

  // --- マスターデータ ---
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [serviceOptions, setServiceOptions] = useState([]); 
  const [adminAdjustments, setAdminAdjustments] = useState([]);
  const [products, setProducts] = useState([]); 
  const [deletedAdjIds, setDeletedAdjIds] = useState([]);
  const [deletedProductIds, setDeletedProductIds] = useState([]);

  // --- 予約・売上データ保持 ---
  const [allReservations, setAllReservations] = useState([]);
  const [salesRecords, setSalesRecords] = useState([]);

  // --- レジパネル用State ---
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedRes, setSelectedRes] = useState(null);
  const [checkoutServices, setCheckoutServices] = useState([]); 
  const [checkoutAdjustments, setCheckoutAdjustments] = useState([]); 
  const [checkoutProducts, setCheckoutProducts] = useState([]); 
  // ✅ 追記：レジで選択中の枝分かれメニューを保持する箱
  const [checkoutOptions, setCheckoutOptions] = useState({});
  const [finalPrice, setFinalPrice] = useState(0);
  const [openAdjCategory, setOpenAdjCategory] = useState(null); 
const [isMenuPopupOpen, setIsMenuPopupOpen] = useState(false); 
  // --- 🆕 売上分析用の新Stateを追加 ---
  const [viewYear, setViewYear] = useState(new Date().getFullYear()); // 表示する年
  const [selectedMonthData, setSelectedMonthData] = useState(null);   // ポップアップで表示する月のデータ
  // --- 顧客情報（カルテ）パネル用State ---
  const [isCustomerInfoOpen, setIsCustomerInfoOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [customerMemo, setCustomerMemo] = useState('');
  const [firstArrivalDate, setFirstArrivalDate] = useState(''); 
  const [pastVisits, setPastVisits] = useState([]);
  const [isSavingMemo, setIsSavingMemo] = useState(false);

  // ✅ 共通並び替え関数
  const sortItems = (items) => [...items].sort((a, b) => {
    const catA = a.category || 'その他'; const catB = b.category || 'その他';
    if (catA !== catB) return catA.localeCompare(catB, 'ja');
    return (a.name || '').localeCompare(b.name || '', 'ja');
  });

  useEffect(() => {
    if (cleanShopId) fetchInitialData();
  }, [cleanShopId, activeMenu, selectedDate]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const shopRes = await supabase.from('profiles').select('*').eq('id', cleanShopId).single();
      if (shopRes.data) setShop(shopRes.data);
      const startOfYear = `${new Date().getFullYear()}-01-01`;
      const endOfYear = `${new Date().getFullYear()}-12-31`;
      const { data: resData } = await supabase.from('reservations').select('*').eq('shop_id', cleanShopId).order('start_time', { ascending: true });
      setAllReservations(resData || []);
      const { data: sData } = await supabase.from('sales').select('*').eq('shop_id', cleanShopId).gte('sale_date', startOfYear).lte('sale_date', endOfYear);
      setSalesRecords(sData || []);
      const [catRes, servRes, optRes, adjRes, prodRes] = await Promise.all([
        supabase.from('service_categories').select('*').eq('shop_id', cleanShopId).order('sort_order'),
        supabase.from('services').select('*').eq('shop_id', cleanShopId).order('sort_order'),
        supabase.from('service_options').select('*'),
        supabase.from('admin_adjustments').select('*'),
        supabase.from('products').select('*').eq('shop_id', cleanShopId).order('sort_order')
      ]);
      setCategories(catRes.data || []); setServices(servRes.data || []); setServiceOptions(optRes.data || []); setAdminAdjustments(adjRes.data || []); setProducts(prodRes.data || []);
    } catch (err) { console.error("Fetch Error:", err); } finally { setLoading(false); }
  };

  // ✅ ② [修正箇所] データの読み込み口：商品名(savedProducts)を抽出できるようにしました
const parseReservationDetails = (res) => {
    if (!res) return { menuName: '', totalPrice: 0, items: [], subItems: [], savedAdjustments: [], savedProducts: [] };

    const opt = typeof res.options === 'string' ? JSON.parse(res.options) : (res.options || {});
    
    // ✅ 修正：people配列がある場合、全員分のservicesとoptionsを合体させる
    let items = [];
    let subItems = [];

    if (opt.people && Array.isArray(opt.people)) {
      // 全員のメニューを一つの配列にまとめる
      items = opt.people.flatMap(p => p.services || []);
      // 全員の枝分かれ（シャンプー等）を一つの配列にまとめる
      subItems = opt.people.flatMap(p => Object.values(p.options || {}));
    } else {
      // 従来の単名予約の場合
      items = opt.services || [];
      subItems = Object.values(opt.options || {});
    }

    const baseNames = items.map(s => s.name).join(', ');
    const optionNames = subItems.map(o => o.option_name).join(', ');
    const fullMenuName = res.menu_name || (optionNames ? `${baseNames}（${optionNames}）` : (baseNames || 'メニューなし'));

    let basePrice = items.reduce((sum, item) => {
      let p = Number(item.price);
      if (!p || p === 0) {
        const master = services.find(s => s.id === item.id || s.name === item.name);
        p = master ? Number(master.price) : 0;
      }
      return sum + p;
    }, 0);

    const optPrice = subItems.reduce((sum, o) => sum + (Number(o.additional_price) || 0), 0);

    return { 
      menuName: fullMenuName, 
      totalPrice: basePrice + optPrice, 
      items, 
      subItems, 
      savedAdjustments: opt.adjustments || [], 
      savedProducts: opt.products || [] 
    };
  };

  // ✅ ① [修正箇所] お会計金額の計算ロジック（ toggle関数の上に配置しました）
// --- お会計計算 ＆ 連動ロジック（ここから） ---
// --- お会計計算 ＆ 連動ロジック ---
const calculateFinalTotal = (currentSvcs, currentAdjs, currentProds, currentOpts = checkoutOptions) => {
    // 1. メインメニューの合計
    let total = currentSvcs.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
    
    // ✅ 修正：予約データ(parseDetails)ではなく、レジで選択中のオプション(currentOpts)を合計する
    const optPrice = Object.values(currentOpts).reduce((sum, o) => sum + (Number(o.additional_price) || 0), 0);
    total += optPrice;

    // 3. 店販・調整の計算
    currentProds.forEach(p => total += Number(p.price || 0));
    currentAdjs.filter(a => !a.is_percent).forEach(a => {
      total += a.is_minus ? -Number(a.price) : Number(a.price);
    });
    currentAdjs.filter(a => a.is_percent).forEach(a => {
      total = total * (1 - (Number(a.price) / 100));
    });
    setFinalPrice(Math.max(0, Math.round(total)));
  };
  const toggleCheckoutAdj = (adj) => {
    const isSelected = checkoutAdjustments.find(a => a.id === adj.id);
    const newSelection = isSelected ? checkoutAdjustments.filter(a => a.id !== adj.id) : [...checkoutAdjustments, adj];
    setCheckoutAdjustments(newSelection);
    calculateFinalTotal(checkoutServices, newSelection, checkoutProducts);
  };

  const toggleCheckoutProduct = (prod) => {
    const isSelected = checkoutProducts.find(p => p.id === prod.id);
    const newSelection = isSelected ? checkoutProducts.filter(p => p.id !== prod.id) : [...checkoutProducts, prod];
    setCheckoutProducts(newSelection);
    calculateFinalTotal(checkoutServices, checkoutAdjustments, newSelection);
  };

  const toggleCheckoutService = (svc) => {
    const isSelected = checkoutServices.find(s => s.id === svc.id);
    const newSelection = isSelected ? checkoutServices.filter(s => s.id !== svc.id) : [...checkoutServices, svc];
    setCheckoutServices(newSelection);
    calculateFinalTotal(newSelection, checkoutAdjustments, checkoutProducts);
  };

  // ✅ 町田さんの件：完了ボタンを押した瞬間に台帳へ同期する命令
  const applyMenuChangeToLedger = () => {
    if (!selectedRes) return;
    const newBaseName = checkoutServices.map(s => s.name).join(', ');
    const info = parseReservationDetails(selectedRes);
    const branchNames = info.subItems.map(o => o.option_name).filter(Boolean);
    const fullDisplayName = branchNames.length > 0 ? `${newBaseName}（${branchNames.join(', ')}）` : newBaseName;

    setAllReservations(prev => prev.map(res => 
      res.id === selectedRes.id ? { ...res, menu_name: fullDisplayName, total_price: finalPrice } : res
    ));
    setIsMenuPopupOpen(false);
  };

const openCheckout = (res) => {
    const info = parseReservationDetails(res);
    setSelectedRes(res);
    setCheckoutServices(info.items);
    setCheckoutAdjustments(info.savedAdjustments);
    setCheckoutProducts(info.savedProducts);

    // ✅ 追記：予約時の枝分かれ設定をレジ用の箱(checkoutOptions)にコピー
    const opt = typeof res.options === 'string' ? JSON.parse(res.options) : (res.options || {});
    // 複数名予約(people)と単名予約(options)の両方から集約
    const initialOpts = opt.people 
      ? opt.people.flatMap(p => Object.entries(p.options || {})) 
      : Object.entries(opt.options || {});
    setCheckoutOptions(Object.fromEntries(initialOpts));

    setFinalPrice(res.total_price || info.totalPrice);
    setOpenAdjCategory(null); setIsCheckoutOpen(true); setIsCustomerInfoOpen(false);
  }; // 👈 ここで openCheckout は一旦終わり！

  // --- 4. 操作用関数（新しく追加するもの） ---
  // openCheckout の中ではなく、すぐ下に新しく書きます
  const toggleCheckoutOption = (serviceId, groupName, opt) => {
    const key = `${serviceId}-${groupName}`;
    const newOptions = { ...checkoutOptions, [key]: opt };
    setCheckoutOptions(newOptions);
    calculateFinalTotal(checkoutServices, checkoutAdjustments, checkoutProducts, newOptions);
  };
  const completePayment = async () => {
    try {
      const totalSlots = checkoutServices.reduce((sum, s) => sum + (Number(s.slots) || 1), 0);
      const endTime = new Date(new Date(selectedRes.start_time).getTime() + totalSlots * (shop.slot_interval_min || 15) * 60000);
      
      // ✅ 町田さんの件：お会計確定時も「枝分かれ込みの名前」でデータベースに保存
      const currentBaseName = checkoutServices.map(s => s.name).join(', ');
      const info = parseReservationDetails(selectedRes);
      const branchNames = info.subItems.map(o => o.option_name).filter(Boolean);
      const dbMenuName = branchNames.length > 0 ? `${currentBaseName}（${branchNames.join(', ')}）` : currentBaseName;

      await supabase.from('reservations').update({ 
        total_price: finalPrice, 
        status: 'completed', 
        total_slots: totalSlots, 
        end_time: endTime.toISOString(), 
        menu_name: dbMenuName, // 👈 ここを修正
options: { 
  services: checkoutServices, 
  adjustments: checkoutAdjustments, 
  products: checkoutProducts, 
  options: checkoutOptions // 👈 これを付け足す
}      }).eq('id', selectedRes.id);

      const { data: cust } = await supabase.from('customers').select('id').eq('shop_id', cleanShopId).eq('name', selectedRes.customer_name).maybeSingle();
      const serviceAmt = checkoutServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
      const productAmt = checkoutProducts.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
      await supabase.from('sales').insert([{ shop_id: cleanShopId, reservation_id: selectedRes.id, customer_id: cust?.id || null, total_amount: finalPrice, service_amount: serviceAmt, product_amount: productAmt, sale_date: selectedDate, details: { services: checkoutServices, products: checkoutProducts, adjustments: checkoutAdjustments } }]);
      
      alert("お会計を確定しました。"); 
      setIsCheckoutOpen(false); 
      fetchInitialData();
    } catch (err) { alert("確定失敗: " + err.message); }
  };

  const addAdjustment = (svcId = null) => {
    const name = prompt("項目名を入力してください"); if (!name) return;
    let cat = svcId === null ? (prompt("カテゴリー名を入力してください", "その他") || "その他") : null;
    setAdminAdjustments([...adminAdjustments, { id: crypto.randomUUID(), service_id: svcId, name, price: 0, is_percent: false, is_minus: false, category: cat }]);
  };

  const handleRemoveAdjustment = (adj) => { if (adj.id && typeof adj.id === 'string' && !adj.id.includes('-temp')) setDeletedAdjIds(prev => [...prev, adj.id]); setAdminAdjustments(adminAdjustments.filter(a => a.id !== adj.id)); };
  const addProduct = () => { const name = prompt("商品名を入力してください"); if (name) setProducts([...products, { id: crypto.randomUUID(), name, price: 0 }]); };
  const dailyTotalSales = useMemo(() => allReservations.filter(r => r.start_time.startsWith(selectedDate) && r.res_type === 'normal' && r.status === 'completed').reduce((sum, r) => sum + (r.total_price || 0), 0), [allReservations, selectedDate]);

// ✅ ロジック修正：年単位で12ヶ月分を日別データ込みで集計します
  const analyticsData = useMemo(() => {
    const currentYear = viewYear;
    // 12ヶ月分の箱を用意
    const months = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      // その月の日数を計算
      const daysInMonth = new Date(currentYear, month, 0).getDate();
      return {
        month: month,
        total: 0,
        count: 0,
        days: Array.from({ length: daysInMonth }, (_, j) => ({ day: j + 1, total: 0, count: 0 }))
      };
    });

    const salesResIds = new Set(salesRecords.map(s => s.reservation_id));

    // 1. 予約データ（reservations）の集計
    allReservations.filter(r => r.status === 'completed' && !salesResIds.has(r.id)).forEach(r => {
      const d = new Date(r.start_time);
      if (d.getFullYear() === currentYear) {
        const mIdx = d.getMonth();
        const dIdx = d.getDate() - 1;
        months[mIdx].total += (r.total_price || 0);
        months[mIdx].count += 1;
        months[mIdx].days[dIdx].total += (r.total_price || 0);
        months[mIdx].days[dIdx].count += 1;
      }
    });

    // 2. 売上記録（sales）の集計
    salesRecords.forEach(s => {
      const d = new Date(s.sale_date);
      if (d.getFullYear() === currentYear) {
        const mIdx = d.getMonth();
        const dIdx = d.getDate() - 1;
        months[mIdx].total += (s.total_amount || 0);
        months[mIdx].count += 1;
        if (months[mIdx].days[dIdx]) {
          months[mIdx].days[dIdx].total += (s.total_amount || 0);
          months[mIdx].days[dIdx].count += 1;
        }
      }
    });

    return months;
  }, [allReservations, salesRecords, viewYear]);

  const groupedWholeAdjustments = useMemo(() => {
    const sorted = sortItems(adminAdjustments.filter(adj => adj.service_id === null));
    return sorted.reduce((acc, adj) => { const cat = adj.category || 'その他'; if (!acc[cat]) acc[cat] = []; acc[cat].push(adj); return acc; }, {});
  }, [adminAdjustments]);

  const saveAllMasters = async () => {
    setIsSaving(true);
    try {
      const formattedServices = services.map(svc => ({ id: svc.id, shop_id: cleanShopId, name: svc.name, price: svc.price || 0, category: svc.category, sort_order: svc.sort_order || 0, slots: svc.slots || 1 }));
      const formattedOptions = serviceOptions.map(opt => ({ id: opt.id, service_id: opt.service_id, group_name: opt.group_name, option_name: opt.option_name, additional_price: opt.additional_price || 0 }));
      const formattedAdjustments = adminAdjustments.map(adj => ({ id: adj.id, service_id: adj.service_id, name: adj.name, price: adj.price || 0, is_percent: adj.is_percent || false, is_minus: adj.is_minus || false, category: adj.service_id ? null : (adj.category || 'その他') }));
      const formattedProducts = products.map((p, i) => ({ id: p.id, shop_id: cleanShopId, name: p.name, price: p.price || 0, sort_order: i }));
      await Promise.all([ supabase.from('services').upsert(formattedServices), supabase.from('service_options').upsert(formattedOptions), supabase.from('admin_adjustments').upsert(formattedAdjustments), supabase.from('products').upsert(formattedProducts) ]);
      alert("保存しました。"); fetchInitialData();
    } catch (err) { alert("保存失敗: " + err.message); } finally { setIsSaving(false); }
  };

  const openCustomerInfo = async (res) => {
    setSelectedRes(res);
    const { data: cust } = await supabase.from('customers').select('*').eq('shop_id', cleanShopId).eq('name', res.customer_name).maybeSingle();
    const { data: history } = await supabase.from('reservations').select('*').eq('shop_id', cleanShopId).eq('customer_name', res.customer_name).order('start_time', { ascending: false });
    setSelectedCustomer(cust || { name: res.customer_name, phone: res.customer_phone, email: res.customer_email });
    setEditName(cust?.name || res.customer_name); setEditPhone(cust?.phone || res.customer_phone || ''); setEditEmail(cust?.email || res.customer_email || ''); setCustomerMemo(cust?.memo || ''); setPastVisits(history || []); setFirstArrivalDate(cust?.first_arrival_date || (history?.length > 0 ? history[history.length - 1].start_time.split('T')[0] : ''));
    setIsCustomerInfoOpen(true); setIsCheckoutOpen(false);
  };

  const saveCustomerInfo = async () => {
    if (!selectedCustomer) return; setIsSavingMemo(true);
    try {
      const currentId = selectedCustomer.id;
      const { data: duplicate } = await supabase.from('customers').select('*').eq('shop_id', cleanShopId).eq('name', editName).neq('id', currentId || '00000000-0000-0000-0000-000000000000').maybeSingle();
      if (duplicate && window.confirm(`「${editName}」様を統合しますか？`)) {
          await supabase.from('customers').update({ memo: `${duplicate.memo || ''}\n\n${customerMemo}`.trim(), total_visits: (duplicate.total_visits || 0) + (selectedCustomer.total_visits || 0), phone: editPhone || duplicate.phone, email: editEmail || duplicate.email, updated_at: new Date().toISOString() }).eq('id', duplicate.id);
          await supabase.from('reservations').update({ customer_name: editName }).eq('shop_id', cleanShopId).eq('customer_name', selectedCustomer.name);
          if (currentId) await supabase.from('customers').delete().eq('id', currentId);
          alert("統合完了！"); setIsCustomerInfoOpen(false); fetchInitialData(); return;
      }
      const payload = { shop_id: cleanShopId, name: editName, phone: editPhone, email: editEmail, memo: customerMemo, first_arrival_date: firstArrivalDate, updated_at: new Date().toISOString() };
      if (currentId) await supabase.from('customers').update(payload).eq('id', currentId); else await supabase.from('customers').insert([payload]);
      alert("情報を更新しました。"); fetchInitialData();
    } catch (err) { alert("失敗: " + err.message); } finally { setIsSavingMemo(false); }
  };

  const cycleAdjType = (id) => {
    setAdminAdjustments(prev => prev.map(a => {
      if (a.id !== id) return a;
      if (!a.is_minus && !a.is_percent) return { ...a, is_minus: true, is_percent: false };
      if (a.is_minus) return { ...a, is_minus: false, is_percent: true };
      return { ...a, is_minus: false, is_percent: false };
    }));
  };

  const handleDateChangeUI = (days) => { const d = new Date(selectedDate); d.setDate(d.getDate() + days); setSelectedDate(d.toLocaleDateString('sv-SE')); };

  return (
    <div style={fullPageWrapper}>
      <div style={sidebarStyle}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '2.2rem', fontStyle: 'italic', fontWeight: '900', color: '#4b2c85', margin: 0 }}>SOLO</h2>
          <p style={{ fontSize: '0.6rem', fontWeight: 'bold' }}>MANAGEMENT</p>
        </div>
        <button style={navBtnStyle(activeMenu === 'work', '#d34817')} onClick={() => setActiveMenu('work')}>日常業務</button>
        <button style={navBtnStyle(activeMenu === 'master_tech', '#4285f4')} onClick={() => setActiveMenu('master_tech')}>施術商品</button>
        <button style={navBtnStyle(activeMenu === 'analytics', '#008000')} onClick={() => setActiveMenu('analytics')}>売上分析</button>

        <div style={{ background: '#fff', borderRadius: '12px', padding: '10px', marginTop: '15px', border: '1px solid #4b2c85' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{viewMonth.getFullYear()}年{viewMonth.getMonth()+1}月</span>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button onClick={() => setViewMonth(new Date(viewMonth.setMonth(viewMonth.getMonth()-1)))} style={{ border: 'none', background: 'none' }}>◀</button>
              <button onClick={() => setViewMonth(new Date(viewMonth.setMonth(viewMonth.getMonth()+1)))} style={{ border: 'none', background: 'none' }}>▶</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center' }}>
            {['月','火','水','木','金','土','日'].map(d => <div key={d} style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{d}</div>)}
            {Array.from({length: 42}).map((_, i) => {
              const year = viewMonth.getFullYear(); const month = viewMonth.getMonth();
              const firstDay = new Date(year, month, 1).getDay();
              const d = new Date(year, month, i - (firstDay === 0 ? 6 : firstDay - 1) + 1);
              if (d.getMonth() !== month) return <div key={i} />;
              const isSelected = d.toLocaleDateString('sv-SE') === selectedDate;
              return <div key={i} onClick={() => setSelectedDate(d.toLocaleDateString('sv-SE'))} style={{ fontSize: '0.7rem', padding: '4px 0', cursor: 'pointer', borderRadius: '4px', background: isSelected ? '#4b2c85' : 'none', color: isSelected ? '#fff' : '#333' }}>{d.getDate()}</div>
            })}
          </div>
        </div>
        <div style={{ marginTop: 'auto', paddingTop: '20px' }}><button style={navBtnStyle(false, '#ff1493')} onClick={() => navigate(`/admin/${cleanShopId}/reservations`)}>業 務 終 了</button></div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {activeMenu === 'work' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ background: '#d34817', padding: '15px 25px', color: '#fff', display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontStyle: 'italic', fontSize: '1.4rem' }}>受付台帳：{selectedDate.replace(/-/g, '/')}</h2>
              <div style={{ display: 'flex', gap: '8px', marginLeft: '20px' }}>
                <button onClick={() => handleDateChangeUI(-1)} style={headerBtnSmall}>前日</button>
                <button onClick={() => setSelectedDate(new Date().toLocaleDateString('sv-SE'))} style={headerBtnSmall}>今日</button>
                <button onClick={() => handleDateChangeUI(1)} style={headerBtnSmall}>次日</button>
              </div>
              <div style={{ background: '#fff', color: '#d34817', padding: '5px 15px', fontWeight: 'bold', marginLeft: 'auto' }}>
                {allReservations.filter(r => r.start_time.startsWith(selectedDate) && r.res_type === 'normal').length}件の予約
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#f3f0ff', borderBottom: '2px solid #4b2c85' }}><th style={thStyle}>時間</th><th style={thStyle}>お客様名 (カルテ)</th><th style={thStyle}>メニュー(予定)</th><th style={thStyle}>お会計 (レジ)</th></tr></thead>
                <tbody>
                  {allReservations.filter(r => r.start_time.startsWith(selectedDate) && r.res_type === 'normal').length > 0 ? 
                    allReservations.filter(r => r.start_time.startsWith(selectedDate) && r.res_type === 'normal').map((res) => (
                      <tr key={res.id} style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}>
                        <td onClick={() => openCheckout(res)} style={tdStyle}>{new Date(res.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td onClick={() => openCustomerInfo(res)} style={{ ...tdStyle, background: res.status === 'completed' ? '#eee' : '#008000', color: res.status === 'completed' ? '#333' : '#fff', fontWeight: 'bold' }}>{res.customer_name} {res.status === 'completed' && '✓'}</td>
                        <td onClick={() => openCheckout(res)} style={tdStyle}>{parseReservationDetails(res).menuName}</td>
                        <td onClick={() => openCheckout(res)} style={{ ...tdStyle, fontWeight: 'bold' }}>¥ {Number(res.total_price || parseReservationDetails(res).totalPrice).toLocaleString()}</td>
                      </tr>
                    )) : (<tr><td colSpan="4" style={{ padding: '50px', textAlign: 'center', color: '#999' }}>予約なし</td></tr>)}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', background: '#d34817', padding: '15px 25px', justifyContent: 'flex-end', alignItems: 'center', gap: '15px', color: '#fff' }}>
               <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>本日のお会計確定 合計</div>
               <div style={{ fontSize: '1.8rem', fontWeight: '900' }}>¥ {dailyTotalSales.toLocaleString()}</div>
            </div>
          </div>
        )}

{activeMenu === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f0f2f5' }}>
            {/* 🆕 年度切り替えヘッダー */}
            <div style={{ background: '#008000', padding: '15px 25px', color: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '30px' }}>
              <button onClick={() => setViewYear(v => v - 1)} style={yearBtnStyle}>◀</button>
              <h2 style={{ margin: 0, fontStyle: 'italic', fontSize: '1.6rem' }}>{viewYear}年 売上分析</h2>
              <button onClick={() => setViewYear(v => v + 1)} style={yearBtnStyle}>▶</button>
            </div>

            {/* 🆕 月別カードグリッド（タイル状に並べる） */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '15px' }}>
              {analyticsData.map(m => (
                <div key={m.month} onClick={() => setSelectedMonthData(m)} style={monthCardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: '900', color: '#008000' }}>{m.month}月</span>
                    <BarChart3 size={20} color="#94a3b8" />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ color: '#666', fontSize: '0.8rem' }}>来客数</span>
                    <span style={{ fontWeight: 'bold' }}>{m.count} 名</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ color: '#666', fontSize: '0.8rem' }}>売上合計</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: '900', color: '#d34817' }}>¥ {m.total.toLocaleString()}</span>
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '0.65rem', color: '#4285f4', textAlign: 'right', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>タップして日別詳細を表示 →</div>
                </div>
              ))}
            </div>

            {/* 🆕 日別詳細ポップアップ（モーダル） */}
            {selectedMonthData && (
              <div style={modalOverlayStyle} onClick={() => setSelectedMonthData(null)}>
                <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #008000', paddingBottom: '10px', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0 }}>{viewYear}年 {selectedMonthData.month}月 日別詳細</h3>
                    <button onClick={() => setSelectedMonthData(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X /></button>
                  </div>
                  <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}><tr style={{ background: '#f8fafc' }}><th style={thStyle}>日付</th><th style={thStyle}>来客数</th><th style={thStyle}>売上高</th></tr></thead>
                      <tbody>
                        {selectedMonthData.days.filter(d => d.total > 0).length > 0 ? (
                          selectedMonthData.days.filter(d => d.total > 0).map(d => (
                            <tr key={d.day} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={tdStyle}>{d.day}日</td>
                              <td style={tdStyle}>{d.count}名</td>
                              <td style={{ ...tdStyle, fontWeight: 'bold', color: '#d34817' }}>¥ {d.total.toLocaleString()}</td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan="3" style={{ padding: '30px', textAlign: 'center', color: '#999' }}>売上データなし</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: '20px', padding: '15px', background: '#f0fdf4', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: '#008000' }}>{selectedMonthData.month}月 合計</span>
                    <span style={{ fontSize: '1.6rem', fontWeight: '900', color: '#d34817' }}>¥ {selectedMonthData.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeMenu === 'master_tech' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc' }}>
            <div style={{ background: '#4285f4', padding: '15px 25px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontStyle: 'italic' }}>商品マスター設定</h2>
              <button onClick={saveAllMasters} disabled={isSaving} style={{ padding: '8px 30px', background: '#008000', color: '#fff', border: '1px solid #fff', fontWeight: 'bold' }}>一括保存</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '30px' }}>
              {categories.map(cat => (
                <div key={cat.id} style={cardStyle}>
                  <div style={catHeaderStyle}><span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>📁 {cat.name}</span></div>
                  {services.filter(s => s.category === cat.name).map(svc => (
                    <div key={svc.id} style={{ ...svcRowStyle, flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px solid #eee' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '15px', width: '100%', marginBottom: '10px' }}>
                          <span style={{ fontWeight: 'bold', minWidth: '150px' }}>{svc.name}</span>
                          <input type="number" value={svc.price || 0} onChange={(e) => setServices(services.map(s => s.id === svc.id ? {...s, price: parseInt(e.target.value)} : s))} style={priceInputStyle} />
                          <button onClick={() => addAdjustment(svc.id)} style={optAddBtnStyle}>＋ プロ調整</button>
                          <div style={{ flex: 1, display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                             {adminAdjustments.filter(a => a.service_id === svc.id).map(adj => (
                               <div key={adj.id} style={adjChipStyle}>
                                   <span>{adj.name}</span><button onClick={() => cycleAdjType(adj.id)} style={typeBtnStyle}>{adj.is_percent ? '%' : adj.is_minus ? '-' : '+'}</button>
                                   <input type="number" value={adj.price || 0} onChange={(e) => setAdminAdjustments(adminAdjustments.map(a => a.id === adj.id ? {...a, price: parseInt(e.target.value)} : a))} style={miniPriceInput} />
                                   <button onClick={() => handleRemoveAdjustment(adj)} style={{border:'none', background:'none'}}>×</button>
                               </div>
                             ))}
                          </div>
                       </div>
                       <div style={{ marginLeft: '30px', width: '90%', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {serviceOptions.filter(opt => opt.service_id === svc.id).map(opt => (
                            <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', background: '#f8fafc', padding: '5px 15px', borderRadius: '8px' }}>
                              <span style={{ color: '#666' }}>└ {opt.group_name}: <b>{opt.option_name}</b></span>
                              <input type="number" value={opt.additional_price || 0} onChange={(e) => setServiceOptions(serviceOptions.map(o => o.id === opt.id ? {...o, additional_price: parseInt(e.target.value)} : o))} style={{ ...miniPriceInput, width: '80px', background: '#fff', border: '1px solid #ddd' }} />
                            </div>
                          ))}
                       </div>
                    </div>
                  ))}
                </div>
              ))}
              <div style={{ ...cardStyle, border: '3px solid #ef4444' }}>
                <div style={{ ...catHeaderStyle, background: '#fff5f5', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ef4444' }}>⚙️ 全体調整 (＋－％)</span>
                  <button onClick={() => addAdjustment(null)} style={{ ...optAddBtnStyle, borderColor: '#ef4444' }}>＋ 共通項目追加</button>
                </div>
                <div style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                  {sortItems(adminAdjustments.filter(a => a.service_id === null)).map(adj => (
                    <div key={adj.id} style={{ ...adjChipStyle, padding: '10px 20px', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input value={adj.name} onChange={(e) => setAdminAdjustments(adminAdjustments.map(a => a.id === adj.id ? {...a, name: e.target.value} : a))} style={{ ...optInputStyle, width: '120px' }} />
                        <button onClick={() => cycleAdjType(adj.id)} style={typeBtnStyle}>{adj.is_percent ? '%' : adj.is_minus ? '-' : '+'}</button>
                        <input type="number" value={adj.price || 0} onChange={(e) => setAdminAdjustments(adminAdjustments.map(a => a.id === adj.id ? {...a, price: parseInt(e.target.value)} : a))} style={{ ...optPriceStyle, width: '80px' }} />
                        <button onClick={() => handleRemoveAdjustment(adj)} style={{ color: '#ff1493', background: 'none', border: 'none' }}><Trash2 size={18} /></button>
                      </div>
                      <input placeholder="カテゴリー" value={adj.category || ''} onChange={(e) => setAdminAdjustments(adminAdjustments.map(a => a.id === adj.id ? {...a, category: e.target.value} : a))} style={{ border: 'none', background: '#f8fafc', fontSize: '0.7rem', width: '100%', marginTop: '5px' }} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ ...cardStyle, border: '3px solid #008000' }}>
                <div style={{ ...catHeaderStyle, background: '#f0fdf4', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#008000' }}>🧴 店販商品マスター</span>
                  <button onClick={addProduct} style={{ ...optAddBtnStyle, borderColor: '#008000', color: '#008000' }}>＋ 商品を追加</button>
                </div>
                <div style={{ padding: '20px' }}>
                  {products.map(p => (
                    <div key={p.id} style={{ ...svcRowStyle, borderBottom: '1px solid #eee' }}>
                      <input value={p.name} onChange={(e) => setProducts(products.map(x => x.id === p.id ? {...x, name: e.target.value} : x))} style={{ ...optInputStyle, width: '200px' }} />
                      <input type="number" value={p.price || 0} onChange={(e) => setProducts(products.map(x => x.id === p.id ? {...x, price: parseInt(e.target.value)} : x))} style={priceInputStyle} />
                      <button onClick={() => { setDeletedProductIds([...deletedProductIds, p.id]); setProducts(products.filter(x => x.id !== p.id)); }} style={{ color: '#ef4444', border: 'none', background: 'none' }}><Trash2 size={18} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {isCheckoutOpen && (
        <div style={checkoutOverlayStyle} onClick={() => setIsCheckoutOpen(false)}>
          <div style={checkoutPanelStyle} onClick={(e) => e.stopPropagation()}>
            <div style={checkoutHeaderStyle}><div><h3 style={{ margin: 0 }}>{selectedRes?.customer_name} 様</h3><p style={{ fontSize: '0.8rem', margin: 0 }}>レジ・お会計</p></div><button onClick={() => setIsCheckoutOpen(false)} style={{ background: 'none', border: 'none', color: '#fff' }}><X size={24} /></button></div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #4b2c85', marginBottom: '15px' }}><div style={{ fontWeight: 'bold' }}>施術内容</div><button onClick={() => setIsMenuPopupOpen(true)} style={{ background: '#f3f0ff', color: '#4b2c85', border: '1px solid #4b2c85', padding: '2px 10px', fontSize: '0.75rem', cursor: 'pointer' }}><Edit3 size={12} /> 変更</button></div>
<div style={{ background: '#f9f9ff', padding: '15px', borderRadius: '10px', marginBottom: '25px', border: '1px dashed #4b2c85' }}>
  <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>
    {/* ✅ 修正：2人以上の時だけ「n人目」を表示し、1人の時はメニュー名のみ表示 */}
    {(() => {
      const opt = typeof selectedRes?.options === 'string' ? JSON.parse(selectedRes.options) : (selectedRes?.options || {});
      const people = opt.people || [];

      if (people.length > 1) {
        // 2人以上の場合
        return people.map((p, i) => (
          <div key={i} style={{ fontSize: '0.9rem', marginBottom: '5px' }}>
            <span style={{ color: '#4b2c85' }}>{i + 1}人目:</span> {p.fullName || p.services.map(s => s.name).join(', ')}
          </div>
        ));
      } else {
        // 1人の場合（1人目という文字を消してスッキリ表示）
        const singleMenu = people[0]?.fullName || 
                           people[0]?.services.map(s => s.name).join(', ') || 
                           parseReservationDetails(selectedRes).menuName;
        return <div>{singleMenu}</div>;
      }
    })()}
  </div>
  <div style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: '8px' }}>
    <span>合計コマ数: {selectedRes?.total_slots || 0} コマ</span>
    <span style={{ fontWeight: 'bold', color: '#d34817', fontSize: '1rem' }}>
      施術合計: ¥ {selectedRes ? parseReservationDetails(selectedRes).totalPrice.toLocaleString() : '0'}
    </span>
  </div>
</div>
              <SectionTitle icon={<Settings size={16} />} title="プロの微調整" color="#ef4444" />
              {(() => {
                const resIds = checkoutServices.map(s => s.id);
                const proAdjs = adminAdjustments.filter(a => a.service_id !== null && resIds.includes(a.service_id));
                return proAdjs.length > 0 && (
                  <div style={{ marginBottom: '15px', padding: '10px', background: '#fff5f5', borderRadius: '8px' }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#ef4444' }}>メニュー専用</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {proAdjs.map(adj => (<button key={adj.id} onClick={() => toggleCheckoutAdj(adj)} style={adjBtnStyle(checkoutAdjustments.some(a => a.id === adj.id))}>{adj.name} ({adj.is_minus ? '-' : ''}¥{adj.price})</button>))}
                    </div>
                  </div>
                );
              })()}
              {Object.entries(groupedWholeAdjustments).map(([catName, adjs]) => (
                <div key={catName} style={{ marginBottom: '10px' }}><button onClick={() => setOpenAdjCategory(openAdjCategory === catName ? null : catName)} style={categoryToggleStyle}><span>{catName}</span><ChevronRight size={18} /></button>
                {openAdjCategory === catName && (<div style={{display:'flex', flexWrap:'wrap', gap:'8px', padding:'10px'}}>{adjs.map(adj => (<button key={adj.id} onClick={() => toggleCheckoutAdj(adj)} style={adjBtnStyle(checkoutAdjustments.some(a => a.id === adj.id))}>{adj.name}</button>))}</div>)}</div>
              ))}
              <div style={{ marginTop: '30px' }}><SectionTitle icon={<ShoppingBag size={16} />} title="店販商品" color="#008000" /><div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>{products.map(prod => (<button key={prod.id} onClick={() => toggleCheckoutProduct(prod)} style={{ ...adjBtnStyle(checkoutProducts.some(p => p.id === prod.id)), borderColor: '#008000', color: checkoutProducts.some(p => p.id === prod.id) ? '#fff' : '#008000', background: checkoutProducts.some(p => p.id === prod.id) ? '#008000' : '#fff' }}>{prod.name} (¥{prod.price.toLocaleString()})</button>))}</div></div>
            </div>
            <div style={checkoutFooterStyle}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}><span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>最終合計</span><span style={{ fontSize: '2.2rem', fontWeight: '900', color: '#d34817' }}>¥ {finalPrice.toLocaleString()}</span></div><button onClick={completePayment} style={completeBtnStyle}><CheckCircle size={20} /> 確定して台帳に記録</button></div>
          </div>
        </div>
      )}

      {isCustomerInfoOpen && (
        <div style={checkoutOverlayStyle} onClick={() => setIsCustomerInfoOpen(false)}>
          <div style={{ ...checkoutPanelStyle, background: '#fdfcf5' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ ...checkoutHeaderStyle, background: '#008000' }}><div><h3 style={{ margin: 0 }}>{selectedCustomer?.name} 様</h3><p style={{ fontSize: '0.8rem', margin: 0 }}>顧客カルテ編集</p></div><button onClick={() => setIsCustomerInfoOpen(false)} style={{ background: 'none', border: 'none', color: '#fff' }}><X size={24} /></button></div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              <SectionTitle icon={<User size={16} />} title="基本情報" color="#008000" />
              <div style={{ background: '#fff', padding: '15px', borderRadius: '10px', border: '1px solid #eee', marginBottom: '20px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>お客様名</label><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={editInputStyle} />
                <div style={{ display: 'flex', gap: '10px' }}><div style={{ flex: 1 }}><label style={{ fontSize: '0.75rem' }}>電話番号</label><input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} style={editInputStyle} /></div><div style={{ flex: 1 }}><label style={{ fontSize: '0.75rem' }}>初回来店日</label><input type="date" value={firstArrivalDate} onChange={(e) => setFirstArrivalDate(e.target.value)} style={editInputStyle} /></div></div>
                <label style={{ fontSize: '0.75rem' }}>メール</label><input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} style={editInputStyle} />
              </div>
              <SectionTitle icon={<FileText size={16} />} title="顧客メモ" color="#d34817" />
              <textarea value={customerMemo} onChange={(e) => setCustomerMemo(e.target.value)} style={{ width: '100%', minHeight: '120px', padding: '10px', borderRadius: '10px', border: '2px solid #d34817', marginBottom: '10px' }} />
              <button onClick={saveCustomerInfo} disabled={isSavingMemo} style={{ width: '100%', padding: '15px', background: '#008000', color: '#fff', borderRadius: '10px', fontWeight: 'bold' }}>{isSavingMemo ? '保存中...' : '情報を保存'}</button>
              
              <SectionTitle icon={<History size={16} />} title="過去の履歴" color="#4b2c85" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pastVisits.map(v => {
                  const details = parseReservationDetails(v);
                  return (
                    <div key={v.id} style={{ background: '#fff', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <b>{v.start_time.split('T')[0]}</b>
                        <span style={{color:'#d34817'}}>¥{Number(v.total_price || 0).toLocaleString()}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8rem' }}>
                        {details.menuName}
                        {details.savedProducts?.length > 0 && (
                          <span style={{ color: '#008000', fontWeight: 'bold' }}>
                            {" "}＋({details.savedProducts.map(p => p.name).join(', ')})
                          </span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ padding: '25px', borderTop: '2px solid #ddd' }}>
              <button onClick={() => openCheckout(selectedRes)} style={{ ...completeBtnStyle, background: '#d34817' }}>
                <Clipboard size={20} /> お会計へ
              </button>
            </div>
          </div>
        </div>
      )}

      {isMenuPopupOpen && (
        <div style={{ ...checkoutOverlayStyle, zIndex: 2000 }} onClick={() => setIsMenuPopupOpen(false)}>
          <div style={{ ...checkoutPanelStyle, width: '400px', borderRadius: '25px 0 0 25px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ ...checkoutHeaderStyle, background: '#4b2c85' }}>
              <h3 style={{ margin: 0 }}>メニューの追加・変更</h3>
              <button onClick={() => setIsMenuPopupOpen(false)} style={{ background: 'none', border: 'none', color: '#fff' }}><X size={24} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {categories.map(cat => (
                <div key={cat.id} style={{ marginBottom: '25px' }}>
                  <h4 style={{ fontSize: '0.8rem', color: '#666', borderBottom: '1px solid #ddd', paddingBottom: '4px', marginBottom: '10px' }}>{cat.name}</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
{services.filter(s => s.category === cat.name).map(svc => {
  // ① 今このメニューにチェックが入っているか確認
  const isSelected = checkoutServices.some(s => s.id === svc.id);
  
  // ② このメニューに紐づく「枝分かれ（ブリーチ回数など）」を取得してグループ分け
  const svcOpts = serviceOptions.filter(o => o.service_id === svc.id);
  const grouped = svcOpts.reduce((acc, o) => {
    if (!acc[o.group_name]) acc[o.group_name] = [];
    acc[o.group_name].push(o);
    return acc;
  }, {});

  return (
    <div key={svc.id} style={{ marginBottom: '10px', border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>
      {/* メインのメニューボタン */}
      <button 
        onClick={() => toggleCheckoutService(svc)} 
        style={{ width: '100%', padding: '15px', border: 'none', textAlign: 'left', background: isSelected ? '#f3f0ff' : '#fff', cursor: 'pointer' }}
      >
        <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{isSelected ? '✅ ' : ''}{svc.name}</span>
          <span style={{ color: '#4b2c85', fontSize: '0.9rem' }}>¥{svc.price.toLocaleString()}</span>
        </div>
      </button>

      {/* ✅ サービスが選択されている時だけ、その下の枝分かれ項目（シャンプーや回数）を表示 */}
      {isSelected && Object.keys(grouped).length > 0 && (
        <div style={{ padding: '12px', background: '#f8fafc', borderTop: '1px solid #eee' }}>
          {Object.keys(grouped).map(gn => (
            <div key={gn} style={{ marginBottom: '10px' }}>
              <p style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold', margin: '0 0 6px 0' }}>└ {gn}</p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {grouped[gn].map(opt => {
                  // レジ専用の選択状態(checkoutOptions)を確認
                  const isOptSelected = checkoutOptions[`${svc.id}-${gn}`]?.id === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => toggleCheckoutOption(svc.id, gn, opt)}
                      style={{
                        padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid',
                        borderColor: isOptSelected ? '#4b2c85' : '#cbd5e1',
                        background: isOptSelected ? '#4b2c85' : '#fff',
                        color: isOptSelected ? '#fff' : '#475569', cursor: 'pointer'
                      }}
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
})}                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '20px', background: '#f8fafc', borderTop: '1px solid #ddd' }}>
              <button onClick={applyMenuChangeToLedger} style={{ ...completeBtnStyle, background: '#4b2c85' }}>完了して反映</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// スタイル定義（ここは変更なし）
const SectionTitle = ({ icon, title, color }) => (<div style={{ display: 'flex', alignItems: 'center', gap: '8px', color, fontWeight: 'bold', borderBottom: `2px solid ${color}`, paddingBottom: '5px', marginBottom: '15px' }}>{icon} {title}</div>);
const fullPageWrapper = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', background: '#fff', zIndex: 9999, overflow: 'hidden' };
const sidebarStyle = { width: '260px', background: '#e0d7f7', borderRight: '2px solid #4b2c85', padding: '15px', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' };
const navBtnStyle = (active, color) => ({ width: '100%', padding: '12px', background: active ? '#fff' : color, color: active ? '#000' : '#fff', border: '1px solid #000', borderRadius: '2px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '6px', boxShadow: active ? 'inset 2px 2px 5px rgba(0,0,0,0.3)' : '2px 2px 0px rgba(0,0,0,0.5)' });
const thStyle = { padding: '12px', border: '1px solid #4b2c85', textAlign: 'center' };
const tdStyle = { padding: '12px', border: '1px solid #eee', textAlign: 'center' };
const cardStyle = { background: '#fff', border: '2px solid #4b2c85', borderRadius: '8px', marginBottom: '30px', overflow: 'hidden' };
const catHeaderStyle = { background: '#f3f0ff', padding: '15px 20px', borderBottom: '2px solid #4b2c85' };
const svcRowStyle = { padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px' };
const priceInputStyle = { border: '1px solid #ddd', padding: '5px', width: '100px', textAlign: 'right', fontWeight: '900', color: '#d34817' };
const optAddBtnStyle = { background: '#fff', border: '1px dashed #4285f4', color: '#4285f4', padding: '5px 12px', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' };
const checkoutOverlayStyle = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.3)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' };
const checkoutPanelStyle = { width: '450px', background: '#fff', height: '100%', boxShadow: '-5px 0px 20px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' };
const checkoutHeaderStyle = { background: '#4b2c85', color: '#fff', padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const checkoutFooterStyle = { background: '#f8fafc', padding: '25px', borderTop: '2px solid #ddd' };
const adjBtnStyle = (active) => ({ padding: '10px 15px', background: active ? '#ef4444' : '#fff', color: active ? '#fff' : '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' });
const completeBtnStyle = { width: '100%', padding: '15px', background: '#008000', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' };
const editInputStyle = { width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.9rem', marginBottom: '10px' };
const headerBtnSmall = { padding: '5px 12px', borderRadius: '6px', border: '1px solid #fff', background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' };
const categoryToggleStyle = { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', color: '#4b2c85' };
const miniPriceInput = { border: 'none', background: '#f1f5f9', width: '60px', textAlign: 'right', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' };
const adjChipStyle = { background: '#fff5f5', border: '1px solid #feb2b2', padding: '8px 12px', display: 'flex', gap: '5px', borderRadius: '10px' };
const typeBtnStyle = { border: '1px solid #ef4444', background: '#fff', borderRadius: '4px', padding: '2px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#ef4444' };
const optInputStyle = { background: 'transparent', border: 'none', fontSize: '0.9rem', fontWeight: 'bold' };
const optPriceStyle = { border: 'none', background: '#fff', width: '70px', textAlign: 'right', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold' };
const yearBtnStyle = { background: 'rgba(255,255,255,0.2)', border: '1px solid #fff', color: '#fff', padding: '5px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const monthCardStyle = { background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', cursor: 'pointer' };
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 };
const modalContentStyle = { background: '#fff', padding: '25px', borderRadius: '24px', width: '90%', maxWidth: '450px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' };

export default AdminManagement;