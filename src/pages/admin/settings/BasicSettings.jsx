import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom'; // URLからshopIdを取得するため
import { supabase } from '../../../supabaseClient'; // 👈 パスとファイル名を修正
import { Save, UserCircle } from 'lucide-react';

const BasicSettings = () => {
  const { shopId } = useParams();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({
    business_name: '',
    business_type: '',
    business_style: 'solo',
    description: '',
    address: '',
    phone: '',
    industry_id: 'warrior' 
  });

  useEffect(() => {
    if (shopId) {
      getProfile();
    }
  }, [shopId]);

  const getProfile = async () => {
    try {
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', shopId)
        .single();

      if (data) setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .upsert({ 
        id: shopId, 
        ...profile, 
        updated_at: new Date() 
      });

    if (error) {
      alert('保存に失敗しました: ' + error.message);
    } else {
      alert('ギルド（店舗）情報を更新しました！');
    }
    setLoading(false);
  };

  if (loading) return <div className="p-8 text-center text-gray-500">ギルド情報を確認中...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-10">
        <h2 className="text-2xl font-bold text-gray-800 mb-8 flex items-center gap-2">
          <UserCircle className="text-indigo-600" /> 基本情報設定
        </h2>

        <div className="grid grid-cols-1 gap-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">酒場（店）の名前</label>
            <input 
              type="text" 
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition"
              value={profile.business_name || ''}
              onChange={(e) => setProfile({...profile, business_name: e.target.value})}
              placeholder="例：ソロ・サロン QUEST"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">職業カテゴリ（業種）</label>
            <select 
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              value={profile.business_type || ''}
              onChange={(e) => setProfile({...profile, business_type: e.target.value})}
            >
              <option value="">選択してください</option>
              <option value="beauty">美容・サロン（戦士の身だしなみ）</option>
              <option value="health">整体・リラク（僧侶の癒やし）</option>
              <option value="food">飲食・カフェ（冒険者の飯屋）</option>
              <option value="visit">出張・訪問（旅の商人）</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">案内人マスコットの職業</label>
            <div className="grid grid-cols-4 gap-4">
              {['warrior', 'mage', 'priest', 'thief'].map((job) => (
                <button
                  key={job}
                  onClick={() => setProfile({...profile, industry_id: job})}
                  className={`p-4 rounded-xl border-2 transition text-center ${
                    profile.industry_id === job 
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-600' 
                    : 'border-gray-100 grayscale hover:grayscale-0 bg-gray-50'
                  }`}
                >
                  <div className="text-2xl mb-1">
                    {job === 'warrior' && '⚔️'}
                    {job === 'mage' && '🧙'}
                    {job === 'priest' && '⛪'}
                    {job === 'thief' && '🗝️'}
                  </div>
                  <span className="text-xs font-bold uppercase">{job}</span>
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={handleSave}
            disabled={loading}
            className="mt-6 w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition flex items-center justify-center gap-2"
          >
            <Save size={20} />
            ギルド情報を保存する
          </button>
        </div>
      </div>
    </div>
  );
};

export default BasicSettings;