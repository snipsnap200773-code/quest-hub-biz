import React, { useState, useEffect } from 'react';
import { Building2, Plus, MapPin, Calendar, Users, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const FacilityManagement = () => {
  // 施設データのステート（本来はSupabaseから取得）
  const [facilities, setFacilities] = useState([
    { id: 1, name: 'あずみ苑 町田', address: '東京都町田市...', visit_rule: '第2火曜 14:00', residents_count: 45 },
    { id: 2, name: 'ケアヒルズ 淵野辺', address: '神奈川県相模原市...', visit_rule: '各月 第3水曜', residents_count: 20 },
  ]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="text-indigo-600" /> 訪問先施設管理
        </h1>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition">
          <Plus size={20} /> 新規施設登録
        </button>
      </div>

      <div className="grid gap-4">
        {facilities.map((facility) => (
          <motion.div 
            key={facility.id}
            whileHover={{ scale: 1.01 }}
            className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition flex justify-between items-center"
          >
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-800">{facility.name}</h3>
              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1"><MapPin size={14} /> {facility.address}</span>
                <span className="flex items-center gap-1"><Calendar size={14} /> {facility.visit_rule}</span>
                <span className="flex items-center gap-1"><Users size={14} /> 入居者: {facility.residents_count}名</span>
              </div>
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-indigo-600 transition">
              <ChevronRight size={24} />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default FacilityManagement;