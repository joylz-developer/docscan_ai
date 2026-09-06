import React, { useEffect, useCallback } from 'react';
import { DocPage } from '../../types';

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pages: DocPage[];
  currentIndex: number;
  onNavigate: (newIndex: number) => void;
  onToggleSelect: (id: string) => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  onClose,
  pages,
  currentIndex,
  onNavigate,
  onToggleSelect
}) => {
  const currentPage = pages[currentIndex];

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
  }, [currentIndex, onNavigate]);

  const handleNext = useCallback(() => {
    if (currentIndex < pages.length - 1) {
      onNavigate(currentIndex + 1);
    }
  }, [currentIndex, pages.length, onNavigate]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handlePrev, handleNext, onClose]);

  if (!isOpen || !currentPage) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 select-none animate-fade-in">
      {/* Top Controls Bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-xs z-10">
        <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-800 px-4 py-2 rounded-2xl shadow-lg backdrop-blur-sm">
          <span className="font-semibold text-slate-200">
            Страница {currentIndex + 1} из {pages.length}
          </span>
          <button
            onClick={() => onToggleSelect(currentPage.id)}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-medium transition flex items-center gap-1.5 cursor-pointer ${
              currentPage.selected
                ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <i className={`fa-solid ${currentPage.selected ? 'fa-circle-check' : 'fa-circle'}`}></i>
            {currentPage.selected ? 'Выбрана для анализа' : 'Не выбрана'}
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-10 h-10 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 flex items-center justify-center transition cursor-pointer shadow-lg backdrop-blur-sm"
          title="Закрыть (Esc)"
        >
          <i className="fa-solid fa-xmark text-base"></i>
        </button>
      </div>

      {/* Navigation Buttons: Left / Prev */}
      <button
        onClick={handlePrev}
        disabled={currentIndex === 0}
        className={`absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl flex items-center justify-center border transition cursor-pointer z-10 shadow-2xl backdrop-blur-sm ${
          currentIndex === 0
            ? 'bg-slate-900/40 text-slate-600 border-slate-800/40 cursor-not-allowed opacity-30'
            : 'bg-slate-900/80 hover:bg-brand-600 text-slate-200 hover:text-white border-slate-800 hover:border-brand-500 shadow-brand-500/10'
        }`}
        title="Предыдущая (Стрелка влево)"
      >
        <i className="fa-solid fa-chevron-left text-lg"></i>
      </button>

      {/* Navigation Buttons: Right / Next */}
      <button
        onClick={handleNext}
        disabled={currentIndex === pages.length - 1}
        className={`absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl flex items-center justify-center border transition cursor-pointer z-10 shadow-2xl backdrop-blur-sm ${
          currentIndex === pages.length - 1
            ? 'bg-slate-900/40 text-slate-600 border-slate-800/40 cursor-not-allowed opacity-30'
            : 'bg-slate-900/80 hover:bg-brand-600 text-slate-200 hover:text-white border-slate-800 hover:border-brand-500 shadow-brand-500/10'
        }`}
        title="Следующая (Стрелка вправо)"
      >
        <i className="fa-solid fa-chevron-right text-lg"></i>
      </button>

      {/* Main Image Container */}
      <div className="max-w-5xl max-h-[82vh] w-full h-full flex items-center justify-center p-4">
        <img
          src={currentPage.src}
          alt={`Документ ${currentIndex + 1}`}
          className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-slate-800/80"
        />
      </div>

      {/* Bottom Hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/80 border border-slate-800 px-4 py-1.5 rounded-full text-[11px] text-slate-400 shadow-md backdrop-blur-sm flex items-center gap-2">
        <span>Листайте стрелками</span>
        <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-slate-300 font-mono">◀</kbd>
        <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-slate-300 font-mono">▶</kbd>
        <span>или кнопками по бокам</span>
      </div>
    </div>
  );
};
