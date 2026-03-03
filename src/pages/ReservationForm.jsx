import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
// ✅ 修正：通知専用の supabaseAnon もインポートに追加
import { supabase, supabaseAnon } from '../supabaseClient';
// 💡 重要：LINEログイン（LIFF）を操作するためのSDK
import liff from '@line/liff';
// ✅ アイコンとボタン部品を追加
import { MapPin, CheckCircle2, ChevronRight } from 'lucide-react';

function ReservationForm() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // 管理者画面からの「ねじ込み予約」データ
  const isAdminMode = location.state?.adminDate && location.state?.adminTime;
  const adminDate = location.state?.adminDate;
  const adminTime = location.state?.adminTime;
  const adminStaffId = location.state?.adminStaffId;
  const fromView = location.state?.fromView;

  // 💡 LINE経由判定
  const queryParams = new URLSearchParams(location.search);
  const isLineSource = queryParams.get('source') === 'line';
  const isLineApp = /Line/i.test(navigator.userAgent);

  // 🆕 【重要】入り口識別キー（?type=xxx）を取得
  const entryType = queryParams.get('type');
  // 🆕 スタッフID（?staff=xxx）を取得
  const staffIdFromUrl = queryParams.get('staff');

  // 基本データState
  const [shop, setShop] = useState(null);
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [options, setOptions] = useState([]);
const [targetStaffName, setTargetStaffName] = useState(''); 
  const [autoStaffId, setAutoStaffId] = useState(null); // 🆕 自動セットされたスタッフIDを保存  

  // ✅ 1. 訪問型とみなす業種リスト（BasicSettingsの選択肢と合わせる）
const VISIT_KEYWORDS = ['訪問', '出張', '代行', 'デリバリー', '清掃'];

  // ✅ 2. 新しいState
  const [visitorZip, setVisitorZip] = useState(''); // 🆕 追加：郵便番号用
  const [visitorAddress, setVisitorAddress] = useState('');
  const [isAddressFixed, setIsAddressFixed] = useState(false);
  const [isVisitService, setIsVisitService] = useState(false);

  // --- 複数名予約用のState ---
  // --- 複数名予約用のState ---
  const [people, setPeople] = useState([]); 
  const [selectedServices, setSelectedServices] = useState([]); 
  const [selectedOptions, setSelectedOptions] = useState({}); 
  
  const [loading, setLoading] = useState(true);
  const [lineUser, setLineUser] = useState(null);
  // 🆕 Googleログインユーザーのプロフィールを保持するState

  const [authUserProfile, setAuthUserProfile] = useState(null);
  // 🆕 【着せ替え用】画面に表示するブランド情報
  const [displayBranding, setDisplayBranding] = useState({ name: '', desc: '' });

  const categoryRefs = useRef({});
  const serviceRefs = useRef({});

  useEffect(() => {
    // 🆕 ページ表示時に強制的に最上部へ
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    fetchData();
    // 💡 ここでの initLiff() 呼び出しは削除します
  }, [shopId]);
  
  const initLiff = async (dynamicLiffId) => {
    try {
      if (!dynamicLiffId) {
        console.warn('LIFF IDが設定されていません');
        return;
      }
      await liff.init({ liffId: dynamicLiffId }); 
      if (liff.isLoggedIn()) {
        const profile = await liff.getProfile();
        setLineUser(profile);
      } else {
        liff.login(); 
      }
    } catch (err) {
      console.error('LIFF Initialization failed', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const shopRes = await supabase.from('profiles').select('*').eq('id', shopId).single();
    
if (shopRes.data) {
      setShop(shopRes.data);
      
      // ✅ 1. キーワードが含まれているか判定（キーワード方式）
      const businessTypeName = shopRes.data.business_type || '';
      const isVisit = VISIT_KEYWORDS.some(keyword => businessTypeName.includes(keyword));
      
      setIsVisitService(isVisit);

      // 来店型（isVisitがfalse）なら、最初から住所入力をスキップ（確定状態）にする
      if (!isVisit) {
        setIsAddressFixed(true);
      }

      // ✅ 2. LINEログイン（LIFF）の初期化（これは絶対に消さない！）
      if (shopRes.data.liff_id && (isLineSource || isLineApp)) {
        initLiff(shopRes.data.liff_id);
      }
            
      // ✅ 1. まずは初期値として本来の店名と説明文をセット
      setDisplayBranding({ 
        name: shopRes.data.business_name, 
        desc: shopRes.data.description 
      });

      // 🆕 管理者モード：ねじ込み対象スタッフの名前を取得
      if (isAdminMode && adminStaffId) {
        const { data: sData } = await supabase.from('staffs').select('name').eq('id', adminStaffId).single();
        if (sData) setTargetStaffName(sData.name);
      } else if (isAdminMode && !adminStaffId) {
        setTargetStaffName('フリー（担当なし）');
      }

      if (!shopRes.data.is_suspended) {
        // カテゴリ取得
        let catQuery = supabase.from('service_categories').select('*').eq('shop_id', shopId).order('sort_order');
        const catRes = await catQuery;
        
        if (catRes.data) {
          // 2. 入り口識別キー（url_key）による絞り込み
          const filteredCats = entryType 
            ? catRes.data.filter(c => c.url_key === entryType) 
            : catRes.data.filter(c => !c.url_key);
          
          setCategories(filteredCats);

          // 🆕 3. 【強制着せ替えロジック】
          if (entryType) {
            const brandingSource = catRes.data.find(c => c.url_key === entryType);
            if (brandingSource) {
              setDisplayBranding({
                name: brandingSource.custom_shop_name || shopRes.data.business_name,
                desc: brandingSource.custom_description || shopRes.data.description
              });
            }
          }
        }

        const servRes = await supabase.from('services').select('*').eq('shop_id', shopId).order('sort_order');
        if (servRes.data) setServices(servRes.data);
const optRes = await supabase.from('service_options').select('*');
        if (optRes.data) setOptions(optRes.data);

        // ✅ スタッフが一人なら自動セットするロジック（State版）
        const { data: staffList } = await supabase.from('staffs').select('*').eq('shop_id', shopId);
        if (staffList && staffList.length === 1 && !isAdminMode && !staffIdFromUrl) {
          console.log("👤 1人営業のため担当者を自動設定:", staffList[0].name);
          setTargetStaffName(staffList[0].name);
setAutoStaffId(staffList[0].id); // Stateに保存
        }

// 🆕 Googleログインユーザー情報の取得
        // 🛡️ 管理者ねじ込みモード(isAdminMode)の場合は、ログイン情報を無視する
        const { data: { user } } = await supabase.auth.getUser();
        if (user && !isAdminMode) {
          const { data: profile } = await supabase
            .from('app_users')
            .select('display_name, email, phone')
            .eq('id', user.id)
            .maybeSingle();
          
          if (profile) setAuthUserProfile(profile);
        } else if (isAdminMode) {
          console.log("🛡️ 管理者モード：ログインユーザー情報を読み込みません");
        }
        
      } // !shopRes.data.is_suspended の閉じ
    } // shopRes.data の閉じ
    setLoading(false);
  };
  // ✅ 追加：リピーター対応（LINEログイン後に名簿から前回の住所を自動セット）
  useEffect(() => {
    const fetchPreviousAddress = async () => {
      // 訪問型サービス かつ LINEユーザーが判明している かつ 住所がまだ空 の場合
      if (isVisitService && lineUser?.userId && !visitorAddress) {
        const { data: cust } = await supabase
          .from('customers')
          .select('address')
          .eq('shop_id', shopId)
          .eq('line_user_id', lineUser.userId)
          .maybeSingle();

        if (cust?.address) {
          console.log("🏠 前回の住所を自動セットしました:", cust.address);
          setVisitorAddress(cust.address);
          setIsAddressFixed(true); // 住所があれば最初からメニューを表示状態にする
        }
      }
    };
fetchPreviousAddress();
  }, [lineUser, isVisitService, shopId]);

  // 🆕 【ここに追加！】郵便番号から住所を自動取得する関数
  const handleZipSearch = async () => {
    // 1. 入力チェック（7桁あるか）
    if (visitorZip.length < 7) {
      alert("郵便番号を7桁で入力してください（ハイフンなし）");
      return;
    }

    try {
      // 2. 無料のAPI（zipcloud）に問い合わせ
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${visitorZip}`);
      const data = await res.json();

      if (data.results) {
        // 3. 成功したら住所をセット
        const { address1, address2, address3 } = data.results[0];
        const fullAddress = `${address1}${address2}${address3}`;
        setVisitorAddress(fullAddress);
        console.log("📮 郵便番号から住所を取得しました:", fullAddress);
      } else {
        alert("住所が見つかりませんでした。正しい郵便番号を入力してください。");
      }
    } catch (err) {
      console.error("❌ 郵便番号検索エラー:", err);
      alert("一時的に住所検索が利用できません。手動で入力してください。");
    }
  };

  // --- 複数名対応の計算ロジック（維持） ---
  const currentPersonSlots = selectedServices.reduce((sum, s) => sum + s.slots, 0) + 
    Object.values(selectedOptions).reduce((sum, opt) => sum + (opt.additional_slots || 0), 0);

  const pastPeopleSlots = people.reduce((sum, p) => sum + p.slots, 0);

  const totalSlotsNeeded = pastPeopleSlots + currentPersonSlots;

  const checkRequiredMet = () => {
    return selectedServices.every(s => {
      const cat = categories.find(c => c.name === s.category);
      if (!cat?.required_categories) return true;
      const requiredNames = cat.required_categories.split(',').map(n => n.trim()).filter(n => n);
      if (requiredNames.length === 0) return true;
      return requiredNames.every(reqName => 
        selectedServices.some(ss => ss.category === reqName)
      );
    });
  };

  const isTotalTimeOk = totalSlotsNeeded > 0;
  const isRequiredMet = checkRequiredMet();

  const handleAddPerson = () => {
    if (people.length >= 3) return; 
    
    // ✅ 修正：合体名を作ってから保存する
    const baseName = selectedServices.map(s => s.name).join(', ');
    const optName = Object.values(selectedOptions).map(o => o.option_name).join(', ');
    const fullName = optName ? `${baseName}（${optName}）` : baseName;

    setPeople([...people, { 
      services: selectedServices, 
      options: selectedOptions, 
      slots: currentPersonSlots,
      fullName: fullName // ✅ 合体名を保存
    }]);

    setSelectedServices([]);
    setSelectedOptions({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const removePerson = (index) => {
    const newPeople = [...people];
    newPeople.splice(index, 1);
    setPeople(newPeople);
  };

  const disabledCategoryNames = selectedServices.reduce((acc, s) => {
    const cat = categories.find(c => c.name === s.category);
    if (cat?.disable_categories) return [...acc, ...cat.disable_categories.split(',').map(n => n.trim())];
    return acc;
  }, []);

  const scrollToNextValidCategory = (currentCatIdx) => {
    const nextValidCat = categories.slice(currentCatIdx + 1).find(cat => !disabledCategoryNames.includes(cat.name));
    if (nextValidCat && categoryRefs.current[nextValidCat.id]) {
      setTimeout(() => categoryRefs.current[nextValidCat.id].scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    }
  };

  const toggleService = (service, catIdx) => {
    if (disabledCategoryNames.includes(service.category)) return;
    const currentCategory = categories.find(c => c.name === service.category);
    const allowMultipleInCat = currentCategory?.allow_multiple_in_category;
    const hasOptions = options.some(o => o.service_id === service.id);

    if (!shop.allow_multiple_services) {
      setSelectedServices([service]);
      setSelectedOptions({});
      if (!hasOptions) scrollToNextValidCategory(catIdx);
      else scrollIntoService(service.id);
    } else {
      const isAlreadySelected = selectedServices.find(s => s.id === service.id);
      if (isAlreadySelected) {
        const newSelection = selectedServices.filter(s => s.id !== service.id);
        setSelectedServices(newSelection);
        const newOpts = { ...selectedOptions };
        Object.keys(newOpts).forEach(key => {
          if (key.startsWith(`${service.id}-`)) delete newOpts[key];
        });
        setSelectedOptions(newOpts);
      } else {
        let newSelection = allowMultipleInCat 
          ? [...selectedServices, service]
          : [...selectedServices.filter(s => s.category !== service.category), service];
        
        if (!allowMultipleInCat) {
          const newOpts = { ...selectedOptions };
          const oldServiceInCat = selectedServices.find(s => s.category === service.category);
          if (oldServiceInCat) {
            Object.keys(newOpts).forEach(key => {
              if (key.startsWith(`${oldServiceInCat.id}-`)) delete newOpts[key];
            });
          }
          setSelectedOptions(newOpts);
        }

        setSelectedServices(newSelection);
        if (!allowMultipleInCat && !hasOptions) scrollToNextValidCategory(catIdx);
        else if (hasOptions) scrollIntoService(service.id);
      }
    }
  };

  const scrollIntoService = (serviceId) => {
    setTimeout(() => { if (serviceRefs.current[serviceId]) serviceRefs.current[serviceId].scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
  };

  const handleOptionSelect = (serviceId, groupName, opt, catIdx) => {
    const key = `${serviceId}-${groupName}`;
    const newOptions = { ...selectedOptions, [key]: opt };
    setSelectedOptions(newOptions);
    const grouped = getGroupedOptions(serviceId);
    if (Object.keys(grouped).every(gn => newOptions[`${serviceId}-${gn}`])) scrollToNextValidCategory(catIdx);
  };

const handleNextStep = () => {
    window.scrollTo(0,0);

    // 1. 現在選択中のメニューを「n人目」のデータとして整形
    const currentBaseName = selectedServices.map(s => s.name).join(', ');
    const currentOptionName = Object.values(selectedOptions).map(o => o.option_name).join(', ');
    const currentFullName = currentOptionName ? `${currentBaseName}（${currentOptionName}）` : currentBaseName;

    // 2. 次のステップへ引き継ぐ共通データ一式
    const commonState = { 
      people: [...people, { 
        services: selectedServices, 
        options: selectedOptions, 
        slots: currentPersonSlots,
        fullName: currentFullName 
      }],
      totalSlotsNeeded,
      lineUser,
      // 🆕 ログイン済みユーザー情報をバトンタッチ
      authUserProfile, 
      visitorZip,
      visitorAddress,
      customShopName: displayBranding.name,
      // ✅ 修正：Stateの autoStaffId を使う
      staffId: adminStaffId || staffIdFromUrl || autoStaffId,
      fromView: fromView
    };

    if (isAdminMode) {
      const confirmUrl = `/shop/${shopId}/confirm${adminStaffId ? `?staff=${adminStaffId}` : ''}`;
      navigate(confirmUrl, { 
        state: { ...commonState, date: adminDate, time: adminTime, adminDate, adminTime } 
      });
    } else {
      const nextUrl = `/shop/${shopId}/reserve/time${staffIdFromUrl ? `?staff=${staffIdFromUrl}` : ''}`;
      navigate(nextUrl, { state: commonState });
    }
  };

  // ✅ 抜けていたヘルパー関数とロジックをここに配置
  const getGroupedOptions = (serviceId) => {
    return options.filter(o => o.service_id === serviceId).reduce((acc, opt) => {
      if (!acc[opt.group_name]) acc[opt.group_name] = [];
      acc[opt.group_name].push(opt);
      return acc;
    }, {});
  };

  const allOptionsSelected = selectedServices.every(s => {
    const grouped = getGroupedOptions(s.id);
    return Object.keys(grouped).every(groupName => selectedOptions[`${s.id}-${groupName}`]);
  });

  if (loading) return <div style={{ textAlign: 'center', padding: '100px', color: '#666' }}>読み込み中...</div>;
  if (shop?.is_suspended) return <div style={{ padding: '60px 20px', textAlign: 'center' }}><h2>現在、予約受付を停止しています</h2></div>;
  if (!shop) return <div style={{ textAlign: 'center', padding: '50px' }}>店舗が見つかりません</div>;

  const themeColor = shop?.theme_color || '#2563eb';

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px', margin: '0 auto', color: '#333', paddingBottom: '160px' }}>
      
      <Link to="/" style={{ position: 'fixed', top: '15px', left: '15px', zIndex: 1100, background: 'rgba(255,255,255,0.9)', color: '#666', textDecoration: 'none', fontSize: '0.7rem', padding: '6px 10px', borderRadius: '15px', border: '1px solid #ddd' }}>← 戻る</Link>
      
      <div style={{ marginTop: '30px', marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '1.4rem' }}>{displayBranding.name}</h2>

        {/* 🚗 訪問型住所入力エリア */}
        {isVisitService && (
          <div style={{ marginBottom: '25px', padding: '20px', background: isAddressFixed ? '#f8fafc' : '#fff', borderRadius: '16px', border: isAddressFixed ? '1px solid #e2e8f0' : `2px solid ${themeColor}`, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <h3 style={{ marginTop: 0, fontSize: '1rem', marginBottom: '15px', color: themeColor, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={20} /> 1. 訪問先の住所を入力
            </h3>
            {!isAddressFixed ? (
              <>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '10px' }}>郵便番号を入力すると住所が自動入力されます。</p>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input 
                    type="tel" 
                    value={visitorZip} 
                    onChange={(e) => setVisitorZip(e.target.value.replace(/[^0-9]/g, '').slice(0, 7))} 
                    placeholder="郵便番号(7桁)" 
                    style={{ flex: 1, padding: '14px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '1rem' }} 
                  />
                  <button onClick={handleZipSearch} type="button" style={{ padding: '0 20px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', color: '#475569' }}>住所検索</button>
                </div>
                <input 
                  type="text" 
                  value={visitorAddress} 
                  onChange={(e) => setVisitorAddress(e.target.value)} 
                  placeholder="市区町村・番地・建物名まで入力してください" 
                  style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '1rem', marginBottom: '12px', boxSizing: 'border-box' }} 
                />
                <button disabled={!visitorAddress} onClick={() => setIsAddressFixed(true)} style={{ width: '100%', padding: '14px', background: visitorAddress ? themeColor : '#cbd5e1', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>この場所で空き枠を探す</button>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: themeColor, fontWeight: 'bold', marginBottom: '4px' }}>📍 訪問先（前回と同じ場所を表示中）</p>
                  <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{visitorAddress}</div>
                </div>
                <button onClick={() => setIsAddressFixed(false)} style={{ background: 'none', border: `2px solid ${themeColor}`, color: themeColor, padding: '5px 15px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>変更</button>
              </div>
            )}
          </div>
        )}

        {lineUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', padding: '10px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
            <img src={lineUser.pictureUrl} style={{ width: '30px', height: '30px', borderRadius: '50%' }} alt="LINE" />
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#166534' }}>{lineUser.displayName} さん、こんにちは！</span>
          </div>
        )}

        {/* 🆕 Googleログインユーザーへの挨拶表示 */}
        {authUserProfile && !lineUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', padding: '10px', background: `${themeColor}10`, borderRadius: '10px', border: `1px solid ${themeColor}30` }}>
            <span style={{ fontSize: '1.2rem' }}>👋</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: themeColor }}>
              {authUserProfile.display_name} 様、こんにちは！
            </span>
          </div>
        )}

        {people.length > 0 && (
          <div style={{ marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold', marginBottom: '8px' }}>現在の予約内容：</p>
            {people.map((p, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '4px 0', borderBottom: idx < people.length - 1 ? '1px dashed #eee' : 'none' }}>
                <span style={{ color: themeColor, fontWeight: 'bold' }}>{idx + 1}人目：{p.services.map(s => s.name).join(', ')}</span>
                <button onClick={() => removePerson(idx)} style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: '0.9rem', cursor: 'pointer' }}>×</button>
              </div>
            ))}
          </div>
        )}

        {isAdminMode && (
          <div style={{ background: '#fef3c7', color: '#92400e', padding: '12px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '15px', border: '1px solid #fcd34d' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚠️ 管理者ねじ込み予約：確定画面へ直行します</span>
            </div>
            <div style={{ marginTop: '5px', fontSize: '0.75rem', opacity: 0.9 }}>
              日時：{adminDate} {adminTime}<br />
              担当：{targetStaffName}
            </div>
          </div>
        )}
        
        {displayBranding.desc && (
          <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.6' }}>
            {displayBranding.desc.split('/').map((line, idx) => (
              <React.Fragment key={idx}>
                {line}
                {idx < displayBranding.desc.split('/').length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
        )}
      </div>

      <div>
        <h3 style={{ fontSize: '1rem', borderLeft: `4px solid ${themeColor}`, paddingLeft: '10px', marginBottom: '20px' }}>
          {people.length === 0 ? "メニューを選択" : `${people.length + 1}人目のメニューを選択`}
        </h3>
        
        {categories.map((cat, idx) => {
          const isDisabled = disabledCategoryNames.includes(cat.name);
          return (
            <div key={cat.id} ref={el => categoryRefs.current[cat.id] = el} style={{ marginBottom: '35px', opacity: isDisabled ? 0.3 : 1 }}>
              <h4 style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '12px', lineHeight: '1.4' }}>
                {cat.name.split('/').map((text, i) => (
                  <React.Fragment key={i}>
                    {text.trim()}
                    {i < cat.name.split('/').length - 1 && <br />}
                  </React.Fragment>
                ))}
              </h4>
              <div style={{ display: 'grid', gap: '10px' }}>
                {services.filter(s => s.category === cat.name).map(service => {
                  const isSelected = selectedServices.find(s => s.id === service.id);
                  const groupedOpts = getGroupedOptions(service.id);
                  return (
                    <div key={service.id} ref={el => serviceRefs.current[service.id] = el} 
                         style={{ border: isSelected ? `2px solid ${themeColor}` : '1px solid #ddd', borderRadius: '12px', background: 'white' }}>
                      <button disabled={isDisabled} onClick={() => toggleService(service, idx)} style={{ width: '100%', padding: '15px', border: 'none', background: 'none', textAlign: 'left' }}>
                        <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ 
                            width: '18px', height: '18px', border: `2px solid ${themeColor}`, 
                            borderRadius: cat.allow_multiple_in_category ? '4px' : '50%', 
                            background: isSelected ? themeColor : 'transparent', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' 
                          }}>{isSelected && '✓'}</div>
                          <span>{service.name}</span>
                        </div>
                      </button>
                      {isSelected && !isDisabled && Object.keys(groupedOpts).length > 0 && (
                        <div style={{ padding: '0 15px 15px 15px', background: '#f8fafc' }}>
                          {Object.keys(groupedOpts).map(gn => (
                            <div key={gn} style={{ marginTop: '10px' }}>
                              <p style={{ fontSize: '0.7rem', color: '#475569' }}>└ {gn}</p>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {groupedOpts[gn].map(opt => {
                                  const isOptSelected = selectedOptions[`${service.id}-${gn}`]?.id === opt.id;
                                  return (
                                    <button 
                                      key={opt.id} 
                                      onClick={() => handleOptionSelect(service.id, gn, opt, idx)} 
                                      style={{ 
                                        padding: '10px 5px', borderRadius: '8px', border: '1px solid', 
                                        borderColor: isOptSelected ? themeColor : '#cbd5e1', 
                                        background: isOptSelected ? themeColor : 'white', 
                                        color: isOptSelected ? 'white' : '#475569', 
                                        fontSize: '0.8rem' 
                                      }}
                                    >
                                      {opt.option_name}
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

        {selectedServices.length > 0 && people.length < 3 && allOptionsSelected && isRequiredMet && (
          <button 
            onClick={handleAddPerson}
            style={{ 
              position: 'fixed', bottom: '100px', right: '15px', zIndex: 999, 
              writingMode: 'vertical-rl',
              background: themeColor, color: 'white', padding: '15px 8px', 
              borderRadius: '8px 0 0 8px', border: 'none', fontWeight: 'bold', 
              fontSize: '0.85rem', boxShadow: '-4px 4px 12px rgba(0,0,0,0.1)', 
              cursor: 'pointer', animation: 'slideIn 0.3s ease-out'
            }}
          >
            追加でもう一人 ＋
          </button>
        )}

        <style>{`
          @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        `}</style>

        {(selectedServices.length > 0 || people.length > 0) && (
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(10px)', padding: '15px 20px', borderTop: '1px solid #e2e8f0', textAlign: 'center', zIndex: 1000, boxShadow: '0 -4px 12px rgba(0,0,0,0.05)' }}>
            <button 
              disabled={!allOptionsSelected || !isRequiredMet || !isTotalTimeOk} 
              onClick={handleNextStep} 
              style={{ 
                width: '100%', maxWidth: '400px', padding: '16px', 
                background: (!allOptionsSelected || !isRequiredMet || !isTotalTimeOk) ? '#cbd5e1' : themeColor, 
                color: 'white', border: 'none', borderRadius: '14px', fontWeight: 'bold', fontSize: '1rem'
              }}
            >
              {!allOptionsSelected ? 'オプションを選択してください' 
               : !isRequiredMet ? '必須メニューが未選択です' 
               : isAdminMode ? `予約内容を確定する (${totalSlotsNeeded * (shop?.slot_interval_min || 15)}分)`
               : `日時選択へ進む (${totalSlotsNeeded * (shop?.slot_interval_min || 15)}分)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReservationForm;