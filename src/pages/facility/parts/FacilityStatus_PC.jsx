import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { 
  CheckCircle2, Clock, XCircle, Users, 
  ChevronDown, ChevronUp, Scissors, Calendar, Activity, Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FacilityStatus_PC = ({ facilityId }) => {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { fetchVisits(); }, [facilityId]);

  const fetchVisits = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('visit_requests')
      .select(`
        *,
        profiles (business_name, theme_color, phone_contact),
        visit_request_residents (
          id, status, menu_name,
          members (name, room, floor)
        )
      `)
      .eq('facility_user_id', facilityId)
      .neq('status', 'canceled')
      .order('scheduled_date', { ascending: false });

    if (!error) {
      setVisits(data || []);
      if (data.length > 0) setExpandedId(data[0].id);
    }
    setLoading(false);
  };

  if (loading) return <div style={centerStyle}>読み込み中...</div>;

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <h2 style={titleStyle}><Activity size={24} /> 現在の訪問・進捗状況</h2>
        <p style={descStyle}>当日の施術進捗は、美容室スタッフがリアルタイムで更新しています。</p>
      </header>
      
      {visits.length === 0 ? (
        <div style={emptyCard}>現在、確定した予約はありません。</div>
      ) : (
        <div style={listContainer}>
          {visits.map((visit) => {
            const residents = visit.visit_request_residents || [];
            const doneCount = residents.filter(r => r.status === 'completed').length;
            const totalCount = residents.length;
            const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

            return (
              <div key={visit.id} style={visitCard(visit.id === expandedId)}>
                <div style={cardHeader} onClick={() => setExpandedId(visit.id === expandedId ? null : visit.id)}>
                  <div style={dateBox}>
                    <Calendar size={18} />
                    <strong>{visit.scheduled_date.replace(/-/g, '/')}</strong>
                    <span style={timeText}>{(visit.start_time || '09:00').substring(0,5)}〜</span>
                  </div>

                  <div style={shopLabel}>
                    <Scissors size={14} color={visit.profiles?.theme_color} />
                    <span>{visit.profiles?.business_name}</span>
                    <a href={`tel:${visit.profiles?.phone_contact}`} style={phoneLink}><Phone size={12} /> 連絡</a>
                  </div>

                  <div style={progressArea}>
                    <div style={countBadge(progress === 100)}>
                      {doneCount} / {totalCount} 名 完了
                    </div>
                    {visit.id === expandedId ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                <div style={progressBarBg}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} style={progressBar(visit.profiles?.theme_color || '#c5a059')} />
                </div>

                <AnimatePresence>
                  {visit.id === expandedId && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                      <div style={residentGrid}>
                        {residents.map((res) => (
                          <div key={res.id} style={resRow(res.status)}>
                            <div style={resMain}>
                              <div style={statusIcon(res.status)}>
                                {res.status === 'completed' ? <CheckCircle2 size={18} /> : res.status === 'cancelled' ? <XCircle size={18} /> : <Clock size={18} />}
                              </div>
                              <div>
                                <div style={resName}>{res.members?.name} 様</div>
                                <div style={resInfo}>{res.members?.floor}F {res.members?.room} | {res.menu_name}</div>
                              </div>
                            </div>
                            <div style={statusLabel(res.status)}>
                              {res.status === 'completed' ? '施術完了' : res.status === 'pending' ? '待機中' : '本日中止'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- スタイルは閲覧用に一部調整 ---
const containerStyle = { maxWidth: '1000px', margin: '0 auto', padding: '20px' };
const headerStyle = { marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '15px' };
const titleStyle = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.4rem', fontWeight: '900', color: '#3d2b1f', margin: 0 };
const descStyle = { fontSize: '0.85rem', color: '#64748b', marginTop: '8px' };
const listContainer = { display: 'flex', flexDirection: 'column', gap: '15px' };
const visitCard = (active) => ({ background: '#fff', borderRadius: '20px', border: active ? '2px solid #3d2b1f' : '1px solid #eee', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' });
const cardHeader = { padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: '15px' };
const dateBox = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem' };
const timeText = { color: '#64748b', fontSize: '0.9rem', background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' };
const shopLabel = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: '#475569' };
const phoneLink = { display: 'flex', alignItems: 'center', gap: '4px', color: '#3d2b1f', textDecoration: 'none', fontSize: '0.75rem', border: '1px solid #ddd', padding: '2px 8px', borderRadius: '5px' };
const progressArea = { display: 'flex', alignItems: 'center', gap: '12px' };
const countBadge = (isDone) => ({ background: isDone ? '#10b981' : '#3d2b1f', color: '#fff', padding: '6px 15px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold' });
const progressBarBg = { height: '6px', background: '#f1f5f9', width: '100%' };
const progressBar = (color) => ({ height: '100%', background: color });
const residentGrid = { padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', background: '#fcfaf7' };
const resRow = (status) => ({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', borderRadius: '12px', background: '#fff', border: `1px solid ${status === 'completed' ? '#10b981' : '#e2e8f0'}`, opacity: status === 'cancelled' ? 0.6 : 1 });
const resMain = { display: 'flex', alignItems: 'center', gap: '12px' };
const statusIcon = (status) => ({ color: status === 'completed' ? '#10b981' : status === 'cancelled' ? '#ef4444' : '#cbd5e1' });
const resName = { fontWeight: 'bold', fontSize: '1rem', color: '#1e293b' };
const resInfo = { fontSize: '0.75rem', color: '#64748b', marginTop: '2px' };
const statusLabel = (status) => ({ fontSize: '0.7rem', fontWeight: '900', color: status === 'completed' ? '#059669' : status === 'cancelled' ? '#dc2626' : '#94a3b8' });
const centerStyle = { textAlign: 'center', padding: '100px', color: '#64748b' };
const emptyCard = { textAlign: 'center', padding: '60px', background: '#fff', borderRadius: '20px', color: '#94a3b8', border: '1px dashed #e2e8f0' };

export default FacilityStatus_PC;