import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { 
  ClipboardList, ArrowLeft, Save, CheckCircle2, 
  MapPin, Car, Building2, HeartPulse, MessageSquare, 
  Eye, ToggleLeft, ToggleRight,
  User, Mail, Phone
} from 'lucide-react';

const FormCustomizer = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [themeColor, setThemeColor] = useState('#2563eb');
  
  // 1. フォーム設定のState（通常とLINEを両方管理）
  const [formConfig, setFormConfig] = useState({
    name: { enabled: true, line_enabled: true, label: "お名前", required: true },
    email: { enabled: true, line_enabled: true, label: "メールアドレス", required: true },
    phone: { enabled: true, line_enabled: true, label: "電話番号", required: true },
    address: { enabled: true, line_enabled: true, label: "訪問先の住所", required: true },
    parking: { enabled: true, line_enabled: true, label: "駐車スペースの有無", required: false },
    building_type: { enabled: false, line_enabled: false, label: "建物の種類", required: false },
    care_notes: { enabled: false, line_enabled: false, label: "お身体の状況", required: false },
    notes: { enabled: true, line_enabled: true, label: "備考欄", required: false }
  });

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isPC = windowWidth > 900;

  useEffect(() => { if (shopId) fetchSettings(); }, [shopId]);

  const fetchSettings = async () => {
    const { data } = await supabase.from('profiles').select('theme_color, form_config').eq('id', shopId).single();
    if (data) {
      setThemeColor(data.theme_color || '#2563eb');
      if (data.form_config) setFormConfig(data.form_config);
    }
  };

  const showMsg = (txt) => { setMessage(txt); setTimeout(() => setMessage(''), 3000); };

  const handleSave = async () => {
    const { error } = await supabase.from('profiles').update({
      form_config: formConfig
    }).eq('id', shopId);

    if (!error) showMsg('予約項目の設定を保存しました！');
    else alert('保存に失敗しました。');
  };

  // 2. スイッチ切り替え関数（通常用とLINE用を引数で分ける）
  const toggleField = (key, type = 'normal') => {
    const targetKey = type === 'line' ? 'line_enabled' : 'enabled';
    setFormConfig(prev => ({
      ...prev,
      [key]: { 
        ...prev[key], 
        [targetKey]: !prev[key][targetKey] 
      }
    }));
  };

  const updateLabel = (key, newLabel) => {
    setFormConfig(prev => ({
      ...prev,
      [key]: { ...prev[key], label: newLabel }
    }));
  };

  const containerStyle = { fontFamily: 'sans-serif', maxWidth: '700px', margin: '0 auto', padding: '20px', paddingBottom: '120px' };
  const cardStyle = { marginBottom: '20px', background: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem' };
  
  // 3. 修正：2列トグル版の ConfigItem 定義（1つだけに統一）
  const ConfigItem = ({ id, icon: Icon, title, description }) => (
    <div style={{ marginBottom: '25px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
          <div style={{ padding: '10px', background: `${themeColor}10`, borderRadius: '12px', height: 'fit-content' }}>
            <Icon size={24} color={themeColor} />
          </div>
          <div>
            <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{title}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{description}</div>
          </div>
        </div>
        
        {/* 右側に2つのスイッチを並べる */}
        <div style={{ display: 'flex', gap: '24px', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>Web予約</div>
            <button onClick={() => toggleField(id, 'normal')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: formConfig[id].enabled ? themeColor : '#cbd5e1' }}>
              {formConfig[id].enabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
            </button>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', color: '#16a34a', marginBottom: '4px', fontWeight: 'bold' }}>LINE予約</div>
            <button onClick={() => toggleField(id, 'line')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: formConfig[id].line_enabled ? '#16a34a' : '#cbd5e1' }}>
              {formConfig[id].line_enabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
            </button>
          </div>
        </div>
      </div>
      
      {(formConfig[id].enabled || formConfig[id].line_enabled) && (
        <div style={{ marginLeft: '46px', animation: 'fadeIn 0.3s ease' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: themeColor, display: 'block', marginBottom: '6px' }}>表示ラベル名</label>
          <input 
            type="text" 
            value={formConfig[id].label} 
            onChange={(e) => updateLabel(id, e.target.value)} 
            style={inputStyle}
          />
        </div>
      )}
    </div>
  );

  return (
    <div style={containerStyle}>
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '12px', zIndex: 1001, textAlign: 'center', fontWeight: 'bold' }}>
          <CheckCircle2 size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> {message}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '30px' }}>
        <button onClick={() => navigate(`/admin/${shopId}/dashboard`)} style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '10px 20px', borderRadius: '30px', fontWeight: 'bold', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeft size={18} /> {isPC ? 'ダッシュボードへ' : '戻る'}
        </button>
      </div>

      <h2 style={{ fontSize: '1.4rem', color: '#1e293b', marginBottom: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <ClipboardList size={28} /> 予約フォーム設定
      </h2>
      <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '24px' }}>
        お客様の入り口（WebまたはLINE）ごとに、入力項目を使い分けられます。
      </p>

      <section style={{ ...cardStyle, borderTop: `8px solid ${themeColor}` }}>
        <ConfigItem id="name" icon={User} title="お名前" description="予約者の識別項目です。" />
        <ConfigItem id="email" icon={Mail} title="メールアドレス" description="通知の送信先になります。" />
        <ConfigItem id="phone" icon={Phone} title="電話番号" description="緊急時の連絡先です。" />
        <ConfigItem id="address" icon={MapPin} title="訪問先住所" description="訪問に必須の項目です。" />
        <ConfigItem id="parking" icon={Car} title="駐車スペース" description="駐車場の有無を確認します。" />
        <ConfigItem id="building_type" icon={Building2} title="建物の種類" description="マンション・戸建て等。" />
        <ConfigItem id="care_notes" icon={HeartPulse} title="お身体の状況・介助" description="介助の有無を確認します。" />
        <ConfigItem id="notes" icon={MessageSquare} title="自由備考欄" description="その他メッセージ。" />
      </section>

      <button onClick={handleSave} style={{ position: 'fixed', bottom: '24px', right: '24px', padding: '18px 40px', background: themeColor, color: '#fff', border: 'none', borderRadius: '50px', fontWeight: 'bold', boxShadow: `0 10px 25px ${themeColor}66`, zIndex: 1000, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '1.1rem' }}>
        <Save size={22} /> 設定を保存する
      </button>
    </div>
  );
};

export default FormCustomizer;