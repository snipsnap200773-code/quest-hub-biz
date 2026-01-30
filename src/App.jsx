import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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

function App() {
  return (
    <Router>
      <Routes>
        {/* ==========================================
            🚀 ワイド表示・管理エリア
            (mobile-containerの外に配置することで全幅表示を可能にします)
            ========================================== */}
        <Route path="/admin/:shopId/management" element={<AdminManagement />} />
        
        <Route path="/super-admin-216-midote-snipsnap-dmaaaahkmm" element={<SuperAdmin />} />
        
        <Route path="/admin/:shopId" element={<AdminDashboard />} />
        <Route path="/admin/:shopId/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/:shopId/reservations" element={<AdminReservations />} />

        {/* ==========================================
            📱 ユーザーエリア（スマホサイズ制限コンテナ）
            ========================================== */}
        <Route path="*" element={
          <div className="mobile-container" style={{ margin: '0 auto', maxWidth: '480px' }}>
            <Routes>
              {/* ✅ ポータル化した新しいHomeがトップページになります */}
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
              
              {/* 💡 ここにあった /admin/:shopId/management は 
                     上の「管理エリア」に引っ越しました。
              */}
            </Routes>
          </div>
        } />
      </Routes>
    </Router>
  );
}

export default App;