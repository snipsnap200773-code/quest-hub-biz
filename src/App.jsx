import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WifiOff } from 'lucide-react'; // オフラインアイコン用

// 既存のインポート
import Home from './pages/Home';
import ReservationForm from './pages/ReservationForm';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdmin from './pages/SuperAdmin'; 
import TimeSelection from './pages/TimeSelection'; 
import ConfirmReservation from './pages/ConfirmReservation';
import AdminReservations from './pages/AdminReservations';
import TrialRegistration from './pages/TrialRegistration';
import CancelReservation from './pages/CancelReservation';
import ShopList from './pages/ShopList';
import AdminManagement from './pages/AdminManagement';
import ShopDetail from './pages/ShopDetail';

// 🆕 QUEST HUB 用の個別設定ページ
import BasicSettings from './pages/admin/settings/BasicSettings';
import MenuSettings from './pages/admin/settings/MenuSettings'; // 次に作るページ

function App() {
  // 🛰️ ネットワーク状態の監視ステート
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <Router>
      {/* 📡 オフラインバナー：ネットが切れた時に上部に表示 */}
      {!isOnline && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#ef4444', color: 'white', textAlign: 'center',
          padding: '8px', fontSize: '14px', fontWeight: 'bold',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
        }}>
          <WifiOff size={16} /> ネットワークが不安定です。一部の機能が制限される可能性があります。
        </div>
      )}

      <Routes>
        {/* ==========================================
            🚀 ワイド表示・管理エリア
            ========================================== */}
        <Route path="/admin/:shopId/management" element={<AdminManagement />} />
        <Route path="/super-admin-216-midote-snipsnap-dmaaaahkmm" element={<SuperAdmin />} />
        <Route path="/admin/:shopId" element={<AdminDashboard />} />
        <Route path="/admin/:shopId/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/:shopId/reservations" element={<AdminReservations />} />

        {/* 🆕 QUEST HUB 個別設定ルート */}
        <Route path="/admin/:shopId/settings/basic" element={<BasicSettings />} />
        <Route path="/admin/:shopId/settings/menu" element={<MenuSettings />} />

        {/* ==========================================
            📱 ユーザーエリア（スマホサイズ制限コンテナ）
            ========================================== */}
        <Route path="*" element={
          <div className="mobile-container" style={{ margin: '0 auto', maxWidth: '480px', minHeight: '100vh', position: 'relative' }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/category/:categoryId" element={<ShopList />} />
              <Route path="/trial-registration" element={<TrialRegistration />} />
              <Route path="/shop/:shopId/detail" element={<ShopDetail />} />
              <Route path="/shop/:shopId" element={<ReservationForm />} /> 
              <Route path="/shop/:shopId/reserve" element={<ReservationForm />} />
              <Route path="/shop/:shopId/reserve/time" element={<TimeSelection />} />
              <Route path="/shop/:shopId/confirm" element={<ConfirmReservation />} />
              <Route path="/cancel" element={<CancelReservation />} />
              <Route path="/shop/:shopId/admin" element={<AdminDashboard />} />
            </Routes>
          </div>
        } />
      </Routes>
    </Router>
  );
}

export default App;