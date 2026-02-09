import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WifiOff } from 'lucide-react';

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

// 🆕 QUEST HUB 個別設定ページ
import BasicSettings from './pages/admin/settings/BasicSettings';
import MenuSettings from './pages/admin/settings/MenuSettings';
import ScheduleSettings from './pages/admin/settings/ScheduleSettings';
import LineSettings from './pages/admin/settings/LineSettings';
import GeneralSettings from './pages/admin/settings/GeneralSettings';
import EmailSettings from './pages/admin/settings/EmailSettings';
import StaffSettings from './pages/admin/settings/StaffSettings';

// ✨ 案内人（ガイド）
import BasicSettingsGuide from './pages/admin/settings/BasicSettingsGuide';
import MenuSettingsGuide from './pages/admin/settings/MenuSettingsGuide';
import ScheduleSettingsGuide from './pages/admin/settings/ScheduleSettingsGuide';

// 🔝 自動スクロール装置（今作ったやつ）
import ScrollToTop from './components/ScrollToTop'; // ✅ 追加

function App() {
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
      <ScrollToTop /> {/* ✅ ここに設置！これで全ページ「常に一番上」から始まります */}

      {!isOnline && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: '#ef4444', color: 'white', textAlign: 'center', padding: '8px', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <WifiOff size={16} /> ネットワークが不安定です。一部の機能が制限される可能性があります。
        </div>
      )}

      <Routes>
        {/* --- 🚀 管理エリア --- */}
        <Route path="/super-admin-216-midote-snipsnap-dmaaaahkmm" element={<SuperAdmin />} />
        <Route path="/admin/:shopId/management" element={<AdminManagement />} />
        <Route path="/admin/:shopId/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/:shopId" element={<AdminDashboard />} />
        <Route path="/admin/:shopId/reservations" element={<AdminReservations />} />

        {/* --- 🆕 QUEST HUB 個別設定ルート --- */}
        <Route path="/admin/:shopId/settings/basic" element={<BasicSettings />} />
        <Route path="/admin/:shopId/settings/staff" element={<StaffSettings />} />
        <Route path="/admin/:shopId/settings/menu" element={<MenuSettings />} />
        <Route path="/admin/:shopId/settings/schedule" element={<ScheduleSettings />} />
        <Route path="/admin/:shopId/settings/email" element={<EmailSettings />} />
        <Route path="/admin/:shopId/settings/line" element={<LineSettings />} />
        <Route path="/admin/:shopId/settings/general" element={<GeneralSettings />} />

        {/* 召喚された案内人（ガイド）用 */}
        <Route path="/admin/:shopId/settings/basic-guide" element={<BasicSettingsGuide />} />
        <Route path="/admin/:shopId/settings/menu-guide" element={<MenuSettingsGuide />} />
        <Route path="/admin/:shopId/settings/schedule-guide" element={<ScheduleSettingsGuide />} />

        {/* --- 📱 ユーザーエリア --- */}
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