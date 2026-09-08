import React, { useEffect, useCallback, useState, useRef } from 'react';
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

  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset zoom & pan when page changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(4, +(prev + 0.25).toFixed(2)));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => {
      const next = Math.max(0.5, +(prev - 0.25).toFixed(2));
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleResetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

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

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        handleZoomIn();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        handleResetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handlePrev, handleNext, handleZoomIn, handleZoomOut, handleResetZoom, onClose]);

  // Handle Ctrl + Wheel zoom
  useEffect(() => {
    if (!isOpen) return;
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.2 : -0.2;
        setScale((prev) => {
          const next = Math.min(4, Math.max(0.5, +(prev + delta).toFixed(2)));
          if (next <= 1) setPosition({ x: 0, y: 0 });
          return next;
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [isOpen]);

  // Handle mouse drag-to-pan when scaled
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!isOpen || !currentPage) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/92 backdrop-blur-md select-none animate-fade-in overflow-hidden"
      onMouseUp={handleMouseUp}
    >
      {/* Top Controls Bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-xs z-20 pointer-events-none">
        {/* Left: Page info & selection */}
        <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-2xl shadow-xl backdrop-blur-md pointer-events-auto">
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
            {currentPage.selected ? 'Выбрана' : 'Не выбрана'}
          </button>
        </div>

        {/* Center: Zoom Controls */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-2xl shadow-xl backdrop-blur-md pointer-events-auto">
          <button
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 flex items-center justify-center transition cursor-pointer"
            title="Уменьшить (Ctrl + -)"
          >
            <i className="fa-solid fa-minus text-xs"></i>
          </button>

          <span className="px-2 font-mono text-xs font-semibold text-brand-400 min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={handleZoomIn}
            disabled={scale >= 4}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 flex items-center justify-center transition cursor-pointer"
            title="Увеличить (Ctrl + +)"
          >
            <i className="fa-solid fa-plus text-xs"></i>
          </button>

          <div className="w-[1px] h-5 bg-slate-800 mx-1"></div>

          <button
            onClick={handleResetZoom}
            className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-[11px] transition cursor-pointer"
            title="Сброс масштаба 100% (Ctrl + 0)"
          >
            1:1
          </button>
        </div>

        {/* Right: Close button */}
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 flex items-center justify-center transition cursor-pointer shadow-xl backdrop-blur-md pointer-events-auto"
          title="Закрыть (Esc)"
        >
          <i className="fa-solid fa-xmark text-base"></i>
        </button>
      </div>

      {/* Navigation Buttons: Left / Prev */}
      <button
        onClick={handlePrev}
        disabled={currentIndex === 0}
        className={`absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl flex items-center justify-center border transition cursor-pointer z-20 shadow-2xl backdrop-blur-md ${
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
        className={`absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl flex items-center justify-center border transition cursor-pointer z-20 shadow-2xl backdrop-blur-md ${
          currentIndex === pages.length - 1
            ? 'bg-slate-900/40 text-slate-600 border-slate-800/40 cursor-not-allowed opacity-30'
            : 'bg-slate-900/80 hover:bg-brand-600 text-slate-200 hover:text-white border-slate-800 hover:border-brand-500 shadow-brand-500/10'
        }`}
        title="Следующая (Стрелка вправо)"
      >
        <i className="fa-solid fa-chevron-right text-lg"></i>
      </button>

      {/* Main Image Container with Wheel & Drag-Pan */}
      <div 
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        className={`w-full h-full flex items-center justify-center p-8 overflow-hidden select-none ${
          scale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
        }`}
      >
        <div 
          className="transition-transform duration-75 ease-out max-w-full max-h-full flex items-center justify-center"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center'
          }}
        >
          <img
            src={currentPage.src}
            alt={`Документ ${currentIndex + 1}`}
            draggable={false}
            className="max-w-[85vw] max-h-[82vh] object-contain rounded-2xl shadow-2xl border border-slate-800/80 pointer-events-none"
          />
        </div>
      </div>

      {/* Bottom Hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-800 px-4 py-1.5 rounded-full text-[11px] text-slate-400 shadow-xl backdrop-blur-md flex items-center gap-2 z-20">
        <span>Масштаб:</span>
        <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-brand-300 font-mono">Ctrl + Колесо</kbd>
        <span>или</span>
        <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-brand-300 font-mono">+</kbd>
        <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-brand-300 font-mono">-</kbd>
        <span className="text-slate-600">|</span>
        <span>Перелистывание:</span>
        <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-slate-300 font-mono">◀</kbd>
        <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-slate-300 font-mono">▶</kbd>
      </div>
    </div>
  );
};

