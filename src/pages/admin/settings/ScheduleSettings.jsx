import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { Clock, Calendar, Save } from 'lucide-react';

const ScheduleSettings = () => {
  const { shopId } = useParams();

  // --- State 管理 ---
  const [message, setMessage] = useState('');
  const [shopData, setShopData] = useState(null);
  const [businessHours, setBusinessHours] = useState({});
  const [regularHolidays, setRegularHolidays] = useState({});

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
    }
  };

  const showMsg = (txt) => { setMessage(txt); setTimeout(() => setMessage(''), 3000); };

  const toggleHoliday = (weekKey, dayKey) => {
    const key = `${weekKey}-${dayKey}`;
    setRegularHolidays(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    const updatedBusinessHours = { ...businessHours, regular_holidays: regularHolidays };
    const { error } = await supabase.from('profiles').update({ business_hours: updatedBusinessHours }).eq('id', shopId);
    if (!error) showMsg('スケジュール設定を保存しました！');
    else alert('保存に失敗しました。');
  };

  // --- 📱 モバイル対応スタイル定義 ---
  const themeColor = shopData?.theme_color || '#2563eb';
  const containerStyle = { width: '100%', maxWidth: '700px', margin: '0 auto', padding: '15px', paddingBottom: '120px', boxSizing: 'border-box', fontFamily: 'sans-serif' };
  const cardStyle = { marginBottom: '20px', background: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid #ddd', boxSizing: 'border-box', width: '100%', overflow: 'hidden' };
  const inputStyle = { padding: '8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '1rem', background: '#fff', width: '90px', boxSizing: 'border-box' };

  return (
    <div style={containerStyle}>
      {message && <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '8px', zIndex: 1001, textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>{message}</div>}

      <h2 style={{ fontSize: '1.2rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Calendar size={24} /> 営業スケジュール
      </h2>

      {/* ⏰ 曜日別営業時間・休憩 */}
      <section style={cardStyle}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}><Clock size={20} /> 曜日別営業時間・休憩</h3>
        {Object.keys(dayMap).map(day => (
          <div key={day} style={{ borderBottom: '1px solid #f1f5f9', padding: '15px 0' }}>
            <b style={{ fontSize: '0.95rem', color: '#1e293b', display: 'block', marginBottom: '10px' }}>{dayMap[day]}</b>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
              {/* 営業時間の並び：スマホで折れ曲がらないように調整 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', width: '30px', color: '#64748b', fontWeight: 'bold' }}>営業</span>
                <input type="time" value={businessHours[day]?.open || '09:00'} onChange={(e) => setBusinessHours({...businessHours, [day]: {...businessHours[day], open: e.target.value}})} style={inputStyle} />
                <span style={{ color: '#cbd5e1' }}>〜</span>
                <input type="time" value={businessHours[day]?.close || '18:00'} onChange={(e) => setBusinessHours({...businessHours, [day]: {...businessHours[day], close: e.target.value}})} style={inputStyle} />
              </div>

              {/* 休憩時間の並び */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', width: '30px', color: '#64748b', fontWeight: 'bold' }}>休憩</span>
                <input type="time" value={businessHours[day]?.rest_start || ''} onChange={(e) => setBusinessHours({...businessHours, [day]: { ...businessHours[day], rest_start: e.target.value }})} style={inputStyle} />
                <span style={{ color: '#cbd5e1' }}>〜</span>
                <input type="time" value={businessHours[day]?.rest_end || ''} onChange={(e) => setBusinessHours({...businessHours, [day]: { ...businessHours[day], rest_end: e.target.value }})} style={inputStyle} />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* 📅 定休日の設定 */}
      <section style={{ ...cardStyle, border: '2px solid #ef4444' }}>
        <h3 style={{ marginTop: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}><Calendar size={20} /> 定休日の設定</h3>
        <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '10px' }}>※表を左右にスワイプして全曜日を確認できます</p>
        
        <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '400px' }}>
            <thead>
              <tr>
                <th style={{ padding: '8px', fontSize: '0.7rem', color: '#94a3b8', textAlign: 'left' }}>週</th>
                {Object.keys(dayMap).map(d => <th key={d} style={{ padding: '8px', fontSize: '0.8rem' }}>{dayMap[d].charAt(0)}</th>)}
              </tr>
            </thead>
            <tbody>
              {weekLabels.map(week => (
                <tr key={week.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 0', fontSize: '0.65rem', fontWeight: 'bold', color: '#64748b', whiteSpace: 'nowrap' }}>{week.label}</td>
                  {Object.keys(dayMap).map(day => {
                    const isActive = regularHolidays[`${week.key}-${day}`];
                    return (
                      <td key={day} style={{ padding: '4px', textAlign: 'center' }}>
                        <button onClick={() => toggleHoliday(week.key, day)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #eee', background: isActive ? '#ef4444' : '#fff', color: isActive ? '#fff' : '#cbd5e1', fontWeight: 'bold', fontSize: '0.7rem', cursor: 'pointer', transition: '0.2s' }}>
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

        <div style={{ marginTop: '20px', padding: '15px', background: '#fef2f2', borderRadius: '12px', border: '1px dashed #ef4444' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#991b1b', flex: 1 }}>定休日が祝日の場合は営業する</span>
            <div onClick={() => setRegularHolidays(prev => ({...prev, open_on_holiday: !prev.open_on_holiday}))} style={{ width: '50px', height: '28px', background: regularHolidays.open_on_holiday ? '#10b981' : '#cbd5e1', borderRadius: '20px', position: 'relative', transition: '0.3s' }}>
              <div style={{ position: 'absolute', top: '2px', left: regularHolidays.open_on_holiday ? '24px' : '2px', width: '24px', height: '24px', background: '#fff', borderRadius: '50%', transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
            </div>
          </label>
        </div>
      </section>

      {/* 💾 保存ボタン：スマホでも押しやすい位置 */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '20px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderTop: '1px solid #eee', zIndex: 1000 }}>
        <button onClick={handleSave} style={{ width: '100%', maxWidth: '500px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', background: themeColor, color: '#fff', border: 'none', borderRadius: '40px', fontWeight: 'bold', fontSize: '1rem', boxShadow: `0 8px 25px ${themeColor}66`, cursor: 'pointer' }}>
          <Save size={20} /> 設定を保存する 💾
        </button>
      </div>
    </div>
  );
};

export default ScheduleSettings;