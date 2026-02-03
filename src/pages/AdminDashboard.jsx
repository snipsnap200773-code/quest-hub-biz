import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from "../supabaseClient";
import { 
  Settings, Menu as MenuIcon, Clock, ClipboardList, 
  ExternalLink, MessageCircle, MapPin, Sparkles
} from 'lucide-react';

const AdminDashboard = () => {
  const { shopId } = useParams();
  const [shopData, setShopData] = useState(null);

  useEffect(() => {
    if (shopId) fetchShopData();
  }, [shopId]);

  const fetchShopData = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (data) setShopData(data);
  };

  const themeColor = shopData?.theme_color || '#2563eb';

  // --- スタイル定義 ---
  const containerStyle = { maxWidth: '900px', margin: '0 auto', padding: '20px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'sans-serif' };
  const headerStyle = { marginBottom: '30px', borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' };
  const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' };
  
  const cardStyle = { 
    background: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', 
    display: 'flex', flexDirection: 'column', alignItems: 'center', 
    textAlign: 'center', transition: 'transform 0.2s', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' 
  };
  
  const iconBoxStyle = (color) => ({ 
    width: '64px', height: '64px', borderRadius: '16px', 
    background: `${color}10`, color: color, 
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' 
  });

  return (
    <div style={containerStyle}>
      {/* ヘッダーエリア */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b', fontWeight: 'bold' }}>
              {shopData?.business_name || '読込中...'}
            </h1>
            <p style={{ margin: '5px 0 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold', letterSpacing: '1px' }}>
              QUEST HUB COMMAND CENTER
            </p>
          </div>
          <Link to={`/shop/${shopId}/reserve`} target="_blank" style={{ fontSize: '0.8rem', color: themeColor, textDecoration: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
            お客様用ページを表示 <ExternalLink size={14} />
          </Link>
        </div>
      </header>

      {/* カードグリッド */}
      <div style={gridStyle}>
        
        {/* 予約台帳（案内人なし） */}
        <NavCard 
          title="予約台帳" desc="最新予約の確認・手動登録" icon={<ClipboardList size={28} />} color="#10b981"
          to={`/admin/${shopId}/reservations`}
          cardStyle={cardStyle} iconBoxStyle={iconBoxStyle} 
        />

        {/* 店舗情報（案内人あり） */}
        <NavCard 
          title="店舗情報" desc="店名、住所、魔王を倒すサブタイトルなど" icon={<MapPin size={28} />} color="#3b82f6"
          to={`/admin/${shopId}/settings/basic`}
          guideTo={`/admin/${shopId}/settings/basic-guide`}
          cardStyle={cardStyle} iconBoxStyle={iconBoxStyle} 
        />

        {/* メニュー管理（案内人あり） */}
        <NavCard 
          title="メニュー管理" desc="サービス・連動設定の構築" icon={<MenuIcon size={28} />} color="#ec4899"
          to={`/admin/${shopId}/settings/menu`}
          guideTo={`/admin/${shopId}/settings/menu-guide`}
          cardStyle={cardStyle} iconBoxStyle={iconBoxStyle} 
        />

        {/* 営業時間（案内人あり） */}
        <NavCard 
          title="営業時間・休日" desc="1コマの単位・休憩・定休日" icon={<Clock size={28} />} color="#f59e0b"
          to={`/admin/${shopId}/settings/schedule`}
          guideTo={`/admin/${shopId}/settings/schedule-guide`}
          cardStyle={cardStyle} iconBoxStyle={iconBoxStyle} 
        />

        {/* LINE連携（案内人なし） */}
        <NavCard 
          title="LINE連携" desc="通知設定・Messaging API" icon={<MessageCircle size={28} />} color="#00b900"
          to={`/admin/${shopId}/settings/line`}
          cardStyle={cardStyle} iconBoxStyle={iconBoxStyle} 
        />

        {/* 全般設定（案内人なし） */}
        <NavCard 
          title="全般設定" desc="カラー・共有ID・パスワード" icon={<Settings size={28} />} color="#6366f1"
          to={`/admin/${shopId}/settings/general`}
          cardStyle={cardStyle} iconBoxStyle={iconBoxStyle} 
        />

      </div>

      <footer style={{ marginTop: '50px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold' }}>QUEST HUB v1.0.5 - READY FOR ADVENTURE</p>
      </footer>
    </div>
  );
};

// --- サブコンポーネント：NavCard ---
const NavCard = ({ to, guideTo, title, desc, icon, color, cardStyle, iconBoxStyle }) => {
  return (
    <div 
      style={cardStyle}
      onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
      onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <div style={iconBoxStyle(color)}>{icon}</div>
      <h3 style={{ margin: '0 0 8px', color: '#1e293b', fontSize: '1.1rem' }}>{title}</h3>
      <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: '0.75rem', lineHeight: '1.5', minHeight: '3em' }}>{desc}</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: 'auto' }}>
        {/* 自力で設定ボタン */}
        <Link to={to} style={{ 
          textDecoration: 'none', padding: '12px', borderRadius: '10px', 
          background: '#f1f5f9', color: '#475569', fontSize: '0.8rem', 
          fontWeight: 'bold', textAlign: 'center', transition: '0.2s'
        }}>
          自力で設定する
        </Link>
        
        {/* 案内人召喚ボタン（設定がある場合のみ表示） */}
        {guideTo && (
          <Link to={guideTo} style={{ 
            textDecoration: 'none', padding: '12px', borderRadius: '10px', 
            background: color, color: '#fff', fontSize: '0.8rem', 
            fontWeight: 'bold', textAlign: 'center', display: 'flex', 
            alignItems: 'center', justifyContent: 'center', gap: '6px',
            boxShadow: `0 4px 12px ${color}33`
          }}>
            <Sparkles size={14} /> 案内人を召喚
          </Link>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;