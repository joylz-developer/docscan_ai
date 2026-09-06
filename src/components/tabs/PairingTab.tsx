import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';

export const PairingTab: React.FC = () => {
  const {
    sessionId,
    reconnectSession,
    pairingStatus,
    connectionChannel,
    customHost,
    setCustomHost,
    pairingUrl,
    serverInfo
  } = useApp();

  const { showToast } = useToast();
  const [hostInput, setHostInput] = useState(customHost);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setHostInput(customHost);
  }, [customHost]);

  useEffect(() => {
    if (canvasRef.current && pairingUrl) {
      QRCode.toCanvas(
        canvasRef.current,
        pairingUrl,
        {
          width: 200,
          margin: 1,
          color: {
            dark: '#1e3a8a',
            light: '#ffffff'
          }
        },
        (err) => {
          if (err) console.error('QRCode rendering error:', err);
        }
      );
    }
  }, [pairingUrl]);

  const handleApplyHost = () => {
    setCustomHost(hostInput.trim());
    showToast('Адрес подключения обновлен', 'success');
  };

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(pairingUrl);
    } else {
      const tempInput = document.createElement('input');
      tempInput.value = pairingUrl;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
    }
    showToast('Ссылка сопряжения скопирована в буфер', 'success');
  };

  // Connection badge styling
  let routeBadge = {
    color: 'bg-slate-800 text-slate-400 border-slate-700',
    icon: 'fa-circle-notch animate-spin text-slate-500',
    text: 'Ожидание подключения смартфона...'
  };

  if (pairingStatus === 'connected') {
    if (connectionChannel === 'local_wifi') {
      routeBadge = {
        color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
        icon: 'fa-wifi text-emerald-400',
        text: 'Прямой P2P (Локальная сеть Wi-Fi)'
      };
    } else if (connectionChannel === 'stun_p2p') {
      routeBadge = {
        color: 'bg-brand-500/10 text-brand-300 border-brand-500/30',
        icon: 'fa-earth-americas text-brand-400',
        text: 'Прямой P2P (Интернет / STUN)'
      };
    } else if (connectionChannel === 'turn_relay') {
      routeBadge = {
        color: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
        icon: 'fa-shield-halved text-indigo-400',
        text: 'Защищенный TURN Relay'
      };
    } else {
      routeBadge = {
        color: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
        icon: 'fa-server text-purple-400',
        text: 'Серверный Relay (VPS WebSocket)'
      };
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Transparent Notice */}
      <div className="bg-gradient-to-r from-brand-950/40 via-slate-900 to-indigo-950/40 border border-brand-500/20 rounded-2xl p-4 text-xs space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 font-bold text-brand-200">
            <i className="fa-solid fa-wand-magic-sparkles text-brand-400 text-sm"></i>
            Бесшовное сопряжение One-QR (Wi-Fi, 4G, 5G)
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            ✓ WebRTC ICE Active
          </span>
        </div>
        <p className="text-slate-400 leading-relaxed">
          Вам больше не нужно выбирать тип сети. Система сама определит оптимальный маршрут: если телефон рядом по Wi-Fi — данные пойдут напрямую по локальной сети; если вы в дороге на 4G/5G — через защищённый WebRTC канал.
        </p>
      </div>

      {/* Main Pairing Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          
          <div className="space-y-5 flex-1 w-full">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-3 h-3 rounded-full ${pairingStatus === 'connected' ? 'bg-emerald-500' : 'bg-brand-500 animate-pulse'}`}></span>
                <h2 className="text-lg font-bold text-slate-100">Сопряжение Со Смартфоном</h2>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-lg">
                Отсканируйте QR-код камерой вашего телефона. Снимки документов будут мгновенно передаваться на ваш компьютер без загрузки на сторонние облачные диски.
              </p>
            </div>

            {/* Session Code Box */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="bg-slate-950 px-5 py-3 rounded-2xl border border-slate-800 flex items-center gap-4 shadow-inner">
                <span className="text-xs text-slate-400 font-medium">Код сессии:</span>
                <span className="font-mono text-2xl font-bold tracking-widest text-brand-400">
                  {sessionId}
                </span>
              </div>
              
              <button
                onClick={reconnectSession}
                className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer shadow-md"
                title="Сгенерировать новый код"
              >
                <i className="fa-solid fa-arrows-rotate"></i>
              </button>

              <button
                onClick={handleCopyLink}
                className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer text-xs font-medium flex items-center gap-2 shadow-md"
                title="Скопировать ссылку"
              >
                <i className="fa-solid fa-link"></i> Скопировать ссылку
              </button>
            </div>

            {/* Live Transport Route Indicator */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Текущий маршрут связи:</div>
              <div className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border shadow-sm ${routeBadge.color}`}>
                <i className={`fa-solid ${routeBadge.icon}`}></i>
                <span>{routeBadge.text}</span>
              </div>
            </div>
          </div>

          {/* QR Code Frame */}
          <div className="flex flex-col items-center gap-3 bg-slate-950/80 p-5 rounded-3xl border border-slate-800 shadow-2xl">
            <div className="p-3 bg-white rounded-2xl shadow-lg flex items-center justify-center min-w-[210px] min-h-[210px]">
              <canvas ref={canvasRef} className="rounded-xl"></canvas>
            </div>
            <div className="text-center">
              <div className="text-xs font-semibold text-slate-300">Наведите камеру смартфона</div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5 max-w-[210px] truncate">{pairingUrl}</div>
            </div>
          </div>

        </div>

        {/* Collapsible Advanced Settings */}
        <div className="pt-6 mt-6 border-t border-slate-800/80">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-slate-400 hover:text-slate-200 transition flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <i className={`fa-solid fa-chevron-${showAdvanced ? 'up' : 'down'} text-[10px]`}></i>
            {showAdvanced ? 'Скрыть дополнительные параметры адреса' : 'Дополнительные параметры адреса (для кастомных доменов / прокси)'}
          </button>

          {showAdvanced && (
            <div className="mt-3 p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
              <p className="text-slate-400">
                По умолчанию QR-код использует адрес текущей страницы. Если вы используете обратный прокси (Nginx) или внешний домен:
              </p>
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <input
                  type="text"
                  value={hostInput}
                  onChange={(e) => setHostInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyHost()}
                  placeholder={serverInfo?.primaryIp ? `http://${serverInfo.primaryIp}:${serverInfo.port || 3000}` : 'https://scan.yourdomain.com'}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs focus:outline-none focus:border-brand-400 flex-1 min-w-[260px]"
                />
                <button
                  onClick={handleApplyHost}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs transition shadow-md cursor-pointer"
                >
                  Применить
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
