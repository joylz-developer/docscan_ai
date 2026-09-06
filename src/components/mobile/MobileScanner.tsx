import React, { useState, useEffect, useRef } from 'react';
import { UnifiedWebRTCClient, ConnectionChannelType } from '../../services/webrtcService';

export const MobileScanner: React.FC = () => {
  const [sessionCode, setSessionCode] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [channelType, setChannelType] = useState<ConnectionChannelType>('disconnected');
  const [statusMessage, setStatusMessage] = useState<string>(
    'Введите код с экрана ПК или отсканируйте QR-код.'
  );
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const webrtcClientRef = useRef<UnifiedWebRTCClient | null>(null);

  const handleConnect = (codeToUse: string) => {
    const code = codeToUse.trim().toUpperCase();
    if (!code) return;

    setStatusMessage(`Установка соединения с ПК [${code}]...`);
    setIsConnected(false);

    if (webrtcClientRef.current) {
      webrtcClientRef.current.destroy();
    }

    const client = new UnifiedWebRTCClient({
      sessionId: code,
      role: 'mobile',
      onStatusChange: (status, channel) => {
        setChannelType(channel);
        if (status === 'connected') {
          setIsConnected(true);
          let label = '✓ Связано с ПК! Можно делать снимки.';
          if (channel === 'local_wifi') label = '✓ Связано напрямую по Wi-Fi!';
          else if (channel === 'stun_p2p') label = '✓ Связано через P2P (Интернет)!';
          else if (channel === 'turn_relay') label = '✓ Связано через защищенный TURN!';
          else if (channel === 'ws_relay') label = '✓ Связано через серверный Relay!';
          setStatusMessage(label);
        } else if (status === 'connecting') {
          setStatusMessage(`Подключение к ПК [${code}]...`);
        } else {
          setIsConnected(false);
          setStatusMessage('Соединение прервано. Нажмите "Связать" для повтора.');
        }
      },
      onError: (err) => {
        console.warn('Mobile WebRTC error:', err);
      }
    });

    webrtcClientRef.current = client;
    client.init();
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const session = params.get('session');
    if (session) {
      const cleanCode = session.trim().toUpperCase();
      setSessionCode(cleanCode);
      handleConnect(cleanCode);
    }

    // PWA install prompt listener
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      webrtcClientRef.current?.destroy();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  const handlePhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsSending(true);
    setSendStatus('Оптимизация и отправка снимка...');

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1600;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
        setPreviewSrc(compressedBase64);

        let sent = false;
        if (webrtcClientRef.current) {
          sent = webrtcClientRef.current.sendPhoto(compressedBase64);
        }

        if (sent) {
          setSendStatus('✓ Фото успешно передано на ПК!');
        } else {
          setSendStatus('⚠️ ПК не подключен. Проверьте код и нажмите "Связать".');
        }
        setIsSending(false);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const switchToDesktopView = () => {
    window.location.href = window.location.pathname;
  };

  let badgeLabel = 'Не подключено';
  let badgeColor = 'bg-slate-800 text-slate-400 border-slate-700';

  if (isConnected) {
    badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (channelType === 'local_wifi') badgeLabel = 'Wi-Fi P2P';
    else if (channelType === 'stun_p2p') badgeLabel = 'P2P Online';
    else if (channelType === 'ws_relay') badgeLabel = 'Relay VPS';
    else badgeLabel = 'Подключено';
  }

  return (
    <div className="flex-1 flex flex-col justify-between p-6 max-w-md mx-auto w-full min-h-screen">
      <div className="space-y-6">
        {/* Mobile Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <i className="fa-solid fa-camera text-white text-sm"></i>
            </div>
            <span className="font-bold text-sm text-slate-100">DocScan Mobile</span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono border ${badgeColor}`}>
              {badgeLabel}
            </span>

            <button
              onClick={switchToDesktopView}
              className="text-xs text-slate-400 hover:text-white p-1"
              title="Переключить на полную версию"
            >
              <i className="fa-solid fa-desktop"></i>
            </button>
          </div>
        </div>

        {/* PWA Install Banner */}
        {deferredPrompt && (
          <div className="bg-gradient-to-r from-brand-950/80 to-indigo-950/80 border border-brand-500/40 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5 text-xs text-slate-200">
              <i className="fa-solid fa-mobile-screen text-brand-400 text-base"></i>
              <span>Установите как приложение на экран</span>
            </div>
            <button
              onClick={handleInstallPWA}
              className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md whitespace-nowrap"
            >
              Установить
            </button>
          </div>
        )}

        {/* Connection Code Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
          <div className="text-xs text-slate-400 font-medium">Код подключения к ПК:</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
              placeholder="КОД (6 СИМВОЛОВ)"
              className="flex-1 uppercase font-mono px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-bold text-brand-400 focus:outline-none focus:border-brand-500"
            />
            <button
              onClick={() => handleConnect(sessionCode)}
              className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs transition cursor-pointer shadow-lg shadow-brand-600/20"
            >
              Связать
            </button>
          </div>
          <div className="text-[11px] text-slate-400 leading-relaxed">{statusMessage}</div>
        </div>

        {/* Camera Capture Big Button */}
        <div className="space-y-4 text-center pt-2">
          <label className="block w-full py-7 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-bold text-base cursor-pointer shadow-xl shadow-brand-600/30 active:scale-95 transition">
            <i className="fa-solid fa-camera text-3xl mb-2 block"></i>
            Сделать фото документа
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoCapture}
            />
          </label>
          <p className="text-[11px] text-slate-500">
            Фотография мгновенно передается на экран компьютера через WebRTC
          </p>
        </div>

        {/* Preview Card */}
        {previewSrc && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 text-center shadow-lg animate-fade-in">
            <span className="text-xs font-semibold text-slate-300">Предпросмотр снимка:</span>
            <img
              src={previewSrc}
              alt="Предпросмотр"
              className="max-h-52 rounded-xl mx-auto border border-slate-800 object-contain shadow-md"
            />
            <div
              className={`text-xs font-medium ${
                sendStatus.startsWith('✓')
                  ? 'text-emerald-400'
                  : sendStatus.startsWith('⚠️')
                  ? 'text-amber-400'
                  : 'text-brand-300'
              }`}
            >
              {isSending ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="fa-solid fa-circle-notch animate-spin"></i> {sendStatus}
                </span>
              ) : (
                sendStatus
              )}
            </div>
          </div>
        )}
      </div>

      <div className="text-center text-[10px] text-slate-600 py-4">
        DocScan AI &bull; Прямой WebRTC канал &bull; PWA
      </div>
    </div>
  );
};
