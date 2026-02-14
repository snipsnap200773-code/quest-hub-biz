import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { 
  MessageCircle, Bell, Clock, ArrowLeft, 
  Save, CheckCircle2, ExternalLink, ShieldCheck 
} from 'lucide-react';

const LineSettings = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();

  // 🆕 画面サイズ管理を追加（ボタンをレスポンシブにするため）
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isPC = windowWidth > 900; 
  
  // --- 1. State 管理 (本家から完全移植) ---
  const [message, setMessage] = useState('');
  const [notifyLineEnabled, setNotifyLineEnabled] = useState(true);
  const [notifyLineRemindEnabled, setNotifyLineRemindEnabled] = useState(false);
  const [lineToken, setLineToken] = useState('');
  const [lineAdminId, setLineAdminId] = useState('');
  const [liffId, setLiffId] = useState('');

  useEffect(() => {
    if (shopId) fetchLineData();
  }, [shopId]);

  const fetchLineData = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (data) {
      setNotifyLineEnabled(data.notify_line_enabled ?? true);
      setNotifyLineRemindEnabled(data.notify_line_remind_enabled ?? false);
      setLineToken(data.line_channel_access_token || '');
      setLineAdminId(data.line_admin_user_id || '');
      setLiffId(data.liff_id || '');
    }
  };

  const showMsg = (txt) => { setMessage(txt); setTimeout(() => setMessage(''), 3000); };

  const handleSave = async () => {
    const { error } = await supabase.from('profiles').update({
      notify_line_enabled: notifyLineEnabled,
      notify_line_remind_enabled: notifyLineRemindEnabled,
      line_channel_access_token: lineToken,
      line_admin_user_id: lineAdminId,
      liff_id: liffId
    }).eq('id', shopId);

    if (!error) showMsg('LINE連携設定を保存しました！');
    else alert('保存に失敗しました。');
};

  // 🆕 ここに追加！
  const handleTestNotify = async () => {
    if (!lineToken || !lineAdminId) {
      alert("トークンとユーザーIDを入力してからテストしてください。");
      return;
    }
    try {
      const { error } = await supabase.functions.invoke('resend', {
        body: {
          type: 'test',
          shopId: shopId,
          lineUserId: lineAdminId,
          message: `✅ クエストハブ：LINE連携テスト成功！\n店舗ID: ${shopId}`
        }
      });
      if (error) throw error;
      alert("テストメッセージを送信しました！LINEのトークを確認してください。");
    } catch (err) {
      alert("送信エラー: " + err.message);
    }
  };

  // --- スタイル定義 (リニューアル統一版) ---
  const containerStyle = { fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto', padding: '20px', paddingBottom: '120px', position: 'relative' };
  const cardStyle = { marginBottom: '20px', background: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #00b900', boxSizing: 'border-box', width: '100%', boxShadow: '0 4px 6px -1px rgba(0,185,0,0.05)' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem', background: '#fff' };
  const labelStyle = { fontSize: '0.8rem', fontWeight: 'bold', color: '#15803d', marginTop: '16px', display: 'block', marginBottom: '8px' };

  return (
    <div style={containerStyle}>
      {/* 🔔 通知メッセージ */}
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '12px', zIndex: 1001, textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}>
          <CheckCircle2 size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> {message}
        </div>
      )}

{/* 🚀 ナビゲーションヘッダー（統一デザイン＆レスポンシブ版） */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '30px' }}>
        <button 
          onClick={() => navigate(`/admin/${shopId}/dashboard`)}
          style={{ 
            background: '#fff', 
            border: '1px solid #e2e8f0', 
            padding: isPC ? '10px 20px' : '10px 12px', 
            borderRadius: '30px', 
            fontWeight: 'bold', 
            color: '#64748b', 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: isPC ? '1rem' : '0.8rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            whiteSpace: 'nowrap'
          }}
        >
          <ArrowLeft size={18} /> {isPC ? 'ダッシュボードへ' : '戻る'}
        </button>
      </div>
      
      <h2 style={{ fontSize: '1.4rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', color: '#00b900', fontWeight: 'bold' }}>
        <MessageCircle size={28} /> LINE公式アカウント連携
      </h2>

      <section style={cardStyle}>
        <div style={{ padding: '20px', background: '#f0fdf4', borderRadius: '16px' }}>
          
          {/* 通知の有効化 */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={notifyLineEnabled} 
              onChange={(e) => setNotifyLineEnabled(e.target.checked)} 
              style={{ width: '22px', height: '22px', cursor: 'pointer' }} 
            />
            <span style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#1e293b' }}>📢 新着予約のLINE通知を有効にする</span>
          </label>

          {/* リマインド通知 (有料版機能) */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', padding: '16px', background: '#fff', borderRadius: '12px', border: '2px dashed #00b900', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={notifyLineRemindEnabled} 
              onChange={(e) => setNotifyLineRemindEnabled(e.target.checked)} 
              style={{ width: '22px', height: '22px', cursor: 'pointer' }} 
            />
            <div>
              <span style={{ fontWeight: 'bold', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px', color: '#059669' }}>
                <Clock size={18} /> リマインドLINEを自動送信
              </span>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '4px' }}>
                ※予約の24時間前にお客様へ自動送信します（有料版）
              </span>
            </div>
          </label>

          {/* 各種キー入力 */}
          <div style={{ borderTop: '1px solid #d1fae5', paddingTop: '10px' }}>
            <label style={labelStyle}><ShieldCheck size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Messaging API Access Token</label>
            <input 
              type="password" 
              value={lineToken} 
              onChange={(e) => setLineToken(e.target.value)} 
              style={inputStyle} 
              placeholder="チャネルアクセストークンを入力"
            />

            <label style={labelStyle}><MessageCircle size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Admin User ID (あなたのLINE ID)</label>
            <input 
              value={lineAdminId} 
              onChange={(e) => setLineAdminId(e.target.value)} 
              style={inputStyle} 
              placeholder="Uxxxx... から始まるIDを入力"
            />

            {/* 🆕 LIFF ID 入力枠の追加 */}
            <label style={labelStyle}>
              <ExternalLink size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> 
              LIFF ID (予約フォーム起動用)
            </label>
            <input 
              value={liffId} 
              onChange={(e) => setLiffId(e.target.value)} 
              style={inputStyle} 
              placeholder="20桁程度の英数字を入力"
            />

            {/* 🆕 ここから追加：リッチメニュー用URLの表示とコピー機能 */}
            {liffId && (
              <div style={{ marginTop: '20px', padding: '15px', background: '#fff', borderRadius: '12px', border: '2px solid #00b900' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#00b900', display: 'block', marginBottom: '8px' }}>
                  💬 LINEリッチメニュー用URL（コピーして使用）
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    readOnly 
                    value={`https://liff.line.me/${liffId}`} 
                    style={{ ...inputStyle, background: '#f8fafc', fontSize: '0.8rem', flex: 1, border: '1px solid #cbd5e1' }} 
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`https://liff.line.me/${liffId}`);
                      showMsg("URLをコピーしました！"); // 既存のshowMsg関数を利用
                    }}
                    style={{ padding: '0 15px', background: '#00b900', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    コピー
                  </button>
                </div>
                <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '10px', lineHeight: '1.4' }}>
                  ※このURLをLINE Developersのリッチメニュー「リンク」欄に設定してください。
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <button 
        onClick={handleSave} 
        style={{ 
          width: '100%', 
          padding: '18px', 
          background: '#00b900', 
          color: '#fff', 
          border: 'none', 
          borderRadius: '16px', 
          fontWeight: 'bold', 
          fontSize: '1.1rem',
          boxShadow: '0 8px 20px rgba(0,185,0,0.3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        <Save size={20} /> 連携設定を保存する 💾
</button><br></br>


      <button 
        onClick={handleTestNotify} 
        style={{ 
          width: '100%', 
          padding: '14px', 
          background: '#fff', 
          color: '#00b900', 
          border: '2px solid #00b900', 
          borderRadius: '16px', 
          fontWeight: 'bold', 
          fontSize: '0.95rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        <Bell size={18} /> テスト通知を送ってみる 🚀
      </button>

      <div style={{ marginTop: '24px', padding: '20px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', display: 'flex', gap: '12px' }}>
        <div style={{ color: '#00b900' }}><Bell size={20} /></div>
        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, lineHeight: '1.6' }}>
          <b>💡 設定のヒント:</b><br />
          LINE Developersの Messaging API設定 から「アクセストークン」を発行してください。<br />
          「あなたのユーザーID」は「チャネル基本設定」タブの最下部で確認できます。
        </p>
      </div>
    </div>
  );
};

export default LineSettings;