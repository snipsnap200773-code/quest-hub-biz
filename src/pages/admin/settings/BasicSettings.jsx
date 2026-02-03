import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";

const BasicSettings = () => {
  const { shopId } = useParams();

  // --- 1. State 管理 (本家から完全移植) ---
  const [message, setMessage] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessNameKana, setBusinessNameKana] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerNameKana, setOwnerNameKana] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [phone, setPhone] = useState('');
  const [emailContact, setEmailContact] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [introText, setIntroText] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [officialUrl, setOfficialUrl] = useState('');
  const [themeColor, setThemeColor] = useState('#2563eb');

  useEffect(() => {
    if (shopId) fetchInitialShopData();
  }, [shopId]);

  const fetchInitialShopData = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (data) {
      setBusinessName(data.business_name || '');
      setBusinessNameKana(data.business_name_kana || '');
      setOwnerName(data.owner_name || '');
      setOwnerNameKana(data.owner_name_kana || '');
      setBusinessType(data.business_type || '');
      setPhone(data.phone || '');
      setEmailContact(data.email_contact || '');
      setAddress(data.address || '');
      setDescription(data.description || '');
      setIntroText(data.intro_text || '');
      setNotes(data.notes || '');
      setImageUrl(data.image_url || '');
      setOfficialUrl(data.official_url || '');
      setThemeColor(data.theme_color || '#2563eb');
    }
  };

  const showMsg = (txt) => { setMessage(txt); setTimeout(() => setMessage(''), 3000); };

  // --- 画像アップロード処理 (修正済みの確実なロジック) ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fileExt = file.name.split('.').pop();
    const fileName = `${shopId}-main.${fileExt}`;
    
    showMsg('画像を更新中...');

    // --- BasicSettings.jsx の 63行目付近 ---
const { data, error: uploadError } = await supabase.storage
  .from('shop-images')
  .upload(fileName, file, { 
    contentType: 'image/jpeg', // 明示的に指定してみる
    upsert: true 
  });

if (uploadError) {
  // ここで詳細なエラーメッセージを確認
  console.error("Storage詳細エラー:", uploadError); 
  alert('アップロード失敗: ' + uploadError.message);
  return;
}

    // 2. 公開URLを取得
    const { data: urlData } = supabase.storage
      .from('shop-images')
      .getPublicUrl(fileName);
    
    const publicUrl = urlData.publicUrl;

    // 3. データベースの image_url 列を即座に更新 (EMPTY回避)
    const { error: dbError } = await supabase
      .from('profiles')
      .update({ image_url: publicUrl })
      .eq('id', shopId);

    if (dbError) {
      alert('DBのURL更新に失敗しました: ' + dbError.message);
      return;
    }

    // 4. ステートを更新 (キャッシュ対策のタイムスタンプ付与)
    setImageUrl(`${publicUrl}?t=${Date.now()}`);
    showMsg('画像を拠点の看板として掲げました！');
  };
  
  // --- 保存処理 ---
  const handleSave = async () => {
    const { error } = await supabase.from('profiles').update({
      business_name: businessName, business_name_kana: businessNameKana,
      owner_name: ownerName, owner_name_kana: ownerNameKana,
      business_type: businessType, phone, email_contact: emailContact, address,
      description, intro_text: introText, notes, image_url: imageUrl, official_url: officialUrl
    }).eq('id', shopId);

    if (!error) showMsg('店舗プロフィールを保存しました！');
    else alert('保存に失敗しました。');
  };

  // スタイル定義
  const cardStyle = { marginBottom: '20px', background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #ddd', boxSizing: 'border-box', width: '100%' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '1rem', background: '#fff' };

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '700px', margin: '0 auto', padding: '20px', paddingBottom: '120px' }}>
      {message && <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '8px', zIndex: 1001, textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>{message}</div>}

      <section style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: '20px' }}>🏪 店舗プロフィール</h3>
        
        {/* --- 🖼️ 店舗画像セクション (本家を忠実に再現) --- */}
        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>店舗画像（推奨 1:1）</label>
        <div style={{ marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt="preview" 
              style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '12px', marginBottom: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }} 
            />
          ) : (
            <div style={{ width: '120px', height: '120px', background: '#e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.7rem', margin: '0 auto 12px' }}>
              NO IMAGE
            </div>
          )}
          <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              onChange={handleFileUpload} 
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 2 }} 
            />
            <button 
              type="button" 
              style={{ width: '100%', padding: '12px', background: '#fff', border: `1px solid ${themeColor}`, color: themeColor, borderRadius: '10px', fontWeight: 'bold', fontSize: '0.9rem' }}
            >
              📸 写真を撮る / 変更する
            </button>
          </div>
        </div>

        {/* 店舗名・代表者名 */}
        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>店舗名 / かな</label>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} style={inputStyle} placeholder="店舗名" />
          <input value={businessNameKana} onChange={(e) => setBusinessNameKana(e.target.value)} style={inputStyle} placeholder="かな" />
        </div>

        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>代表者名 / かな</label>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} style={inputStyle} placeholder="代表者名" />
          <input value={ownerNameKana} onChange={(e) => setOwnerNameKana(e.target.value)} style={inputStyle} placeholder="かな" />
        </div>

        {/* 業種・URL */}
        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>業種</label>
        <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }}>
          <option value="美容室・理容室">美容室・理容室</option>
          <option value="ネイル・アイラッシュ">ネイル・アイラッシュ</option>
          <option value="エステ・リラク">エステ・リラク</option>
          <option value="整体・接骨院・針灸">整体・接骨院・針灸</option>
          <option value="飲食店・カフェ">飲食店・カフェ</option>
          <option value="その他・ライフ">その他・ライフ</option>
        </select>
        
        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>🌐 公式サイトURL</label>
        <input value={officialUrl} onChange={(e) => setOfficialUrl(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} placeholder="https://..." />
        
        {/* 基本連絡先 */}
        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>住所</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} />
        
        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>電話番号</label>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} />
        
        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>メール</label>
        <input type="email" value={emailContact} onChange={(e) => setEmailContact(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} />
        
        {/* サブタイトル (プレビュー付き) */}
        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>サブタイトル</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, marginBottom: '8px' }} placeholder="スラッシュ(/)で改行できます" />
        <div style={{ marginBottom: '20px', padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: themeColor, lineHeight: '1.5' }}>
            {description ? description.split('/').map((line, idx) => (
              <React.Fragment key={idx}>{line}{idx < description.split('/').length - 1 && <br />}</React.Fragment>
            )) : 'プレビューが表示されます'}
          </div>
        </div>

        {/* 紹介・詳細 */}
        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>店舗紹介・詳細アピール文</label>
        <textarea value={introText} onChange={(e) => setIntroText(e.target.value)} style={{ ...inputStyle, minHeight: '150px', marginBottom: '15px' }} />
        
        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>注意事項</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, border: '2px solid #ef4444', minHeight: '80px' }} />

        <button 
          onClick={handleSave} 
          style={{ width: '100%', padding: '16px', background: themeColor, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', marginTop: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', cursor: 'pointer' }}
        >
          店舗プロフィールを保存する 💾
        </button>
      </section>
    </div>
  );
};

export default BasicSettings;