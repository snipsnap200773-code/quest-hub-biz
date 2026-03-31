import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom'; // 🚀 🆕 URLからIDを取るために追加
import { supabase } from '../supabaseClient';
import { Send, User, Mail, MessageSquare, Phone, CheckCircle2, MapPin } from 'lucide-react';

const InquiryForm = ({ shopId: propsShopId, themeColor: propsThemeColor }) => {
  // --- 1. IDの取得（Props または URLパラメータから） ---
  const { shopId: paramsShopId } = useParams();
  const shopId = propsShopId || paramsShopId; // 🚀 🆕 どちらからでも取れるように

  const [formData, setFormData] = useState({});
  const [standardFields, setStandardFields] = useState({});
  const [customQuestions, setCustomQuestions] = useState([]);
  const [themeColor, setThemeColor] = useState(propsThemeColor || '#2563eb');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- 2. 設定の取得 ---
  useEffect(() => {
    const fetchSettings = async () => {
      if (!shopId) return;
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('theme_color, form_config')
        .eq('id', shopId)
        .single();

      if (!error && data) {
        setThemeColor(data.theme_color || '#2563eb');
        if (data.form_config) {
          const { custom_questions, ...rest } = data.form_config;
          setStandardFields(rest || {});
          setCustomQuestions(custom_questions || []);
        }
      }
      setLoading(false);
    };
    fetchSettings();
  }, [shopId]);

  // 🚀 🆕 問合せスイッチ(inquiry_enabled)がONのものだけを抽出
  const activeStandardFields = Object.entries(standardFields)
    .filter(([key, config]) => config && config.inquiry_enabled === true)
    .map(([key, config]) => ({ id: key, ...config }));

  const activeCustomQuestions = customQuestions.filter(q => q && q.inquiry_enabled === true);

  // --- 3. ハンドラー ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCustomChange = (id, value) => {
    setCustomAnswers(prev => ({ ...prev, [id]: value }));
  };

  // 🚀 🆕 通知機能付きの送信処理
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 1. データベース (inquiriesテーブル) への保存
      const { error: dbError } = await supabase
        .from('inquiries')
        .insert([{
          shop_id: shopId,
          name: formData.name || '不明',
          email: formData.email || '',
          phone: formData.phone || '',
          content: formData.content,
          custom_answers: formData, 
          status: 'unread'
        }]);

      if (dbError) throw dbError;

      // 2. 🚀 🆕 ここを修正！ URLではなく「関数名」で呼び出します
      // supabase.functions.invoke を使うと、自動的に認証キーを添えてくれます
      const { error: funcError } = await supabase.functions.invoke('resend', {
        body: {
          type: 'inquiry',
          shopId: shopId,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          content: formData.content,
          custom_answers: formData 
        }
      });

      if (funcError) throw funcError;

      setIsSuccess(true);
    } catch (err) {
      console.error("送信エラー:", err);
      // 401エラーが出る場合は、ここに来ます
      alert("通知の送信に失敗しました。Edge Functionがデプロイされているか確認してください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '100px', color: '#64748b' }}>読み込み中...</div>;

  if (isSuccess) {
    return (
      <div style={successBoxStyle}>
        <CheckCircle2 size={48} color="#10b981" />
        <h3 style={{ marginTop: '15px' }}>送信完了</h3>
        <p style={{ color: '#64748b', fontSize: '0.85rem' }}>お問い合わせありがとうございました。</p>
        <button onClick={() => setIsSuccess(false)} style={backBtnStyle(themeColor)}>戻る</button>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <form onSubmit={handleSubmit} style={formStyle}>
        <h3 style={titleStyle}><MessageSquare size={20} color={themeColor} /> お問い合わせ</h3>
        
        {/* A. 基本項目の動的表示 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {activeStandardFields.map((field) => (
            <div key={field.id} style={inputGroup}>
              <label style={labelStyle}>{field.label} {field.required && <span style={{color:'#ef4444'}}>*</span>}</label>
              <input 
                type={field.id === 'email' ? 'email' : field.id === 'phone' ? 'tel' : 'text'} 
                name={field.id} 
                required={field.required} 
                onChange={handleInputChange} 
                style={inputStyle} 
                placeholder={field.label} 
              />
            </div>
          ))}
        </div>

        {/* B. カスタム質問の動的表示 */}
        {activeCustomQuestions.map((q) => (
          <div key={q.id} style={inputGroup}>
            <label style={labelStyle}>{q.label} {q.required && <span style={{color:'#ef4444'}}>*</span>}</label>
            {q.options ? (
              <select name={q.id} required={q.required} onChange={handleInputChange} style={inputStyle}>
                <option value="">選択してください</option>
                {q.options.split(',').map(opt => <option key={opt} value={opt}>{opt.trim()}</option>)}
              </select>
            ) : (
              <input type="text" name={q.id} required={q.required} onChange={handleInputChange} style={inputStyle} placeholder={q.label} />
            )}
          </div>
        ))}

        {/* C. 固定：お問い合わせ内容 */}
        <div style={{ ...inputGroup, borderTop: '1px dashed #e2e8f0', paddingTop: '15px' }}>
          <label style={labelStyle}>お問い合わせ内容 <span style={{color:'#ef4444'}}>*</span></label>
          <textarea name="content" required onChange={handleInputChange} style={{ ...inputStyle, minHeight: '120px' }} placeholder="ご質問などをご入力ください" />
        </div>

        <button type="submit" disabled={isSubmitting} style={submitBtnStyle(themeColor)}>
          {isSubmitting ? '送信中...' : 'この内容で送信する'} <Send size={18} />
        </button>
      </form>
    </div>
  );
};

// --- スタイル (前回と同じ) ---
const containerStyle = { maxWidth: '480px', margin: '0 auto', padding: '20px' };
const formStyle = { background: '#fff', padding: '25px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' };
const titleStyle = { margin: '0 0 20px 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' };
const inputGroup = { marginBottom: '15px' };
const labelStyle = { fontSize: '0.8rem', fontWeight: 'bold', color: '#475569', marginBottom: '6px', display: 'block' };
const inputStyle = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box', background: '#f8fafc' };
const submitBtnStyle = (color) => ({ width: '100%', padding: '16px', borderRadius: '16px', background: color, color: '#fff', border: 'none', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' });
const successBoxStyle = { textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0' };
const backBtnStyle = (color) => ({ marginTop: '25px', padding: '10px 30px', borderRadius: '12px', border: `2px solid ${color}`, background: 'transparent', color: color, fontWeight: 'bold', cursor: 'pointer' });

export default InquiryForm;