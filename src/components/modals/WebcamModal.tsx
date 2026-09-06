import React, { useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';

export const WebcamModal: React.FC = () => {
  const { isWebcamModalOpen, setIsWebcamModalOpen, addPage } = useApp();
  const { showToast } = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isWebcamModalOpen) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          showToast('Ошибка подключения к веб-камере: ' + err.message, 'error');
          setIsWebcamModalOpen(false);
        });
    } else {
      stopStream();
    }

    return () => {
      stopStream();
    };
  }, [isWebcamModalOpen]);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const handleClose = () => {
    stopStream();
    setIsWebcamModalOpen(false);
  };

  const handleCapture = () => {
    if (videoRef.current && videoRef.current.videoWidth) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        addPage(dataUrl);
        showToast('Снимок с веб-камеры добавлен в галерею', 'success');
        handleClose();
      }
    }
  };

  if (!isWebcamModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-950/80 backdrop-blur-sm items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm">
            <i className="fa-solid fa-camera text-emerald-400"></i> Съёмка с веб-камеры ПК
          </h3>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <div className="relative bg-black rounded-xl overflow-hidden aspect-video border border-slate-800">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          ></video>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition cursor-pointer"
          >
            Отмена
          </button>
          <button
            onClick={handleCapture}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer"
          >
            <i className="fa-solid fa-circle-dot"></i> Сделать снимок
          </button>
        </div>
      </div>
    </div>
  );
};
