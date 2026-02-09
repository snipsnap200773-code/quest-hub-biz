import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from "../supabaseClient";
import { 
  Settings, Menu as MenuIcon, Clock, ClipboardList, 
  ExternalLink, MessageCircle, MapPin, Sparkles, Mail,
  Users
} from 'lucide-react';

const AdminDashboard = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
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
    background: '#fff', padding: '32px 24px', borderRadius: '24px', border: '1px solid #e2e8f0', 
    display: 'flex', flexDirection: 'column', alignItems: 'center', 
    textAlign: 'center', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', cursor: 'pointer',
    textDecoration: 'none', position: 'relative', overflow: 'hidden'
  };
  
  const iconBoxStyle = (color) => ({ 
    width: '64px', height: '64px', borderRadius: '20px', 
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
        
        {/* 予約台帳 */}
        <NavCard 
          title="予約台帳" desc="最新予約の確認・手動登録" icon={<ClipboardList size={28} />} color="#10b981"
          to={`/admin/${shopId}/reservations`}
          cardStyle={cardStyle} iconBoxStyle={iconBoxStyle} 
        />

        {/* スタッフ管理（ここに追加！） */}
        <NavCard 
          title="スタッフ管理" desc="担当者の登録・カラー設定・表示順" icon={<Users size={28} />} color="#f43f5e"
          to={`/admin/${shopId}/settings/staff`}
          cardStyle={cardStyle} iconBoxStyle={iconBoxStyle} 
        />

        {/* 店舗情報 */}
        <NavCard 
          title="店舗情報" desc="店名、住所、サブタイトルなどの基本設定" icon={<MapPin size={28} />} color="#3b82f6"
          to={`/admin/${shopId}/settings/basic`}
          cardStyle={cardStyle} iconBoxStyle={iconBoxStyle} 
        />

        {/* メニュー管理 */}
        <NavCard 
          title="メニュー管理" desc="サービス・連動設定の構築" icon={<MenuIcon size={28} />} color="#ec4899"
          to={`/admin/${shopId}/settings/menu`}
          cardStyle={cardStyle} iconBoxStyle={iconBoxStyle} 
        />

        {/* 営業時間 */}
        <NavCard 
          title="営業時間・休日" desc="1コマの単位・同時予約数・定休日・予約制限" icon={<Clock size={28} />} color="#f59e0b"
          to={`/admin/${shopId}/settings/schedule`}
          cardStyle={cardStyle} iconBoxStyle={iconBoxStyle} 
        />

        {/* メール設定 */}
        <NavCard 
          title="メール設定" desc="予約完了メールを自分らしくカスタマイズ" icon={<Mail size={28} />} color="#8b5cf6"
          to={`/admin/${shopId}/settings/email`}
          cardStyle={cardStyle} iconBoxStyle={iconBoxStyle} 
        />

        {/* LINE連携 */}
        <NavCard 
          title="LINE連携" desc="通知設定・Messaging APIの連携" icon={<MessageCircle size={28} />} color="#00b900"
          to={`/admin/${shopId}/settings/line`}
          cardStyle={cardStyle} iconBoxStyle={iconBoxStyle} 
        />

        {/* 全般設定 */}
        <NavCard 
          title="全般設定" desc="カラー・共有ID・パスワード設定" icon={<Settings size={28} />} color="#6366f1"
          to={`/admin/${shopId}/settings/general`}
          cardStyle={cardStyle} iconBoxStyle={iconBoxStyle} 
        />

      </div>

      <footer style={{ marginTop: '50px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold' }}>QUEST HUB v1.0.6 - READY FOR ADVENTURE</p>
      </footer>
    </div>
  );
};

// --- サブコンポーネント：NavCard (リニューアル版) ---
const NavCard = ({ to, title, desc, icon, color, cardStyle, iconBoxStyle }) => {
  return (
    <Link 
      to={to}
      style={cardStyle}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-8px)';
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.boxShadow = `0 12px 20px -5px ${color}22`;
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = '#e2e8f0';
        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
      }}
    >
      <div style={iconBoxStyle(color)}>{icon}</div>
      <h3 style={{ margin: '0 0 8px', color: '#1e293b', fontSize: '1.2rem', fontWeight: 'bold' }}>{title}</h3>
      <p style={{ margin: '0', color: '#64748b', fontSize: '0.85rem', lineHeight: '1.5' }}>{desc}</p>
      
      {/* 右下の小さな矢印演出 */}
      <div style={{ position: 'absolute', bottom: '20px', right: '20px', color: '#cbd5e1' }}>
        <ChevronRight size={20} />
      </div>
    </Link>
  );
};

// ヘルパー用（ChevronRightが必要なため追加）
const ChevronRight = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
);

export default AdminDashboard;