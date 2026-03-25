import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient'; // 💡 階層が一つ浅くなったので ../ に修正
import { 
  ArrowLeft, CheckCircle2, Clock, XCircle, 
  Building2, Loader2, CheckCircle, Calculator, ReceiptText // ✅ 全部ここにまとめます
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AdminFacilityVisit_PC = () => {
  const { shopId, visitId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [visit, setVisit] = useState(null);
  const [residents, setResidents] = useState([]);
  const [shopData, setShopData] = useState(null);

  // 🆕 追加：売上計算用
  const [services, setServices] = useState([]); 
  const [isFinalizing, setIsFinalizing] = useState(false);

  useEffect(() => { fetchData(); }, [visitId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. 訪問情報の取得
      const { data: vData } = await supabase
        .from('visit_requests')
        .select('*, facility_users(facility_name), profiles(*)')
        .eq('id', visitId)
        .single();

      if (vData) {
        setVisit(vData);
        setShopData(vData.profiles);

        // 🆕 名簿を読み込む先のIDを決定（親がいれば親のID、いなければ自分）
        const targetIdForResidents = vData.parent_id || vData.id;

        // 💡 2. 入居者名簿と進捗の取得（ここを追記！）
        const { data: rData } = await supabase
          .from('visit_request_residents')
          .select('*, members(name, room, floor)')
          .eq('visit_request_id', targetIdForResidents);
        setResidents(rData || []);

        // 💡 3. サービスマスター（単価）を取得
        const { data: cData } = await supabase
          .from('service_categories')
          .select('name, is_facility_only')
          .eq('shop_id', shopId);
        const facilityCatNames = cData?.filter(c => c.is_facility_only).map(c => c.name) || [];

        // 💡 4. サービスマスターを取得し、施設用メニューのみに絞り込む
        const { data: sData } = await supabase
          .from('services')
          .select('*')
          .eq('shop_id', shopId);
        
        // 施設訪問画面なので、施設専用カテゴリに属するメニューだけに限定する
        const facilityServices = sData?.filter(s => facilityCatNames.includes(s.category)) || [];
        setServices(facilityServices);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 🆕 ステータスを「待機中」→「完了」→「中止」の順でループ切り替え
  const handleToggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'pending' ? 'completed' : 
                       currentStatus === 'completed' ? 'cancelled' : 'pending';
    
    const updateData = { 
      status: nextStatus, 
      updated_at: new Date().toISOString() 
    };

    if (nextStatus === 'completed') {
      // 💡 今日(25日)ポチポチしても、18日の画面なら「18日に完了」と記録させる
      updateData.completed_at = `${visit.scheduled_date}T12:00:00Z`;
    } else {
      updateData.completed_at = null;
    }
    
    const { error } = await supabase.from('visit_request_residents').update(updateData).eq('id', id);
    if (!error) {
      setResidents(residents.map(r => r.id === id ? { ...r, ...updateData } : r));
    }
  };

  // --- 🆕 ここから追加：売上集計・確定ロジック ---

  // 1. 本日の売上を計算（完了した人のメニュー単価をマスターから合計）
  const calculateTodayTotal = () => {
    return residents
      .filter(r => r.status === 'completed') // 💡 条件をシンプルに（ポチポチしたもの全部）
      .reduce((sum, res) => {
        const targetMenu = res.menu_name?.trim();
        const master = services.find(s => s.name?.trim() === targetMenu);
        return sum + (Number(master?.price) || 0);
      }, 0);
  };

  // 2. 売上を確定して「店舗の売上台帳(sales)」に記録する
  const handleFinalizeSales = async () => {
    const total = calculateTodayTotal();
    const donePeople = residents.filter(r => r.status === 'completed');

    if (donePeople.length === 0) {
      alert("完了した施術が1件もありません。名簿を「完了」にしてから確定してください。");
      return;
    }

    // ✅ 追加：価格が正しく拾えていない場合の警告
    if (total === 0) {
      alert("メニューの合計金額が 0円になっています。サービス設定のメニュー名（カット等）と入居者名簿のメニュー名が完全に一致しているか確認してください。");
      return;
    }

    if (!window.confirm(`本日の売上 ¥${total.toLocaleString()} を確定し、店舗の売上台帳に記録しますか？`)) {
      return;
    }

    setIsFinalizing(true);
    try {
      // A. 施設を「1人のお客様」として名簿(customers)から特定（または自動作成）
      let customerId = null;
      const facilityName = visit?.facility_users?.facility_name;

      const { data: existingCust } = await supabase
        .from('customers')
        .select('id')
        .eq('shop_id', shopId)
        .eq('name', facilityName)
        .maybeSingle();

      if (existingCust) {
        customerId = existingCust.id;
      } else {
        // 初めての施設なら顧客名簿に自動登録
        const { data: newCust, error: cErr } = await supabase
          .from('customers')
          .insert([{ shop_id: shopId, name: facilityName, memo: '施設訪問（自動登録）' }])
          .select()
          .single();
        if (cErr) throw cErr;
        customerId = newCust.id;
      }

      // B. 売上テーブル(sales)に保存
      // 💡 upsert を使うことで、もしボタンを2回押しても二重計上されないようにします
      const targetDateMembers = residents
      .filter(r => r.status === 'completed')
      .map(r => ({
        name: r.members?.name,
        menu: r.menu_name,
        price: services.find(s => s.name?.trim() === r.menu_name?.trim())?.price || 0
      }));

    const { error: saleErr } = await supabase
    .from('sales')
    .upsert([{
      shop_id: shopId,
      visit_request_id: visitId,
      customer_id: customerId,
      total_amount: total,
      sale_date: visit.scheduled_date,
      details: { 
        is_facility: true,
        residents_count: targetDateMembers.length,
        // 🆕 ここで誰を売上にしたか保存！
        members_list: targetDateMembers 
      }
    }], { onConflict: 'visit_request_id' });

    if (saleErr) throw saleErr;

    // ✅ B. 訪問データ(visit_requests)自体のステータスも「完了」に更新する
    // これをしないと、管理画面側で「まだ終わっていないタスク」として扱われてしまいます
    const { error: visitUpdateErr } = await supabase
      .from('visit_requests')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString() 
      })
      .eq('id', visitId);

    if (visitUpdateErr) throw visitUpdateErr;

    alert("売上確定と訪問ステータスの更新が完了しました！✨");
      navigate(-1); // 一覧（今日のタスク）に戻る

    } catch (err) {
      console.error("売上確定エラー:", err);
      alert("エラーが発生しました: " + err.message);
    } finally {
      setIsFinalizing(false);
    }
  };

  // --- 🆕 追加ここまで ---

  const themeColor = shopData?.theme_color || '#4f46e5';

  if (loading) return <div style={centerStyle}><Loader2 className="animate-spin" /> 読込中...</div>;

  const doneCount = residents.filter(r => r.status === 'completed').length;
  const totalCount = residents.length;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return (
    <div style={containerStyle}>
      {/* 固定ヘッダー */}
      <header style={headerStyle}>
        <button onClick={() => navigate(-1)} style={backBtn}>
          <ArrowLeft size={20} /> 戻る
        </button>
        <div style={titleGroup}>
          <div style={facilityLabel}><Building2 size={16} /> 施設訪問・現場実行</div>
          <h2 style={facilityName}>{visit?.facility_users?.facility_name} 様</h2>
          <p style={dateText}>{visit?.scheduled_date?.replace(/-/g, '/')} 訪問分</p>
        </div>
      </header>

      {/* 進捗サマリーカード */}
      <div style={statsCard}>
        <div style={statsInfo}>
          <span style={statsLabel}>本日の完了状況</span>
          <span style={statsValue}>{doneCount} <small style={{fontSize:'0.9rem', color:'#94a3b8'}}>/ {totalCount} 名</small></span>
        </div>
        <div style={progressBg}>
          <motion.div 
            initial={{ width: 0 }} 
            animate={{ width: `${progress}%` }} 
            style={progressBar(themeColor)} 
          />
        </div>
      </div>

      {/* 🆕 売上確定・締めカード */}
      <div style={finalizeCard}>
        <div style={finalizeHeader}>
          <ReceiptText size={18} color="#4f46e5" />
          <span style={finalizeTitle}>本日の計上予定（マスター価格）</span>
        </div>
        <div style={finalizeAmount}>
          ¥ {calculateTodayTotal().toLocaleString()}
        </div>
        <p style={finalizeNote}>※ 完了 {residents.filter(r => r.status === 'completed').length} 名分の合計額</p>
        
        <button 
          onClick={handleFinalizeSales} 
          disabled={isFinalizing || residents.filter(r => r.status === 'completed').length === 0}
          style={finalizeBtn(isFinalizing || residents.filter(r => r.status === 'completed').length === 0)}
        >
          {isFinalizing ? <Loader2 className="animate-spin" /> : <CheckCircle size={20} />}
          {isFinalizing ? '処理中...' : '本日の施術を終了して売上を確定'}
        </button>
      </div>

      {/* 利用者ポチポチリスト */}
      <div style={listContainer}>
        {residents.length === 0 ? (
          <div style={{textAlign:'center', padding:'40px', color:'#94a3b8'}}>名簿が登録されていません。</div>
        ) : (() => {
          // ✅ 1. 今開いている「訪問予定日」を取得 (例: "2026-03-19")
          const todayStr = visit?.scheduled_date; 
          
          // ✅ 2. 「本日の施術対象」と「他日程で完了済み」に仕分ける
          // 本日分：未完了の人、または「今日完了させた人」
          const todayResidents = residents.filter(r => 
            r.status !== 'completed' || (r.status === 'completed' && r.completed_at?.startsWith(todayStr))
          );

          // 別日分：ステータスが完了で、かつ「完了日が今日ではない」人
          const pastResidents = residents.filter(r => 
            r.status === 'completed' && r.completed_at && !r.completed_at?.startsWith(todayStr)
          );

          return (
            <>
              {/* --- A. 本日の施術リスト（タップ可能・通常デザイン） --- */}
              {todayResidents.map((res) => (
                <motion.div 
                  key={res.id} 
                  onClick={() => handleToggleStatus(res.id, res.status)}
                  whileTap={{ scale: 0.97 }}
                  style={resCard(res.status)}
                >
                  <div style={resLeft}>
                    <div style={roomTag}>{res.members?.room || '居室'}</div>
                    <div>
                      <div style={resName}>{res.members?.name} 様</div>
                      <div style={resMenu}>{res.menu_name}</div>
                    </div>
                  </div>

                  <div style={statusBadge(res.status)}>
                    {res.status === 'completed' ? (
                      <div style={{color:'#10b981', display:'flex', alignItems:'center', gap:'4px'}}>
                        <CheckCircle2 size={20} /> <span style={{fontSize:'0.85rem'}}>完了</span>
                      </div>
                    ) : res.status === 'cancelled' ? (
                      <div style={{color:'#ef4444', display:'flex', alignItems:'center', gap:'4px'}}>
                        <XCircle size={20} /> <span style={{fontSize:'0.85rem'}}>中止</span>
                      </div>
                    ) : (
                      <div style={{color:'#cbd5e1', display:'flex', alignItems:'center', gap:'4px'}}>
                        <Clock size={20} /> <span style={{fontSize:'0.85rem'}}>待機</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* --- B. 別日完了済みリスト（タップ不可・灰色デザイン） --- */}
              {pastResidents.length > 0 && (
                <div style={{ marginTop: '40px', borderTop: '2px dashed #cbd5e1', paddingTop: '20px' }}>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    🔒 他の日程で完了済み（変更できません）
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {pastResidents.map((res) => {
                      // 完了日（2026-03-18等）を見やすく整形
                      const finishDate = res.completed_at ? res.completed_at.split('T')[0].replace(/-/g, '/') : '';
                      return (
                        <div 
                          key={res.id} 
                          style={{ 
                            ...resCard('completed'), 
                            opacity: 0.5, 
                            background: '#f1f5f9', // 灰色背景
                            borderColor: '#cbd5e1',
                            filter: 'grayscale(1)',   // 全てを白黒に
                            cursor: 'not-allowed',  // 禁止マークのカーソル
                            pointerEvents: 'none',   // 物理的にタップを無効化
                            userSelect: 'none'
                          }}
                        >
                          <div style={resLeft}>
                            <div style={{ ...roomTag, background: '#cbd5e1', color: '#64748b' }}>済</div>
                            <div>
                              <div style={{ ...resName, color: '#64748b' }}>{res.members?.name} 様</div>
                              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{res.menu_name}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold', textAlign: 'right' }}>
                            {finishDate}<br />完了済み ✓
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>

      <footer style={footerStyle}>
        <button onClick={() => navigate(-1)} style={finishBtn}>
          作業を一時中断して一覧へ戻る
        </button>
      </footer>
    </div>
  );
};

// --- スタイル定義（スマホ・タブレットの現場操作に特化） ---
const containerStyle = { maxWidth: '600px', margin: '0 auto', padding: '15px', paddingBottom: '120px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'sans-serif' };
const headerStyle = { marginBottom: '20px' };
const backBtn = { background: 'none', border: 'none', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '15px', fontSize: '0.9rem' };
const titleGroup = { padding: '0 5px' };
const facilityLabel = { fontSize: '0.7rem', color: '#4f46e5', fontWeight: '900', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px', textTransform: 'uppercase' };
const facilityName = { margin: 0, fontSize: '1.6rem', fontWeight: '900', color: '#1e293b' };
const dateText = { margin: '4px 0 0', fontSize: '0.9rem', color: '#64748b', fontWeight: 'bold' };
const statsCard = { background: '#fff', padding: '20px', borderRadius: '24px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', marginBottom: '25px', border: '1px solid #f1f5f9' };
const statsInfo = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' };
const statsLabel = { fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' };
const statsValue = { fontSize: '1.8rem', fontWeight: '900', color: '#1e293b' };
const progressBg = { height: '12px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' };
const progressBar = (color) => ({ height: '100%', background: color });
const listContainer = { display: 'flex', flexDirection: 'column', gap: '12px' };
const resCard = (status) => ({ 
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px', borderRadius: '20px', 
  background: status === 'completed' ? '#f0fdf4' : status === 'cancelled' ? '#fff' : '#fff',
  border: `2px solid ${status === 'completed' ? '#10b981' : status === 'cancelled' ? '#ef4444' : '#f1f5f9'}`,
  opacity: status === 'cancelled' ? 0.6 : 1, cursor: 'pointer', transition: '0.2s',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
});
const resLeft = { display: 'flex', alignItems: 'center', gap: '15px' };
const roomTag = { background: '#f1f5f9', padding: '6px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '900', color: '#475569', minWidth: '45px', textAlign: 'center', border: '1px solid #e2e8f0' };
const resName = { fontWeight: 'bold', fontSize: '1.1rem', color: '#1e293b' };
const resMenu = { fontSize: '0.8rem', color: '#64748b', marginTop: '2px', fontWeight: 'bold' };
const statusBadge = (status) => ({ minWidth: '60px', display: 'flex', justifyContent: 'flex-end' });
const footerStyle = { position: 'fixed', bottom: 0, left: 0, right: 0, padding: '20px', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', zIndex: 100 };
const finishBtn = { width: '100%', maxWidth: '400px', padding: '18px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '18px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' };
const centerStyle = { display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: '#64748b', background: '#f8fafc' };
const finalizeCard = { background: '#f5f3ff', padding: '24px', borderRadius: '28px', border: '2px solid #ddd6fe', marginBottom: '25px', textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.1)' };
const finalizeHeader = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '10px' };
const finalizeTitle = { fontSize: '0.8rem', fontWeight: 'bold', color: '#6d28d9', letterSpacing: '0.5px' };
const finalizeAmount = { fontSize: '2.4rem', fontWeight: '900', color: '#1e293b', marginBottom: '5px' };
const finalizeNote = { fontSize: '0.75rem', color: '#7c3aed', marginBottom: '15px', fontWeight: 'bold' };
const finalizeBtn = (disabled) => ({ 
  width: '100%', padding: '18px', background: disabled ? '#cbd5e1' : '#4f46e5', 
  color: '#fff', border: 'none', borderRadius: '20px', fontWeight: 'bold', 
  fontSize: '1rem', cursor: disabled ? 'default' : 'pointer', 
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', 
  transition: '0.2s', boxShadow: disabled ? 'none' : '0 10px 20px -5px rgba(79, 70, 229, 0.4)' 
});
export default AdminFacilityVisit_PC;