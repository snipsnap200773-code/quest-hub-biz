import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WifiOff } from 'lucide-react';

// --- 🛍️ 一般・利用者向けページ ---
import Home from './pages/Home';
import ShopList from './pages/ShopList';
import ShopDetail from './pages/ShopDetail';
import InitialSetup from './pages/InitialSetup';
import TrialRegistration from './pages/TrialRegistration';

// --- 📅 予約システム ---
import ReservationForm from './pages/ReservationForm';
import TimeSelectionCalendar from './pages/TimeSelectionCalendar'; 
import ConfirmReservation from './pages/ConfirmReservation';
import CancelReservation from './pages/CancelReservation';

// --- 🛠️ 共通コンポーネント ---
import ShopSearch from './components/ShopSearch';
import InquiryForm from './components/InquiryForm';
import ScrollToTop from './components/ScrollToTop';

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

      {/* オフライン通知 */}
      {!isOnline && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: '#ef4444', color: 'white', textAlign: 'center', padding: '8px', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <WifiOff size={16} /> ネットワークが不安定です。一部の機能が制限される可能性があります。
        </div>
      )}

      <Routes>
        {/* --- 🏠 メイン・ポータル --- */}
        <Route path="/" element={<Home />} />
        <Route path="/category/:categoryName" element={<ShopList />} />
        <Route path="/shop/:shopId/detail" element={<ShopDetail />} />
        <Route path="/search" element={<ShopSearch />} />
        <Route path="/inquiry" element={<InquiryForm />} />

        {/* --- 📅 予約フロー --- */}
        <Route path="/shop/:shopId/reserve" element={<ReservationForm />} />
        <Route path="/shop/:shopId/calendar" element={<TimeSelectionCalendar />} />
        <Route path="/shop/:shopId/confirm" element={<ConfirmReservation />} />
        <Route path="/cancel-reservation" element={<CancelReservation />} />

        {/* --- 🚀 新規登録・初期設定 --- */}
        <Route path="/trial-registration" element={<TrialRegistration />} />
        <Route path="/initial-setup" element={<InitialSetup />} />

        {/* 404ページ代わりのリダイレクト（迷子防止） */}
        <Route path="*" element={<Home />} />
      </Routes>
    </Router>
  );
}

export default App;