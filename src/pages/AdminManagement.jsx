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

  // --- 検索機能用State ---
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // --- マスターデータ ---
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [serviceOptions, setServiceOptions] = useState([]); 
  const [adminAdjustments, setAdminAdjustments] = useState([]);
  const [products, setProducts] = useState([]); 
  const [staffs, setStaffs] = useState([]); // 🆕 追加済み（再確認）
  const [staffPickerRes, setStaffPickerRes] = useState(null);
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

  // ==========================================
  // --- 🆕 画面サイズ管理（エラー解決のために追加） ---
  // ==========================================
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // これで画面全体の isPC 判定が有効になります
  const isPC = windowWidth > 1024; 
  // ==========================================

// ✅ 共通並び替え関数
  const sortItems = (items) => [...items].sort((a, b) => {
    const catA = a.category || 'その他'; const catB = b.category || 'その他';
    if (catA !== catB) return catA.localeCompare(catB, 'ja');
    return (a.name || '').localeCompare(b.name || '', 'ja');
  });

  useEffect(() => {
    if (cleanShopId) fetchInitialData();
  }, [cleanShopId, activeMenu, selectedDate, viewYear]); // viewYearが変わった時も再読込

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      // 1. プロフィール取得
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', cleanShopId).single();
      if (profile) setShop(profile);
      
      const startOfYear = `${viewYear}-01-01`;
      const endOfYear = `${viewYear}-12-31`;

      // 2. 予約データ取得
      const { data: resData } = await supabase
        .from('reservations')
        .select('*, staffs(name)')
        .eq('shop_id', cleanShopId)
        .order('start_time', { ascending: true });
      setAllReservations(resData || []);

      // 3. スタッフ名簿取得
      const { data: staffsData } = await supabase.from('staffs').select('*').eq('shop_id', cleanShopId);
      setStaffs(staffsData || []);

      // 4. 各種マスター ＆ 売上実績(sales)取得
      const [catRes, servRes, optRes, adjRes, prodRes, sDataRes] = await Promise.all([
        supabase.from('service_categories').select('*').eq('shop_id', cleanShopId).order('sort_order'),
        supabase.from('services').select('*').eq('shop_id', cleanShopId).order('sort_order'),
        supabase.from('service_options').select('*'),
        supabase.from('admin_adjustments').select('*').eq('shop_id', cleanShopId),
        supabase.from('products').select('*').eq('shop_id', cleanShopId).order('sort_order'),
        supabase.from('sales').select('*').eq('shop_id', cleanShopId).gte('sale_date', startOfYear).lte('sale_date', endOfYear)
      ]);

      setCategories(catRes.data || []);
      setServices(servRes.data || []);
      setServiceOptions(optRes.data || []);
      setAdminAdjustments(adjRes.data || []);
      setProducts(prodRes.data || []);
      setSalesRecords(sDataRes.data || []);

    } catch (err) { 
      console.error("Fetch Error:", err); 
    } finally { 
      setLoading(false); 
    }
  };

  // 🆕 --- ここから：顧客検索ロジックを追加 ---
  const handleSearch = async (val) => {
    setSearchTerm(val);
    if (val.length < 1) {
      setSearchResults([]);
      return;
    }

    setIsSearchLoading(true);
    // ✅ 幽霊データを防ぐため、reservationsではなく「customers名簿」だけを検索
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, phone') // 電話番号も取得しておくと後で便利です
      .eq('shop_id', cleanShopId)
      .ilike('name', `%${val}%`) // あいまい検索
      .limit(5); // 候補は5件まで
    
    if (error) console.error("Search Error:", error);
    setSearchResults(data || []);
    setIsSearchLoading(false);
  };

  // 検索結果の候補をクリックした時の処理
  const selectSearchResult = (cust) => {
    // 幽霊データを防ぐため、ダミーの予約オブジェクト形式にしてカルテ関数に渡す
    openCustomerInfo({ customer_name: cust.name });
    
    // 検索窓をきれいにする
    setSearchTerm('');
    setSearchResults([]);
  };

// 🆕 キーボード操作（上下、エンター、エスケープ）を制御する
  const handleKeyDown = (e) => {
    if (searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      // ↓キー：次の候補へ
      e.preventDefault();
      setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      // ↑キー：前の候補へ
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      // Enterキー：現在の選択を決定
      if (selectedIndex >= 0) {
        e.preventDefault();
        selectSearchResult(searchResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      // Escキー：閉じる
      setSearchResults([]);
      setSelectedIndex(-1);
    }
  };

  const parseReservationDetails = (res) => {
    if (!res) return { menuName: '', totalPrice: 0, items: [], subItems: [], savedAdjustments: [], savedProducts: [] };
    const opt = typeof res.options === 'string' ? JSON.parse(res.options) : (res.options || {});
    let items = [];
    let subItems = [];

    if (opt.people && Array.isArray(opt.people)) {
      items = opt.people.flatMap(p => p.services || []);
      subItems = opt.people.flatMap(p => Object.values(p.options || {}));
    } else {
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

  const calculateFinalTotal = (currentSvcs, currentAdjs, currentProds, currentOpts = checkoutOptions) => {
    let total = currentSvcs.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
    const optPrice = Object.values(currentOpts).reduce((sum, o) => sum + (Number(o.additional_price) || 0), 0);
    total += optPrice;

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

const applyMenuChangeToLedger = () => {
    if (!selectedRes) return;
    const newBaseName = checkoutServices.map(s => s.name).join(', ');
    // 🆕 合計コマ数も計算
    const newTotalSlots = checkoutServices.reduce((sum, s) => sum + (s.slots ?? 1), 0);
    
    const info = parseReservationDetails(selectedRes);
    const branchNames = info.subItems.map(o => o.option_name).filter(Boolean);
    const fullDisplayName = branchNames.length > 0 ? `${newBaseName}（${branchNames.join(', ')}）` : newBaseName;

    setAllReservations(prev => prev.map(res => 
      // 🆕 total_slots も更新対象に含める
      res.id === selectedRes.id ? { ...res, menu_name: fullDisplayName, total_price: finalPrice, total_slots: newTotalSlots } : res
    ));
    setIsMenuPopupOpen(false);
  };
const openCheckout = (res) => {
    const info = parseReservationDetails(res);
    setSelectedRes(res);

    // 🆕 【重要】今のマスターデータに存在する項目だけを抽出（お掃除）
    // 1. 施術メニューの精査
    const validServices = info.items.filter(savedSvc => 
      services.some(masterSvc => masterSvc.id === savedSvc.id || masterSvc.name === savedSvc.name)
    );

    // 2. プロ調整項目の精査
    const validAdjustments = info.savedAdjustments.filter(savedAdj => 
      adminAdjustments.some(masterAdj => masterAdj.id === savedAdj.id || masterAdj.name === savedAdj.name)
    );

    setCheckoutServices(validServices);
    setCheckoutAdjustments(validAdjustments);
    setCheckoutProducts(info.savedProducts);

    // 枝分かれ（オプション）のコピー
    const opt = typeof res.options === 'string' ? JSON.parse(res.options) : (res.options || {});
    const initialOpts = opt.people 
      ? opt.people.flatMap(p => Object.entries(p.options || {})) 
      : Object.entries(opt.options || {});
    setCheckoutOptions(Object.fromEntries(initialOpts));

    // 金額を再計算してセット
    setFinalPrice(res.total_price || info.totalPrice);
    setOpenAdjCategory(null); 
    setIsCheckoutOpen(true); 
    setIsCustomerInfoOpen(false);
  };

  const toggleCheckoutOption = (serviceId, groupName, opt) => {
    const key = `${serviceId}-${groupName}`;
    const newOptions = { ...checkoutOptions, [key]: opt };
    setCheckoutOptions(newOptions);
    calculateFinalTotal(checkoutServices, checkoutAdjustments, checkoutProducts, newOptions);
  };

const completePayment = async () => {
    try {
      const totalSlots = checkoutServices.reduce((sum, s) => sum + (s.slots ?? 1), 0);
      const endTime = new Date(new Date(selectedRes.start_time).getTime() + totalSlots * (shop.slot_interval_min || 15) * 60000);
      
      const currentBaseName = checkoutServices.map(s => s.name).join(', ');
      const info = parseReservationDetails(selectedRes);
      const branchNames = info.subItems.map(o => o.option_name).filter(Boolean);
      const dbMenuName = branchNames.length > 0 ? `${currentBaseName}（${branchNames.join(', ')}）` : currentBaseName;

// ✅ 1. 予約ステータスを更新（古いメニュー情報を新しいレジの内容で完全に上書き）
      await supabase.from('reservations').update({ 
        total_price: finalPrice, 
        status: 'completed', 
        total_slots: totalSlots, 
        end_time: endTime.toISOString(), 
        menu_name: dbMenuName, // 枝分かれ込みの新しい名前に上書き
        options: { 
          // 🆕 ここを「お会計時の内容」だけに絞ることで、本家の古いメニューを消し去ります
          services: checkoutServices, 
          adjustments: checkoutAdjustments, 
          products: checkoutProducts, 
          options: checkoutOptions,
          isUpdatedFromCheckout: true // お会計で更新した目印（任意）
        }
      }).eq('id', selectedRes.id);

      const { data: cust } = await supabase.from('customers').select('id').eq('shop_id', cleanShopId).eq('name', selectedRes.customer_name).maybeSingle();
      const serviceAmt = checkoutServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
      const productAmt = checkoutProducts.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
      
      // ==========================================
      // ✅ 2. 【最重要：二重登録防止】
      // すでにこの予約の売上データがあるか確認
      // ==========================================
      const { data: existingSale } = await supabase
        .from('sales')
        .select('id')
        .eq('reservation_id', selectedRes.id)
        .maybeSingle();

      const salePayload = { 
        shop_id: cleanShopId, 
        reservation_id: selectedRes.id, 
        customer_id: cust?.id || null, 
        total_amount: finalPrice, 
        service_amount: serviceAmt, 
        product_amount: productAmt, 
        sale_date: selectedDate, 
        details: { services: checkoutServices, products: checkoutProducts, adjustments: checkoutAdjustments } 
      };

      if (existingSale) {
        // すでにお会計済みなら「更新」
        await supabase.from('sales').update(salePayload).eq('id', existingSale.id);
      } else {
        // 初めてのお会計なら「新規登録」
        await supabase.from('sales').insert([salePayload]);
      }
      // ==========================================
      
      alert("お会計を確定しました。"); 
      setIsCheckoutOpen(false); 
      fetchInitialData();
    } catch (err) { 
      alert("確定失敗: " + err.message); 
    }
};

  // 🆕 ここから追加：お会計リセット機能
  const handleResetCheckout = () => {
    if (!window.confirm("お会計内容を現在のマスター設定の状態にリセットしますか？\n（追加した店販や調整もリセットされます）")) return;

    // 1. 予約時の本来のメニュー（最新のマスター価格を反映）に再構築
    const info = parseReservationDetails(selectedRes);
    
    // 今のマスターに実在するメニューだけを最新価格で取得
    const freshServices = info.items.map(saved => 
      services.find(s => s.id === saved.id || s.name === saved.name)
    ).filter(Boolean);

    // 2. 各ステートを初期化
    setCheckoutServices(freshServices);
    setCheckoutAdjustments([]); // 調整をクリア
    setCheckoutProducts([]);    // 店販をクリア
    setCheckoutOptions({});     // 枝分かれ（シャンプー等）も一旦クリア
    
    // 3. 金額を再計算して画面に反映
    calculateFinalTotal(freshServices, [], [], {});
    
    alert("現在のマスター設定でリセットしました。");
  };
  const addAdjustment = (svcId = null) => {
    const name = prompt("項目名を入力してください"); if (!name) return;
    let cat = svcId === null ? (prompt("カテゴリー名を入力してください", "その他") || "その他") : null;
    setAdminAdjustments([...adminAdjustments, { id: crypto.randomUUID(), service_id: svcId, name, price: 0, is_percent: false, is_minus: false, category: cat }]);
  };

  const handleRemoveAdjustment = (adj) => {
    setAdminAdjustments(prev => prev.filter(a => a.id !== adj.id));
    if (adj.id && adj.id.length >= 36) { // 正式なUUID(DB登録済み)の場合のみ削除リストへ
      setDeletedAdjIds(prev => [...prev, adj.id]);
    }
  };

  const addProduct = () => { 
    const name = prompt("商品名を入力してください"); 
    if (name) setProducts([...products, { id: crypto.randomUUID(), name, price: 0 }]); 
  };

  const dailyTotalSales = useMemo(() => allReservations.filter(r => r.start_time.startsWith(selectedDate) && r.res_type === 'normal' && r.status === 'completed').reduce((sum, r) => sum + (r.total_price || 0), 0), [allReservations, selectedDate]);

// ✅ 売上の人数と金額のズレを完全に解消する集計ロジック（厳格・台帳連動版）
  const analyticsData = useMemo(() => {
    const currentYear = viewYear;
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1, total: 0, count: 0,
      days: Array.from({ length: new Date(currentYear, i + 1, 0).getDate() }, (_, j) => ({ day: j + 1, total: 0, count: 0 }))
    }));

    // 1️⃣ 台帳に表示される「通常予約(normal)」のIDだけを正解リストとして抽出
    const validNormalRes = allReservations.filter(r => r.res_type === 'normal');
    const validResIds = new Set(validNormalRes.map(r => r.id));

    // 2️⃣ 会計記録(sales)を集計（※現存する通常予約に紐付いているものだけ）
    salesRecords.forEach(s => {
      // 予約が削除されていたり、通常予約以外(✕印など)の売上は集計から除外
      if (!s.reservation_id || !validResIds.has(s.reservation_id)) return;

      const d = new Date(s.sale_date);
      if (d.getFullYear() === currentYear) {
        const mIdx = d.getMonth();
        const dIdx = d.getDate() - 1;
        if (months[mIdx] && months[mIdx].days[dIdx]) {
          months[mIdx].total += (Number(s.total_amount) || 0);
          months[mIdx].count += 1;
          months[mIdx].days[dIdx].total += (Number(s.total_amount) || 0);
          months[mIdx].days[dIdx].count += 1;
        }
      }
    });

    // 3️⃣ まだ会計(sales)に載っていない「完了済み予約(完了 ✓)」を補完
    const accountedResIds = new Set(salesRecords.map(s => s.reservation_id));
    
    validNormalRes.filter(r => 
      r.status === 'completed' && 
      !accountedResIds.has(r.id)
    ).forEach(r => {
      const d = new Date(r.start_time);
      if (d.getFullYear() === currentYear) {
        const mIdx = d.getMonth();
        const dIdx = d.getDate() - 1;
        if (months[mIdx] && months[mIdx].days[dIdx]) {
          months[mIdx].total += (Number(r.total_price) || 0);
          months[mIdx].count += 1;
          months[mIdx].days[dIdx].total += (Number(r.total_price) || 0);
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

  // ✅ 削除・整形・保存を一括で行う関数（エラー解消版）
  const saveAllMasters = async () => {
    setIsSaving(true);
    try {
      // 1. 物理削除を実行
      if (deletedAdjIds.length > 0) {
        await supabase.from('admin_adjustments').delete().in('id', deletedAdjIds);
        setDeletedAdjIds([]); 
      }
      if (deletedProductIds.length > 0) {
        await supabase.from('products').delete().in('id', deletedProductIds);
        setDeletedProductIds([]);
      }

      // 2. 整形
      const formattedServices = services.map(svc => ({ id: svc.id, shop_id: cleanShopId, name: svc.name, price: svc.price || 0, category: svc.category, sort_order: svc.sort_order || 0, slots: svc.slots || 1 }));
      const formattedOptions = serviceOptions.map(opt => ({ id: opt.id, service_id: opt.service_id, group_name: opt.group_name, option_name: opt.option_name, additional_price: opt.additional_price || 0 }));
      const formattedAdjustments = adminAdjustments.map(adj => ({ 
        id: adj.id, shop_id: cleanShopId, service_id: adj.service_id, name: adj.name, price: adj.price || 0, 
        is_percent: adj.is_percent || false, is_minus: adj.is_minus || false, category: adj.service_id ? null : (adj.category || 'その他') 
      }));
      const formattedProducts = products.map((p, i) => ({ id: p.id, shop_id: cleanShopId, name: p.name, price: p.price || 0, sort_order: i }));

      // 3. 一括保存(upsert)
      await Promise.all([ 
        supabase.from('services').upsert(formattedServices), 
        supabase.from('service_options').upsert(formattedOptions), 
        supabase.from('admin_adjustments').upsert(formattedAdjustments), 
        supabase.from('products').upsert(formattedProducts) 
      ]);

      alert("設定をすべて保存しました。"); 
      fetchInitialData();
    } catch (err) { 
      console.error(err);
      alert("保存失敗: " + err.message); 
    } finally { 
      setIsSaving(false); 
    }
  };

  // 🆕 ここから追加：お客様詳細（カルテ）を開く関数
  const openCustomerInfo = async (res) => {
    try {
      // 1. 予約名からお客様の基本情報を取得
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', cleanShopId)
        .eq('name', res.customer_name)
        .maybeSingle();

      // ステートにセット
      setSelectedCustomer(customer || { name: res.customer_name });
      setEditName(customer?.name || res.customer_name);
      setEditPhone(customer?.phone || '');
      setEditEmail(customer?.email || '');
      setCustomerMemo(customer?.memo || '');
      setFirstArrivalDate(customer?.first_arrival_date || '');

      // 2. 過去の来店履歴（完了済み予約）を取得
      const { data: visits } = await supabase
        .from('reservations')
        .select('*, staffs(name)')
        .eq('shop_id', cleanShopId)
        .eq('customer_name', res.customer_name)
        .eq('status', 'completed')
        .order('start_time', { ascending: false });

      setPastVisits(visits || []);
      
      // パネルを表示
      setIsCustomerInfoOpen(true);
      setIsCheckoutOpen(false); // レジが開いていたら閉じる
    } catch (err) {
      console.error("Customer Info Error:", err);
    }
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

  const handleUpdateStaffDirectly = async (resId, newStaffId) => {
    try {
      const { error } = await supabase.from('reservations').update({ staff_id: newStaffId }).eq('id', resId);
      if (error) throw error;
      setStaffPickerRes(null); 
      fetchInitialData();
    } catch (err) { alert("担当者の変更に失敗しました"); }
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
        
        <div style={{ marginTop: 'auto', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* 🆕 カレンダー画面へ戻るボタン */}
          <button 
            style={navBtnStyle(false, '#4285f4')} 
            onClick={() => navigate(`/admin/${cleanShopId}/reservations`)}
          >
            カレンダー
          </button>

          {/* 🆕 タイムライン画面へ戻るボタン */}
          <button 
            style={navBtnStyle(false, '#4b2c85')} 
            onClick={() => navigate(`/admin/${cleanShopId}/timeline`)}
          >
            タイムライン
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
{activeMenu === 'work' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            
            {/* 🚀 ヘッダー部分：スマホではボタンを小さく、分析ボタンを追加 */}
            <div style={{ 
              background: '#d34817', 
              padding: isPC ? '15px 25px' : '10px 15px', 
              color: '#fff', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <h2 style={{ margin: 0, fontStyle: 'italic', fontSize: isPC ? '1.4rem' : '1.1rem' }}>
                台帳：{selectedDate.replace(/-/g, '/')}
              </h2>
<div style={{ display: 'flex', gap: '6px', alignItems: 'center', position: 'relative' }}>
  {/* 🔍 検索入力エリア */}
  <div style={{ position: 'relative' }}>
<input 
  type="text" 
  placeholder="顧客検索..." 
  value={searchTerm}
  onChange={(e) => {
    handleSearch(e.target.value);
    setSelectedIndex(-1); // 文字を変えたら選択をリセット
  }}
  onKeyDown={handleKeyDown} // 🆕 キー入力を監視
  style={{ 
    padding: '5px 10px', 
    borderRadius: '6px', 
    border: 'none', 
    fontSize: '0.8rem', 
    width: isPC ? '150px' : '100px',
    marginRight: '10px',
    outline: 'none'
  }} 
/>
{/* 検索結果のドロップダウン */}
{searchResults.length > 0 && (
  <div style={{ 
    position: 'absolute', top: '35px', left: 0, width: '250px', 
    background: '#fff', color: '#333', borderRadius: '8px', 
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 100,
    overflow: 'hidden'
  }}>
    {searchResults.map((cust, index) => (
      <div 
        key={cust.id} 
        onClick={() => selectSearchResult(cust)}
        onMouseEnter={() => setSelectedIndex(index)} // 🆕 マウスが乗った時も同期
        style={{ 
          padding: '10px', 
          borderBottom: '1px solid #eee', 
          cursor: 'pointer', 
          fontSize: '0.85rem',
          // 🆕 選択されている項目に背景色をつける
          background: selectedIndex === index ? '#f3f0ff' : '#fff',
          color: selectedIndex === index ? '#4b2c85' : '#333',
          fontWeight: selectedIndex === index ? 'bold' : 'normal'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{cust.name} 様</span>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{cust.phone?.slice(-4)}</span>
        </div>
      </div>
    ))}
  </div>
)}
    {/* 検索結果のドロップダウン */}
    {searchResults.length > 0 && (
      <div style={{ 
        position: 'absolute', top: '35px', left: 0, width: '200px', 
        background: '#fff', color: '#333', borderRadius: '8px', 
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 100 
      }}>
        {searchResults.map(cust => (
          <div 
            key={cust.id} 
            onClick={() => selectSearchResult(cust)}
            style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            {cust.name} 様
          </div>
        ))}
      </div>
    )}
  </div>

  <button onClick={() => handleDateChangeUI(-1)} style={headerBtnSmall}>前日</button>
                  <button onClick={() => setSelectedDate(new Date().toLocaleDateString('sv-SE'))} style={headerBtnSmall}>今日</button>
                <button onClick={() => handleDateChangeUI(1)} style={headerBtnSmall}>次日</button>
                {/* 📊 スマホ版のみ、サイドバーの代わりに「分析」ボタンを表示 */}
                {!isPC && (
                  <button onClick={() => setActiveMenu('analytics')} style={{ ...headerBtnSmall, background: '#008000', border: 'none' }}>📊 分析</button>
                )}
              </div>
            </div>

            {/* 🚀 メインエリア：ここで「PC（表）」と「スマホ（カード）」を切り替えます */}
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              background: isPC ? '#fff' : '#f4f7f9', 
              padding: isPC ? '0' : '15px' 
            }}>
              
              {isPC ? (
                /* ==========================================
                   💻 PC版：既存の正確なテーブル（表）形式
                   ========================================== */
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
                    <tr style={{ background: '#f3f0ff', borderBottom: '2px solid #4b2c85' }}>
                      <th style={thStyle}>担当者</th>
                      <th style={thStyle}>時間</th>
                      <th style={thStyle}>お客様名 (カルテ)</th>
                      <th style={thStyle}>メニュー(予定)</th>
                      <th style={thStyle}>お会計 (レジ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allReservations.filter(r => r.start_time.startsWith(selectedDate) && r.res_type === 'normal').length > 0 ? 
                      allReservations.filter(r => r.start_time.startsWith(selectedDate) && r.res_type === 'normal').map((res) => (
                        <tr key={res.id} style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}>
                          <td onClick={(e) => { e.stopPropagation(); setStaffPickerRes(res); }} style={{ ...tdStyle, fontWeight: 'bold', color: '#4b2c85', background: '#fdfbff' }}>
                            {res.staffs?.name || 'フリー'}
                          </td>
                          <td onClick={() => openCheckout(res)} style={tdStyle}>
                            {new Date(res.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td onClick={() => openCustomerInfo(res)} style={{ ...tdStyle, background: res.status === 'completed' ? '#eee' : '#008000', color: res.status === 'completed' ? '#333' : '#fff', fontWeight: 'bold' }}>
                            {res.customer_name} {res.status === 'completed' && '✓'}
                          </td>
                          <td onClick={() => openCheckout(res)} style={tdStyle}>
                            {parseReservationDetails(res).menuName}
                          </td>
                          <td onClick={() => openCheckout(res)} style={{ ...tdStyle, fontWeight: 'bold' }}>
                            ¥ {Number(res.total_price || parseReservationDetails(res).totalPrice).toLocaleString()}
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan="5" style={{ padding: '50px', textAlign: 'center', color: '#999' }}>予約なし</td></tr>
                      )
                    }
                  </tbody>
                </table>
              ) : (
                /* ==========================================
                   📱 スマホ版：見やすい「売上カード」形式
                   ========================================== */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {allReservations.filter(r => r.start_time.startsWith(selectedDate) && r.res_type === 'normal').length > 0 ? (
                    allReservations.filter(r => r.start_time.startsWith(selectedDate) && r.res_type === 'normal').map((res) => {
                      const details = parseReservationDetails(res);
                      const isCompleted = res.status === 'completed';
                      return (
                        <div 
                          key={res.id} 
                          style={{ 
                            background: '#fff', 
                            borderRadius: '16px', 
                            padding: '16px', 
                            boxShadow: '0 4px 15px rgba(0,0,0,0.05)', 
                            border: `1px solid ${isCompleted ? '#e2e8f0' : '#d3481722'}`,
                            position: 'relative'
                          }}
                        >
                          {/* ステータスバー（左端の色） */}
                          <div style={{ position: 'absolute', left: 0, top: 15, bottom: 15, width: '4px', background: isCompleted ? '#94a3b8' : '#008000', borderRadius: '0 4px 4px 0' }} />
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', paddingLeft: '8px' }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#1e293b' }}>
                              {new Date(res.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button 
                              onClick={() => setStaffPickerRes(res)}
                              style={{ background: '#f3f0ff', color: '#4b2c85', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold' }}
                            >
                              👤 {res.staffs?.name || '担当者選択'}
                            </button>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', paddingLeft: '8px' }}>
                            <div 
                              onClick={() => openCustomerInfo(res)} 
                              style={{ flex: 1, fontSize: '1.1rem', fontWeight: 'bold', color: '#1e293b', textDecoration: 'underline', textDecorationColor: '#cbd5e1' }}
                            >
                              {res.customer_name} 様
                            </div>
                            <button 
                              onClick={() => openCheckout(res)}
                              style={{ 
                                background: isCompleted ? '#f1f5f9' : '#008000', 
                                color: isCompleted ? '#94a3b8' : '#fff', 
                                border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold' 
                              }}
                            >
                              {isCompleted ? '確定済 ✓' : 'レジへ'}
                            </button>
                          </div>

                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '10px', paddingLeft: '8px', lineHeight: '1.4' }}>
                            📋 {details.menuName}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '10px', paddingLeft: '8px' }}>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>お会計金額</span>
                            <span style={{ fontSize: '1.3rem', fontWeight: '900', color: isCompleted ? '#1e293b' : '#d34817' }}>
                              ¥ {Number(res.total_price || details.totalPrice).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>予約なし</div>
                  )}
                </div>
              )}
            </div>

            {/* 🚀 フッター：合計金額表示 */}
            <div style={{ 
              display: 'flex', 
              background: '#d34817', 
              padding: isPC ? '15px 25px' : '10px 20px', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              color: '#fff' 
            }}>
               <div style={{ fontSize: isPC ? '0.9rem' : '0.75rem', fontWeight: 'bold' }}>本日のお会計確定 合計</div>
               <div style={{ fontSize: isPC ? '1.8rem' : '1.4rem', fontWeight: '900' }}>¥ {dailyTotalSales.toLocaleString()}</div>
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
<div style={checkoutHeaderStyle}>
  <div>
    <h3 style={{ margin: 0 }}>{selectedRes?.customer_name} 様</h3>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <p style={{ fontSize: '0.8rem', margin: 0 }}>レジ・お会計</p>
      {/* 🆕 リセットボタンを追加 */}
      <button 
        onClick={handleResetCheckout}
        style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid #fff', color: '#fff', fontSize: '0.6rem', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
      >
        <RefreshCw size={10} style={{ marginRight: '4px' }} /> 設定リセット
      </button>
    </div>
  </div>
  <button onClick={() => setIsCheckoutOpen(false)} style={{ background: 'none', border: 'none', color: '#fff' }}><X size={24} /></button>
</div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #4b2c85', marginBottom: '15px' }}><div style={{ fontWeight: 'bold' }}>施術内容</div><button onClick={() => setIsMenuPopupOpen(true)} style={{ background: '#f3f0ff', color: '#4b2c85', border: '1px solid #4b2c85', padding: '2px 10px', fontSize: '0.75rem', cursor: 'pointer' }}><Edit3 size={12} /> 変更</button></div>
<div style={{ background: '#f9f9ff', padding: '15px', borderRadius: '10px', marginBottom: '25px', border: '1px dashed #4b2c85' }}>
  <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>
    {(() => {
      // 1. 予約データを解析
      const opt = typeof selectedRes?.options === 'string' ? JSON.parse(selectedRes.options) : (selectedRes?.options || {});
      const people = Array.isArray(opt.people) ? opt.people : [];
      const services = Array.isArray(opt.services) ? opt.services : [];

      // 🟢 ケースA：本当に複数人の予約（グループ予約）の場合
      if (people.length > 1) {
        return people.map((person, pIdx) => {
          // その人の全メニューとオプションを結合
          const sText = person.services?.map(s => {
            const oNames = Object.values(person.options || {}).filter(o => o.service_id === s.id).map(o => o.option_name);
            return oNames.length > 0 ? `${s.name}（${oNames.join(', ')}）` : s.name;
          }).join(', ');

          return (
            <div key={pIdx} style={{ fontSize: '0.95rem', marginBottom: '8px', borderBottom: pIdx !== people.length - 1 ? '1px solid #eef' : 'none', paddingBottom: '4px' }}>
              <span style={{ color: '#4b2c85', fontWeight: '900' }}>{pIdx + 1}人目：</span>
              {sText || 'メニュー未設定'}
            </div>
          );
        });
      } 

      // ⚪ ケースB：1人予約の場合（メニューが複数あっても1つにまとめる）
      const targetServices = (people.length > 0 && people[0].services) ? people[0].services : services;
      const targetOptions = (people.length > 0 && people[0].options) ? people[0].options : (opt.options || {});

      if (targetServices.length > 0) {
        const sText = targetServices.map(s => {
          const oNames = Object.values(targetOptions).filter(o => o.service_id === s.id).map(o => o.option_name);
          return oNames.length > 0 ? `${s.name}（${oNames.join(', ')}）` : s.name;
        }).join(', ');

        return <div style={{ fontSize: '1rem' }}>{sText}</div>;
      }
      
      return <div style={{ fontSize: '1rem' }}>{selectedRes?.menu_name || 'メニュー未設定'}</div>;
    })()}
  </div>

  <div style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: '8px' }}>
    <span>合計コマ数: {checkoutServices.reduce((sum, s) => sum + (s.slots ?? 1), 0)} コマ</span>
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
  <span style={{ fontWeight: 'bold', color: '#4b2c85', marginRight: '8px' }}>👤 {v.staffs?.name || 'フリー'}</span> {/* 🆕 追加 */}
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
{/* 🆕 ここ！ここに「スタッフ選択モーダル」を差し込みます */}
      {staffPickerRes && (
        <div style={modalOverlayStyle} onClick={() => setStaffPickerRes(null)}>
          <div style={{ ...modalContentStyle, maxWidth: '300px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1rem', marginBottom: '20px', color: '#4b2c85' }}>
              「{staffPickerRes.customer_name}」様の<br />担当者を変更
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={() => handleUpdateStaffDirectly(staffPickerRes.id, null)}
                style={{ padding: '12px', borderRadius: '10px', border: '1px solid #ddd', background: '#f8fafc', fontWeight: 'bold', cursor: 'pointer' }}
              >
                担当なし（フリー）
              </button>
              {staffs.map(s => (
                <button 
                  key={s.id}
                  onClick={() => handleUpdateStaffDirectly(staffPickerRes.id, s.id)}
                  style={{ padding: '12px', borderRadius: '10px', border: 'none', background: '#4b2c85', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {s.name}
                </button>
              ))}
            </div>
            <button onClick={() => setStaffPickerRes(null)} style={{ marginTop: '20px', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>キャンセル</button>
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