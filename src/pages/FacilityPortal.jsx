import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  Users, UserPlus, Search, Building2, 
  Save, LogOut, ChevronRight, X, Trash2, Check,
  Edit3,
  Calendar, AlertCircle,
  Store, CalendarCheck,
  Settings, ShieldAlert,
  User, Mail, 
  Phone,
  Send,
  MapPin,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FacilityPortal = () => {
  const { facilityId } = useParams();
  const navigate = useNavigate();
  
  const [facility, setFacility] = useState(null);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // 🆕 追加：タブ管理と更新用State
  const [activeTab, setActiveTab] = useState('residents'); // 'residents' or 'settings'
  const [isUpdating, setIsUpdating] = useState(false);
  
  // モーダル・フォーム管理
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '', name_kana: '', room_number: '', 
    has_wheelchair: false, needs_bed_cut: false, memo: ''
  });

  // --- 🆕 追加：訪問リクエスト管理用のState ---
  const [activeRequest, setActiveRequest] = useState(null); // 現在進行中の訪問予定
  const [selectedResidentIds, setSelectedResidentIds] = useState([]); // 今回カットする人のIDリスト
  const [isRequestSaving, setIsRequestSaving] = useState(false); // 保存中フラグ

  // 🆕 認証チェック（プラットフォーム統合仕様）
  useEffect(() => {
    const loggedInId = sessionStorage.getItem('facility_user_id');
    const isActive = sessionStorage.getItem('facility_auth_active');

    // ログインしていない、またはURLのIDとログインIDが一致しない場合は戻す
    if (!isActive || loggedInId !== facilityId) {
      navigate(`/facility-login/${facilityId}`);
      return;
    }
    fetchData();
  }, [facilityId]);

  const [connectedShops, setConnectedShops] = useState([]); // 🆕 提携店舗用のStateをコンポーネント内に追加してください

  const fetchData = async () => {
    setLoading(true);
    
    // 1. 施設マスター情報の取得
    const { data: fData } = await supabase.from('facility_users').select('*').eq('id', facilityId).single();
    if (fData) setFacility(fData);

    // 2. 提携している「サービス（店舗）」の一覧を取得
    const { data: shopData } = await supabase
  .from('shop_facility_connections')
  .select(`
    *, 
    profiles (
    id, business_name, business_type, theme_color, phone, email_contact,
    address, official_url, description, intro_text, owner_name
  )
  `)
  .eq('facility_user_id', facilityId)
  .in('status', ['active', 'pending']); // ✅ 両方取得する！

setConnectedShops(shopData || []);

    // --- 🆕 追加：進行中の訪問依頼（未完了の最新1件）をDBから取得 ---
    const { data: reqData } = await supabase
      .from('visit_requests')
      .select('*, visit_request_residents(resident_id)')
      .eq('facility_user_id', facilityId)
      .neq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reqData) {
      setActiveRequest(reqData);
      // DBに保存済みのメンバーがいればチェック状態を復元
      setSelectedResidentIds(reqData.visit_request_residents.map(r => r.resident_id));
    } else {
      setActiveRequest(null);
      // 予約がない場合は、現在の手元での選択（selectedResidentIds）を維持します
    }

    // 3. 共通入居者名簿の取得
    const { data: rData } = await supabase
      .from('residents')
      .select('*')
      .eq('facility_user_id', facilityId)
      .eq('is_active', true)
      .order('room_number', { ascending: true });
    
    setResidents(rData || []);
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    // 🆕 古い facility_id ではなく、新しい facility_user_id をセットする
    const payload = { ...formData, facility_user_id: facilityId }; 
    
    let error;
    if (editingId) {
      const { error: err } = await supabase.from('residents').update(payload).eq('id', editingId);
      error = err;
    } else {
      const { error: err } = await supabase.from('residents').insert([payload]);
      error = err;
    }

    if (!error) {
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } else {
      alert('エラーが発生しました: ' + error.message);
    }
  };

  // --- 🆕 追加：名簿のチェック操作と、訪問依頼の保存ロジック ---

  // 名簿の左側にあるチェック円をタップした時の動作
  const handleToggleResident = (id) => {
    // 💡 予約がなくてもチェック可能にします（Scenario C: 名簿 ➔ 予約 のため）
    setSelectedResidentIds(prev => 
      prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]
    );
  };

  // 「一時保存」または「確定」ボタンを押した時の動作
  const handleSaveVisitList = async (isConfirming = false) => {
    if (!activeRequest) return;
    setIsRequestSaving(true);
    
    try {
      // 1. 一旦、今回のリクエストに紐付いている名簿データをリセット（最新の状態にするため）
      await supabase.from('visit_request_residents').delete().eq('request_id', activeRequest.id);

      // 2. 現在チェックが入っている人を一括で登録
      if (selectedResidentIds.length > 0) {
        const inserts = selectedResidentIds.map(rid => ({
          request_id: activeRequest.id,
          resident_id: rid
        }));
        await supabase.from('visit_request_residents').insert(inserts);
      }

      // 3. 「確定する」が押された場合は、依頼自体のステータスを更新
      if (isConfirming) {
        if (selectedResidentIds.length === 0) {
          alert('カット希望者が0名の状態で確定はできません。');
          setIsRequestSaving(false);
          return;
        }
        await supabase.from('visit_requests')
          .update({ is_list_confirmed: true, status: 'confirmed' })
          .eq('id', activeRequest.id);
        
        alert(`【${facility.name}様】\n名簿を最終確定しました。三土手さんに通知されます。`);
      } else {
        alert('名簿の選択状態を一時保存しました。');
      }
      
      // 画面のデータを最新にする
      fetchData();
    } catch (err) {
      console.error('保存エラー:', err);
      alert('保存中にエラーが発生しました。');
    } finally {
      setIsRequestSaving(false);
    }
  };

  // --- 🆕 アップグレード：カレンダー画面へ移動して日程を確保する ---
  const handleCreateFixedRequest = async () => {
    if (!facility) return;

    // 1. まずこの施設が提携している店舗（SnipSnapなど）のIDを取得
    // ※今はSnipSnap固定ですが、将来的に複数業者から選べるようにここを拡張します
    const { data: connection } = await supabase
      .from('shop_facility_connections')
      .select('shop_id')
      .eq('facility_user_id', facilityId)
      .eq('status', 'active')
      .limit(1)
      .single();

    if (!connection) {
      alert("提携している店舗が見つかりません。店舗側での承認が必要です。");
      return;
    }

    // 2. 既存のカレンダー画面へ遷移
    // mode: 'facility' を渡すことで、カレンダー側で「施設用枠確保」として動かします
    navigate(`/shop/${connection.shop_id}/reserve/time`, { 
      state: { 
        mode: 'facility',
        facilityUserId: facilityId,
        totalSlotsNeeded: 12, // 施設訪問用に3時間分（15分×12コマ）などの枠を想定
      } 
    });
  };

  // --- 追加ここまで ---
  // 🆕 追加：受付ステータス（業種別スイッチ）を更新する
  const updateAcceptStatus = async (column, value) => {
    setIsUpdating(true);
    const { error } = await supabase
      .from('facility_users')
      .update({ [column]: value })
      .eq('id', facilityId);

    if (!error) {
      setFacility(prev => ({ ...prev, [column]: value }));
    } else {
      alert('設定の更新に失敗しました');
    }
    setIsUpdating(false);
  };

  // 🆕 提携リクエスト（Connections）を承認・拒否する関数
  const handleConnectionStatus = async (connectionId, newStatus) => {
    setIsUpdating(true);
    
    if (newStatus === 'rejected') {
      const { error } = await supabase.from('shop_facility_connections').delete().eq('id', connectionId);
      if (!error) {
        alert('リクエストを拒否しました。');
        fetchData();
      } else {
        alert('エラーが発生しました: ' + error.message);
      }
    } else {
      // --- 承認（active）の場合 ---
      const { error } = await supabase.from('shop_facility_connections').update({ status: newStatus }).eq('id', connectionId);

      if (!error) {
        // 🆕 祝福メール送信
        try {
          const req = connectedShops.find(c => c.id === connectionId);
          if (req) {
            await fetch("https://vcfndmyxypgoreuykwij.supabase.co/functions/v1/resend", {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
              body: JSON.stringify({
                type: 'partnership_approved',
                shopName: req.profiles?.business_name,
                facilityName: facility?.facility_name,
                shopEmail: req.profiles?.email_contact || req.profiles?.email,
                facilityEmail: facility?.email,
                shopId: req.shop_id,
                facilityId: facilityId
              })
            });
          }
        } catch (mailErr) {
          console.error("祝福メール送信エラー:", mailErr);
        }

        alert('提携を承認しました！お互いに祝福メールを送信しました🎉');
        fetchData();
      } else {
        alert('エラーが発生しました: ' + error.message);
      }
    }
    setIsUpdating(false);
  };

  // 🆕 提携解消（契約解除）の処理を追加
  const handleDisconnect = async (connection) => {
    const shopName = connection.profiles?.business_name;
    
    // 🆕 名前を入力させ、不一致なら実行しない
    const inputName = window.prompt(
      `「${shopName}」との提携を解消しますか？\n解消すると名簿の共有と予約機能が停止されます。\n\n実行する場合は、確認のため店舗名を正確に入力してください：`
    );
    
    if (inputName !== shopName) {
      if (inputName !== null) alert("店舗名が一致しません。処理を中断しました。");
      return;
    }

    const { error } = await supabase
      .from('shop_facility_connections')
      .delete()
      .eq('id', connection.id);

    if (!error) {
      alert(`${shopName} との提携を解消しました。`);
      fetchData(); // データを再取得して画面を更新
    } else {
      alert('エラーが発生しました: ' + error.message);
    }
  };

  // --- 追加ここまで ---

  const resetForm = () => {
    setEditingId(null);
    setFormData({ name: '', name_kana: '', room_number: '', has_wheelchair: false, needs_bed_cut: false, memo: '' });
  };

  const filteredResidents = residents.filter(r => 
    r.name.includes(searchTerm) || (r.room_number || "").includes(searchTerm)
  );

  if (loading) return <div style={centerStyle}>読み込み中...</div>;

// 🆕 追加：設定画面のレンダリング
  const renderSettings = () => {
    // 申請中のリスト（重複排除）
    const pendingRequests = connectedShops
      .filter(con => con.status === 'pending')
      .reduce((acc, current) => {
        const isDuplicate = acc.find(item => item.shop_id === current.shop_id);
        if (!isDuplicate) return acc.concat([current]);
        return acc;
      }, []);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', paddingBottom: '100px' }}>
        
        {/* --- A: 提携リクエストの状況（申請が届いている場合のみ表示） --- */}
        {pendingRequests.length > 0 && (
          <div style={{ ...panelStyle, border: '2px solid #f59e0b', background: '#fffbeb' }}>
            <h3 style={{ ...panelTitle, color: '#d97706' }}><ShieldAlert size={18} /> 提携リクエストの状況</h3>
            <p style={{ fontSize: '0.75rem', color: '#b45309', marginBottom: '15px' }}>
              届いている申請を確認し、詳細をチェックしてから承認できます。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {pendingRequests.map(req => {
                const shop = req.profiles;
                const themeColor = shop?.theme_color || '#4f46e5';
                return (
                  <div key={req.id} style={{ background: '#fff', padding: '20px', borderRadius: '24px', border: `2px solid ${themeColor}`, boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ background: themeColor, color: '#fff', fontSize: '0.65rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px', display: 'inline-block', marginBottom: '5px' }}>{shop?.business_type}</div>
                        <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: '#1a1a1a' }}>{shop?.business_name}</h4>
                      </div>
                      <div style={{ fontSize: '0.65rem', padding: '4px 10px', borderRadius: '20px', background: '#f1f5f9', color: '#64748b', fontWeight: 'bold' }}>
                        {req.created_by_type === 'shop' ? '相手からの申請' : 'こちらから依頼中'}
                      </div>
                    </div>
                    {/* 店舗の連絡先・住所（タップ可能） */}
                    <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#666' }}>
                        <User size={16} color={themeColor} />
                        <span>代表：<strong>{shop?.owner_name || '未登録'}</strong></span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#666' }}>
                        <MapPin size={16} color={themeColor} />
                        <span>{shop?.address || '住所未登録'}</span>
                      </div>
                      {shop?.phone && (
                        <a href={`tel:${shop.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: themeColor, textDecoration: 'none', fontWeight: 'bold' }}>
                          <Phone size={16} />
                          <span>{shop.phone} <span style={{fontSize:'0.7rem', fontWeight:'normal'}}>(タップで電話)</span></span>
                        </a>
                      )}
                      <a href={`mailto:${shop?.email_contact}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: themeColor, textDecoration: 'none' }}>
                        <Mail size={16} />
                        <span>{shop?.email_contact || 'メール未登録'}</span>
                      </a>
                    </div>
                    {/* 承認ボタン */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {shop?.official_url && (
                        <a href={shop.official_url} target="_blank" rel="noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '14px', background: '#f1f5f9', color: '#475569', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 'bold' }}>
                          <ExternalLink size={16} /> サイト
                        </a>
                      )}
                      {req.created_by_type === 'shop' ? (
                        <div style={{ flex: 2, display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleConnectionStatus(req.id, 'active')} style={{ ...approveBtnStyle, flex: 2, padding: '12px', fontSize: '0.9rem' }}>承認する</button>
                          <button onClick={() => handleConnectionStatus(req.id, 'rejected')} style={{ ...rejectBtnStyle, flex: 1, padding: '12px', fontSize: '0.8rem' }}>拒否</button>
                        </div>
                      ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#f97316', fontWeight: 'bold', fontSize: '0.9rem' }}><Send size={16} /> 返信待ちです</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- B: 通知設定（ON/OFFスイッチ） --- */}
        <div style={panelStyle}>
          <h3 style={panelTitle}><Mail size={18} /> 通知設定</h3>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '20px' }}>
            新しい提携リクエストが届いた際の通知方法を設定します。
          </p>
          <div style={settingRowStyle}>
            <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>メールでの新着通知</span>
            <label style={switchStyle}>
              <input 
                type="checkbox" 
                style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                checked={facility?.email_notifications_enabled ?? true} 
                onChange={(e) => updateAcceptStatus('email_notifications_enabled', e.target.checked)}
                disabled={isUpdating}
              />
              <span style={{ ...sliderStyle, backgroundColor: (facility?.email_notifications_enabled ?? true) ? '#4f46e5' : '#cbd5e1' }}>
                <div style={{ width: '18px', height: '18px', backgroundColor: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: (facility?.email_notifications_enabled ?? true) ? '24px' : '4px', transition: '0.3s' }} />
              </span>
            </label>
          </div>
        </div>

        {/* --- C: 外部業者からの提携申請制限 --- */}
        <div style={panelStyle}>
          <h3 style={panelTitle}><ShieldAlert size={18} /> 外部業者からの提携申請制限</h3>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '20px' }}>業種ごとに新規提携の受付を制限できます。</p>          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {[
              { label: '美容・理容（カット・顔剃り等）', col: 'accept_salon' },
              { label: '歯科・口腔ケア（定期検診等）', col: 'accept_dentist' },
              { label: 'マッサージ・リハビリ', col: 'accept_massage' }
            ].map(item => (
              <div key={item.col} style={settingRowStyle}>
                <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{item.label}</span>
                <label style={switchStyle}>
                  <input type="checkbox" style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} checked={facility?.[item.col] ?? true} onChange={(e) => updateAcceptStatus(item.col, e.target.checked)} disabled={isUpdating} />
                  <span style={{ ...sliderStyle, backgroundColor: (facility?.[item.col] ?? true) ? '#4f46e5' : '#cbd5e1' }}>
                    <div style={{ width: '18px', height: '18px', backgroundColor: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: (facility?.[item.col] ?? true) ? '24px' : '4px', transition: '0.3s' }} />
                  </span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* --- D: 施設プロフィールの登録・編集 --- */}
        <div style={panelStyle}>
          <h3 style={panelTitle}><Building2 size={18} /> 施設プロフィールの登録・編集</h3>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '20px' }}>ここで登録した連絡先が提携先の店舗（業者）に表示されます。</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <label style={labelStyle}>施設名
              <input style={{...inputStyle, background: '#f1f5f9', color: '#64748b'}} value={facility?.facility_name || ''} readOnly />
              <span style={{fontSize: '0.7rem', color: '#94a3b8'}}>※施設名の変更は運営まで</span>
            </label>

            <label style={labelStyle}>担当者名
              <input style={inputStyle} placeholder="例：山田 花子" value={facility?.contact_name || ''} onChange={(e) => setFacility({...facility, contact_name: e.target.value})} />
            </label>

            <label style={labelStyle}>郵便番号・住所
              <input style={inputStyle} placeholder="例：東京都町田市..." value={facility?.address || ''} onChange={(e) => setFacility({...facility, address: e.target.value})} />
            </label>

            <label style={labelStyle}>電話番号
              <input style={inputStyle} placeholder="例：090-0000-0000" value={facility?.tel || ''} onChange={(e) => setFacility({...facility, tel: e.target.value})} />
            </label>

            <label style={labelStyle}>公式サイトURL
              <input style={inputStyle} placeholder="https://example.com" value={facility?.official_url || ''} onChange={(e) => setFacility({...facility, official_url: e.target.value})} />
            </label>

            <label style={labelStyle}>通知用メールアドレス
              <input style={inputStyle} placeholder="例：info@example.com" value={facility?.email || ''} onChange={(e) => setFacility({...facility, email: e.target.value})} />
            </label>

            <button 
              onClick={async () => {
                setIsUpdating(true);
                const { error } = await supabase.from('facility_users').update({ 
                  address: facility.address, 
                  tel: facility.tel, 
                  email: facility.email, 
                  contact_name: facility.contact_name, 
                  official_url: facility.official_url 
                }).eq('id', facilityId);
                
                if (!error) alert('プロフィールを更新しました！');
                else alert('更新失敗: ' + error.message);
                setIsUpdating(false);
              }} 
              style={{ ...saveBtnStyle, marginTop: '10px' }} 
              disabled={isUpdating}
            >
              <Save size={18} /> プロフィールを保存
            </button>
          </div>
          
          <div style={{ marginTop: '25px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
            <p style={{ fontSize: '0.85rem' }}>ログインID: <code>{facility?.login_id}</code></p>
            <p style={{ fontSize: '0.7rem', color: '#94a3b8' }}>パスワードの変更は運営（三土手）までお問い合わせください。</p>
          </div>
        </div>
      </div>
    );
  };

  // --- 修正後：タブ切り替えロジックを導入 ---
  return (
    <div style={containerStyle}>
      {/* 施設ポータルヘッダー：共通 */}
      <header style={headerStyle}>
        <div>
          <div style={facilityLabelStyle}><Building2 size={14} /> QUEST HUB 施設ポータル</div>
          <h1 style={titleStyle}>{facility?.facility_name || "読み込み中..."} 様</h1>
        </div>
        <button 
          onClick={() => { 
            sessionStorage.clear();
            navigate(`/facility-login/${facilityId}`); 
          }} 
          style={logoutBtnStyle}
        >
          <LogOut size={18} /> ログアウト
        </button>
      </header>

      {/* 🆕 ナビゲーションタブ：ここで名簿と設定、業者検索を切り替え */}
      <div style={tabContainerStyle}>
        <button 
          onClick={() => setActiveTab('residents')} 
          style={activeTab === 'residents' ? activeTabStyle : tabStyle}
        >
          <Users size={18} /> 名簿管理
        </button>
        <button 
          onClick={() => setActiveTab('settings')} 
          style={activeTab === 'settings' ? activeTabStyle : tabStyle}
        >
          <Settings size={18} /> 受付設定
        </button>
        {/* 🆕 修正：業者を探すボタンを追加 */}
        <button 
          onClick={() => setActiveTab('find_shops')} 
          style={activeTab === 'find_shops' ? activeTabStyle : tabStyle}
        >
          <Search size={18} /> 業者を探す
        </button>
      </div>

      {/* --- コンテンツエリアの分岐開始 --- */}
      {activeTab === 'residents' ? (
        <>
          {/* 提携サービス（業者）セクション */}
          <section style={sectionAreaStyle}>
            <h2 style={sectionTitleStyle}><Store size={18} /> 提携サービス（業者）</h2>
            <div style={shopGridStyle}>
              {connectedShops
                .filter(con => con.status === 'active') 
                .map(con => (
                  <div key={con.id} style={{...shopCardStyle, borderTop: `4px solid ${con.profiles?.theme_color || '#4f46e5'}`}}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={shopInfoStyle}>
                        <h3 style={shopNameStyle}>{con.profiles?.business_name}</h3>
                        <span style={shopTagStyle}>{con.profiles?.business_type || '訪問サービス'}</span>
                      </div>
                      <button 
                        onClick={() => handleDisconnect(con)} 
                        style={{ 
                          background: '#fee2e2', color: '#ef4444', border: 'none', 
                          padding: '4px 10px', borderRadius: '8px', fontSize: '0.7rem', 
                          fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' 
                        }}
                      >
                        <Trash2 size={12} /> 提携解消
                      </button>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
  
  {/* 代表者名（profilesに owner_name がある前提） */}
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#666' }}>
    <User size={16} color={con.profiles?.theme_color || '#4f46e5'} />
    <span>代表：<strong>{con.profiles?.owner_name || '三土手 真里'}</strong></span>
  </div>

  {/* 住所 ＆ Googleマップ連携 */}
  {con.profiles?.address && (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.85rem', color: '#666' }}>
      <MapPin size={16} color={con.profiles?.theme_color || '#4f46e5'} style={{ marginTop: '2px' }} />
      <div style={{ flex: 1 }}>
        <div style={{ lineHeight: '1.4' }}>{con.profiles.address}</div>
        <a 
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(con.profiles.address)}`} 
          target="_blank" 
          rel="noreferrer"
          style={{ fontSize: '0.75rem', color: '#4f46e5', fontWeight: 'bold', textDecoration: 'none', marginTop: '4px', display: 'inline-block' }}
        >
          Googleマップで場所を確認
        </a>
      </div>
    </div>
  )}

  {/* 電話：タップで発信 */}
  {con.profiles?.phone && (
    <a href={`tel:${con.profiles.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#4f46e5', textDecoration: 'none', fontWeight: 'bold' }}>
      <Phone size={16} />
      <span>{con.profiles.phone} <span style={{fontSize:'0.7rem', fontWeight:'normal'}}>(タップで電話)</span></span>
    </a>
  )}
  
  {/* メール：タップでメーラー起動 */}
  {con.profiles?.email_contact && (
    <a href={`mailto:${con.profiles.email_contact}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#4f46e5', textDecoration: 'none' }}>
      <Mail size={16} />
      <span>{con.profiles.email_contact}</span>
    </a>
  )}
</div>

{/* 公式サイトがあれば表示 */}
{con.profiles?.official_url && (
  <a href={con.profiles.official_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '14px', background: '#f1f5f9', color: '#475569', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 'bold', marginBottom: '10px' }}>
    <ExternalLink size={16} /> 公式サイト
  </a>
)}

                    <button 
                      onClick={() => navigate(`/shop/${con.shop_id}/reserve/time`, { 
                        state: { mode: 'facility', facilityUserId: facilityId, totalSlotsNeeded: 12 } 
                      })}
                      style={{ ...bookingBtnStyle, marginTop: '10px' }}
                    >
                      <CalendarCheck size={16} /> 予約・依頼
                    </button>
                  </div>
                ))}
              {connectedShops.filter(con => con.status === 'active').length === 0 && (
                <div style={emptyCardStyle}>提携中の業者はありません</div>
              )}
            </div>
          </section>

          <div style={{...sectionTitleStyle, marginTop: '30px'}}><Users size={18} /> 共通入居者名簿</div>

          <div style={actionRowStyle}>
            <div style={searchBoxStyle}>
              <Search size={18} style={searchIconStyle} />
              <input 
                placeholder="名前や部屋番号で検索" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={searchInputStyle}
              />
            </div>
            <button onClick={() => { resetForm(); setIsModalOpen(true); }} style={addBtnStyle}>
              <UserPlus size={20} /> 追加
            </button>
          </div>

          <div style={{ ...listStyle, paddingBottom: activeRequest ? '140px' : '20px' }}>
            <div style={listCountStyle}>登録数: {residents.length}名</div>
            {filteredResidents.map(r => {
              const isSelected = selectedResidentIds.includes(r.id);
              return (
                <motion.div 
                  key={r.id} 
                  whileTap={{ scale: 0.98 }}
                  style={{
                    ...residentCardStyle, 
                    border: isSelected ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                    background: isSelected ? '#f5f7ff' : '#fff',
                  }}
                  onClick={() => handleToggleResident(r.id)}
                >
                  <div style={checkCircleStyle(isSelected)}>
                    {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={roomNoStyle}>{r.room_number ? `${r.room_number}号室` : '部屋番号未登録'}</div>
                    <h3 style={nameStyle}>{r.name} <span style={kanaStyle}>{r.name_kana}</span></h3>
                    <div style={tagRowStyle}>
                      {r.has_wheelchair && <span style={tagStyle}>車椅子</span>}
                      {r.needs_bed_cut && <span style={{...tagStyle, background: '#fee2e2', color: '#ef4444'}}>ベッドカット</span>}
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(r.id);
                      setFormData(r);
                      setIsModalOpen(true);
                    }}
                    style={miniEditBtnStyle}
                  >
                    <Edit3 size={18} />
                  </button>
                </motion.div>
              );
            })}
          </div>

          {!activeRequest ? (
            <div style={floatingBarStyle}>
              <div style={floatingInfoStyle}>
                {selectedResidentIds.length > 0 ? (
                  <span style={{color: '#4f46e5'}}><Users size={16} /> {selectedResidentIds.length}名を選択中</span>
                ) : (
                  <span style={{color: '#64748b'}}><AlertCircle size={16} /> 次回の予定がありません</span>
                )}
              </div>
              <button 
                onClick={() => {
                  if (connectedShops.length === 0) return alert("提携店舗が見つかりません");
                  navigate(`/shop/${connectedShops[0].profiles.id}/reserve/time`, { 
                    state: { mode: 'facility', facilityUserId: facilityId, selectedResidentIds: selectedResidentIds } 
                  });
                }}
                style={{ ...mainActionBtnStyle, background: selectedResidentIds.length > 0 ? '#4f46e5' : '#1e293b' }}
              >
                {selectedResidentIds.length > 0 ? <><CalendarCheck size={18} /> このメンバーで日程を選ぶ</> : <><Calendar size={18} /> まずは訪問日だけキープする</>}
              </button>
            </div>
          ) : (
            <div style={floatingBarStyle}>
              <div style={floatingInfoStyle}>
                 <span style={dateBadgeStyle}>{activeRequest.scheduled_date}</span>
                 <span>のカット依頼を編集中（{selectedResidentIds.length}名）</span>
              </div>
              <div style={floatingActionStyle}>
                <button onClick={() => handleSaveVisitList(false)} disabled={isRequestSaving} style={subActionBtnStyle}>一時保存</button>
                <button onClick={() => handleSaveVisitList(true)} disabled={isRequestSaving} style={mainActionBtnStyle}>名簿を確定する</button>
                <button 
                  onClick={() => navigate(`/shop/${connectedShops[0].profiles.id}/reserve/time`, { 
                    state: { mode: 'facility', facilityUserId: facilityId, requestId: activeRequest.id } 
                  })}
                  style={{...subActionBtnStyle, width: 'auto', flex: 'none', padding: '14px'}}
                >
                  <Calendar size={18} />
                </button>
              </div>
            </div>
          )}
        </>
      ) : activeTab === 'find_shops' ? (
        /* 🆕 業者を探すタブが選択された時の分岐を追加 */
        <div style={{ ...panelStyle, textAlign: 'center', padding: '60px 20px' }}>
          <Search size={48} color="#cbd5e1" style={{ marginBottom: '20px' }} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '10px' }}>新しい提携業者を探す</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '30px', lineHeight: 1.6 }}>
            訪問美容・歯科・マッサージなどの専門業者を検索し、<br/>
            施設への訪問依頼や提携のリクエストを送ることができます。
          </p>
          <button 
            onClick={() => navigate(`/facility-portal/${facilityId}/find-shops`)} 
            style={{ ...mainActionBtnStyle, width: 'auto', padding: '16px 40px', margin: '0 auto' }}
          >
            業者検索画面を開く <ChevronRight size={18} />
          </button>
        </div>
      ) : (
        /* 受付設定タブの内容 */
        renderSettings()
      )}

      {/* 入居者追加・編集用モーダル（共通） */}
      <AnimatePresence>
        {isModalOpen && (
          <div style={modalOverlayStyle} onClick={() => setIsModalOpen(false)}>
            <motion.div 
              initial={{ y: 50, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: 50, opacity: 0 }}
              style={modalContentStyle} 
              onClick={(e) => e.stopPropagation()}
            >
              <div style={modalHeaderStyle}>
                <h2 style={{margin: 0, fontSize: '1.2rem'}}>{editingId ? '情報を編集' : '新しい入居者を追加'}</h2>
                <button onClick={() => setIsModalOpen(false)} style={closeBtnStyle}><X /></button>
              </div>

              <form onSubmit={handleSave} style={formStyle}>
                <label style={labelStyle}>お名前
                  <input required style={inputStyle} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="例: 山田 太郎" />
                </label>
                <label style={labelStyle}>ふりがな
                  <input style={inputStyle} value={formData.name_kana} onChange={e => setFormData({...formData, name_kana: e.target.value})} placeholder="例: やまだ たろう" />
                </label>
                <label style={labelStyle}>部屋番号
                  <input style={inputStyle} value={formData.room_number} onChange={e => setFormData({...formData, room_number: e.target.value})} placeholder="例: 201" />
                </label>

                <div style={checkGroupStyle}>
                  <label style={checkLabelStyle}>
                    <input type="checkbox" checked={formData.has_wheelchair} onChange={e => setFormData({...formData, has_wheelchair: e.target.checked})} />
                    車椅子を利用している
                  </label>
                  <label style={checkLabelStyle}>
                    <input type="checkbox" checked={formData.needs_bed_cut} onChange={e => setFormData({...formData, needs_bed_cut: e.target.checked})} />
                    ベッド上でのカットが必要
                  </label>
                </div>

                <label style={labelStyle}>メモ・要望
                  <textarea style={{...inputStyle, height: '80px'}} value={formData.memo} onChange={e => setFormData({...formData, memo: e.target.value})} placeholder="例: 短め希望、耳は出す" />
                </label>

                <button type="submit" style={saveBtnStyle}>
                  <Save size={18} /> 名簿に保存する
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ==========================================
// スタイル定義：QUEST HUB 施設ポータル
// ==========================================

// --- 1. ベース・レイアウト ---
const containerStyle = { maxWidth: '500px', margin: '0 auto', padding: '20px', minHeight: '100vh', background: '#f8fafc' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px', padding: '10px 0' };
const facilityLabelStyle = { fontSize: '0.65rem', fontWeight: 'bold', color: '#4f46e5', background: '#4f46e510', padding: '4px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '8px' };
const titleStyle = { margin: 0, fontSize: '1.4rem', fontWeight: 'bold', color: '#1e293b' };
const logoutBtnStyle = { background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' };
const centerStyle = { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' };

// --- 2. タブ・パネル共通 ---
const tabContainerStyle = { display: 'flex', background: '#fff', padding: '5px', borderRadius: '15px', marginBottom: '25px', boxShadow: '0 4px 10px rgba(0,0,0,0.03)' };
const tabStyle = { flex: 1, padding: '12px', border: 'none', borderRadius: '12px', background: 'transparent', color: '#64748b', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: '0.2s' };
const activeTabStyle = { ...tabStyle, background: '#1e293b', color: '#fff' };
const panelStyle = { background: '#fff', padding: '20px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '20px' };
const panelTitle = { margin: 0, fontSize: '1rem', fontWeight: 'bold', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' };

// --- 3. フォーム・入力関連（重複統合） ---
const formGridStyle = { display: 'flex', flexDirection: 'column', gap: '15px' };
const formStyle = { display: 'flex', flexDirection: 'column', gap: '15px' }; // モーダル用
const labelStyle = { display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', textAlign: 'left' };
const inputStyle = { width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem', outline: 'none', background: '#f8fafc', boxSizing: 'border-box' };
const checkGroupStyle = { display: 'flex', flexDirection: 'column', gap: '10px', background: '#f8fafc', padding: '15px', borderRadius: '15px' };
const checkLabelStyle = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#1e293b', cursor: 'pointer' };
const saveBtnStyle = { marginTop: '10px', background: '#1e293b', color: '#fff', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: 'bold', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer' };

// --- 4. 名簿管理タブ：検索・追加 ---
const actionRowStyle = { display: 'flex', gap: '10px', marginBottom: '20px' };
const searchBoxStyle = { flex: 1, position: 'relative' };
const searchIconStyle = { position: 'absolute', left: '12px', top: '14px', color: '#cbd5e1' };
const searchInputStyle = { width: '100%', padding: '12px 12px 12px 40px', borderRadius: '16px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '1rem' };
const addBtnStyle = { background: '#1e293b', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' };

// --- 5. 名簿管理タブ：入居者リスト ---
const listStyle = { display: 'flex', flexDirection: 'column', gap: '12px' };
const listCountStyle = { fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold', marginLeft: '5px' };
const residentCardStyle = { background: '#fff', padding: '20px', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const roomNoStyle = { fontSize: '0.65rem', fontWeight: 'bold', color: '#94a3b8', marginBottom: '4px' };
const nameStyle = { margin: 0, fontSize: '1.15rem', color: '#1e293b', fontWeight: 'bold' };
const kanaStyle = { fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'normal', marginLeft: '6px' };
const tagRowStyle = { display: 'flex', gap: '6px', marginTop: '10px' };
const tagStyle = { fontSize: '0.7rem', background: '#f0f9ff', color: '#0369a1', padding: '4px 10px', borderRadius: '8px', fontWeight: 'bold' };
const miniEditBtnStyle = { background: '#f8fafc', border: 'none', padding: '10px', borderRadius: '12px', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const checkCircleStyle = (selected) => ({
  width: '24px', height: '24px', borderRadius: '50%', border: selected ? 'none' : '2px solid #cbd5e1',
  background: selected ? '#4f46e5' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px', transition: 'all 0.2s'
});
const emptyTextStyle = { textAlign: 'center', padding: '50px', color: '#cbd5e1', fontSize: '0.9rem' };

// --- 6. 名簿管理タブ：提携業者（ショップ）グリッド ---
const sectionAreaStyle = { marginBottom: '30px' };
const sectionTitleStyle = { fontSize: '0.9rem', fontWeight: 'bold', color: '#64748b', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' };
const shopGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' };
const shopCardStyle = { background: '#fff', padding: '20px', borderRadius: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '15px' };
const shopNameStyle = { margin: 0, fontSize: '1.1rem', color: '#1e293b', fontWeight: 'bold' };
const shopTagStyle = { fontSize: '0.7rem', color: '#94a3b8', background: '#f8fafc', padding: '2px 8px', borderRadius: '6px' };
const shopInfoStyle = { flex: 1 };
const bookingBtnStyle = { background: '#1e293b', color: '#fff', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };
const emptyCardStyle = { gridColumn: '1/-1', textAlign: 'center', padding: '30px', background: '#fff', borderRadius: '20px', color: '#cbd5e1', fontSize: '0.8rem', border: '2px dashed #f1f5f9' };

// --- 7. 下部フローティングバー（訪問依頼用） ---
const floatingBarStyle = { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', padding: '20px', boxShadow: '0 -10px 25px rgba(0,0,0,0.08)', zIndex: 900, borderTop: '1px solid #e2e8f0' };
const floatingInfoStyle = { fontSize: '0.85rem', color: '#1e293b', fontWeight: 'bold', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' };
const dateBadgeStyle = { background: '#1e293b', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem' };
const floatingActionStyle = { display: 'flex', gap: '10px' };
const subActionBtnStyle = { flex: 1, padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' };
const mainActionBtnStyle = { flex: 2, padding: '14px', borderRadius: '14px', border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)' };

// --- 8. スイッチ & 提携申請 ---
const settingRowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' };
const switchStyle = { position: 'relative', display: 'inline-block', width: '46px', height: '24px' };
const sliderStyle = { position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, transition: '.3s', borderRadius: '24px' };
const requestCardStyle = { background: '#fff', padding: '15px', borderRadius: '16px', border: '1px solid #fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' };
const approveBtnStyle = { background: '#10b981', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' };
const rejectBtnStyle = { background: '#f1f5f9', color: '#64748b', border: 'none', padding: '8px 16px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' };

// --- 9. モーダルUI ---
const modalOverlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 };
const modalContentStyle = { background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '30px 30px 0 0', padding: '30px', maxHeight: '90vh', overflowY: 'auto' };
const modalHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const closeBtnStyle = { background: '#f1f5f9', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer' };

export default FacilityPortal;