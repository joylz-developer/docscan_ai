import React from 'react';
import { useApp } from '../../context/AppContext';

export const TabNavigation: React.FC = () => {
  const { activeTab, setActiveTab } = useApp();

  const tabs = [
    { id: 1, label: '1. Документы и Сканирование', icon: 'fa-images' },
    { id: 2, label: '2. Настройки Нейросети', icon: 'fa-sliders' },
    { id: 3, label: '3. P2P Сопряжение', icon: 'fa-qrcode' },
    { id: 4, label: '4. Реестр Документов', icon: 'fa-table-list' }
  ];

  return (
    <div className="bg-slate-900/50 border-b border-slate-800 px-6">
      <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-xs font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-brand-500 text-brand-400 bg-brand-900/20 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <i className={`fa-solid ${tab.icon}`}></i> {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
