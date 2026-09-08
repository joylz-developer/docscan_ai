import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { formatTextWithAi } from '../../services/api';

interface FormatTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  fieldTitle: string;
  originalText: string;
  onApply: (newText: string) => void;
}

const PRESETS = [
  {
    id: 'clean',
    title: '🧹 Очистить и склеить строки',
    instruction: 'Устрани разорванные переносы строк, исправь склеенные слова и опечатки OCR, сохранив все названия, номера и знаки препинания.'
  },
  {
    id: 'bullets',
    title: '📑 Структурировать списком',
    instruction: 'Разбей текст на аккуратные логические пункты / список с маркерами (•), выделив ключевые параметры, модели или характеристики.'
  },
  {
    id: 'standards',
    title: '📜 Выделить ГОСТы и стандарты',
    instruction: 'Выдели и структурируй встречающиеся стандарты ГОСТ, ТР ТС, ТУ, органы сертификации и номера документов.'
  },
  {
    id: 'custom',
    title: '✏️ Пользовательский промпт...',
    instruction: ''
  }
];

export const FormatTextModal: React.FC<FormatTextModalProps> = ({
  isOpen,
  onClose,
  fieldTitle,
  originalText,
  onApply
}) => {
  const { provider, model, apiKey } = useApp();
  const { showToast } = useToast();

  const [selectedPreset, setSelectedPreset] = useState<string>('clean');
  const [instruction, setInstruction] = useState<string>(PRESETS[0].instruction);
  const [formattedText, setFormattedText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasFormatted, setHasFormatted] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSelectPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    const found = PRESETS.find((p) => p.id === presetId);
    if (found && presetId !== 'custom') {
      setInstruction(found.instruction);
    } else if (presetId === 'custom' && instruction === PRESETS[0].instruction) {
      setInstruction('');
    }
  };

  const handleRunFormat = async () => {
    if (!originalText || !originalText.trim()) {
      showToast('Исходный текст пуст', 'error');
      return;
    }

    if (!instruction.trim()) {
      showToast('Укажите инструкцию (промпт) для форматирования', 'error');
      return;
    }

    if (!apiKey) {
      showToast('API-ключ не указан в настройках', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const result = await formatTextWithAi({
        provider,
        model,
        apiKey,
        text: originalText,
        instruction
      });

      setFormattedText(result);
      setHasFormatted(true);
      showToast('Текст успешно отформатирован нейросетью!', 'success');
    } catch (err: any) {
      showToast('Ошибка форматирования: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = () => {
    if (!formattedText) return;
    onApply(formattedText);
    showToast('Изменения приняты и подставлены в поле', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-600/20 text-brand-400 flex items-center justify-center text-sm">
              <i className="fa-solid fa-wand-magic-sparkles"></i>
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">
                ИИ-Форматирование поля «{fieldTitle}»
              </h3>
              <p className="text-[11px] text-slate-400">
                Задайте промпт для обработки текста и сравните версию «До» и «После»
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Preset Buttons */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">Шаблоны форматирования:</label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p.id)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
                    selectedPreset === p.id
                      ? 'bg-brand-600/20 text-brand-300 border-brand-500/50 shadow-sm'
                      : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {p.title}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Instruction Input */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium flex items-center justify-between">
              <span>Инструкция для ИИ (промпт):</span>
              <span className="text-[10px] text-slate-500">можете отредактировать под свои нужды</span>
            </label>
            <textarea
              rows={2}
              value={instruction}
              onChange={(e) => {
                setInstruction(e.target.value);
                setSelectedPreset('custom');
              }}
              placeholder="Например: Разбей на пункты, убери переносы строк, выдели ГОСТы..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-500 font-mono text-xs"
            />
          </div>

          {/* Run Button */}
          <div className="flex justify-end">
            <button
              onClick={handleRunFormat}
              disabled={isLoading || !instruction.trim()}
              className={`px-4 py-2 rounded-xl font-semibold transition flex items-center gap-2 cursor-pointer shadow-md ${
                isLoading || !instruction.trim()
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-600/20'
              }`}
            >
              {isLoading ? (
                <>
                  <i className="fa-solid fa-circle-notch animate-spin"></i>
                  Форматирование текста нейросетью...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-play text-xs"></i>
                  Запустить форматирование
                </>
              )}
            </button>
          </div>

          {/* Side-by-Side Before & After Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Column 1: Before */}
            <div className="space-y-2 bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <i className="fa-solid fa-clock-rotate-left text-slate-500"></i> Было (Оригинал)
                </span>
                <span className="text-[10px] text-slate-500">
                  {originalText.length} симв.
                </span>
              </div>
              <div className="p-2.5 bg-slate-900/50 rounded-xl text-slate-300 font-mono text-[11px] whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed">
                {originalText || <span className="text-slate-600 italic">Текст пуст</span>}
              </div>
            </div>

            {/* Column 2: After */}
            <div className="space-y-2 bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-semibold text-brand-400 flex items-center gap-1.5">
                  <i className="fa-solid fa-sparkles text-brand-400"></i> Стало (После обработки ИИ)
                </span>
                {hasFormatted && (
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Готово
                  </span>
                )}
              </div>
              <div className="p-2.5 bg-slate-900/50 rounded-xl text-emerald-300 font-mono text-[11px] whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed border border-brand-500/20">
                {formattedText ? (
                  formattedText
                ) : (
                  <span className="text-slate-600 italic">
                    Нажмите «Запустить форматирование», чтобы увидеть результат ИИ...
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition cursor-pointer"
          >
            Отмена
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAccept}
              disabled={!hasFormatted || !formattedText}
              className={`px-5 py-2 rounded-xl font-semibold transition flex items-center gap-2 cursor-pointer shadow-lg ${
                !hasFormatted || !formattedText
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700/50'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
              }`}
            >
              <i className="fa-solid fa-check"></i>
              Принять изменения
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
