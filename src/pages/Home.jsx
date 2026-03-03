import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
// 🆕 共通マスター（大カテゴリのリスト）をインポート
import { INDUSTRY_LABELS } from '../constants/industryMaster';
import { MapPin, User, LogIn, Heart, Calendar, LogOut, X, Mail } from 'lucide-react';

const profileInputStyle = { width: '100%', padding: '8px', borderRadius: '6px', border: 'none', color: '#333', fontSize: '0.9rem', boxSizing: 'border-box' };
const profileSmallBtnStyle = { padding: '8px 12px', background: '#fff', color: '#07aadb', border: 'none', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' };
const profileActionBtnStyle = { flex: 1, padding: '10px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' };

// 🆕 ここから追記：モーダル内で使う共通スタイル（エラー解消用）
const modalInputStyle = { padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem', width: '100%', boxSizing: 'border-box' };
const modalPrimaryBtnStyle = { background: '#0f172a', color: '#fff', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px', fontSize: '1.05rem', boxShadow: '0 10px 15px -3px rgba(15,23,42,0.3)', width: '100%' };

function Home() {
  const navigate = useNavigate();
  const [shops, setShops] = useState([]);
  const [newShops, setNewShops] = useState([]); 
  const [currentSlide, setCurrentSlide] = useState(0);
  const [topics, setTopics] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  // 🆕 プロフィール編集モードのON/OFF
  const [isEditingProfile, setIsEditingProfile] = useState(false); 
  // 🆕 編集中の各項目をまとめて管理する箱
  const [editFields, setEditFields] = useState({
    display_name: '',
    zip_code: '',
    address: '',
    phone: ''
  });
const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // 🆕 追加：多段登録フロー用
  const [signUpStep, setSignUpStep] = useState('email'); // 'email' | 'otp' | 'password' | 'profile'
  const [otpCode, setOtpCode] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [favorites, setFavorites] = useState([]); 
  const [myHistory, setMyHistory] = useState([]); // 履歴用

  const sliderImages = [
    { id: 1, url: 'https://images.unsplash.com/photo-1600880210836-8f8fe100a35c?auto=format&fit=crop&w=1200&q=80', title: '自分らしく、働く。', desc: 'Solopreneurを支えるポータルサイト' },
    { id: 2, url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80', title: '次世代の予約管理', desc: 'SOLOでビジネスを加速させる' },
    { id: 3, url: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80', title: '新しい繋がりを。', desc: 'あなたのサービスを世界へ届けよう' },
  ];

  // 🆕 1. 【部品】ポータルデータを読み込む関数（最優先で実行される）
  const fetchPortalData = async () => {
    try {
      const shopRes = await supabase.from('profiles').select('*').eq('is_suspended', false).not('business_name', 'is', null);
      if (shopRes.data) {
        setShops(shopRes.data);
        setNewShops([...shopRes.data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3));
      }
      const newsRes = await supabase.from('portal_news').select('*').order('sort_order', { ascending: true });
      if (newsRes.data) setTopics(newsRes.data);
      const catRes = await supabase.from('portal_categories').select('*').order('sort_order', { ascending: true });
      if (catRes.data) setCategoryList(catRes.data);
    } catch (err) {
      console.error("Portal Data Error:", err);
    }
  };

  // 🆕 2. 【部品】ユーザー情報と履歴を同期する関数
const handleSyncUser = async (session) => {
    if (!session) return;
    try {
      // 1. まず、app_usersにデータがあるか確認（読み込みを先に行う）
      const { data: appUser, error: fetchError } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      let currentUser = appUser;

      // 🆕 強化ポイント：データが「本当に存在しない」時だけ作成処理を行う
      if (!appUser && !fetchError) {
        const randomId = `user_${Math.random().toString(36).substring(2, 7)}`;
        
        // upsertを使用し、もし一瞬の差でデータが作られていてもエラーにしない設定
        const { data: newUser, error: insError } = await supabase
          .from('app_users')
          .upsert({
            id: session.user.id,
            display_id: randomId,
            display_name: session.user.user_metadata?.full_name || 'ゲストユーザー',
            email: session.user.email,
            avatar_url: session.user.user_metadata?.avatar_url || null
          }, { onConflict: 'id' }) // IDが重なったら更新（無視）する
          .select()
          .single();
        
if (!insError) {
          currentUser = newUser;
        }
      }

      // 🤝 ここに配置することで、新規登録時もリロード時も常に最新の名寄せを試みます
      if (currentUser) {
        setUserProfile(currentUser);

        // 🆕 1. メールアドレスで紐付け（存在する場合のみ）
        if (session.user.email) {
          supabase.from('customers')
            .update({ auth_id: session.user.id })
            .eq('email', session.user.email)
            .then();
        }

        // 🆕 2. 電話番号で紐付け
        // Googleから取得できる場合、または今後プロフィールに電話番号を保存した場合に備えます
        const userPhone = currentUser.phone || session.user.phone || session.user.user_metadata?.phone;
        if (userPhone) {
          supabase.from('customers')
            .update({ auth_id: session.user.id })
            .eq('phone', userPhone)
            .then();
        }
      }
      // 2. プロフィール情報をセット
      if (currentUser) {
        setUserProfile(currentUser);
      }

      // 3. 履歴取得（独立したtry-catchで安全に実行）
      try {
        const { data: history } = await supabase
          .from('reservations')
          .select('*, profiles(business_name)')
          .eq('customer_email', session.user.email)
          .order('start_time', { ascending: false });
        if (history) setMyHistory(history);
      } catch (hErr) {
        console.warn("履歴の取得をスキップしました:", hErr);
      }

} catch (err) {
      console.error("ユーザー同期中にエラーが発生しました:", err);
    }
  };

// 🆕 プロフィール情報をデータベースに保存する関数
  const handleUpdateProfile = async () => {
    if (!editFields.display_name.trim()) return alert("お名前は必須です");

    try {
      const { error } = await supabase
        .from('app_users')
        .update({ 
          display_name: editFields.display_name,
          zip_code: editFields.zip_code,
          address: editFields.address,
          phone: editFields.phone
        })
        .eq('id', user.id);

      if (error) throw error;

      // 保存成功：画面表示を最新にする
      setUserProfile({ ...userProfile, ...editFields });
      setIsEditingProfile(false);

      // 🤝 【重要】電話番号が登録されたなら、名寄せ（customersテーブルとの紐付け）を実行
      if (editFields.phone) {
        await supabase.from('customers')
          .update({ auth_id: user.id })
          .eq('phone', editFields.phone);
      }

      alert("プロフィールを更新しました！");
    } catch (err) {
      console.error("Profile Update Error:", err);
      alert("更新に失敗しました。");
    }
  };

  // 🆕 郵便番号から住所を自動取得する関数
  const handleZipSearch = async () => {
    const zip = editFields.zip_code.replace(/[^0-9]/g, '');
    if (zip.length < 7) return alert("郵便番号を7桁で入力してください");
    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zip}`);
      const data = await res.json();
      if (data.results) {
        const { address1, address2, address3 } = data.results[0];
        setEditFields({ ...editFields, address: `${address1}${address2}${address3}` });
      } else {
        alert("住所が見つかりませんでした");
      }
    } catch (err) { console.error("Zip Search Error:", err); }
  };
    
  // 🆕 3. 【司令塔】useEffect：ページを開いた瞬間に一度だけ動く
  useEffect(() => {
    const scrollTimer = setTimeout(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, 100);
    const sliderTimer = setInterval(() => { setCurrentSlide((prev) => (prev === sliderImages.length - 1 ? 0 : prev + 1)); }, 5000);

    // 🔥 トピック読み込みを真っ先に実行！
    fetchPortalData();

    // 初期セッションチェック
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        handleSyncUser(session);
      }
    };
    checkSession();

// 認証状態の監視
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      
      if (session) {
        // 🆕 重要：新規登録モード(isSignUpMode)の時は、何があってもモーダルを閉じない
        if (isSignUpMode) {
          console.log("🛠 登録フロー継続中：モーダルを維持します");
        } else {
          setIsModalOpen(false);
        }
        handleSyncUser(session);
      } else {
        setUserProfile(null);
        setMyHistory([]);
      }
    });
    
    return () => {
      clearTimeout(scrollTimer);
      clearInterval(sliderTimer);
      authListener.subscription.unsubscribe();
    };
  }, []);

  // 🆕 ステート
const [isSignUpMode, setIsSignUpMode] = useState(false);

  // 🆕 1. 新規登録フロー：ステップごとに処理を切り替える
  const handleSignUpFlow = async (e) => {
    e.preventDefault();
    try {
      if (signUpStep === 'email') {
        // 【ステップ1】認証コード（OTP）を送信
        const { error } = await supabase.auth.signInWithOtp({ 
          email, 
          options: { shouldCreateUser: true } 
        });
        if (error) throw error;
        setSignUpStep('otp');
        alert("6ケタの認証コードを送信しました。");

} else if (signUpStep === 'otp') {
        const { error } = await supabase.auth.verifyOtp({
          email,
          token: otpCode,
          type: 'email'
        });
        if (error) throw error;

        // 認証成功！
        // 本来はここでマイページに行こうとしますが、
        // ログインモード(isSignUpMode)が true の間は、モーダルを閉じずに
        // 次のステップ（パスワード設定）へ強制的に進めます。
        setSignUpStep('password');
        
        // 【重要】もし useEffect などで「ログインしたらモーダルを閉じる」
        // という処理を入れている場合は、一時的にその動きを止める必要があります。
        
      } else if (signUpStep === 'password') {
        // 【ステップ3】パスワード設定
        if (password !== confirmPassword) return alert("パスワードが一致しません");
        if (password.length < 8) return alert("8文字以上で入力してください");
        
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setSignUpStep('profile');

      } else if (signUpStep === 'profile') {
        // 【ステップ4】電話番号の最終登録
        if (!phone) return alert("電話番号を入力してください");
        
        // 会員テーブル(app_users)を更新
        const { error } = await supabase.from('app_users').update({ 
          phone: phone,
          updated_at: new Date().toISOString()
        }).eq('id', user.id);
        
        if (error) throw error;

        // 全行程完了！
        alert("登録が完了しました！");
        setIsModalOpen(false);
        setSignUpStep('email'); // 初期状態に戻しておく
      }
    } catch (err) {
      alert("エラーが発生しました: " + err.message);
    }
  };

  // 🆕 2. ログイン専用の関数
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      let loginEmail = email;
      // IDログイン対応
      if (!email.includes('@')) {
        const { data: profile } = await supabase.from('app_users').select('email').eq('display_id', email).maybeSingle();
        if (!profile) return alert("ユーザーIDが見つかりません。");
        loginEmail = profile.email;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
      if (error) throw error;
      
      setIsModalOpen(false);
    } catch (err) {
      alert("ログイン失敗: " + err.message);
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) alert(error.message);
  };

  const handleLogout = async () => {
    if (window.confirm("ログアウトしますか？")) {
      await supabase.auth.signOut();
    }
  };

  return (
    <div style={{ backgroundColor: '#f4f7f9', minHeight: '100vh', fontFamily: '"Hiragino Sans", "Meiryo", sans-serif', color: '#333', width: '100%' }}>
      
      {/* 1. ヘッダーエリア（🆕 ログイン対応版） */}
      <div style={{ background: '#fff', padding: '15px 20px', borderBottom: '1px solid #eee', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h1 style={{ color: '#07aadb', fontSize: '1.6rem', fontWeight: '900', margin: 0, letterSpacing: '-1.5px' }}>SOLO</h1>
            <div style={{ height: '20px', width: '1px', background: '#ccc', margin: '0 12px' }}></div>
            <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: 'bold' }}>Solopreneur Portal</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
{user.user_metadata?.avatar_url ? (
  <img 
    src={user.user_metadata.avatar_url} 
    style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #07aadb' }} 
    alt="profile" 
  />
) : (
  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #07aadb' }}>
    <User size={18} color="#07aadb" />
  </div>
)}
         <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><LogOut size={18} color="#666" /></button>
              </div>
            ) : (
              <button onClick={() => setIsModalOpen(true)} style={{ background: '#07aadb', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', boxShadow: '0 4px 10px rgba(7,170,219,0.2)' }}>
                ログイン
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. 自動カルーセルスライダー */}
      <div style={{ width: '100%', position: 'relative', height: '320px', overflow: 'hidden', background: '#000' }}>
        {sliderImages.map((slide, index) => (
          <div
            key={slide.id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundImage: `linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.5)), url(${slide.url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: index === currentSlide ? 1 : 0,
              transition: 'opacity 1.5s ease-in-out',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              color: '#fff',
              textAlign: 'center'
            }}
          >
            <h2 style={{ fontSize: '2rem', fontWeight: '900', margin: '0 0 10px 0', textShadow: '0 2px 15px rgba(0,0,0,0.6)', transform: index === currentSlide ? 'translateY(0)' : 'translateY(20px)', transition: '0.8s ease-out' }}>
              {slide.title}
            </h2>
            <p style={{ fontSize: '1rem', margin: 0, textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>
              {slide.desc}
            </p>
          </div>
        ))}
        <div style={{ position: 'absolute', bottom: '20px', width: '100%', display: 'flex', justifyContent: 'center', gap: '10px' }}>
          {sliderImages.map((_, i) => (
            <div key={i} onClick={() => setCurrentSlide(i)} style={{ width: '8px', height: '8px', borderRadius: '50%', background: i === currentSlide ? '#fff' : 'rgba(255,255,255,0.4)', cursor: 'pointer', transition: '0.3s' }}></div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
        
{/* 🆕 お客様専用：ログイン後のパーソナライズボード */}
{user && !isSignUpMode && (
  <div style={{ background: 'linear-gradient(135deg, #07aadb 0%, #0284c7 100%)', borderRadius: '16px', padding: '20px', marginBottom: '25px', color: '#fff', boxShadow: '0 8px 20px rgba(7, 170, 219, 0.2)' }}>
    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ fontSize: '0.8rem', opacity: 0.8, fontWeight: 'normal' }}>
        @{userProfile?.display_id || 'guest_user'}
      </span>

      {/* 🆕 プロフィール編集モードの条件分岐 */}
      {isEditingProfile ? (
        /* --- 編集用フォームを表示 --- */
        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '15px', borderRadius: '12px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '0.7rem', display: 'block', marginBottom: '4px', opacity: 0.9 }}>お名前</label>
            <input value={editFields.display_name} onChange={(e) => setEditFields({...editFields, display_name: e.target.value})} style={profileInputStyle} />
          </div>
          
          <div>
            <label style={{ fontSize: '0.7rem', display: 'block', marginBottom: '4px', opacity: 0.9 }}>メールアドレス（編集不可）</label>
            <div style={{ fontSize: '0.9rem', padding: '8px', background: 'rgba(255,255,255,0.2)', borderRadius: '6px', opacity: 0.8 }}>{userProfile?.email}</div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.7rem', display: 'block', marginBottom: '4px', opacity: 0.9 }}>郵便番号</label>
              <input value={editFields.zip_code} onChange={(e) => setEditFields({...editFields, zip_code: e.target.value})} placeholder="000-0000" style={profileInputStyle} />
            </div>
            <button onClick={handleZipSearch} style={profileSmallBtnStyle}>住所検索</button>
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', display: 'block', marginBottom: '4px', opacity: 0.9 }}>住所</label>
            <input value={editFields.address} onChange={(e) => setEditFields({...editFields, address: e.target.value})} style={profileInputStyle} />
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', display: 'block', marginBottom: '4px', opacity: 0.9 }}>電話番号</label>
            <input value={editFields.phone} onChange={(e) => setEditFields({...editFields, phone: e.target.value})} style={profileInputStyle} />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
            <button onClick={handleUpdateProfile} style={{ ...profileActionBtnStyle, background: '#fff', color: '#07aadb' }}>保存する</button>
            <button onClick={() => setIsEditingProfile(false)} style={{ ...profileActionBtnStyle, background: 'rgba(255,255,255,0.2)', color: '#fff' }}>キャンセル</button>
          </div>
        </div>
      ) : (
        /* --- 通常の表示を表示 --- */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>こんにちは、{userProfile?.display_name || 'ゲスト'} 様</span>
            <button 
              onClick={() => {
                // 現在の情報を編集用の箱（editFields）にセットして編集モードにする
                setEditFields({
                  display_name: userProfile?.display_name || '',
                  zip_code: userProfile?.zip_code || '',
                  address: userProfile?.address || '',
                  phone: userProfile?.phone || ''
                });
                setIsEditingProfile(true);
              }}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 'bold' }}
            >
              プロフィール編集
            </button>
          </div>
          {/* 住所があれば表示する */}
          {userProfile?.address && (
            <div style={{ fontSize: '0.75rem', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'normal' }}>
              <MapPin size={12} /> {userProfile.address}
            </div>
          )}
        </div>
      )}
    </h2>

    <div style={{ display: 'flex', gap: '12px', marginTop: '15px' }}>
      <div style={{ flex: 1, background: 'rgba(255,255,255,0.15)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
        <Calendar size={20} style={{ marginBottom: '4px' }} /><br/><span style={{ fontSize: '0.7rem' }}>予約確認</span>
      </div>
      <div style={{ flex: 1, background: 'rgba(255,255,255,0.15)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
        <Heart size={20} style={{ marginBottom: '4px' }} /><br/><span style={{ fontSize: '0.7rem' }}>お気に入り</span>
      </div>
    </div>
  </div>
)}
        {/* 🆕 予約履歴（My Journey）セクション */}
        {user && !isSignUpMode && (
          <div style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', letterSpacing: '1px', color: '#1a1a1a' }}>My Journey</h3>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>これまでの利用履歴</span>
            </div>

            {myHistory.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {myHistory.map((res) => (
                  <div key={res.id} style={{ background: '#fff', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: '#07aadb', fontWeight: 'bold', marginBottom: '4px' }}>
                        {new Date(res.start_time).toLocaleDateString('ja-JP')}
                      </div>
                      <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#1e293b' }}>
                        {res.profiles?.business_name || '店舗情報なし'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                        {res.menu_name}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1rem', fontWeight: '900', color: '#1e293b' }}>
                        ¥{res.total_price?.toLocaleString() || 0}
                      </div>
                      <span style={{ fontSize: '0.6rem', background: res.status === 'completed' ? '#f1f5f9' : '#ecfdf5', color: res.status === 'completed' ? '#64748b' : '#059669', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                        {res.status === 'completed' ? '来店済み' : '予約中'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '30px', textAlign: 'center', background: '#fff', borderRadius: '16px', color: '#94a3b8', fontSize: '0.85rem', border: '2px dashed #e2e8f0' }}>
                まだ予約履歴がありません。<br/>新しいサービスを体験して、あなたの物語を始めましょう。
              </div>
            )}
          </div>
        )}

        {/* 3. 最新トピック */}
        {topics.length > 0 && (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '15px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#e60012' }}>●</span> 最新トピック
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {topics.map((topic, idx) => (
                <div key={topic.id} style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  padding: '10px 0', 
                  borderBottom: idx === topics.length - 1 ? 'none' : '1px solid #f0f0f0', 
                  gap: '10px' 
                }}>
                  <span style={{ fontSize: '0.75rem', color: '#999', minWidth: '68px', flexShrink: 0, paddingTop: '2px' }}>
                    {topic.publish_date}
                  </span>
                  <span style={{ 
                    fontSize: '0.6rem', 
                    background: topic.category === '重要' ? '#fee2e2' : '#f1f5f9', 
                    color: topic.category === '重要' ? '#ef4444' : '#64748b', 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    minWidth: '50px',
                    textAlign: 'center'
                  }}>
                    {topic.category}
                  </span>
                  <span style={{ 
                    fontSize: '0.85rem', 
                    color: '#333', 
                    cursor: 'pointer',
                    flex: 1,
                    lineHeight: '1.5',
                    whiteSpace: 'normal',
                    wordBreak: 'break-all'
                  }}>
                    {topic.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 🆕 お気に入り店舗セクション */}
        {user && !isSignUpMode && (
          <div style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', letterSpacing: '1px', color: '#1a1a1a' }}>My Favorite</h3>
              <span style={{ fontSize: '0.7rem', color: '#999' }}>お気に入り登録した店舗</span>
            </div>
            <div style={{ padding: '30px', textAlign: 'center', background: '#fff', borderRadius: '16px', color: '#94a3b8', fontSize: '0.85rem', border: '2px dashed #e2e8f0' }}>
              お気に入りの店舗はまだありません。<br/>気になるお店を保存してすぐに予約できるようにしましょう。
            </div>
          </div>
        )}

        {/* 4. Pick Up Solopreneur */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', letterSpacing: '1px', color: '#1a1a1a' }}>Pick Up Solopreneur</h3>
            <span style={{ fontSize: '0.7rem', color: '#999' }}>注目のソロ起業家たち</span>
          </div>
          <div style={{ display: 'grid', gap: '15px' }}>
            {newShops.map(shop => (
              <div key={shop.id} style={{ background: '#fff', border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', display: 'flex', height: '120px' }}>
                <Link to={`/shop/${shop.id}/detail`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', width: '100%' }}>
                  <div style={{ width: '120px', minWidth: '120px', height: '120px', background: '#f0f0f0', backgroundImage: shop.image_url ? `url(${shop.image_url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', flexShrink: 0 }}>
                    {!shop.image_url && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '0.6rem', color: '#ccc' }}>NO IMAGE</div>}
                    <div style={{ position: 'absolute', top: '0', left: '0', background: 'rgba(230,0,18,0.9)', color: '#fff', fontSize: '0.5rem', fontWeight: 'bold', padding: '4px 8px', borderRadius: '0 0 4px 0' }}>PICK UP</div>
                  </div>
                  <div style={{ padding: '12px 15px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: '#2563eb', fontWeight: 'bold', marginBottom: '2px' }}>{shop.business_type}</div>
                    <h4 style={{ margin: '0 0 3px 0', fontSize: '1rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shop.business_name}</h4>
                    <p style={{ fontSize: '0.75rem', color: '#666', margin: 0, lineHeight: '1.4' }}>
                      {shop.description ? shop.description.substring(0, 50) + '...' : '店舗の詳細情報は準備中です。'}
                    </p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>

{/* 5. カテゴリグリッド（大カテゴリのみを表示） */}
        <div style={{ marginBottom: '50px' }}>
          <div style={{ borderLeft: '4px solid #1e293b', paddingLeft: '15px', marginBottom: '25px' }}>
            <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '900', color: '#1e293b' }}>FIND YOUR SERVICE</h3>
            <p style={{ margin: '5px 0 0 0', fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold' }}>カテゴリーから探す</p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
            {/* 🆕 大カテゴリ（INDUSTRY_LABELS）に名前が含まれるものだけを抽出して表示 */}
            {categoryList
              .filter(cat => INDUSTRY_LABELS.includes(cat.name))
              .map((cat) => (
                <Link key={cat.name} to={`/category/${cat.name}`} style={{ textDecoration: 'none' }}>
                  <div style={{ height: '140px', borderRadius: '16px', backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.7)), url(${cat.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '15px', boxShadow: '0 8px 20px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div style={{ color: '#fff', fontSize: '0.55rem', fontWeight: 'bold', letterSpacing: '1px', opacity: 0.8, marginBottom: '2px' }}>{cat.en_name}</div>
                      <div style={{ color: '#fff', fontSize: '0.95rem', fontWeight: '900', letterSpacing: '0.5px' }}>{cat.name}</div>
                    </div>
                  </div>
                </Link>
            ))}
          </div>
        </div>
      </div>

{/* 🆕 ログイン・新規登録モーダル（省略なし完全版） */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '420px', borderRadius: '32px', padding: '40px', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            
            {/* 閉じるボタン */}
            <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={24} color="#94a3b8" />
            </button>
            
{/* 1. タイトル部分：ステップに応じてメッセージを細かく変える */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h2 style={{ fontSize: '1.6rem', fontWeight: '900', color: '#1e293b', marginBottom: '8px' }}>
                {!isSignUpMode ? 'SOLOにログイン' : 
                 signUpStep === 'email' ? '新規アカウント作成' : 
                 signUpStep === 'otp' ? '認証コードを確認' : 
                 signUpStep === 'password' ? 'パスワード設定' : 'プロフィール登録'}
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                {!isSignUpMode ? 'スマートな予約体験を。' : 
                 signUpStep === 'email' ? 'まずはメールアドレスを送信してください' : 
                 signUpStep === 'otp' ? 'メールに届いた6ケタの番号を入力' : 
                 signUpStep === 'password' ? 'ログイン用のパスワードを決めましょう' : '最後に連絡先を教えてください'}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Googleボタンは最初のステップ（ログイン中 or 新規登録開始時）だけ表示 */}
              {(!isSignUpMode || signUpStep === 'email') && (
                <>
                  <button onClick={handleGoogleLogin} style={{ background: '#fff', color: '#334155', border: '2px solid #e2e8f0', padding: '14px', borderRadius: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer', fontSize: '1rem' }}>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" alt="G" /> 
                    Googleで{!isSignUpMode ? 'ログイン' : '登録'}
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0' }}>
                    <div style={{ flex: 1, height: '1px', background: '#f1f5f9' }}></div>
                    <span style={{ padding: '0 16px', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold' }}>OR</span>
                    <div style={{ flex: 1, height: '1px', background: '#f1f5f9' }}></div>
                  </div>
                </>
              )}

              {/* 2. 入力フォーム部分：onSubmit先をモードで切り替え */}
{/* 2. 入力フォーム部分 */}
              <form onSubmit={isSignUpMode ? handleSignUpFlow : handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                {/* --- A. ログインモード --- */}
                {!isSignUpMode && (
                  <>
                    <input type="text" placeholder="メールアドレス または ID" value={email} onChange={(e) => setEmail(e.target.value)} style={modalInputStyle} required />
                    <input type="password" placeholder="パスワード" value={password} onChange={(e) => setPassword(e.target.value)} style={modalInputStyle} required />
                    <button type="submit" style={modalPrimaryBtnStyle}>ログインして進む</button>
                  </>
                )}

                {/* --- B. 新規登録モード：ステップごとの出し分け --- */}
                {isSignUpMode && (
                  <>
                    {signUpStep === 'email' && (
                      <>
                        <input type="email" placeholder="メールアドレス" value={email} onChange={(e) => setEmail(e.target.value)} style={modalInputStyle} required />
                        <button type="submit" style={modalPrimaryBtnStyle}>認証コードを送信</button>
                      </>
                    )}

                    {signUpStep === 'otp' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <input 
                          type="text" 
                          placeholder="000000" 
                          maxLength={6} 
                          value={otpCode} 
                          onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))} 
                          style={{ ...modalInputStyle, textAlign: 'center', letterSpacing: '8px', fontSize: '1.5rem', fontWeight: '900' }} 
                          required 
                        />
                        <button type="submit" style={modalPrimaryBtnStyle}>番号を認証する</button>
                        <button type="button" onClick={() => setSignUpStep('email')} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }}>やり直す</button>
                      </div>
                    )}

                    {signUpStep === 'password' && (
                      <>
                        <input type="password" placeholder="新しいパスワード（8文字以上）" value={password} onChange={(e) => setPassword(e.target.value)} style={modalInputStyle} required />
                        <input type="password" placeholder="パスワード（確認用）" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={modalInputStyle} required />
                        <span style={{ fontSize: '0.65rem', color: '#94a3b8', padding: '0 4px' }}>※英大文字・小文字・数字をすべて含めてください</span>
                        <button type="submit" style={modalPrimaryBtnStyle}>パスワードを確定して次へ</button>
                      </>
                    )}

                    {signUpStep === 'profile' && (
                      <>
                        <input type="tel" placeholder="電話番号（ハイフンなし）" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))} style={modalInputStyle} required />
                        <button type="submit" style={modalPrimaryBtnStyle}>すべての登録を完了する</button>
                      </>
                    )}
                  </>
                )}
              </form>

              {/* 3. モード切り替えリンク：ここが一番大事！ */}
              <div style={{ textAlign: 'center', marginTop: '24px' }}>
                <button 
                  onClick={() => setIsSignUpMode(!isSignUpMode)} 
                  style={{ background: 'none', border: 'none', color: '#07aadb', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {isSignUpMode ? 'すでにアカウントをお持ちの方（ログイン）' : 'まだアカウントをお持ちでない方（新規登録）'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#cbd5e1', fontSize: '0.7rem' }}>
        <p>© 2026 Solopreneur Portal SOLO</p>
      </div>
    </div>
  );
}

export default Home;