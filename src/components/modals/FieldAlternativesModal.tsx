import React from 'react';

interface FieldAlternativesModalProps {
  isOpen: boolean;
  onClose: () => void;
  fieldTitle: string;
  currentValue: string;
  alternatives: string[];
  isLoading: boolean;
  onSelectAlternative: (value: string) => void;
  onRefreshAlternatives: () => void;
}

export const FieldAlternativesModal: React.FC<FieldAlternativesModalProps> = ({
  isOpen,
  onClose,
  fieldTitle,
  currentValue,
  alternatives,
  isLoading,
  onSelectAlternative,
  onRefreshAlternatives
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm">
              <i className="fa-solid fa-list-check"></i>
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">
                Варианты заполнения: «{fieldTitle}»
              </h3>
              <p className="text-[11px] text-slate-400">
                Другие фрагменты текста и варианты, найденные нейросетью в документе
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-xs"></i>
          </button>
        </div>

        {/* Current Value Preview */}
        <div className="px-6 py-3 bg-slate-950/50 border-b border-slate-800/80 text-xs">
          <div className="text-slate-400 text-[11px] font-medium mb-1">Текущее значение в поле:</div>
          <div className="font-mono text-slate-200 bg-slate-900 p-2 rounded-xl border border-slate-800 break-words">
            {currentValue || <span className="text-slate-500 italic">(пусто)</span>}
          </div>
        </div>

        {/* Alternatives List */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1 text-xs">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <i className="fa-solid fa-circle-notch animate-spin text-2xl text-amber-400"></i>
              <span>Поиск других вариантов в скане документа...</span>
            </div>
          ) : alternatives.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-800/60 flex items-center justify-center text-slate-500 text-lg">
                <i className="fa-solid fa-magnifying-glass"></i>
              </div>
              <p className="text-slate-400">
                Других очевидных вариантов для этого поля в документе пока не найдено.
              </p>
              <button
                type="button"
                onClick={onRefreshAlternatives}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition cursor-pointer inline-flex items-center gap-2"
              >
                <i className="fa-solid fa-rotate"></i>
                Попробовать поискать ещё раз
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <span>Найдено вариантов: {alternatives.length}</span>
                <button
                  type="button"
                  onClick={onRefreshAlternatives}
                  className="text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <i className="fa-solid fa-rotate text-[10px]"></i>
                  Обновить поиск
                </button>
              </div>

              {alternatives.map((alt, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-amber-500/40 rounded-2xl transition flex items-start justify-between gap-3 group"
                >
                  <div className="flex-1 font-mono text-slate-200 text-xs break-words leading-relaxed">
                    {alt}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectAlternative(alt);
                      onClose();
                    }}
                    className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 font-semibold text-xs transition cursor-pointer border border-amber-500/30"
                  >
                    Выбрать
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
