import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { 
  CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp, Scissors, Calendar, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FacilityStatus_PC = ({ facilityId }) => {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { fetchVisits(); }, [facilityId]);

  const fetchVisits = async () => {
    setLoading(true);
    
    // 1. 訪問予定を取得
    const { data: visitsData, error: vError } = await supabase
      .from('visit_requests')
      .select(`
        id, scheduled_date, start_time, status, parent_id,
        profiles (business_name, theme_color)
      `)
      .eq('facility_user_id', facilityId)
      .neq('status', 'canceled')
      .order('scheduled_date', { ascending: false });

    if (vError) {
      console.error(vError);
      setLoading(false);
      return;
    }

    // 2. 名簿を一括取得
    const allRelevantIds = visitsData.map(v => v.parent_id || v.id);
    
    const { data: allResidents, error: rError } = await supabase
      .from('visit_request_residents')
      .select('*, members(name, room, floor)') 
      .in('visit_request_id', allRelevantIds);

    if (!rError) {
      // 3. データを加工してセット
      const combinedData = visitsData.map(visit => {
        const targetId = visit.parent_id || visit.id;
        const residents = allResidents.filter(r => r.visit_request_id === targetId);
        return { ...visit, residents };
      });

      setVisits(combinedData);
      
      // 🚀 🆕 【ここを修正！】「今日」の訪問があるか探します
      const todayStr = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD 形式
      const todayVisit = combinedData.find(v => v.scheduled_date === todayStr);

      if (todayVisit) {
        // 今日なら自動で開く
        setExpandedId(todayVisit.id);
      } else {
        // 今日でない（過去や未来の）データなら、最初は閉じておく
        setExpandedId(null);
      }
    }
    setLoading(false);
  };

  // 🆕 日付比較用のヘルパー関数
  const isSameDay = (dateStr1, dateStr2) => {
    if (!dateStr1 || !dateStr2) return false;
    return dateStr1.split('T')[0] === dateStr2.split('T')[0];
  };

  if (loading) return <div style={{textAlign:'center', padding:'100px'}}>読み込み中...</div>;

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <h2 style={titleStyle}><Activity size={24} /> 現在の訪問・進捗状況</h2>
        <p style={descStyle}>複数日にわたる訪問の場合、各日程の実施内容と全体の進捗を共有しています。</p>
      </header>
      
      {visits.length === 0 ? (
        <div style={emptyCard}>現在、確定した予約はありません。</div>
      ) : (
        <div style={listContainer}>
          {visits.map((visit) => {
            const residents = visit.residents || [];
            
            // 🆕 ロジックの強化
            // A. この日に完了した人
            const doneThisDay = residents.filter(r => r.status === 'completed' && isSameDay(r.completed_at, visit.scheduled_date));
            // B. すでに完了している全ての人数（進捗バー用）
            const globalDoneCount = residents.filter(r => r.status === 'completed').length;
            // C. 全体の対象人数
            const totalCount = residents.length;
            // D. 進捗率（全体）
            const progress = totalCount > 0 ? (globalDoneCount / totalCount) * 100 : 0;

            // 🆕 表示するリストの選別
            // その日のカードには「その日に終わった人」と、まだ終わっていない「待機中の人」を表示する
            const displayResidents = residents.filter(r => {
              const isDoneToday = r.status === 'completed' && isSameDay(r.completed_at, visit.scheduled_date);
              const isPending = r.status === 'pending';
              // 過去に終わった人は、その日のカードには出さない（スッキリさせるため）
              return isDoneToday || isPending;
            });

            return (
              <div key={visit.id} style={visitCard(visit.id === expandedId)}>
                <div style={cardHeader} onClick={() => setExpandedId(visit.id === expandedId ? null : visit.id)}>
                  <div style={dateBox}>
                    <Calendar size={18} />
                    <strong>{visit.scheduled_date.replace(/-/g, '/')}</strong>
                    
                    {/* 🚀 🆕 業者名バッジを追加 */}
                    <span style={shopBadge(visit.profiles?.theme_color)}>
                      <Scissors size={12} style={{marginRight:'4px'}} />
                      {visit.profiles?.business_name || '不明な業者'}
                    </span>

                    {visit.parent_id && <span style={childBadge}>継続分</span>}
                  </div>

                  <div style={progressArea}>
                    {/* 🆕 バッジの表記を「本日分 / 全体」に変更 */}
                    <div style={countBadge(progress === 100)}>
                      本日: {doneThisDay.length}名 / 全体: {globalDoneCount}名 完了
                    </div>
                    {visit.id === expandedId ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                {/* 全体の進捗バー */}
                <div style={progressBarBg}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} style={progressBar(visit.profiles?.theme_color || '#c5a059')} />
                </div>

                <AnimatePresence>
                  {visit.id === expandedId && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                      <div style={residentGrid}>
                        {displayResidents.length > 0 ? displayResidents.map((res) => {
                          // 🚀 完了時間の計算（doneTime）を丸ごと削除しました

                          return (
                            <div key={res.id} style={resRow(res.status)}>
                              <div style={resMain}>
                                <div style={statusIcon(res.status)}>
                                  {res.status === 'completed' ? <CheckCircle2 size={18} /> : res.status === 'cancelled' ? <XCircle size={18} /> : <Clock size={18} />}
                                </div>
                                <div>
                                  <div style={resName}>{res.members?.name} 様</div>
                                  <div style={resInfo}>{res.members?.room} | {res.menu_name}</div>
                                </div>
                              </div>
                              
                              <div style={{ textAlign: 'right' }}>
                                <div style={statusLabel(res.status)}>
                                  {res.status === 'completed' ? '完了' : res.status === 'pending' ? '待機中' : '中止'}
                                </div>
                                {/* 🚀 ここにあった doneTime の表示ブロックを削除しました */}
                              </div>
                            </div>
                          );
                        }) : (
                          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '0.85rem' }}>
                            この日の実施記録はありません（または全日程完了済み）
                          </div>
                        )}
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

// --- スタイル ---
const childBadge = { fontSize: '0.65rem', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '4px', marginLeft: '10px', fontWeight: 'bold' };
const containerStyle = { maxWidth: '1000px', margin: '0 auto', padding: '20px' };
const headerStyle = { marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '15px' };
const titleStyle = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.4rem', fontWeight: '900', color: '#3d2b1f', margin: 0 };
const descStyle = { fontSize: '0.85rem', color: '#64748b', marginTop: '8px' };
const listContainer = { display: 'flex', flexDirection: 'column', gap: '15px' };
const visitCard = (active) => ({ background: '#fff', borderRadius: '20px', border: active ? '2px solid #3d2b1f' : '1px solid #eee', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' });
const cardHeader = { padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' };
const dateBox = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem' };
const progressArea = { display: 'flex', alignItems: 'center', gap: '12px' };
const countBadge = (isDone) => ({ background: isDone ? '#10b981' : '#3d2b1f', color: '#fff', padding: '6px 15px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' });
const progressBarBg = { height: '6px', background: '#f1f5f9', width: '100%' };
const progressBar = (color) => ({ height: '100%', background: color });
const residentGrid = { padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', background: '#fcfaf7' };
const resRow = (status) => ({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: '12px', background: '#fff', border: `1px solid ${status === 'completed' ? '#10b981' : '#e2e8f0'}` });
const resMain = { display: 'flex', alignItems: 'center', gap: '12px' };
const statusIcon = (status) => ({ color: status === 'completed' ? '#10b981' : status === 'cancelled' ? '#ef4444' : '#cbd5e1' });
const resName = { fontWeight: 'bold', fontSize: '0.95rem', color: '#1e293b' };
const resInfo = { fontSize: '0.75rem', color: '#64748b' };
const statusLabel = (status) => ({ fontSize: '0.7rem', fontWeight: '900', color: status === 'completed' ? '#059669' : '#94a3b8' });
const emptyCard = { textAlign: 'center', padding: '60px', background: '#fff', borderRadius: '20px', color: '#94a3b8', border: '1px dashed #e2e8f0' };

// 🚀 🆕 業者名バッジのスタイル（業者のテーマカラーを背景色に活用）
const shopBadge = (color) => ({
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: '0.7rem',
  fontWeight: 'bold',
  background: color ? `${color}15` : '#f1f5f9', // 15は透明度
  color: color || '#64748b',
  padding: '4px 10px',
  borderRadius: '6px',
  border: `1px solid ${color || '#e2e8f0'}44`,
  marginLeft: '10px'
});

export default FacilityStatus_PC;