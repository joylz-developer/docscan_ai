import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { extractPagesFromPdf, readFileAsBase64 } from '../../services/pdfService';
import { sendOCRRequest, rescanSingleField, fetchFieldAlternatives } from '../../services/api';
import { FieldKey } from '../../types';
import { DocumentViewerModal } from '../modals/DocumentViewerModal';
import { FormatTextModal } from '../modals/FormatTextModal';
import { FieldAlternativesModal } from '../modals/FieldAlternativesModal';

export const ScanningTab: React.FC = () => {
  const {
    pages,
    addPage,
    togglePageSelect,
    removePage,
    removeSelectedPages,
    movePage,
    reorderPages,
    selectAllPages,
    deselectAllPages,
    clearPages,
    applyRange,
    saveRegistryDoc,
    provider,
    model,
    apiKey,
    customPrompts,
    setActiveTab,
    setIsWebcamModalOpen,
    ocrForm,
    setOcrForm,
    showResults,
    setShowResults,
    updateOcrField,
    resetOcrForm
  } = useApp();

  const { showToast } = useToast();

  const [rangeInput, setRangeInput] = useState('');
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [isDropOver, setIsDropOver] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Fullscreen Viewer state
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // Field actions state
  const [rescanLoadingField, setRescanLoadingField] = useState<FieldKey | null>(null);
  const [copiedField, setCopiedField] = useState<FieldKey | null>(null);

  const [alternativesModal, setAlternativesModal] = useState<{
    isOpen: boolean;
    fieldKey: FieldKey;
    fieldTitle: string;
    currentValue: string;
    alternatives: string[];
    isLoading: boolean;
  }>({
    isOpen: false,
    fieldKey: 'docName',
    fieldTitle: '',
    currentValue: '',
    alternatives: [],
    isLoading: false
  });

  const [formatModal, setFormatModal] = useState<{
    isOpen: boolean;
    fieldKey: FieldKey;
    fieldTitle: string;
    originalText: string;
  }>({
    isOpen: false,
    fieldKey: 'product',
    fieldTitle: '',
    originalText: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsProcessingFiles(true);

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (file.type === 'application/pdf') {
          showToast(`Обработка PDF: ${file.name}...`, 'info');
          const extracted = await extractPagesFromPdf(file);
          extracted.forEach((p) => addPage(p));
          showToast(`Извлечено страниц: ${extracted.length}`, 'success');
        } else if (file.type.startsWith('image/')) {
          const b64 = await readFileAsBase64(file);
          addPage(b64);
        }
      }
    } catch (err: any) {
      showToast('Ошибка чтения файлов: ' + err.message, 'error');
    } finally {
      setIsProcessingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApplyRange = () => {
    applyRange(rangeInput);
  };

  const handleRunOCR = async () => {
    const selected = pages.filter((p) => p.selected);
    if (selected.length === 0) {
      showToast('Выберите хотя бы один документ для распознавания', 'error');
      return;
    }

    if (!apiKey) {
      showToast('Укажите API-ключ во вкладке "Настройки Нейросети"', 'error');
      setActiveTab(2);
      return;
    }

    setIsOcrLoading(true);

    try {
      const result = await sendOCRRequest({
        provider,
        model,
        apiKey,
        imageBase64: selected[0].src,
        customPrompts
      });

      setOcrForm(result);
      setShowResults(true);
      showToast('Документ успешно распознан!', 'success');
    } catch (err: any) {
      showToast('Ошибка распознавания: ' + err.message, 'error');
    } finally {
      setIsOcrLoading(false);
    }
  };

  const handleSaveToRegistry = () => {
    saveRegistryDoc({
      name: ocrForm.docName || 'Без названия',
      number: ocrForm.docNumber || '-',
      product: ocrForm.product || '-',
      validFrom: ocrForm.validFrom || '-',
      validTo: ocrForm.validTo || '-',
      notes: ocrForm.notes || ''
    });
  };

  const handleResetForm = () => {
    resetOcrForm();
    showToast('Результаты распознавания очищены', 'info');
  };

  const handleCopyField = (fieldKey: FieldKey, text: string) => {
    if (!text || !text.trim()) {
      showToast('Поле пустое', 'info');
      return;
    }
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
    showToast('Скопировано в буфер обмена', 'success');
  };

  const handleRescanField = async (fieldKey: FieldKey, fieldLabel: string) => {
    const selected = pages.filter((p) => p.selected);
    const targetPage = selected.length > 0 ? selected[0] : pages[0];
    if (!targetPage) {
      showToast('Нет документов для анализа', 'error');
      return;
    }
    if (!apiKey) {
      showToast('Укажите API-ключ в настройках', 'error');
      setActiveTab(2);
      return;
    }

    setRescanLoadingField(fieldKey);
    try {
      const value = await rescanSingleField({
        provider,
        model,
        apiKey,
        imageBase64: targetPage.src,
        fieldKey,
        fieldName: fieldLabel,
        fieldPrompt: (customPrompts as any)[fieldKey] || ''
      });

      updateOcrField(fieldKey, value);
      showToast(`Поле «${fieldLabel}» успешно обновлено!`, 'success');
    } catch (err: any) {
      showToast('Ошибка пересканирования поля: ' + err.message, 'error');
    } finally {
      setRescanLoadingField(null);
    }
  };

  const handleOpenAlternatives = async (fieldKey: FieldKey, fieldLabel: string, currentValue: string) => {
    const selected = pages.filter((p) => p.selected);
    const targetPage = selected.length > 0 ? selected[0] : pages[0];
    if (!targetPage) {
      showToast('Нет документов для анализа', 'error');
      return;
    }
    if (!apiKey) {
      showToast('Укажите API-ключ в настройках', 'error');
      setActiveTab(2);
      return;
    }

    setAlternativesModal({
      isOpen: true,
      fieldKey,
      fieldTitle: fieldLabel,
      currentValue,
      alternatives: [],
      isLoading: true
    });

    try {
      const alts = await fetchFieldAlternatives({
        provider,
        model,
        apiKey,
        imageBase64: targetPage.src,
        fieldKey,
        fieldName: fieldLabel,
        fieldPrompt: (customPrompts as any)[fieldKey] || '',
        currentValue
      });

      setAlternativesModal((prev) => ({
        ...prev,
        alternatives: alts,
        isLoading: false
      }));
    } catch (err: any) {
      showToast('Ошибка поиска вариантов: ' + err.message, 'error');
      setAlternativesModal((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const handleOpenFormatModal = (fieldKey: FieldKey, fieldLabel: string, originalText: string) => {
    setFormatModal({
      isOpen: true,
      fieldKey,
      fieldTitle: fieldLabel,
      originalText
    });
  };

  // Drag & drop sorting handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOverItem = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDropOnItem = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      reorderPages(draggedIndex, targetIndex);
    }
    setDraggedIndex(null);
  };

  const selectedCount = pages.filter((p) => p.selected).length;

  return (
    <div className="space-y-6">
      {/* Top Action Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-2.5 flex-wrap">
          <label className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs cursor-pointer transition flex items-center gap-2 shadow-lg shadow-brand-600/20">
            <i className="fa-solid fa-upload"></i> Загрузить файлы (PDF / Фото)
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,application/pdf"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>

          <button
            onClick={() => setIsWebcamModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition flex items-center gap-2 border border-slate-700 cursor-pointer shadow-sm"
          >
            <i className="fa-solid fa-camera text-emerald-400"></i> Веб-камера ПК
          </button>
        </div>

        <div className="text-xs text-slate-400 font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Всего в галерее: <span className="text-slate-100 font-mono font-bold">{pages.length}</span>
        </div>
      </div>

      {/* Gallery & Manipulation Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-md">
        {/* Left: Selection Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-300 mr-1">
            Выбрано: <span className="text-brand-400 font-mono font-bold">{selectedCount}</span> из {pages.length}
          </span>
          <button
            onClick={selectAllPages}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 cursor-pointer transition"
          >
            Все
          </button>
          <button
            onClick={deselectAllPages}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 cursor-pointer transition"
          >
            Снять
          </button>

          {/* Delete Selected Button next to selection tools */}
          <button
            onClick={removeSelectedPages}
            disabled={selectedCount === 0}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 cursor-pointer border ${
              selectedCount === 0
                ? 'bg-slate-950/50 text-slate-600 border-slate-800 cursor-not-allowed'
                : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/80 shadow-md shadow-rose-950/30'
            }`}
            title="Удалить только выбранные документы"
          >
            <i className="fa-solid fa-trash-can"></i>
            Удалить выбранные ({selectedCount})
          </button>
        </div>

        {/* Right: Range & Clear All */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={rangeInput}
              onChange={(e) => setRangeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyRange()}
              placeholder="диапазон: 1-3, 5"
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 w-36 focus:outline-none focus:border-brand-500"
            />
            <button
              onClick={handleApplyRange}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 cursor-pointer transition"
            >
              Выбрать
            </button>
          </div>

          <button
            onClick={clearPages}
            disabled={pages.length === 0}
            className={`px-3 py-1.5 rounded-xl text-xs transition border cursor-pointer ${
              pages.length === 0
                ? 'bg-slate-950/50 text-slate-600 border-slate-800 cursor-not-allowed'
                : 'bg-slate-800/80 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border-slate-700/50'
            }`}
            title="Очистить всю галерею"
          >
            Очистить все
          </button>
        </div>
      </div>

      {/* Integrated Dropzone & Pages Grid */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDropOver(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDropOver(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDropOver(false);
          if (e.dataTransfer.files?.length) {
            handleFiles(e.dataTransfer.files);
          }
        }}
        className={`relative min-h-[220px] rounded-2xl transition p-4 border-2 border-dashed ${
          isDropOver
            ? 'border-brand-500 bg-brand-950/30'
            : 'border-slate-800/80 bg-slate-900/40'
        }`}
      >
        {isDropOver && (
          <div className="absolute inset-0 bg-brand-950/80 backdrop-blur-sm z-30 rounded-2xl flex flex-col items-center justify-center pointer-events-none text-brand-300 animate-fade-in">
            <i className="fa-solid fa-cloud-arrow-up text-4xl mb-2 animate-bounce"></i>
            <span className="font-bold text-sm">Отпустите файлы для добавления в галерею</span>
          </div>
        )}

        {pages.length === 0 ? (
          /* Empty Gallery State with integrated Dropzone */
          <div
            onClick={() => fileInputRef.current?.click()}
            className="py-16 text-center cursor-pointer flex flex-col items-center justify-center hover:text-brand-300 transition"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mb-3 shadow-inner">
              <i className="fa-solid fa-cloud-arrow-up text-2xl text-slate-400"></i>
            </div>
            <p className="text-sm font-semibold text-slate-200">
              {isProcessingFiles ? 'Обработка файлов...' : 'Галерея пуста: перетащите сюда сканы или PDF'}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Или нажмите здесь, чтобы выбрать файлы на диске. Также вы можете передать фото со смартфона через вкладку «3. P2P Сопряжение».
            </p>
          </div>
        ) : (
          /* Grid of Documents */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {pages.map((page, index) => (
              <div
                key={page.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOverItem(e, index)}
                onDrop={(e) => handleDropOnItem(e, index)}
                className={`relative group bg-slate-900 border rounded-2xl overflow-hidden shadow-lg transition select-none ${
                  page.selected
                    ? 'border-brand-500 ring-2 ring-brand-500/40 shadow-brand-500/10'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Android Gallery Selection Badge (Top-Right) */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePageSelect(page.id);
                  }}
                  className="absolute top-2.5 right-2.5 z-20 cursor-pointer p-1"
                  title={page.selected ? 'Снять выбор' : 'Выбрать документ'}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-md ${
                      page.selected
                        ? 'bg-brand-500 text-white scale-105 shadow-brand-500/40'
                        : 'bg-black/40 border-2 border-white/70 text-transparent hover:border-white hover:scale-105'
                    }`}
                  >
                    <i className="fa-solid fa-check text-[11px] font-bold"></i>
                  </div>
                </div>

                {/* Lightbox Zoom Button (Top-Left) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewerIndex(index);
                  }}
                  className="absolute top-2.5 left-2.5 z-20 w-7 h-7 rounded-xl bg-slate-900/80 hover:bg-brand-600 text-slate-300 hover:text-white border border-slate-700/80 flex items-center justify-center transition opacity-80 hover:opacity-100 shadow-md cursor-pointer"
                  title="Увеличить и просмотреть"
                >
                  <i className="fa-solid fa-magnifying-glass-plus text-xs"></i>
                </button>

                {/* Document Thumbnail Preview (Clicking toggles selection) */}
                <div
                  onClick={() => togglePageSelect(page.id)}
                  className="aspect-[3/4] bg-slate-950 flex items-center justify-center overflow-hidden cursor-pointer relative"
                >
                  <img
                    src={page.src}
                    alt={`Страница ${index + 1}`}
                    className={`w-full h-full object-contain transition duration-200 ${
                      page.selected ? 'opacity-90' : 'opacity-75 group-hover:opacity-100'
                    }`}
                  />
                  {page.selected && (
                    <div className="absolute inset-0 bg-brand-600/10 pointer-events-none"></div>
                  )}
                </div>

                {/* Bottom Manipulation Bar: Move Left, Index, Move Right, Delete */}
                <div className="p-2 flex items-center justify-between text-xs bg-slate-950/90 border-t border-slate-800/80">
                  <div className="flex items-center gap-1">
                    {/* Move Left Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        movePage(index, 'left');
                      }}
                      disabled={index === 0}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition cursor-pointer ${
                        index === 0
                          ? 'text-slate-700 cursor-not-allowed'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      title="Переместить влево"
                    >
                      <i className="fa-solid fa-chevron-left text-[10px]"></i>
                    </button>

                    {/* Page Index */}
                    <span className="font-mono text-[11px] font-bold text-slate-400 px-1">
                      #{index + 1}
                    </span>

                    {/* Move Right Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        movePage(index, 'right');
                      }}
                      disabled={index === pages.length - 1}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition cursor-pointer ${
                        index === pages.length - 1
                          ? 'text-slate-700 cursor-not-allowed'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      title="Переместить вправо"
                    >
                      <i className="fa-solid fa-chevron-right text-[10px]"></i>
                    </button>
                  </div>

                  {/* Individual Delete Page Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removePage(page.id);
                    }}
                    className="w-6 h-6 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 flex items-center justify-center transition cursor-pointer"
                    title="Удалить этот документ"
                  >
                    <i className="fa-solid fa-trash text-xs"></i>
                  </button>
                </div>
              </div>
            ))}

            {/* Quick Add Tile inside Grid */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="aspect-[3/4] border-2 border-dashed border-slate-800 hover:border-brand-500 rounded-2xl bg-slate-900/30 hover:bg-brand-950/20 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-brand-300 transition cursor-pointer shadow-sm group"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-800/80 group-hover:bg-brand-600/30 flex items-center justify-center transition">
                <i className="fa-solid fa-plus text-base"></i>
              </div>
              <span className="text-xs font-semibold text-center px-2">Добавить скан / PDF</span>
              <span className="text-[10px] text-slate-600 text-center">или перетащите сюда</span>
            </div>
          </div>
        )}
      </div>

      {/* Recognition Action Launcher */}
      <div className="pt-2">
        <button
          onClick={handleRunOCR}
          disabled={isOcrLoading || selectedCount === 0}
          className={`w-full py-4 rounded-2xl font-bold text-sm shadow-xl transition flex items-center justify-center gap-2.5 cursor-pointer ${
            isOcrLoading || selectedCount === 0
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              : 'bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-brand-600/25 active:scale-[0.99]'
          }`}
        >
          {isOcrLoading ? (
            <>
              <i className="fa-solid fa-circle-notch animate-spin text-lg"></i>
              Обработка выбранного документа нейросетью...
            </>
          ) : (
            <>
              <i className="fa-solid fa-wand-magic-sparkles text-lg"></i>
              Распознать выбранный документ ({selectedCount}) через ИИ
            </>
          )}
        </button>
      </div>

      {/* Recognition Output Card */}
      {showResults && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <i className="fa-solid fa-file-signature text-brand-400"></i> Результаты распознавания
            </h3>
            <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full font-medium">
              ✓ Распознано успешно
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveToRegistry();
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs"
          >
            {/* 1. Document Name */}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                <label className="text-slate-400 font-medium">Название документа</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleCopyField('docName', ocrForm.docName)}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] transition cursor-pointer flex items-center gap-1 border border-slate-700/40"
                    title="Скопировать поле в буфер"
                  >
                    <i className={`fa-solid ${copiedField === 'docName' ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                    {copiedField === 'docName' ? 'Скопировано' : 'Копировать'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRescanField('docName', 'Название документа')}
                    disabled={rescanLoadingField === 'docName'}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-brand-600/20 text-slate-400 hover:text-brand-300 text-[10px] transition cursor-pointer flex items-center gap-1 border border-slate-700/40 hover:border-brand-500/40 disabled:opacity-40"
                    title="Пересканировать только это поле"
                  >
                    <i className={`fa-solid fa-rotate ${rescanLoadingField === 'docName' ? 'animate-spin text-brand-400' : ''}`}></i>
                    {rescanLoadingField === 'docName' ? 'Поиск...' : 'Перескан'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAlternatives('docName', 'Название документа', ocrForm.docName)}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 text-[10px] transition cursor-pointer flex items-center gap-1 border border-slate-700/40 hover:border-amber-500/40"
                    title="Другие варианты из документа"
                  >
                    <i className="fa-solid fa-list-check"></i>
                    Варианты
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={ocrForm.docName}
                onChange={(e) => updateOcrField('docName', e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* 2. Document Number */}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                <label className="text-slate-400 font-medium">Номер документа / Сертификата</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleCopyField('docNumber', ocrForm.docNumber)}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] transition cursor-pointer flex items-center gap-1 border border-slate-700/40"
                    title="Скопировать поле в буфер"
                  >
                    <i className={`fa-solid ${copiedField === 'docNumber' ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                    {copiedField === 'docNumber' ? 'Скопировано' : 'Копировать'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRescanField('docNumber', 'Номер документа / Сертификата')}
                    disabled={rescanLoadingField === 'docNumber'}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-brand-600/20 text-slate-400 hover:text-brand-300 text-[10px] transition cursor-pointer flex items-center gap-1 border border-slate-700/40 hover:border-brand-500/40 disabled:opacity-40"
                    title="Пересканировать только это поле"
                  >
                    <i className={`fa-solid fa-rotate ${rescanLoadingField === 'docNumber' ? 'animate-spin text-brand-400' : ''}`}></i>
                    {rescanLoadingField === 'docNumber' ? 'Поиск...' : 'Перескан'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAlternatives('docNumber', 'Номер документа / Сертификата', ocrForm.docNumber)}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 text-[10px] transition cursor-pointer flex items-center gap-1 border border-slate-700/40 hover:border-amber-500/40"
                    title="Другие варианты из документа"
                  >
                    <i className="fa-solid fa-list-check"></i>
                    Варианты
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={ocrForm.docNumber}
                onChange={(e) => updateOcrField('docNumber', e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* 3. Product / Object Name (with AI format) */}
            <div className="space-y-1 md:col-span-2">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                <label className="text-slate-400 font-medium">Наименование продукции / Объекта</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleCopyField('product', ocrForm.product)}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] transition cursor-pointer flex items-center gap-1 border border-slate-700/40"
                    title="Скопировать поле в буфер"
                  >
                    <i className={`fa-solid ${copiedField === 'product' ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                    {copiedField === 'product' ? 'Скопировано' : 'Копировать'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRescanField('product', 'Наименование продукции / Объекта')}
                    disabled={rescanLoadingField === 'product'}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-brand-600/20 text-slate-400 hover:text-brand-300 text-[10px] transition cursor-pointer flex items-center gap-1 border border-slate-700/40 hover:border-brand-500/40 disabled:opacity-40"
                    title="Пересканировать только это поле"
                  >
                    <i className={`fa-solid fa-rotate ${rescanLoadingField === 'product' ? 'animate-spin text-brand-400' : ''}`}></i>
                    {rescanLoadingField === 'product' ? 'Поиск...' : 'Перескан'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAlternatives('product', 'Наименование продукции / Объекта', ocrForm.product)}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 text-[10px] transition cursor-pointer flex items-center gap-1 border border-slate-700/40 hover:border-amber-500/40"
                    title="Другие варианты из документа"
                  >
                    <i className="fa-solid fa-list-check"></i>
                    Варианты
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenFormatModal('product', 'Наименование продукции / Объекта', ocrForm.product)}
                    className="px-2 py-0.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 text-[10px] font-medium transition cursor-pointer flex items-center gap-1 border border-brand-500/30"
                    title="Отформатировать и очистить текст через ИИ с предпросмотром До/После"
                  >
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                    ИИ Форматирование
                  </button>
                </div>
              </div>
              <textarea
                rows={3}
                value={ocrForm.product}
                onChange={(e) => updateOcrField('product', e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium focus:outline-none focus:border-brand-500 resize-y"
              />
            </div>

            {/* 4. Valid From */}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                <label className="text-slate-400 font-medium">Действителен С (Дата начала)</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleCopyField('validFrom', ocrForm.validFrom)}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] transition cursor-pointer flex items-center gap-1 border border-slate-700/40"
                    title="Скопировать дату"
                  >
                    <i className={`fa-solid ${copiedField === 'validFrom' ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                    {copiedField === 'validFrom' ? 'Скопировано' : 'Копировать'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRescanField('validFrom', 'Дата начала действия')}
                    disabled={rescanLoadingField === 'validFrom'}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-brand-600/20 text-slate-400 hover:text-brand-300 text-[10px] transition cursor-pointer flex items-center gap-1 border border-slate-700/40 hover:border-brand-500/40 disabled:opacity-40"
                    title="Пересканировать дату начала"
                  >
                    <i className={`fa-solid fa-rotate ${rescanLoadingField === 'validFrom' ? 'animate-spin text-brand-400' : ''}`}></i>
                    {rescanLoadingField === 'validFrom' ? 'Поиск...' : 'Перескан'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAlternatives('validFrom', 'Дата начала действия', ocrForm.validFrom)}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 text-[10px] transition cursor-pointer flex items-center gap-1 border border-slate-700/40 hover:border-amber-500/40"
                    title="Другие варианты даты"
                  >
                    <i className="fa-solid fa-list-check"></i>
                    Варианты
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={ocrForm.validFrom}
                onChange={(e) => updateOcrField('validFrom', e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* 5. Valid To */}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                <label className="text-slate-400 font-medium">Действителен ПО (Дата окончания)</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleCopyField('validTo', ocrForm.validTo)}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] transition cursor-pointer flex items-center gap-1 border border-slate-700/40"
                    title="Скопировать дату"
                  >
                    <i className={`fa-solid ${copiedField === 'validTo' ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                    {copiedField === 'validTo' ? 'Скопировано' : 'Копировать'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRescanField('validTo', 'Дата окончания действия')}
                    disabled={rescanLoadingField === 'validTo'}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-brand-600/20 text-slate-400 hover:text-brand-300 text-[10px] transition cursor-pointer flex items-center gap-1 border border-slate-700/40 hover:border-brand-500/40 disabled:opacity-40"
                    title="Пересканировать дату окончания"
                  >
                    <i className={`fa-solid fa-rotate ${rescanLoadingField === 'validTo' ? 'animate-spin text-brand-400' : ''}`}></i>
                    {rescanLoadingField === 'validTo' ? 'Поиск...' : 'Перескан'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAlternatives('validTo', 'Дата окончания действия', ocrForm.validTo)}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 text-[10px] transition cursor-pointer flex items-center gap-1 border border-slate-700/40 hover:border-amber-500/40"
                    title="Другие варианты даты"
                  >
                    <i className="fa-solid fa-list-check"></i>
                    Варианты
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={ocrForm.validTo}
                onChange={(e) => updateOcrField('validTo', e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* 6. Notes / GOST / Certification Body (with AI format) */}
            <div className="space-y-1 md:col-span-2">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                <label className="text-slate-400 font-medium">Заметки / Орган сертификации / Стандарты ГОСТ</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleCopyField('notes', ocrForm.notes)}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] transition cursor-pointer flex items-center gap-1 border border-slate-700/40"
                    title="Скопировать поле в буфер"
                  >
                    <i className={`fa-solid ${copiedField === 'notes' ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                    {copiedField === 'notes' ? 'Скопировано' : 'Копировать'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRescanField('notes', 'Заметки / Орган сертификации / Стандарты ГОСТ')}
                    disabled={rescanLoadingField === 'notes'}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-brand-600/20 text-slate-400 hover:text-brand-300 text-[10px] transition cursor-pointer flex items-center gap-1 border border-slate-700/40 hover:border-brand-500/40 disabled:opacity-40"
                    title="Пересканировать только это поле"
                  >
                    <i className={`fa-solid fa-rotate ${rescanLoadingField === 'notes' ? 'animate-spin text-brand-400' : ''}`}></i>
                    {rescanLoadingField === 'notes' ? 'Поиск...' : 'Перескан'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAlternatives('notes', 'Заметки / Орган сертификации / Стандарты ГОСТ', ocrForm.notes)}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 text-[10px] transition cursor-pointer flex items-center gap-1 border border-slate-700/40 hover:border-amber-500/40"
                    title="Другие варианты из документа"
                  >
                    <i className="fa-solid fa-list-check"></i>
                    Варианты
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenFormatModal('notes', 'Заметки / Орган сертификации / Стандарты ГОСТ', ocrForm.notes)}
                    className="px-2 py-0.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 text-[10px] font-medium transition cursor-pointer flex items-center gap-1 border border-brand-500/30"
                    title="Отформатировать и очистить текст через ИИ с предпросмотром До/После"
                  >
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                    ИИ Форматирование
                  </button>
                </div>
              </div>
              <textarea
                rows={3}
                value={ocrForm.notes}
                onChange={(e) => updateOcrField('notes', e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium focus:outline-none focus:border-brand-500 resize-y"
              />
            </div>

            <div className="md:col-span-2 pt-2 flex items-center justify-between border-t border-slate-800">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition cursor-pointer"
              >
                Сбросить
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold transition shadow-lg shadow-emerald-600/20 cursor-pointer flex items-center gap-2"
              >
                <i className="fa-solid fa-folder-plus"></i> Сохранить в реестр
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Fullscreen Document Viewer Modal with Zoom & Pan */}
      {viewerIndex !== null && (
        <DocumentViewerModal
          isOpen={viewerIndex !== null}
          onClose={() => setViewerIndex(null)}
          pages={pages}
          currentIndex={viewerIndex}
          onNavigate={(newIdx) => setViewerIndex(newIdx)}
          onToggleSelect={togglePageSelect}
        />
      )}

      {/* AI Text Formatting Modal (Before & After comparison) */}
      <FormatTextModal
        isOpen={formatModal.isOpen}
        onClose={() => setFormatModal((prev) => ({ ...prev, isOpen: false }))}
        fieldTitle={formatModal.fieldTitle}
        originalText={formatModal.originalText}
        onApply={(newText) => updateOcrField(formatModal.fieldKey, newText)}
      />

      {/* Alternatives Popover/Modal */}
      <FieldAlternativesModal
        isOpen={alternativesModal.isOpen}
        onClose={() => setAlternativesModal((prev) => ({ ...prev, isOpen: false }))}
        fieldTitle={alternativesModal.fieldTitle}
        currentValue={alternativesModal.currentValue}
        alternatives={alternativesModal.alternatives}
        isLoading={alternativesModal.isLoading}
        onSelectAlternative={(val) => updateOcrField(alternativesModal.fieldKey, val)}
        onRefreshAlternatives={() => handleOpenAlternatives(alternativesModal.fieldKey, alternativesModal.fieldTitle, alternativesModal.currentValue)}
      />
    </div>
  );
};
