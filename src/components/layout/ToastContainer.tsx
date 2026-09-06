import React from 'react';
import { useToast } from '../../context/ToastContext';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let colorCss = 'bg-slate-900 border-slate-700 text-slate-200';
        let icon = 'fa-circle-info text-brand-400';

        if (toast.type === 'success') {
          colorCss = 'bg-slate-900 border-emerald-500/40 text-emerald-200';
          icon = 'fa-circle-check text-emerald-400';
        } else if (toast.type === 'error') {
          colorCss = 'bg-slate-900 border-rose-500/40 text-rose-200';
          icon = 'fa-triangle-exclamation text-rose-400';
        }

        return (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            className={`p-3.5 rounded-xl border shadow-xl flex items-center gap-3 text-xs font-medium pointer-events-auto cursor-pointer transition-all animate-bounce-in ${colorCss}`}
          >
            <i className={`fa-solid ${icon} text-base flex-shrink-0`}></i>
            <span className="flex-1">{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
};
