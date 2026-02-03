import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { ChevronRight, ChevronLeft, Plus, Trash2, CheckCircle2, ListTree, Scissors } from 'lucide-react';

const MenuSettingsGuide = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();

  const [step, setStep] = useState(0); 
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [newCatName, setNewCatName] = useState('');

  useEffect(() => { if (shopId) fetchData(); }, [shopId]);

  const fetchData = async () => {
    const catRes = await supabase.from('service_categories').select('*').eq('shop_id', shopId).order('sort_order');
    const servRes = await supabase.from('services').select('*').eq('shop_id', shopId).order('sort_order');
    if (catRes.data) setCategories(catRes.data);
    if (servRes.data) setServices(servRes.data);
  };

  const addCategory = async () => {
    if (!newCatName) return;
    const { data, error } = await supabase.from('service_categories').insert([{ name: newCatName, shop_id: shopId, sort_order: categories.length }]).select();
    if (!error) { setCategories([...categories, data[0]]); setNewCatName(''); }
  };

  const addService = async (catName) => {
    const name = window.prompt(`${catName} に追加するメニュー名を入力してください`);
    if (!name) return;
    const { data, error } = await supabase.from('services').insert([{ name, category: catName, shop_id: shopId, slots: 2, sort_order: services.length }]).select();
    if (!error) setServices([...services, data[0]]);
  };

  const containerStyle = { minHeight: '100vh', background: '#0f172a', color: '#fff', padding: '40px 20px', fontFamily: 'sans-serif', boxSizing: 'border-box' };
  const cardStyle = { maxWidth: '500px', margin: '0 auto', textAlign: 'center' };
  const btnPrimary = { width: '100%', padding: '16px', borderRadius: '40px', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginTop: '20px' };
  const inputStyle = { width: '100%', padding: '15px', borderRadius: '12px', background: '#1e293b', border: '2px solid #334155', color: '#fff', fontSize: '1rem', marginBottom: '10px', boxSizing: 'border-box' };

  return (
    <div style={containerStyle}>
      <div style={{ maxWidth: '500px', margin: '0 auto 40px', height: '6px', background: '#334155', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${(step + 1) * 50}%`, height: '100%', background: '#3b82f6', transition: '0.4s' }} />
      </div>

      {step === 0 ? (
        <div style={cardStyle}>
          <ListTree size={48} style={{ marginBottom: '20px', color: '#3b82f6' }} />
          <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>メニューの「分類」を教えてください。</h2>
          <p style={{ color: '#94a3b8', marginBottom: '30px' }}>カット、カラー、などの大きなグループです。</p>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input style={{ ...inputStyle, marginBottom: 0 }} placeholder="分類名（例：カット）" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
            <button onClick={addCategory} style={{ padding: '0 20px', background: '#3b82f6', border: 'none', borderRadius: '12px', color: '#fff' }}><Plus /></button>
          </div>
          {categories.map(c => (
            <div key={c.id} style={{ background: '#1e293b', padding: '15px', borderRadius: '12px', marginBottom: '10px', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
              <span>{c.name}</span>
            </div>
          ))}
          <button style={btnPrimary} onClick={() => setStep(1)} disabled={categories.length === 0}>次へ：メニューの詳細を作る</button>
        </div>
      ) : (
        <div style={cardStyle}>
          <Scissors size={48} style={{ marginBottom: '20px', color: '#ec4899' }} />
          <h2 style={{ fontSize: '1.5rem', marginBottom: '30px' }}>具体的な品目を追加しましょう。</h2>
          {categories.map(cat => (
            <div key={cat.id} style={{ marginBottom: '30px', textAlign: 'left' }}>
              <h3 style={{ borderLeft: '4px solid #3b82f6', paddingLeft: '10px', marginBottom: '15px', fontSize: '1rem' }}>{cat.name}</h3>
              {services.filter(s => s.category === cat.name).map(s => (
                <div key={s.id} style={{ background: '#1e293b', padding: '12px', borderRadius: '8px', marginBottom: '8px' }}>{s.name}</div>
              ))}
              <button onClick={() => addService(cat.name)} style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px dashed #475569', borderRadius: '8px', color: '#94a3b8' }}>＋ メニューを追加</button>
            </div>
          ))}
          <button style={{ ...btnPrimary, background: '#10b981' }} onClick={() => navigate(`/admin/${shopId}/dashboard`)}>
            全メニューの登録を完了する <CheckCircle2 size={18} style={{ marginLeft: '8px' }} />
          </button>
          <button style={{ width: '100%', background: 'none', border: 'none', color: '#94a3b8', marginTop: '15px' }} onClick={() => setStep(0)}>カテゴリ作成に戻る</button>
        </div>
      )}
    </div>
  );
};

export default MenuSettingsGuide;