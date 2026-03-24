import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { CheckCircle2, Calendar, Users, ArrowLeft, Send, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const FacilityBooking_PC = ({ facilityId, setActiveTab }) => {
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [shopInfo, setShopInfo] = useState(null);

  // 🆕 施設情報を保存する箱（ここを追記！）
  const [facilityName, setFacilityName] = useState('');
  const [facilityEmail, setFacilityEmail] = useState('');

  // 🆕 定期キープ計算用のState
  const [manualKeeps, setManualKeeps] = useState([]);
  const [regularRules, setRegularRules] = useState([]);
  const [exclusions, setExclusions] = useState([]);

  useEffect(() => { fetchSummary(); }, [facilityId]);

  const fetchSummary = async () => {
    // 1. 下書きと提携先情報を取得
    const { data: draftData } = await supabase.from('visit_list_drafts').select('*, members(*)').eq('facility_user_id', facilityId);
    const { data: connData } = await supabase.from('shop_facility_connections').select('shop_id, regular_rules, profiles(*)').eq('facility_user_id', facilityId).eq('status', 'active').single();
    
    // 🆕 施設の情報を取得（メール送信に使用）
    const { data: facData } = await supabase.from('facility_users').select('facility_name, email').eq('id', facilityId).single();

    setDrafts(draftData || []);
    setShopInfo(connData?.profiles || null);
    setRegularRules(connData?.regular_rules || []);
    
    // 🆕 Stateに施設情報を保持（もしなければ追加してください）
    setFacilityName(facData?.facility_name || '');
    setFacilityEmail(facData?.email || '');
    
    // 2. 確保済みの日程データをバラバラに取得
    const [keepRes, exclRes] = await Promise.all([
      // 🆕 start_time も取得
      supabase.from('keep_dates').select('date, start_time').eq('facility_user_id', facilityId),
      supabase.from('regular_keep_exclusions').select('excluded_date').eq('facility_user_id', facilityId)
    ]);

    setDrafts(draftData || []);
    setShopInfo(connData?.profiles || null);
    setRegularRules(connData?.regular_rules || []);
    // 🆕 配列ではなくオブジェクトのまま保存
    setManualKeeps(keepRes.data || []);
    setExclusions(exclRes.data?.map(e => e.excluded_date) || []);
  };

  // 🆕 定期キープの判定ロジック（カレンダーと同じもの）
  const checkIsRegularKeep = (date) => {
    const day = date.getDay();
    const dom = date.getDate();
    const m = date.getMonth() + 1;
    const nthWeek = Math.ceil(dom / 7);
    
    const t7 = new Date(date); t7.setDate(dom + 7);
    const isL1 = t7.getMonth() !== date.getMonth(); 
    const t14 = new Date(date); t14.setDate(dom + 14);
    const isL2 = t14.getMonth() !== date.getMonth() && !isL1;

    let matchTime = null;
    regularRules?.forEach(r => {
      const monthMatch = (r.monthType === 0) || (r.monthType === 1 && m % 2 !== 0) || (r.monthType === 2 && m % 2 === 0);
      const dayMatch = (r.day === day);
      const weekMatch = (r.week === nthWeek) || (r.week === -1 && isL1) || (r.week === -2 && isL2);
      if (monthMatch && dayMatch && weekMatch) matchTime = r.time;
    });
    return matchTime;
  };

  // 🆕 手動キープと定期キープを合算して「今月の訪問予定日」を算出
  const ensuredDates = useMemo(() => {
    const list = [];
    
    // 1. 手動キープ分
    manualKeeps.forEach(k => {
      list.push({ date: k.date, time: k.start_time || '09:00' });
    });

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDate = new Date(year, month + 1, 0).getDate();

    for (let d = 1; d <= lastDate; d++) {
      const date = new Date(year, month, d);
      const dateStr = date.toLocaleDateString('sv-SE');
      const regTime = checkIsRegularKeep(date);
      
      if (regTime && !exclusions.includes(dateStr)) {
        if (!list.some(item => item.date === dateStr)) {
          list.push({ date: dateStr, time: regTime });
        }
      }
    }
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [manualKeeps, regularRules, exclusions]);

  const handleFinalSubmit = async () => {
    if (ensuredDates.length === 0) return alert("訪問日が確保されていません。");
    if (drafts.length === 0) return alert("希望者が選択されていません。");

    setLoading(true);
    try {
      // 🚀 1. 予約の「親」を1件だけ登録
      const { data: request, error: reqErr } = await supabase
        .from('visit_requests')
        .insert([{
          facility_user_id: facilityId,
          shop_id: shopInfo.id,
          // 💡 重要：.date を付けて、塊（オブジェクト）ではなく日付の「文字」だけを渡す
          scheduled_date: ensuredDates[0].date, 
          end_date: ensuredDates[ensuredDates.length - 1].date, 
          visit_date_list: ensuredDates, // ここはJSONBなので塊のままでOK
          start_time: ensuredDates[0].time, 
          status: 'confirmed'
        }])
        .select().single();

      if (reqErr) throw reqErr;

      // 🚀 2. 「子（利用者）」を人数分だけ登録
      const residentPayloads = drafts.map(d => ({
        visit_request_id: request.id,
        member_id: d.member_id,
        menu_name: d.menu_name
      }));

      const { error: resErr } = await supabase.from('visit_request_residents').insert(residentPayloads);
      if (resErr) throw resErr;

      // 🚀 3. メール送信と掃除（ここはこれまでと同じ）
      const residentListText = drafts.map(d => `・${d.members?.name} 様 (${d.menu_name})`).join('\n');
      const formattedDatesForMail = ensuredDates.map(d => `${d.date.replace(/-/g, '/')} (${d.time})`);

      await supabase.functions.invoke('resend', {
        body: {
          type: 'facility_booking',
          shopName: shopInfo.business_name,
          shopEmail: shopInfo.email_contact,
          facilityName: facilityName,
          facilityEmail: facilityEmail,
          // 💡 変換したテキスト版を送る
          scheduledDates: formattedDatesForMail, 
          residentCount: drafts.length,
          residentListText: residentListText,
          shopId: shopInfo.id,
          facilityId: facilityId
        }
      });

      await supabase.from('visit_list_drafts').delete().eq('facility_user_id', facilityId);
      await supabase.from('keep_dates').delete().eq('facility_user_id', facilityId);

      alert(`${ensuredDates.length}日間の訪問予約を確定しました！`);
      setActiveTab('status'); 
    } catch (err) {
      alert("エラー: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div style={containerStyle}>
      <button onClick={() => setActiveTab('list-up')} style={backBtn}>
        <ArrowLeft size={18} /> リストアップ画面へ戻る
      </button>

      <div style={summaryCard}>
        <h2 style={title}><CheckCircle2 color="#c5a059" /> 予約内容の最終確認</h2>
        <p style={subTitle}>以下の内容で <strong>{shopInfo?.business_name}</strong> さんに予約を依頼します。</p>

        <div style={grid}>
          <div style={infoBox}>
            {/* 🆕 ensuredDates.length が正しく反映されます */}
            <div style={label}><Calendar size={16} /> 訪問予定日（{ensuredDates.length}日間）</div>
            <div style={dateList}>
              {ensuredDates.map(item => (
                <span key={item.date} style={dateTag}>
                  {item.date.replace(/-/g,'/')}
                  <small style={{ marginLeft: '6px', opacity: 0.8 }}>({item.time?.substring(0, 5)})</small>
                </span>
              ))}
            </div>
          </div>

          <div style={infoBox}>
            <div style={label}><Users size={16} /> 今回の施術希望者</div>
            <div style={countNum}>{drafts.length} <small>名</small></div>
          </div>
        </div>

        <div style={residentPreview}>
          <h4 style={smallTitle}>希望者一覧（各日程共通）</h4>
          <div style={previewScroll}>
            {drafts.map(d => (
              <div key={d.id} style={pRow}>
                <span style={pName}>{d.members?.name} 様</span>
                <span style={pMenu}>{d.menu_name}</span>
              </div>
            ))}
          </div>
        </div>

        <button 
          onClick={handleFinalSubmit} 
          disabled={loading || ensuredDates.length === 0} 
          style={finalBtn(loading)}
        >
          {loading ? <Loader2 className="animate-spin" /> : <Send size={20} />}
          {loading ? '送信中...' : 'この内容で予約を確定して依頼する'}
        </button>
      </div>
    </div>
  );
};

// スタイル定義は変更なし
const containerStyle = { maxWidth: '800px', margin: '0 auto', padding: '20px' };
const backBtn = { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px', fontWeight: 'bold' };
const summaryCard = { background: '#fff', borderRadius: '30px', padding: '40px', border: '1px solid #eee', boxShadow: '0 15px 40px rgba(0,0,0,0.05)' };
const title = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.8rem', margin: '0 0 10px 0', color: '#3d2b1f', fontWeight: '900' };
const subTitle = { fontSize: '1rem', color: '#64748b', marginBottom: '30px' };
const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' };
const infoBox = { background: '#fcfaf7', padding: '20px', borderRadius: '20px', border: '1px solid #f0e6d2' };
const label = { fontSize: '0.8rem', color: '#948b83', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' };
const dateList = { display: 'flex', flexWrap: 'wrap', gap: '8px' };
const dateTag = { background: '#3d2b1f', color: '#fff', padding: '5px 12px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 'bold' };
const countNum = { fontSize: '2.5rem', fontWeight: '900', color: '#c5a059' };
const residentPreview = { background: '#fff', border: '1px solid #eee', borderRadius: '20px', padding: '20px', marginBottom: '40px' };
const smallTitle = { margin: '0 0 15px 0', fontSize: '0.9rem', color: '#3d2b1f' };
const previewScroll = { maxHeight: '200px', overflowY: 'auto' };
const pRow = { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f8fafc' };
const pName = { fontWeight: 'bold', color: '#334155' };
const pMenu = { color: '#c5a059', fontWeight: 'bold', fontSize: '0.9rem' };
const finalBtn = (loading) => ({ width: '100%', padding: '25px', borderRadius: '20px', border: 'none', background: loading ? '#ccc' : '#3d2b1f', color: '#fff', fontSize: '1.2rem', fontWeight: '900', cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', boxShadow: '0 10px 25px rgba(61,43,31,0.2)' });

export default FacilityBooking_PC;