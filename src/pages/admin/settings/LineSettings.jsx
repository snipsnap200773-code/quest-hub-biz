import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { MessageCircle, Bell, Clock } from 'lucide-react'; // アイコン追加

const LineSettings = () => {
  const { shopId } = useParams();
  
  // --- 1. State 管理 (本家から完全移植) ---
  const [message, setMessage] = useState('');
  const [notifyLineEnabled, setNotifyLineEnabled] = useState(true);
  const [notifyLineRemindEnabled, setNotifyLineRemindEnabled] = useState(false);
  const [lineToken, setLineToken] = useState('');
  const [lineAdminId, setLineAdminId] = useState('');
  const [themeColor, setThemeColor] = useState('#2563eb');

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
      setThemeColor(data.theme_color || '#2563eb');
    }
  };

  const showMsg = (txt) => { setMessage(txt); setTimeout(() => setMessage(''), 3000); };

  const handleSave = async () => {
    const { error } = await supabase.from('profiles').update({
      notify_line_enabled: notifyLineEnabled,
      notify_line_remind_enabled: notifyLineRemindEnabled,
      line_channel_access_token: lineToken,
      line_admin_user_id: lineAdminId
    }).eq('id', shopId);

    if (!error) showMsg('LINE連携設定を保存しました！');
    else alert('保存に失敗しました。');
  };

  // --- スタイル定義 (本家準拠) ---
  const cardStyle = { marginBottom: '20px', background: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid #00b900', boxSizing: 'border-box', width: '100%' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '1rem', background: '#fff' };
  const labelStyle = { fontSize: '0.7rem', fontWeight: 'bold', color: '#15803d', marginTop: '10px', display: 'block', marginBottom: '4px' };

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto', padding: '20px', paddingBottom: '120px' }}>
      {message && <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '8px', zIndex: 1001, textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>{message}</div>}

      <h2 style={{ fontSize: '1.2rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#00b900' }}>
        <MessageCircle size={24} /> LINE公式アカウント連携
      </h2>

      <section style={cardStyle}>
        <div style={{ padding: '15px', background: '#f0fdf4', borderRadius: '12px' }}>
          
          {/* 通知の有効化 */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={notifyLineEnabled} 
              onChange={(e) => setNotifyLineEnabled(e.target.checked)} 
              style={{ width: '20px', height: '20px' }} 
            />
            <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>📢 新着予約のLINE通知を有効にする</span>
          </label>

          {/* リマインド通知 (有料版機能) */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', padding: '12px', background: '#fff', borderRadius: '10px', border: '1px dashed #00b900', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={notifyLineRemindEnabled} 
              onChange={(e) => setNotifyLineRemindEnabled(e.target.checked)} 
              style={{ width: '20px', height: '20px' }} 
            />
            <div>
              <span style={{ fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={16} /> リマインドLINEを送る
              </span>
              <span style={{ fontSize: '0.7rem', color: '#059669', display: 'block', marginTop: '2px' }}>
                ※24時間前に自動送信します（有料版機能）
              </span>
            </div>
          </label>

          {/* 各種キー入力 */}
          <label style={labelStyle}>Access Token</label>
          <input 
            type="password" 
            value={lineToken} 
            onChange={(e) => setLineToken(e.target.value)} 
            style={inputStyle} 
            placeholder="Messaging APIのアクセストークン"
          />

          <label style={labelStyle}>Admin User ID</label>
          <input 
            value={lineAdminId} 
            onChange={(e) => setLineAdminId(e.target.value)} 
            style={inputStyle} 
            placeholder="通知を受け取る管理者のLINE ID"
          />
        </div>
      </section>

      <button 
        onClick={handleSave} 
        style={{ 
          width: '100%', 
          padding: '16px', 
          background: '#00b900', 
          color: '#fff', 
          border: 'none', 
          borderRadius: '12px', 
          fontWeight: 'bold', 
          fontSize: '1rem',
          boxShadow: '0 4px 12px rgba(0,185,0,0.2)',
          cursor: 'pointer'
        }}
      >
        連携設定を保存する 💾
      </button>

      <div style={{ marginTop: '20px', padding: '15px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, lineHeight: '1.5' }}>
          <b>💡 設定のヒント:</b><br />
          LINE Developersの Messaging API設定 から「アクセストークン」を発行し、
          「あなたのユーザーID」を Admin User ID に貼り付けてください。
        </p>
      </div>
    </div>
  );
};

export default LineSettings;