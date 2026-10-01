import React, { useState } from 'react';
import { OcrHistoryEntry, OCRResult, FieldKey } from '../../types';

interface OcrHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: OcrHistoryEntry[];
  onLoadEntry: (entry: OcrHistoryEntry) => void;
  onRestoreBaseVersion: (entry: OcrHistoryEntry) => void;
  onDeleteEntry: (id: string) => void;
  onClearAllHistory: () => void;
}

const FIELD_LABELS: Record<FieldKey, string> = {
  docName: 'Название документа',
  docNumber: 'Номер документа',
  product: 'Наименование продукции',
  validFrom: 'Действителен С',
  validTo: 'Действителен ПО',
  notes: 'Заметки / ГОСТ'
};

export const OcrHistoryModal: React.FC<OcrHistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onLoadEntry,
  onRestoreBaseVersion,
  onDeleteEntry,
  onClearAllHistory
}) => {
  const [selectedEntry, setSelectedEntry] = useState<OcrHistoryEntry | null>(() => history[0] || null);
  const [showDiff, setShowDiff] = useState(false);

  if (!isOpen) return null;

  const currentSelected = selectedEntry && history.find((h) => h.id === selectedEntry.id) 
    ? history.find((h) => h.id === selectedEntry.id)! 
    : history[0] || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center">
              <i className="fa-solid fa-clock-rotate-left text-lg"></i>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                История распознавания документов
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono font-normal">
                  {history.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Все сохранённые сессии OCR с базовой версией ИИ и внесёнными изменениями
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('Очистить всю историю распознавания?')) {
                    onClearAllHistory();
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 text-xs transition cursor-pointer border border-slate-700/50 hover:border-rose-500/30"
                title="Очистить всю историю"
              >
                <i className="fa-solid fa-trash-can mr-1.5"></i>
                Очистить историю
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>
        </div>

        {/* Content Body */}
        {history.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <i className="fa-regular fa-folder-open text-4xl text-slate-600"></i>
            <p className="text-sm">История распознавания пока пуста</p>
            <p className="text-xs text-slate-600">
              После распознавания документов здесь будут сохраняться снимки и результаты
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-800">
            {/* Left Column: Sessions List */}
            <div className="md:col-span-5 p-4 overflow-y-auto space-y-2.5 max-h-[40vh] md:max-h-[70vh]">
              {history.map((entry) => {
                const isSelected = currentSelected?.id === entry.id;
                const dateStr = new Date(entry.timestamp).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div
                    key={entry.id}
                    onClick={() => {
                      setSelectedEntry(entry);
                      setShowDiff(false);
                    }}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-start gap-3 text-left ${
                      isSelected
                        ? 'bg-brand-950/30 border-brand-500/50 shadow-md shadow-brand-500/5'
                        : 'bg-slate-950/50 hover:bg-slate-800/60 border-slate-800/80'
                    }`}
                  >
                    {entry.thumbnail ? (
                      <img
                        src={entry.thumbnail}
                        alt="Скан"
                        className="w-12 h-16 object-cover rounded-lg border border-slate-800 shrink-0 bg-slate-900"
                      />
                    ) : (
                      <div className="w-12 h-16 rounded-lg bg-slate-800 border border-slate-700/50 flex items-center justify-center text-slate-600 shrink-0">
                        <i className="fa-solid fa-file-invoice text-lg"></i>
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-slate-200 truncate">
                          {entry.docTitle || 'Без названия'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0">
                          {dateStr}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 line-clamp-1">
                        {entry.currentVersion.product || entry.baseVersion.product || 'Продукция не указана'}
                      </p>

                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {entry.pagesCount} стр.
                        </span>
                        {entry.hasEdits ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-medium">
                            ✏️ С изменениями ({entry.editedFields?.length || 1})
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium">
                            🤖 Базовая версия ИИ
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Column: Entry Details & Actions */}
            <div className="md:col-span-7 p-5 overflow-y-auto max-h-[50vh] md:max-h-[70vh] flex flex-col justify-between space-y-4">
              {currentSelected && (
                <>
                  <div className="space-y-4">
                    {/* Entry Header Info */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-100">
                          {currentSelected.docTitle || 'Документ'}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Создан: {new Date(currentSelected.timestamp).toLocaleString('ru-RU')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {currentSelected.hasEdits && (
                          <button
                            onClick={() => setShowDiff(!showDiff)}
                            className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer border border-slate-700/60"
                          >
                            {showDiff ? 'Показать текущую' : 'Сравнить до/после'}
                          </button>
                        )}
                        <button
                          onClick={() => onDeleteEntry(currentSelected.id)}
                          className="w-7 h-7 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 flex items-center justify-center transition cursor-pointer"
                          title="Удалить эту запись"
                        >
                          <i className="fa-solid fa-trash-can text-xs"></i>
                        </button>
                      </div>
                    </div>

                    {/* Compare or Details */}
                    {showDiff ? (
                      <div className="space-y-3 animate-fade-in text-xs">
                        <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
                          <span className="text-emerald-400">🤖 Исходная базовая версия ИИ</span>
                          <span className="text-amber-400">✏️ Текущая с вашими правками</span>
                        </div>

                        {(['docName', 'docNumber', 'product', 'validFrom', 'validTo', 'notes'] as FieldKey[]).map((key) => {
                          const baseVal = currentSelected.baseVersion[key] || '—';
                          const curVal = currentSelected.currentVersion[key] || '—';
                          const isChanged = baseVal !== curVal;

                          return (
                            <div key={key} className={`p-2.5 rounded-xl border ${isChanged ? 'bg-amber-950/20 border-amber-500/30' : 'bg-slate-950/40 border-slate-800/60'}`}>
                              <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                                {FIELD_LABELS[key]} {isChanged && <span className="text-amber-400 text-[10px] ml-1">● Изменено</span>}
                              </span>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                                  {baseVal}
                                </div>
                                <div className={`p-2 rounded-lg border ${isChanged ? 'bg-amber-950/30 border-amber-500/40 text-amber-200 font-medium' : 'bg-slate-900 border-slate-800 text-slate-300'}`}>
                                  {curVal}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-2.5 text-xs">
                        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                          <span className="text-[11px] text-slate-400 font-medium">Название:</span>
                          <p className="text-slate-100 font-semibold">{currentSelected.currentVersion.docName || '—'}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                            <span className="text-[11px] text-slate-400 font-medium">Номер:</span>
                            <p className="text-slate-100 font-mono font-medium">{currentSelected.currentVersion.docNumber || 'б/н'}</p>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                            <span className="text-[11px] text-slate-400 font-medium">Срок действия:</span>
                            <p className="text-slate-100 font-mono text-xs">
                              {currentSelected.currentVersion.validFrom || '—'} по {currentSelected.currentVersion.validTo || '—'}
                            </p>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                          <span className="text-[11px] text-slate-400 font-medium">Продукция / Изделия:</span>
                          <p className="text-slate-200 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                            {currentSelected.currentVersion.product || '—'}
                          </p>
                        </div>

                        {currentSelected.currentVersion.notes && (
                          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                            <span className="text-[11px] text-slate-400 font-medium">Заметки / ГОСТ:</span>
                            <p className="text-slate-300 text-xs">{currentSelected.currentVersion.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                    {currentSelected.hasEdits ? (
                      <button
                        onClick={() => {
                          onRestoreBaseVersion(currentSelected);
                          onClose();
                        }}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer flex items-center gap-1.5 border border-slate-700/60"
                        title="Сбросить все правки к изначальному результату нейросети"
                      >
                        <i className="fa-solid fa-arrow-rotate-left text-brand-400"></i>
                        Откатить к базовой версии ИИ
                      </button>
                    ) : (
                      <div className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                        <i className="fa-solid fa-circle-check"></i>
                        Используется чистый оригинал ИИ
                      </div>
                    )}

                    <button
                      onClick={() => {
                        onLoadEntry(currentSelected);
                        onClose();
                      }}
                      className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition shadow-md shadow-brand-500/20 cursor-pointer flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-file-import"></i>
                      Загрузить в форму
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
