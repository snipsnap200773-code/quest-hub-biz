import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { Clock, Calendar, CheckCircle2 } from 'lucide-react';

const ScheduleSettingsGuide = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [businessHours, setBusinessHours] = useState({});

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', shopId).single();
      if (data) setBusinessHours(data.business_hours || {});
    };
    if (shopId) fetch();
  }, [shopId]);

  const saveAndExit = async () => {
    await supabase.from('profiles').update({ business_hours: businessHours }).eq('id', shopId);
    navigate(`/admin/${shopId}/dashboard`);
  };

  const containerStyle = { minHeight: '100vh', background: '#0f172a', color: '#fff', padding: '40px 20px', fontFamily: 'sans-serif', boxSizing: 'border-box' };
  const cardStyle = { maxWidth: '500px', margin: '0 auto', textAlign: 'center' };
  const inputStyle = { padding: '12px', borderRadius: '8px', background: '#1e293b', border: '2px solid #334155', color: '#fff', fontSize: '1rem', width: '100px' };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <Clock size={48} style={{ marginBottom: '20px', color: '#f59e0b' }} />
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>営業時間を設定しましょう。</h2>
        <p style={{ color: '#94a3b8', marginBottom: '30px' }}>基本の営業時間を入力してください。</p>
        
        {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => (
          <div key={day} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px', background: '#1e293b', borderRadius: '12px', marginBottom: '10px' }}>
            <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{day}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="time" value={businessHours[day]?.open || '09:00'} onChange={e => setBusinessHours({...businessHours, [day]: {...businessHours[day], open: e.target.value}})} style={inputStyle} />
              <span>~</span>
              <input type="time" value={businessHours[day]?.close || '18:00'} onChange={e => setBusinessHours({...businessHours, [day]: {...businessHours[day], close: e.target.value}})} style={inputStyle} />
            </div>
          </div>
        ))}
        
        <button style={{ width: '100%', padding: '18px', borderRadius: '40px', background: '#10b981', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '1rem', marginTop: '20px', cursor: 'pointer' }} onClick={saveAndExit}>
          営業時間を保存して完了！ <CheckCircle2 size={18} style={{ marginLeft: '8px' }} />
        </button>
      </div>
    </div>
  );
};

export default ScheduleSettingsGuide;