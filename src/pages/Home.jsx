import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { MapPin, User, LogIn, Heart, Calendar, LogOut, X, Mail } from 'lucide-react'; 

function Home() {
  const [shops, setShops] = useState([]);
  const [newShops, setNewShops] = useState([]); 
  const [currentSlide, setCurrentSlide] = useState(0);
  
  // DBから取得するデータを保持するState
  const [topics, setTopics] = useState([]);
  const [categoryList, setCategoryList] = useState([]);

  // 🆕 ログイン・ユーザー管理用のState
  const [user, setUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [favorites, setFavorites] = useState([]); // お気に入り店舗用（将来用）

  const sliderImages = [
    { id: 1, url: 'https://images.unsplash.com/photo-1600880210836-8f8fe100a35c?auto=format&fit=crop&w=1200&q=80', title: '自分らしく、働く。', desc: 'Solopreneurを支えるポータルサイト' },
    { id: 2, url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80', title: '次世代の予約管理', desc: 'SOLOでビジネスを加速させる' },
    { id: 3, url: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80', title: '新しい繋がりを。', desc: 'あなたのサービスを世界へ届けよう' },
  ];

  useEffect(() => {
    const scrollTimer = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, 100);

    const sliderTimer = setInterval(() => {
      setCurrentSlide((prev) => (prev === sliderImages.length - 1 ? 0 : prev + 1));
    }, 5000);

    // 🆕 ログイン状態の取得と監視
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };
    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session) setIsModalOpen(false); // ログイン成功時にモーダルを閉じる
    });

    const fetchPortalData = async () => {
      // 1. 店舗データの取得
      const shopRes = await supabase
        .from('profiles')
        .select('*')
        .eq('is_suspended', false)
        .not('business_name', 'is', null);
      
      if (shopRes.data) {
        const latest = [...shopRes.data]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 3);
        setNewShops(latest);
        setShops(shopRes.data);
      }

      // 2. ニュース（最新トピック）の取得
      const newsRes = await supabase
        .from('portal_news')
        .select('*')
        .order('sort_order', { ascending: true });
      if (newsRes.data) setTopics(newsRes.data);

      // 3. カテゴリデータの取得
      const catRes = await supabase
        .from('portal_categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (catRes.data) setCategoryList(catRes.data);
    };

    fetchPortalData();
    return () => {
      clearTimeout(scrollTimer);
      clearInterval(sliderTimer);
      authListener.subscription.unsubscribe(); // 監視解除
    };
  }, []);

  // 🆕 認証用関数
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const { error: signUpErr } = await supabase.auth.signUp({ email, password });
      if (signUpErr) alert("エラー: " + signUpErr.message);
      else alert("確認メールを送信しました。");
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) alert(error.message);
  };

  const handleLineLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'line' });
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
                <img src={user.user_metadata?.avatar_url || 'https://via.placeholder.com/32'} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #07aadb' }} alt="profile" />
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
        
        {/* 🆕 ログイン中のユーザー専用ボード */}
        {user && (
          <div style={{ background: 'linear-gradient(135deg, #07aadb 0%, #0284c7 100%)', borderRadius: '16px', padding: '20px', marginBottom: '25px', color: '#fff', boxShadow: '0 8px 20px rgba(7, 170, 219, 0.2)' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>
              こんにちは、{user.user_metadata?.full_name || 'ゲスト'} 様
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
        {user && (
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

        {/* 5. カテゴリグリッド */}
        <div style={{ marginBottom: '50px' }}>
          <div style={{ borderLeft: '4px solid #1e293b', paddingLeft: '15px', marginBottom: '25px' }}>
            <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '900', color: '#1e293b' }}>FIND YOUR SERVICE</h3>
            <p style={{ margin: '5px 0 0 0', fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold' }}>カテゴリーから探す</p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
            {categoryList.map((cat) => (
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

      {/* 🆕 ログインモーダル */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '400px', borderRadius: '24px', padding: '35px', position: 'relative', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} color="#999" /></button>
            <h2 style={{ textAlign: 'center', fontSize: '1.4rem', marginBottom: '30px', fontWeight: '900', color: '#1a1a1a' }}>SOLOにログイン</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button onClick={handleLineLogin} style={{ background: '#06C755', color: '#fff', border: 'none', padding: '14px', borderRadius: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', fontSize: '1rem' }}>
                <span style={{ fontSize: '1.2rem' }}>LINE</span> LINEでログイン
              </button>
              <button onClick={handleGoogleLogin} style={{ background: '#fff', color: '#333', border: '1px solid #ddd', padding: '14px', borderRadius: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', fontSize: '1rem' }}>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" alt="G" /> Googleでログイン
              </button>

              <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
                <div style={{ flex: 1, height: '1px', background: '#eee' }}></div>
                <span style={{ padding: '0 15px', fontSize: '0.75rem', color: '#bbb', fontWeight: 'bold' }}>OR</span>
                <div style={{ flex: 1, height: '1px', background: '#eee' }}></div>
              </div>

              <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input type="email" placeholder="メールアドレス" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: '14px', borderRadius: '12px', border: '1px solid #ddd', fontSize: '1rem' }} required />
                <input type="password" placeholder="パスワード" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: '14px', borderRadius: '12px', border: '1px solid #ddd', fontSize: '1rem' }} required />
                <button type="submit" style={{ background: '#1a1a1a', color: '#fff', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', fontSize: '1rem' }}>
                  メールアドレスで進む
                </button>
              </form>
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