import React, { useEffect, useState, useRef } from 'react';
import { supabase } from "../../../supabaseClient";
import { 
  Plus, ChevronUp, ChevronDown, Edit2, Trash2, 
  Settings2, Link2, AlertCircle, CheckCircle2 
} from 'lucide-react';

const MenuSettings = ({ shopId, industryType }) => {
  // --- 1. State 管理 (SOLOから継承) ---
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 編集用State
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [activeServiceIdForOptions, setActiveServiceIdForOptions] = useState(null);
  
  // フォーム用State
  const [categoryForm, setCategoryForm] = useState({ name: '', url_key: '', custom_shop_name: '' });
  const [serviceForm, setServiceForm] = useState({ name: '', slots: 1, category: '' });
  const [optionForm, setOptionForm] = useState({ group_name: '', name: '', slots: 0 });

  useEffect(() => {
    fetchMenuData();
  }, [shopId]);

  const fetchMenuData = async () => {
    setLoading(true);
    // SOLOの fetchMenuDetails ロジックを継承
    const [catRes, servRes, optRes] = await Promise.all([
      supabase.from('service_categories').select('*').eq('shop_id', shopId).order('sort_order'),
      supabase.from('services').select('*').eq('shop_id', shopId).order('sort_order'),
      supabase.from('service_options').select('*') // 必要に応じてフィルタリング
    ]);
    
    if (catRes.data) setCategories(catRes.data);
    if (servRes.data) setServices(servRes.data);
    if (optRes.data) setOptions(optRes.data);
    setLoading(false);
  };

  // --- 2. 業種別フィールド最適化ロジック ---
  const renderIndustryFields = () => {
    switch (industryType) {
      case '美容室・理容室':
        return (
          <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
            <CheckCircle2 size={12} /> 美容室向け：ロング料金設定が有効
          </div>
        );
      case '飲食店・カフェ':
        return (
          <div className="text-xs text-orange-600 mt-1 flex items-center gap-1">
            <AlertCircle size={12} /> 飲食向け：テーブル番号連動が有効
          </div>
        );
      default:
        return null;
    }
  };

  // --- 3. 共通アクション (move, delete, submitなどはSOLOから移植) ---
  const handleMove = async (type, id, direction) => {
    // SOLOの moveItem ロジックをここに移植
    console.log(`Move ${type} ${id} ${direction}`);
  };

  if (loading) return <div className="p-8 text-center text-gray-500">データを読み込み中...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8">
      
      {/* --- カテゴリ設定セクション --- */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4 text-gray-800">
          <Settings2 size={20} className="text-indigo-600" />
          <h2 className="font-bold text-lg">カテゴリ管理</h2>
        </div>
        
        {/* フォーム部分 (SOLOの handleCategorySubmit 相当) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <input 
            className="border rounded-lg p-2 text-sm" 
            placeholder="カテゴリ名"
            value={categoryForm.name}
            onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})}
          />
          <input 
            className="border rounded-lg p-2 text-sm" 
            placeholder="識別キー (URL用)"
            value={categoryForm.url_key}
            onChange={(e) => setCategoryForm({...categoryForm, url_key: e.target.value})}
          />
          <button className="bg-indigo-600 text-white rounded-lg py-2 font-bold text-sm hover:bg-indigo-700 transition">
            {editingCategoryId ? '更新' : 'カテゴリ追加'}
          </button>
        </div>

        {/* リスト部分 */}
        <div className="space-y-2">
          {categories.map((cat, idx) => (
            <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div>
                <span className="font-bold text-gray-700">{cat.name}</span>
                <span className="ml-2 text-xs text-gray-400">/{cat.url_key}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleMove('category', cat.id, 'up')} className="p-1 hover:bg-gray-200 rounded"><ChevronUp size={16}/></button>
                <button onClick={() => handleMove('category', cat.id, 'down')} className="p-1 hover:bg-gray-200 rounded"><ChevronDown size={16}/></button>
                <button className="p-1 hover:bg-blue-100 text-blue-600 rounded"><Edit2 size={16}/></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- メニュー登録セクション --- */}
      <section className="bg-indigo-50 rounded-xl border border-indigo-100 p-6">
        <h3 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
          <Plus size={18} /> メニュー新規登録
        </h3>
        <div className="space-y-4">
          <select 
            className="w-full border-gray-300 rounded-lg p-2.5 text-sm bg-white"
            value={serviceForm.category}
            onChange={(e) => setServiceForm({...serviceForm, category: e.target.value})}
          >
            <option value="">-- カテゴリを選択 --</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          
          <input 
            className="w-full border-gray-300 rounded-lg p-2.5 text-sm bg-white" 
            placeholder="メニュー名（例：カット＆カラー）"
            value={serviceForm.name}
            onChange={(e) => setServiceForm({...serviceForm, name: e.target.value})}
          />

          <div>
            <label className="text-xs font-bold text-gray-500 mb-2 block">必要コマ数（1コマ15分想定）</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 6, 8].map(n => (
                <button 
                  key={n}
                  onClick={() => setServiceForm({...serviceForm, slots: n})}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold border transition ${
                    serviceForm.slots === n ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            {renderIndustryFields()}
          </div>

          <button className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700">
            メニューを保存する
          </button>
        </div>
      </section>

      {/* --- サービス一覧 & 枝メニュー --- */}
      <div className="space-y-6">
        {categories.map(cat => (
          <div key={cat.id}>
            <div className="flex items-center gap-2 mb-3 border-l-4 border-indigo-500 pl-3">
              <h4 className="font-bold text-gray-600">{cat.name}</h4>
              <Link2 size={14} className="text-gray-400" />
            </div>
            
            <div className="grid gap-3">
              {services.filter(s => s.category === cat.name).map(service => (
                <ServiceCard 
                  key={service.id} 
                  service={service} 
                  options={options.filter(o => o.service_id === service.id)}
                  onToggleOptions={() => setActiveServiceIdForOptions(
                    activeServiceIdForOptions === service.id ? null : service.id
                  )}
                  isOpen={activeServiceIdForOptions === service.id}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// サブコンポーネント: サービスカード (SOLOの枝メニュー表示を内包)
const ServiceCard = ({ service, options, onToggleOptions, isOpen }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition">
      <div className="p-4 flex items-center justify-between">
        <div>
          <h5 className="font-bold text-gray-800">{service.name}</h5>
          <p className="text-xs text-indigo-500 font-medium">{service.slots * 15}分 ({service.slots}コマ)</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={onToggleOptions}
            className={`px-3 py-1 rounded-md text-xs font-bold transition ${
              isOpen ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            枝メニュー {options.length > 0 && `(${options.length})`}
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"><Trash2 size={16}/></button>
        </div>
      </div>
      
      {/* 枝メニューエリア (SOLOの activeServiceForOptions ロジック) */}
      {isOpen && (
        <div className="bg-gray-50 p-4 border-t border-gray-100 space-y-3">
          <div className="flex gap-2">
            <input className="flex-1 text-xs p-2 border rounded" placeholder="オプション名（例：指名料）" />
            <input className="w-16 text-xs p-2 border rounded" type="number" placeholder="+コマ" />
            <button className="bg-gray-800 text-white px-3 py-1 rounded-md text-xs font-bold">追加</button>
          </div>
          <div className="space-y-1">
            {options.map(opt => (
              <div key={opt.id} className="flex justify-between items-center text-sm py-1 border-b border-gray-200 last:border-0">
                <span className="text-gray-600">{opt.option_name}</span>
                <span className="text-gray-400 text-xs">+{opt.additional_slots}コマ</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuSettings;