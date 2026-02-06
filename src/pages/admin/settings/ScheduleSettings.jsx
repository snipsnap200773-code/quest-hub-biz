import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { 
  Clock, Calendar, Save, Zap, ArrowLeft, Sparkles 
} from 'lucide-react';

const ScheduleSettings = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();

  // --- 1. State 管理 (本家ロジック完全継承) ---
  const [message, setMessage] = useState('');
  const [shopData, setShopData] = useState(null);
  const [businessHours, setBusinessHours] = useState({});
  const [regularHolidays, setRegularHolidays] = useState({});
  
  const [bufferPreparationMin, setBufferPreparationMin] = useState(0);
  const [minLeadTimeHours, setMinLeadTimeHours] = useState(0);
  const [autoFillLogic, setAutoFillLogic] = useState(true);

  const dayMap = { mon: '月曜日', tue: '火曜日', wed: '水曜日', thu: '木曜日', fri: '金曜日', sat: '土曜日', sun: '日曜日' };
  const weekLabels = [
    { key: '1', label: '第1' }, { key: '2', label: '第2' }, { key: '3', label: '第3' },
    { key: '4', label: '第4' }, { key: 'L2', label: '最後から2' }, { key: 'L1', label: '最後' }
  ];

  useEffect(() => {
    if (shopId) fetchScheduleData();
  }, [shopId]);

  const fetchScheduleData = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (data) {
      setShopData(data);
      setBusinessHours(data.business_hours || {});
      setRegularHolidays(data.business_hours?.regular_holidays || {});
      setBufferPreparationMin(data.buffer_preparation_min || 0);
      setMinLeadTimeHours(data.min_lead_time_hours || 0);
      setAutoFillLogic(data.auto_fill_logic ?? true);
    }
  };

  const showMsg = (txt) => { setMessage(txt); setTimeout(() => setMessage(''), 3000); };

  const toggleHoliday = (weekKey, dayKey) => {
    const key = `${weekKey}-${dayKey}`;
    setRegularHolidays(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // --- 💾 保存ロジック (統合版・完全維持) ---
  const handleSave = async () => {
    const updatedBusinessHours = { ...businessHours, regular_holidays: regularHolidays };
    const { error } = await supabase.from('profiles').update({ 
      business_hours: updatedBusinessHours,
      buffer_preparation_min: bufferPreparationMin,
      min_lead_time_hours: minLeadTimeHours,
      auto_fill_logic: autoFillLogic
    }).eq('id', shopId);

    if (!error) showMsg('全スケジュール設定を保存しました！');
    else alert('保存に失敗しました。');
  };

  const themeColor = shopData?.theme_color || '#2563eb';
  
  // --- スタイル定義 ---
  const containerStyle = { width: '100%', maxWidth: '700px', margin: '0 auto', padding: '20px', paddingBottom: '120px', boxSizing: 'border-box', fontFamily: 'sans-serif', position: 'relative' };
  const cardStyle = { marginBottom: '20px', background: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxSizing: 'border-box', width: '100%', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
  const inputStyle = { padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', background: '#fff', width: '90px', boxSizing: 'border-box' };
  const selectStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem', background: '#fff' };

  return (
    <div style={containerStyle}>
      {/* 🔔 通知メッセージ */}
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '12px', zIndex: 1001, textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}>
          {message}
        </div>
      )}

      {/* 🚀 ナビゲーションヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <button 
          onClick={() => navigate(`/admin/${shopId}/dashboard`)}
          style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '10px 16px', borderRadius: '30px', fontSize: '0.85rem', fontWeight: 'bold', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
        >
          <ArrowLeft size={16} /> ダッシュボードへ
        </button>

        <button 
          onClick={() => navigate(`/admin/${shopId}/settings/schedule-guide`)}
          style={{ background: themeColor, border: 'none', padding: '10px 20px', borderRadius: '30px', fontSize: '0.85rem', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: `0 4px 12px ${themeColor}44` }}
        >
          <Sparkles size={16} /> 案内人を召喚
        </button>
      </div>

      <h2 style={{ fontSize: '1.4rem', color: '#1e293b', marginBottom: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
        営業時間・予約制限の設定
      </h2>

      {/* ⏰ 曜日別営業時間・休憩 */}
      <section style={cardStyle}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: '#1e293b', marginBottom: '20px' }}>
          <Clock size={22} color={themeColor} /> 曜日別営業時間・休憩
        </h3>
        {Object.keys(dayMap).map(day => (
          <div key={day} style={{ borderBottom: '1px solid #f1f5f9', padding: '15px 0' }}>
            <b style={{ fontSize: '0.95rem', color: '#1e293b', display: 'block', marginBottom: '12px' }}>{dayMap[day]}</b>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: '#f8fafc', borderRadius: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', width: '35px', color: '#64748b', fontWeight: 'bold' }}>営業</span>
                <input type="time" value={businessHours[day]?.open || '09:00'} onChange={(e) => setBusinessHours({...businessHours, [day]: {...businessHours[day], open: e.target.value}})} style={inputStyle} />
                <span style={{ color: '#cbd5e1' }}>〜</span>
                <input type="time" value={businessHours[day]?.close || '18:00'} onChange={(e) => setBusinessHours({...businessHours, [day]: {...businessHours[day], close: e.target.value}})} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', width: '35px', color: '#64748b', fontWeight: 'bold' }}>休憩</span>
                <input type="time" value={businessHours[day]?.rest_start || ''} onChange={(e) => setBusinessHours({...businessHours, [day]: { ...businessHours[day], rest_start: e.target.value }})} style={inputStyle} />
                <span style={{ color: '#cbd5e1' }}>〜</span>
                <input type="time" value={businessHours[day]?.rest_end || ''} onChange={(e) => setBusinessHours({...businessHours, [day]: { ...businessHours[day], rest_end: e.target.value }})} style={inputStyle} />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* ⚙️ 予約受付ルールの詳細 */}
      <section style={{ ...cardStyle, border: `2px solid ${themeColor}` }}>
        <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: themeColor, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Zap size={22} /> 予約受付ルールの詳細
        </h3>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px', fontSize: '0.85rem', color: '#334155' }}>インターバル（準備時間）</label>
          <select value={bufferPreparationMin} onChange={(e) => setBufferPreparationMin(parseInt(e.target.value))} style={selectStyle}>
            <option value={0}>なし</option>
            {[10, 15, 20, 30].map(m => <option key={m} value={m}>{m}分</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px', fontSize: '0.85rem', color: '#334155' }}>直近の予約制限（何時間前まで受付可能か）</label>
          <select value={minLeadTimeHours} onChange={(e) => setMinLeadTimeHours(parseInt(e.target.value))} style={selectStyle}>
            <option value={0}>当日OK</option>
            <option value={2}>2時間先NG</option>
            <option value={3}>3時間先NG</option>
            <option value={24}>当日NG</option>
            <option value={48}>翌日までNG</option>
            <option value={72}>翌々日までNG</option>
          </select>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '10px' }}>
          <input type="checkbox" checked={autoFillLogic} onChange={(e) => setAutoFillLogic(e.target.checked)} style={{ width: '22px', height: '22px' }} />
          <b style={{ fontSize: '0.95rem', color: '#334155' }}>自動詰め機能を有効にする</b>
        </label>
      </section>

      {/* 📅 定休日の設定 */}
      <section style={{ ...cardStyle, border: '1px solid #fee2e2' }}>
        <h3 style={{ marginTop: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', marginBottom: '20px' }}>
          <Calendar size={22} /> 定休日の詳細設定
        </h3>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '15px' }}>※表を左右にスワイプして全曜日を確認できます</p>
        
        <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch', marginBottom: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '400px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <th style={{ padding: '12px 8px', fontSize: '0.75rem', color: '#94a3b8', textAlign: 'left' }}>週</th>
                {Object.keys(dayMap).map(d => <th key={d} style={{ padding: '12px 8px', fontSize: '0.85rem', color: '#1e293b' }}>{dayMap[d].charAt(0)}</th>)}
              </tr>
            </thead>
            <tbody>
              {weekLabels.map(week => (
                <tr key={week.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 0', fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b', whiteSpace: 'nowrap' }}>{week.label}</td>
                  {Object.keys(dayMap).map(day => {
                    const isActive = regularHolidays[`${week.key}-${day}`];
                    return (
                      <td key={day} style={{ padding: '6px', textAlign: 'center' }}>
                        <button 
                          onClick={() => toggleHoliday(week.key, day)} 
                          style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #eee', background: isActive ? '#ef4444' : '#fff', color: isActive ? '#fff' : '#cbd5e1', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', transition: '0.2s', boxShadow: isActive ? '0 4px 10px rgba(239,68,68,0.3)' : 'none' }}
                        >
                          {isActive ? '休' : '◯'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '10px', padding: '16px', background: '#fef2f2', borderRadius: '16px', border: '1px dashed #fca5a5' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#991b1b', flex: 1 }}>定休日が祝日の場合は営業する</span>
            <div 
              onClick={() => setRegularHolidays(prev => ({...prev, open_on_holiday: !prev.open_on_holiday}))} 
              style={{ width: '50px', height: '28px', background: regularHolidays.open_on_holiday ? '#10b981' : '#cbd5e1', borderRadius: '20px', position: 'relative', transition: '0.3s' }}
            >
              <div style={{ position: 'absolute', top: '2px', left: regularHolidays.open_on_holiday ? '24px' : '2px', width: '24px', height: '24px', background: '#fff', borderRadius: '50%', transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
            </div>
          </label>
        </div>
      </section>

      {/* 💾 保存ボタン */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '24px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderTop: '1px solid #e2e8f0', zIndex: 1000 }}>
        <button 
          onClick={handleSave} 
          style={{ width: '100%', maxWidth: '500px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '18px', background: themeColor, color: '#fff', border: 'none', borderRadius: '50px', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: `0 10px 25px ${themeColor}66`, cursor: 'pointer' }}
        >
          <Save size={22} /> スケジュールを保存する 💾
        </button>
      </div>
    </div>
  );
};

export default ScheduleSettings;