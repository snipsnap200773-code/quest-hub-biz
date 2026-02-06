import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { Mail, ArrowLeft, Save, CheckCircle2, MessageSquare, User, Bell, Trash2, Clock, Globe, Info } from 'lucide-react';

const EmailSettings = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('customer_booking');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [shopData, setShopData] = useState(null);

  // 全テンプレートのState管理
  const [templates, setTemplates] = useState({
    customer_booking: { sub: '', body: '' },
    customer_remind: { sub: '', body: '', enabled: true },
    customer_cancel: { sub: '', body: '' },
    shop_booking: { sub: '', body: '' },
    shop_cancel: { sub: '', body: '' }
  });

  const themeColor = shopData?.theme_color || '#2563eb';

  useEffect(() => { if (shopId) fetchSettings(); }, [shopId]);

  const fetchSettings = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (data) {
      setShopData(data);
      setTemplates({
        customer_booking: { sub: data.mail_sub_customer_booking || '', body: data.mail_body_customer_booking || '' },
        customer_remind: { sub: data.mail_sub_customer_remind || '', body: data.mail_body_customer_remind || '', enabled: data.notify_mail_remind_enabled ?? true },
        customer_cancel: { sub: data.mail_sub_customer_cancel || '', body: data.mail_body_customer_cancel || '' },
        shop_booking: { sub: data.mail_sub_shop_booking || '', body: data.mail_body_shop_booking || '' },
        shop_cancel: { sub: data.mail_sub_shop_cancel || '', body: data.mail_body_shop_cancel || '' }
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    const { error } = await supabase.from('profiles').update({
      mail_sub_customer_booking: templates.customer_booking.sub,
      mail_body_customer_booking: templates.customer_booking.body,
      mail_sub_customer_remind: templates.customer_remind.sub,
      mail_body_customer_remind: templates.customer_remind.body,
      notify_mail_remind_enabled: templates.customer_remind.enabled,
      mail_sub_customer_cancel: templates.customer_cancel.sub,
      mail_body_customer_cancel: templates.customer_cancel.body,
      mail_sub_shop_booking: templates.shop_booking.sub,
      mail_body_shop_booking: templates.shop_booking.body,
      mail_sub_shop_cancel: templates.shop_cancel.sub,
      mail_body_shop_cancel: templates.shop_cancel.body
    }).eq('id', shopId);

    if (!error) {
      setMessage('全ての設定を保存しました！');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const insertTag = (tag) => {
    const current = templates[activeTab];
    setTemplates({ ...templates, [activeTab]: { ...current, body: current.body + tag } });
  };

  const getPreview = (text) => {
    return text.replace(/{name}/g, '三土手 功真')
               .replace(/{shop_name}/g, shopData?.business_name || '美容室SOLO')
               .replace(/{start_time}/g, '2026/02/10 14:00')
               .replace(/{services}/g, 'カット ＆ カラー')
               .replace(/{cancel_url}/g, 'https://solo.biz/cancel/...')
               .replace(/{official_url}/g, 'https://instagram.com/...');
  };

  if (loading) return null;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px', paddingBottom: '120px', fontFamily: 'sans-serif' }}>
      
      {/* ナビゲーション */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
        <button onClick={() => navigate(`/admin/${shopId}/dashboard`)} style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '10px 20px', borderRadius: '30px', fontWeight: 'bold', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeft size={18} /> ダッシュボードへ
        </button>
        <button onClick={handleSave} style={{ background: themeColor, color: '#fff', border: 'none', padding: '12px 30px', borderRadius: '30px', fontWeight: 'bold', boxShadow: `0 4px 15px ${themeColor}44`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Save size={18} /> 設定を保存する
        </button>
      </div>

      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '24px' }}>✉️ 通知メールのカスタマイズ</h2>

      {/* タブメニュー */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '10px' }}>
        {[
          { id: 'customer_booking', label: '予約完了 (客)', icon: <CheckCircle2 size={16}/> },
          { id: 'customer_remind', label: 'リマインド (客)', icon: <Clock size={16}/> },
          { id: 'customer_cancel', label: 'キャンセル (客)', icon: <Trash2 size={16}/> },
          { id: 'shop_booking', label: '新着予約 (店)', icon: <Bell size={16}/> },
          { id: 'shop_cancel', label: 'キャンセル (店)', icon: <Info size={16}/> }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: '12px 20px', borderRadius: '12px', border: 'none', background: activeTab === tab.id ? '#1e293b' : '#fff', color: activeTab === tab.id ? '#fff' : '#64748b', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: activeTab === tab.id ? '0 4px 10px rgba(0,0,0,0.1)' : 'none' }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        
        {/* 左側：エディタ */}
        <div>
          <section style={{ background: '#fff', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            
            {activeTab === 'customer_remind' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={templates.customer_remind.enabled} onChange={e => setTemplates({...templates, customer_remind: {...templates.customer_remind, enabled: e.target.checked}})} style={{ width: '20px', height: '20px' }} />
                <span style={{ fontWeight: 'bold', color: '#1e293b' }}>リマインドメールを自動送信する</span>
              </label>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>件名</label>
              <input value={templates[activeTab].sub} onChange={e => setTemplates({...templates, [activeTab]: {...templates[activeTab], sub: e.target.value}})} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '1rem' }} placeholder="例: ご予約ありがとうございます" />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>本文</label>
              
              {/* 魔法のタグボタン（店主さんに分かりやすい日本語ラベル） */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {[
                  { t: '{name}', l: 'お客様名' },
                  { t: '{start_time}', l: '予約日時' },
                  { t: '{services}', l: 'メニュー内容' },
                  { t: '{shop_name}', l: '店名' },
                  { t: '{cancel_url}', l: 'キャンセル用URL' },
                  { t: '{official_url}', l: '公式HP/SNS' }
                ].map(tag => (
                  <button key={tag.t} onClick={() => insertTag(tag.t)} style={{ padding: '6px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', color: '#475569', cursor: 'pointer' }}>
                    [{tag.l}]
                  </button>
                ))}
              </div>

              <textarea value={templates[activeTab].body} onChange={e => setTemplates({...templates, [activeTab]: {...templates[activeTab], body: e.target.value}})} style={{ width: '100%', minHeight: '300px', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '1rem', lineHeight: '1.6' }} placeholder="ここに文章を入力してください。上のボタンを押すと自動で情報が埋め込まれます。" />
            </div>
            
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>
              ※空欄にすると三土手さん設計の「標準デザイン」で送信されます。
            </p>
          </section>
        </div>

        {/* 右側：ライブプレビュー */}
        <div>
          <div style={{ position: 'sticky', top: '20px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#10b981', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={18} /> リアルタイム・プレビュー
            </h3>
            <div style={{ background: '#fff', borderRadius: '24px', border: '8px solid #1e293b', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
              <div style={{ padding: '15px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>件名:</span>
                <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{getPreview(templates[activeTab].sub) || '（件名がここに入ります）'}</div>
              </div>
              <div style={{ padding: '20px', height: '480px', overflowY: 'auto', whiteSpace: 'pre-wrap', color: '#334155', fontSize: '0.9rem', lineHeight: '1.7' }}>
                {getPreview(templates[activeTab].body) || 'ここに本文のプレビューが表示されます。\n\n[お客様名] などのボタンを使うと、実際のお客様の名前に自動で切り替わります。'}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EmailSettings;