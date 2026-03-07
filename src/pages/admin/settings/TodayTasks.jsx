import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { 
  CheckCircle2, Clock, User, ArrowLeft, 
  Calendar, CheckCircle, AlertCircle 
} from 'lucide-react';

const TodayTasks = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [tasks, setTasks] = useState([]);
  const [shopData, setShopData] = useState(null);

  // 画面サイズ管理
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isPC = windowWidth > 900;

  useEffect(() => {
    if (shopId) {
      fetchShopData();
      fetchTodayTasks();
    }
  }, [shopId]);

  const fetchShopData = async () => {
    const { data } = await supabase.from('profiles').select('theme_color, business_name').eq('id', shopId).single();
    if (data) setShopData(data);
  };

const fetchTodayTasks = async () => {
    setLoading(true);
    
    // ✅ 修正：'date' カラムではなく 'start_time' の「今日の開始〜終了」で範囲検索します [cite: 2026-03-01]
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
    
    const { data, error } = await supabase
      .from('reservations')
      // ✅ 肉付け：カレンダー同様、顧客マスタ側の最新名（admin_name含む）も一緒に取得します [cite: 2026-03-06]
      .select('*, customers(name, admin_name)') 
      .eq('shop_id', shopId)
      .gte('start_time', startOfToday)
      .lte('start_time', endOfToday)
      .in('status', ['confirmed', 'completed'])
      .order('start_time', { ascending: true });

    if (!error) setTasks(data || []);
    else console.error("取得エラー:", error.message);
    setLoading(false);
  };

  const showMsg = (txt) => { setMessage(txt); setTimeout(() => setMessage(''), 3000); };

  // 🚀 汎用トリガー：サービス完了処理
  const handleCompleteTask = async (reservationId, userId) => {
    try {
      // 1. 予約ステータスを 'completed' に更新 [cite: 2026-03-01]
      const { error: resError } = await supabase
        .from('reservations')
        .update({ status: 'completed' })
        .eq('id', reservationId);

      if (resError) throw resError;

      // ---------------------------------------------------------
      // 💡 肉付けポイント：ここに将来の報酬ロジックを追記します
      // 例: await giveReward(userId); // 卵、称号、スタンプなど
      // ---------------------------------------------------------

      showMsg("サービス完了を記録しました！✨");
      fetchTodayTasks();
    } catch (err) {
      alert("更新エラー: " + err.message);
    }
  };

  const themeColor = shopData?.theme_color || '#2563eb';

  if (loading) return <div style={{ textAlign: 'center', padding: '50px' }}>読み込み中...</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', paddingBottom: '100px', fontFamily: 'sans-serif' }}>
      
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '12px', zIndex: 1001, textAlign: 'center', fontWeight: 'bold', boxShadow: '0 10px 15px rgba(0,0,0,0.1)' }}>
          {message}
        </div>
      )}

<div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
        {/* ✅ 修正：ダッシュボードではなく「カレンダー画面」へ直接戻ります [cite: 2026-03-06] */}
        <button 
          onClick={() => navigate(`/admin/${shopId}/reservations`)} 
          style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '50%', cursor: 'pointer', color: '#64748b', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#1e293b' }}>今日のタスク</h2>
          <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>← カレンダーへ戻る</p>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '20px', color: '#64748b' }}>
            <Calendar size={40} style={{ marginBottom: '10px', opacity: 0.5 }} />
            <p>今日の予約タスクはありません</p>
          </div>
        ) : (
          tasks.map(task => (
            <div key={task.id} style={{ 
              background: task.status === 'completed' ? '#f8fafc' : '#fff', 
              padding: '20px', 
              borderRadius: '20px', 
              border: task.status === 'completed' ? '1px solid #e2e8f0' : `2px solid ${themeColor}22`,
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              opacity: task.status === 'completed' ? 0.7 : 1
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Clock size={16} color={themeColor} />
                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#1e293b' }}>{task.start_time} 〜</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
                    <User size={16} />
                    <span style={{ fontWeight: 'bold' }}>{task.customer_name || 'お客様'} 様</span>
                  </div>
                </div>

                {task.status === 'completed' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10b981', fontWeight: 'bold', fontSize: '0.9rem' }}>
                    <CheckCircle size={20} /> 完了済み
                  </div>
                ) : (
                  <button 
                    onClick={() => handleCompleteTask(task.id, task.user_id)}
                    style={{ 
                      padding: '12px 24px', 
                      background: themeColor, 
                      color: '#fff', 
                      border: 'none', 
                      borderRadius: '12px', 
                      fontWeight: 'bold', 
                      cursor: 'pointer',
                      boxShadow: `0 4px 12px ${themeColor}44`
                    }}
                  >
                    サービス完了
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: '30px', padding: '20px', background: '#fefce8', borderRadius: '16px', border: '1px solid #fef08a', display: 'flex', gap: '12px' }}>
        <AlertCircle size={20} color="#a16207" />
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#854d0e', lineHeight: '1.6' }}>
          <b>店主様へ：</b><br />
          施術が完了したら「サービス完了」を押してください。これがトリガーとなり、お客様のマイページにアクション（卵の付与など）が発生します。[cite: 2026-03-01, 2026-03-06]
        </p>
      </div>
    </div>
  );
};

export default TodayTasks;