import React from 'react';
import { useApp } from '../../context/AppContext';

export const Header: React.FC = () => {
  const { pairingStatus, pairingStatusText, provider, model, apiKey, setIsServerGuideModalOpen } = useApp();

  let p2pBadgeCss = 'bg-slate-800 text-slate-400 border-slate-700';
  let p2pIcon = 'fa-globe';

  if (pairingStatus === 'connected') {
    p2pBadgeCss = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    p2pIcon = 'fa-mobile-screen-button';
  } else if (pairingStatus === 'error') {
    p2pBadgeCss = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    p2pIcon = 'fa-triangle-exclamation';
  }

  const isApiConfigured = Boolean(apiKey);

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 sticky top-0 z-40 backdrop-blur-md bg-opacity-80">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <i className="fa-solid fa-file-contract text-xl text-white"></i>
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 leading-tight">DocScan AI</h1>
            <p className="text-xs text-slate-400">P2P Сканер &amp; Экспресс OCR</p>
          </div>
        </div>

        {/* Status Badges & Server Guide */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${p2pBadgeCss}`}>
            <i className={`fa-solid ${p2pIcon}`}></i> P2P Cloud: {pairingStatusText}
          </span>

          {isApiConfigured ? (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <i className="fa-solid fa-robot"></i> {provider.toUpperCase()}: {model.split('/').pop()}
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
              <i className="fa-solid fa-triangle-exclamation"></i> API не настроен
            </span>
          )}

          <button
            onClick={() => setIsServerGuideModalOpen(true)}
            className="px-3 py-1 rounded-xl text-xs font-medium bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 border border-brand-500/30 transition flex items-center gap-1.5 cursor-pointer"
            title="Инструкция по развертыванию на личном сервере VPS"
          >
            <i className="fa-solid fa-server"></i> Запуск на VPS
          </button>
        </div>
      </div>
    </header>
  );
};
