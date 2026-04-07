import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WifiOff } from 'lucide-react';

// 既存のインポート
import Home from './pages/Home';
import ReservationForm from './pages/ReservationForm';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdmin from './pages/SuperAdmin'; 
import TimeSelection from './pages/TimeSelection'; 
// 🆕 新しいカレンダー版をインポート
import TimeSelectionCalendar from './pages/TimeSelectionCalendar'; 
import ConfirmReservation from './pages/ConfirmReservation';
import AdminReservations from './pages/AdminReservations';
import TrialRegistration from './pages/TrialRegistration';
import CancelReservation from './pages/CancelReservation';
import ShopList from './pages/ShopList';
import AdminManagement from './pages/AdminManagement';
import ShopDetail from './pages/ShopDetail';
import AdminTimeline from './pages/AdminTimeline';
import InitialSetup from './pages/InitialSetup';

// 🆕 QUEST HUB 個別設定ページ
import BasicSettings from './pages/admin/settings/BasicSettings';
import MenuSettings from './pages/admin/settings/MenuSettings';
import ScheduleSettings from './pages/admin/settings/ScheduleSettings';
import LineSettings from './pages/admin/settings/LineSettings';
import GeneralSettings from './pages/admin/settings/GeneralSettings';
import EmailSettings from './pages/admin/settings/EmailSettings';
import StaffSettings from './pages/admin/settings/StaffSettings';
import FormCustomizer from './pages/admin/settings/FormCustomizer';
// ✅ 追加：新しい汎用トリガーページをインポート [cite: 2026-03-01]
import TodayTasks from './pages/admin/settings/TodayTasks'; 

// ✨ 案内人（ガイド）
import BasicSettingsGuide from './pages/admin/settings/BasicSettingsGuide';
import MenuSettingsGuide from './pages/admin/settings/MenuSettingsGuide';
import ScheduleSettingsGuide from './pages/admin/settings/ScheduleSettingsGuide';

// ✨ 施設用
import FacilityManagement from './pages/admin/FacilityManagement';
import FacilityLogin from './pages/facility/FacilityLogin';
import FacilityPortal from './pages/facility/FacilityPortal';

// ✨ 施設用タスク
import AdminFacilityVisit_PC from './pages/AdminFacilityVisit_PC';

// 🆕 施設又は業者検索・申請画面をインポート
import FacilitySearch from './components/FacilitySearch';
import ShopSearch from './components/ShopSearch';

// 🔝 自動スクロール装置
import ScrollToTop from './components/ScrollToTop';

// 🚀 🆕 お問い合わせフォームをインポート
import InquiryForm from './components/InquiryForm';

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
      <ScrollToTop />

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
        {/* ✅ 追加：今日のタスク画面（汎用トリガー）へのルート [cite: 2026-03-06] */}
        <Route path="/admin/:shopId/today-tasks" element={<TodayTasks />} />

        {/* --- 🆕 QUEST HUB 個別設定ルート --- */}
        <Route path="/admin/:shopId/settings/basic" element={<BasicSettings />} />
        <Route path="/admin/:shopId/settings/staff" element={<StaffSettings />} />
        <Route path="/admin/:shopId/settings/menu" element={<MenuSettings />} />
        <Route path="/admin/:shopId/settings/schedule" element={<ScheduleSettings />} />
        <Route path="/admin/:shopId/settings/email" element={<EmailSettings />} />
        <Route path="/admin/:shopId/settings/line" element={<LineSettings />} />
        <Route path="/admin/:shopId/settings/general" element={<GeneralSettings />} />
        <Route path="/admin/:shopId/settings/form" element={<FormCustomizer />} />

        {/* 🆕 施設又は業者を探す・提携申請を送る画面へのルートを追加 */}
        <Route path="/admin/:shopId/facility-search" element={<FacilitySearch />} />
        <Route path="/facility-portal/:facilityId/find-shops" element={<ShopSearch />} />

        {/* 召喚された案内人（ガイド）用 */}
        <Route path="/admin/:shopId/settings/basic-guide" element={<BasicSettingsGuide />} />
        <Route path="/admin/:shopId/settings/menu-guide" element={<MenuSettingsGuide />} />
        <Route path="/admin/:shopId/settings/schedule-guide" element={<ScheduleSettingsGuide />} />

        {/* 施設用 */}
        <Route path="/admin/:shopId/facilities" element={<FacilityManagement />} />
        <Route path="/facility-login/:facilityId" element={<FacilityLogin />} /> {/* 🆕 */}
        <Route path="/facility-portal/:facilityId/residents" element={<FacilityPortal />} />

{/* 施設用タスク */}
        <Route 
  path="/admin/:shopId/visit-requests/:visitId" 
  element={<AdminFacilityVisit_PC />} 
/>

{/* --- 📱 ログイン・認証エリア --- */}
        <Route path="*" element={
  <div className="mobile-container" style={{ margin: '0 auto', maxWidth: '480px', minHeight: '100vh', position: 'relative' }}>
    <Routes>
      {/* 起動時は Home ではなくログイン画面を表示 */}
      <Route path="/" element={<FacilityLogin />} /> 
      
      {/* ログイン後の遷移先（一例） */}
      <Route path="/admin/:shopId/dashboard" element={<AdminDashboard />} />
      <Route path="/super-admin" element={<SuperAdmin />} />
    </Routes>
  </div>
} />
      </Routes>
    </Router>
  );
}

export default App;