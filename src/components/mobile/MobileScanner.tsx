import React, { useState, useEffect, useRef } from 'react';
import { UnifiedWebRTCClient, ConnectionChannelType } from '../../services/webrtcService';

interface PendingPhoto {
  id: string;
  src: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  timestamp: number;
}

export const MobileScanner: React.FC = () => {
  const [sessionCode, setSessionCode] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [channelType, setChannelType] = useState<ConnectionChannelType>('disconnected');
  const [statusMessage, setStatusMessage] = useState<string>(
    'Введите код с экрана ПК или отсканируйте QR-код.'
  );

  // Queue of captured photos
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    percent: number;
    successCount: number;
  }>({ current: 0, total: 0, percent: 0, successCount: 0 });

  // Fullscreen mobile preview
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const webrtcClientRef = useRef<UnifiedWebRTCClient | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

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

  // Compress and resize image to max 1600px
  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = reject;
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
          if (!ctx) return reject(new Error('Canvas context unavailable'));

          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingPhoto(true);

    try {
      const newItems: PendingPhoto[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64 = await processImageFile(file);
        newItems.push({
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          src: base64,
          status: 'pending',
          timestamp: Date.now()
        });
      }

      setPendingPhotos((prev) => [...prev, ...newItems]);
    } catch (err: any) {
      console.error('Ошибка обработки фото:', err);
    } finally {
      setIsProcessingPhoto(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    setPendingPhotos((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      if (previewIndex !== null) {
        if (filtered.length === 0) {
          setPreviewIndex(null);
        } else if (previewIndex >= filtered.length) {
          setPreviewIndex(filtered.length - 1);
        }
      }
      return filtered;
    });
  };

  const handleClearAll = () => {
    if (isUploading) return;
    setPendingPhotos([]);
    setPreviewIndex(null);
    setUploadProgress({ current: 0, total: 0, percent: 0, successCount: 0 });
  };

  // Sequential batch upload with live progress
  const handleSendAll = async () => {
    if (isUploading || pendingPhotos.length === 0) return;

    if (!isConnected) {
      alert('Сначала свяжите телефон с ПК (проверьте код подключения и нажмите "Связать")');
      return;
    }

    setIsUploading(true);
    const total = pendingPhotos.length;
    let sentCount = 0;

    setUploadProgress({ current: 0, total, percent: 0, successCount: 0 });

    for (let i = 0; i < total; i++) {
      const photoId = pendingPhotos[i].id;
      const photoSrc = pendingPhotos[i].src;

      // Update current photo status to uploading
      setPendingPhotos((prev) =>
        prev.map((p) => (p.id === photoId ? { ...p, status: 'uploading' } : p))
      );

      setUploadProgress({
        current: i + 1,
        total,
        percent: Math.round((i / total) * 100),
        successCount: sentCount
      });

      let success = false;
      if (webrtcClientRef.current) {
        success = webrtcClientRef.current.sendPhoto(photoSrc);
      }

      // 250ms pause for reliable socket transport and visible feedback
      await new Promise((resolve) => setTimeout(resolve, 250));

      if (success) {
        sentCount++;
      }

      setPendingPhotos((prev) =>
        prev.map((p) => (p.id === photoId ? { ...p, status: success ? 'done' : 'error' } : p))
      );

      setUploadProgress({
        current: i + 1,
        total,
        percent: Math.round(((i + 1) / total) * 100),
        successCount: sentCount
      });
    }

    setIsUploading(false);
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

  const allSent = pendingPhotos.length > 0 && pendingPhotos.every((p) => p.status === 'done');

  return (
    <div className="flex-1 flex flex-col justify-between p-4 sm:p-6 max-w-md mx-auto w-full min-h-screen">
      <div className="space-y-5">
        {/* Mobile Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
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
          <div className="bg-gradient-to-r from-brand-950/80 to-indigo-950/80 border border-brand-500/40 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-lg animate-fade-in">
            <div className="flex items-center gap-2.5 text-xs text-slate-200">
              <i className="fa-solid fa-mobile-screen text-brand-400 text-base"></i>
              <span>Установите как приложение на экран</span>
            </div>
            <button
              onClick={handleInstallPWA}
              className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md whitespace-nowrap cursor-pointer"
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

        {/* Camera & Gallery Buttons */}
        <div className="space-y-2.5">
          {/* Main Camera Shutter Button */}
          <label className="block w-full py-5 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm text-center cursor-pointer shadow-xl shadow-brand-600/25 active:scale-[0.98] transition select-none">
            <i className="fa-solid fa-camera text-2xl mb-1.5 block"></i>
            {isProcessingPhoto ? (
              <span className="flex items-center justify-center gap-2">
                <i className="fa-solid fa-circle-notch animate-spin"></i> Обработка снимка...
              </span>
            ) : (
              <span>Сделать фото документа</span>
            )}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={isProcessingPhoto}
              onChange={handlePhotoCapture}
            />
          </label>

          {/* Secondary: pick from device gallery */}
          <div className="flex items-center justify-center">
            <label className="text-xs text-brand-400 hover:text-brand-300 font-medium cursor-pointer flex items-center gap-1.5 py-1 px-3 rounded-lg hover:bg-slate-800 transition">
              <i className="fa-solid fa-images"></i> или выбрать из галереи устройства
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={isProcessingPhoto}
                onChange={handlePhotoCapture}
              />
            </label>
          </div>
        </div>

        {/* Pending Photos Gallery Card */}
        {pendingPhotos.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-100">
                  Снимки в очереди: <span className="text-brand-400 font-mono">{pendingPhotos.length}</span>
                </span>
                <span className="text-[10px] text-slate-500">(нажмите для предпросмотра)</span>
              </div>
              <button
                onClick={handleClearAll}
                disabled={isUploading}
                className="text-[11px] text-slate-400 hover:text-rose-400 transition cursor-pointer disabled:opacity-40"
              >
                Очистить
              </button>
            </div>

            {/* Thumbnails Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {pendingPhotos.map((photo, index) => (
                <div
                  key={photo.id}
                  onClick={() => setPreviewIndex(index)}
                  className="relative aspect-[3/4] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden group cursor-pointer shadow-md active:scale-95 transition"
                >
                  <img
                    src={photo.src}
                    alt={`Снимок ${index + 1}`}
                    className="w-full h-full object-cover"
                  />

                  {/* Top Badge: Number */}
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-slate-900/80 text-[10px] font-mono font-bold text-slate-200 backdrop-blur-xs">
                    #{index + 1}
                  </div>

                  {/* Top Right: Delete Button */}
                  <button
                    onClick={(e) => handleDeletePhoto(photo.id, e)}
                    disabled={isUploading}
                    className="absolute top-1 right-1 w-6 h-6 rounded-md bg-rose-950/80 hover:bg-rose-600 text-rose-300 hover:text-white flex items-center justify-center transition cursor-pointer disabled:opacity-40 backdrop-blur-xs"
                    title="Удалить этот снимок"
                  >
                    <i className="fa-solid fa-xmark text-[10px]"></i>
                  </button>

                  {/* Bottom Status Overlay */}
                  <div className="absolute bottom-0 inset-x-0 bg-slate-950/85 backdrop-blur-xs py-1 px-1 text-center text-[10px]">
                    {photo.status === 'pending' && (
                      <span className="text-slate-400 flex items-center justify-center gap-1">
                        <i className="fa-regular fa-clock"></i> В очереди
                      </span>
                    )}
                    {photo.status === 'uploading' && (
                      <span className="text-brand-400 font-medium flex items-center justify-center gap-1 animate-pulse">
                        <i className="fa-solid fa-circle-notch animate-spin"></i> Отправка
                      </span>
                    )}
                    {photo.status === 'done' && (
                      <span className="text-emerald-400 font-medium flex items-center justify-center gap-1">
                        <i className="fa-solid fa-check"></i> Передано
                      </span>
                    )}
                    {photo.status === 'error' && (
                      <span className="text-rose-400 font-medium flex items-center justify-center gap-1">
                        <i className="fa-solid fa-triangle-exclamation"></i> Ошибка
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Live Upload Progress Bar */}
            {(isUploading || uploadProgress.total > 0) && (
              <div className="space-y-1.5 pt-1 animate-fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    {isUploading ? (
                      <>
                        <i className="fa-solid fa-circle-notch animate-spin text-brand-400"></i>
                        Передача на ПК: {uploadProgress.current} из {uploadProgress.total}
                      </>
                    ) : allSent ? (
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <i className="fa-solid fa-circle-check"></i> Все фото переданы ({uploadProgress.total})
                      </span>
                    ) : (
                      <span>Прогресс загрузки:</span>
                    )}
                  </span>
                  <span className="font-mono font-bold text-brand-400">{uploadProgress.percent}%</span>
                </div>

                <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress.percent}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Send All Action Button */}
            <div className="pt-2">
              <button
                onClick={handleSendAll}
                disabled={isUploading || pendingPhotos.length === 0}
                className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                  isUploading
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : allSent
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                    : 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-600/20 active:scale-[0.99]'
                }`}
              >
                {isUploading ? (
                  <>
                    <i className="fa-solid fa-circle-notch animate-spin"></i>
                    Передача снимка {uploadProgress.current} из {uploadProgress.total}...
                  </>
                ) : allSent ? (
                  <>
                    <i className="fa-solid fa-check-double"></i>
                    Отправить повторно ({pendingPhotos.length})
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane"></i>
                    Отправить на ПК ({pendingPhotos.length} {pendingPhotos.length === 1 ? 'фото' : 'фото'})
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Mobile Photo Preview Modal */}
      {previewIndex !== null && pendingPhotos[previewIndex] && (
        <div className="fixed inset-0 z-50 flex flex-col justify-between bg-slate-950/95 backdrop-blur-md p-4 animate-fade-in select-none">
          {/* Top Bar */}
          <div className="flex items-center justify-between z-10 pt-2 px-1">
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-200 shadow-lg">
              <span>Снимок {previewIndex + 1} из {pendingPhotos.length}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDeletePhoto(pendingPhotos[previewIndex].id)}
                className="px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 text-xs font-medium border border-rose-800/80 transition flex items-center gap-1.5 shadow-lg cursor-pointer"
                title="Удалить этот снимок"
              >
                <i className="fa-solid fa-trash-can"></i> Удалить
              </button>

              <button
                onClick={() => setPreviewIndex(null)}
                className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 flex items-center justify-center transition shadow-lg cursor-pointer"
                title="Закрыть"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>
          </div>

          {/* Main Enlarged Image with Next/Prev navigation */}
          <div className="relative flex-1 flex items-center justify-center my-4 overflow-hidden">
            <img
              src={pendingPhotos[previewIndex].src}
              alt={`Снимок ${previewIndex + 1}`}
              className="max-w-full max-h-[72vh] object-contain rounded-2xl shadow-2xl border border-slate-800"
            />

            {/* Prev Button */}
            {previewIndex > 0 && (
              <button
                onClick={() => setPreviewIndex(previewIndex - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-brand-600 text-white border border-slate-700 flex items-center justify-center shadow-lg transition cursor-pointer"
              >
                <i className="fa-solid fa-chevron-left text-sm"></i>
              </button>
            )}

            {/* Next Button */}
            {previewIndex < pendingPhotos.length - 1 && (
              <button
                onClick={() => setPreviewIndex(previewIndex + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-brand-600 text-white border border-slate-700 flex items-center justify-center shadow-lg transition cursor-pointer"
              >
                <i className="fa-solid fa-chevron-right text-sm"></i>
              </button>
            )}
          </div>

          {/* Bottom Bar in Modal */}
          <div className="flex items-center justify-between pb-2 px-1 text-xs">
            <div className="text-slate-400">
              Статус:{' '}
              {pendingPhotos[previewIndex].status === 'pending' && <span className="text-slate-300">В очереди на отправку</span>}
              {pendingPhotos[previewIndex].status === 'uploading' && <span className="text-brand-400">Отправляется...</span>}
              {pendingPhotos[previewIndex].status === 'done' && <span className="text-emerald-400 font-semibold">✓ Уже передан на ПК</span>}
              {pendingPhotos[previewIndex].status === 'error' && <span className="text-rose-400 font-semibold">Ошибка передачи</span>}
            </div>

            <button
              onClick={() => setPreviewIndex(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium transition cursor-pointer"
            >
              Готово
            </button>
          </div>
        </div>
      )}

      <div className="text-center text-[10px] text-slate-600 py-4">
        DocScan AI &bull; Прямой WebRTC канал &bull; PWA
      </div>
    </div>
  );
};

