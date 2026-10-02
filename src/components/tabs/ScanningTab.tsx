import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { extractPagesFromPdf, readFileAsBase64 } from '../../services/pdfService';
import { sendOCRRequest, rescanSingleField, fetchFieldAlternatives } from '../../services/api';
import { storage, idbStorage } from '../../services/storage';
import { FieldKey, OCRResult, OcrHistoryEntry, QuickCopyConfig, FieldAlternativesMap } from '../../types';
import { formatTextByTemplate } from '../../utils/quickCopyFormatter';
import { DocumentViewerModal } from '../modals/DocumentViewerModal';
import { FormatTextModal } from '../modals/FormatTextModal';
import { FieldAlternativesModal } from '../modals/FieldAlternativesModal';
import { OcrHistoryModal } from '../modals/OcrHistoryModal';

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
    updateProductItems,
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

  // History state
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyList, setHistoryList] = useState<OcrHistoryEntry[]>([]);
  const [baseOcrResult, setBaseOcrResult] = useState<OCRResult | null>(null);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [hasEdits, setHasEdits] = useState(false);

  // Products itemized list & view mode (restored from ocrForm across tab switches)
  const [productsList, setProductsList] = useState<string[]>(() => {
    if (ocrForm.productsList && ocrForm.productsList.length > 0) return ocrForm.productsList;
    if (ocrForm.product) return ocrForm.product.split('\n').map((s) => s.trim()).filter(Boolean);
    return [];
  });
  const [productViewMode, setProductViewMode] = useState<'list' | 'text'>('list');
  const [copiedProductIndex, setCopiedProductIndex] = useState<number | null>(null);

  // Selected product checkboxes for Quick Copy template
  const [selectedProductIndices, setSelectedProductIndices] = useState<number[]>(() => {
    const count = ocrForm.productsList?.length || (ocrForm.product ? ocrForm.product.split('\n').filter(Boolean).length : 0);
    return Array.from({ length: count }, (_, i) => i);
  });

  // OCR Loading Progress Bar state
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [ocrStageText, setOcrStageText] = useState<string>('');

  // Instant field alternatives map & inline visibility
  const [fieldAlternatives, setFieldAlternatives] = useState<FieldAlternativesMap>(() => ocrForm.fieldAlternatives || {});
  const [showInlineAlternatives, setShowInlineAlternatives] = useState<Partial<Record<FieldKey, boolean>>>({});

  // Quick Copy / RegEx state
  const [quickCopyConfig, setQuickCopyConfig] = useState<QuickCopyConfig>(() => storage.getQuickCopyConfig());
  const [isQuickCopyOpen, setIsQuickCopyOpen] = useState(false);
  const [copiedQuick, setCopiedQuick] = useState(false);

  // Keep productsList & fieldAlternatives in sync with ocrForm (across tab switches / hydration)
  useEffect(() => {
    if (ocrForm.productsList && ocrForm.productsList.length > 0) {
      setProductsList(ocrForm.productsList);
    } else if (ocrForm.product) {
      const lines = ocrForm.product.split('\n').map((s) => s.trim()).filter(Boolean);
      if (lines.length > 0) {
        setProductsList(lines);
      }
    }
    if (ocrForm.fieldAlternatives && Object.keys(ocrForm.fieldAlternatives).length > 0) {
      setFieldAlternatives(ocrForm.fieldAlternatives);
    }
  }, [ocrForm.product, ocrForm.productsList, ocrForm.fieldAlternatives]);

  // Keep checkboxes in sync with products length
  useEffect(() => {
    if (productsList.length > 0 && selectedProductIndices.length === 0) {
      setSelectedProductIndices(productsList.map((_, i) => i));
    }
  }, [productsList.length]);

  // Hydrate history list on mount
  useEffect(() => {
    idbStorage.getOcrHistory().then((list) => {
      setHistoryList(list);
    });
  }, []);

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
    setOcrProgress(12);
    setOcrStageText(`Подготовка и кодирование страниц (${selected.length} стр.)...`);

    // Smooth progress simulation during the neural network request
    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed < 3000) {
        setOcrProgress((prev) => Math.min(35, prev + 3));
        setOcrStageText('Оптимизация сканов и отправка в модель...');
      } else if (elapsed < 8000) {
        setOcrProgress((prev) => Math.min(65, prev + 2));
        setOcrStageText('Оптический анализ текста нейросетью...');
      } else if (elapsed < 14000) {
        setOcrProgress((prev) => Math.min(88, prev + 1));
        setOcrStageText('Поиск моделей, типоразмеров, ГОСТов и альтернатив...');
      } else {
        setOcrProgress((prev) => Math.min(95, prev + 1));
        setOcrStageText('Формирование структуры полей и проверка б/н...');
      }
    }, 280);

    try {
      // Send all selected pages as imagesBase64
      const result = await sendOCRRequest({
        provider,
        model,
        apiKey,
        imageBase64: selected[0].src,
        imagesBase64: selected.map((p) => p.src),
        customPrompts
      });

      // Normalize missing docNumber to "б/н"
      if (!result.docNumber || result.docNumber.trim() === '1' || result.docNumber.trim() === '-') {
        result.docNumber = 'б/н';
      }

      setOcrForm(result);
      setShowResults(true);

      // Populate products list
      const pList = result.productsList && result.productsList.length > 0
        ? result.productsList
        : (result.product ? result.product.split('\n').map((s) => s.trim()).filter(Boolean) : []);
      setProductsList(pList);
      setSelectedProductIndices(pList.map((_, i) => i));

      // Populate field alternatives
      if (result.fieldAlternatives) {
        setFieldAlternatives(result.fieldAlternatives);
      } else {
        setFieldAlternatives({});
      }
      setShowInlineAlternatives({});

      // Record in OCR history
      const historyId = 'ocr_' + Date.now();
      const historyEntry: OcrHistoryEntry = {
        id: historyId,
        timestamp: Date.now(),
        docTitle: result.docName || 'Документ',
        thumbnail: selected[0]?.src,
        pagesCount: selected.length,
        baseVersion: { ...result },
        currentVersion: { ...result },
        hasEdits: false,
        editedFields: []
      };

      await idbStorage.addOcrHistory(historyEntry);
      const updatedHistory = await idbStorage.getOcrHistory();
      setHistoryList(updatedHistory);
      setBaseOcrResult({ ...result });
      setCurrentHistoryId(historyId);
      setHasEdits(false);

      // Finish progress animation
      clearInterval(progressInterval);
      setOcrProgress(100);
      setOcrStageText('✓ Документ успешно распознан!');
      await new Promise((resolve) => setTimeout(resolve, 400));

      showToast(
        selected.length > 1
          ? `Успешно распознано страниц: ${selected.length}!`
          : 'Документ успешно распознан!',
        'success'
      );
    } catch (err: any) {
      clearInterval(progressInterval);
      setOcrProgress(0);
      setOcrStageText('');
      showToast('Ошибка распознавания: ' + err.message, 'error');
    } finally {
      clearInterval(progressInterval);
      setIsOcrLoading(false);
    }
  };

  const handleFieldChange = (fieldKey: FieldKey, value: string) => {
    updateOcrField(fieldKey, value);

    if (fieldKey === 'product') {
      const lines = value.split('\n').map((s) => s.trim()).filter(Boolean);
      setProductsList(lines);
    }

    if (baseOcrResult && currentHistoryId) {
      const updatedForm = { ...ocrForm, [fieldKey]: value };
      const diffKeys = (['docName', 'docNumber', 'product', 'validFrom', 'validTo', 'notes'] as FieldKey[]).filter(
        (k) => (k === fieldKey ? value.trim() : (ocrForm[k] || '').trim()) !== (baseOcrResult[k] || '').trim()
      );
      const editActive = diffKeys.length > 0;
      setHasEdits(editActive);

      const existing = historyList.find((h) => h.id === currentHistoryId);
      if (existing) {
        const updatedEntry: OcrHistoryEntry = {
          ...existing,
          currentVersion: updatedForm,
          hasEdits: editActive,
          editedFields: diffKeys
        };
        idbStorage.updateOcrHistory(updatedEntry);
        setHistoryList((prev) => prev.map((e) => (e.id === currentHistoryId ? updatedEntry : e)));
      }
    }
  };

  const handleUpdateProductItem = (index: number, newValue: string) => {
    const updatedList = [...productsList];
    updatedList[index] = newValue;
    setProductsList(updatedList);
    updateProductItems(updatedList);
  };

  const handleAddProductItem = () => {
    const updatedList = [...productsList, ''];
    setProductsList(updatedList);
    updateProductItems(updatedList);
    setSelectedProductIndices((prev) => [...prev, updatedList.length - 1]);
  };

  const handleRemoveProductItem = (index: number) => {
    const updatedList = productsList.filter((_, i) => i !== index);
    setProductsList(updatedList);
    updateProductItems(updatedList);
    setSelectedProductIndices((prev) =>
      prev.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i))
    );
    showToast('Позиция удалена из списка', 'info');
  };

  const toggleProductSelect = (idx: number) => {
    setSelectedProductIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const selectAllProducts = () => {
    setSelectedProductIndices(productsList.map((_, i) => i));
  };

  const deselectAllProducts = () => {
    setSelectedProductIndices([]);
  };

  const getSelectedProductString = () => {
    if (productsList.length > 0 && selectedProductIndices.length > 0) {
      return productsList.filter((_, i) => selectedProductIndices.includes(i)).join(', ');
    }
    return ocrForm.product || '';
  };

  const handleCopySelectedProducts = () => {
    const text = getSelectedProductString().trim();
    if (!text) {
      showToast('Нет выбранных позиций для копирования', 'info');
      return;
    }
    navigator.clipboard.writeText(text);
    showToast(`Скопировано выбранных позиций (${selectedProductIndices.length}): "${text}"`, 'success');
  };

  const handleCopyProductItem = (text: string, index: number) => {
    const cleanText = (text || '').trim();
    if (!cleanText) {
      showToast('Позиция пустая', 'info');
      return;
    }
    navigator.clipboard.writeText(cleanText);
    setCopiedProductIndex(index);
    setTimeout(() => setCopiedProductIndex(null), 2000);
    showToast('Позиция скопирована в буфер', 'success');
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
    setProductsList([]);
    setSelectedProductIndices([]);
    setBaseOcrResult(null);
    setCurrentHistoryId(null);
    setHasEdits(false);
    setFieldAlternatives({});
    setShowInlineAlternatives({});
    showToast('Результаты распознавания очищены', 'info');
  };

  const handleCopyField = (fieldKey: FieldKey, text: string) => {
    const cleanText = (text || '').trim();
    if (!cleanText) {
      showToast('Поле пустое', 'info');
      return;
    }
    navigator.clipboard.writeText(cleanText);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);

    // Requirement 6: Show inline alternatives list after clicking copy
    setShowInlineAlternatives((prev) => ({ ...prev, [fieldKey]: true }));

    showToast('Скопировано в буфер обмена', 'success');
  };

  const handleSelectInlineAlternative = (fieldKey: FieldKey, altText: string) => {
    const cleanAlt = (altText || '').trim();
    handleFieldChange(fieldKey, cleanAlt);
    navigator.clipboard.writeText(cleanAlt);
    showToast(`Вариант применён и скопирован: "${cleanAlt}"`, 'success');
  };

  const handleQuickCopy = () => {
    // Substitute only checked product items into {product}
    const customOcr = { ...ocrForm, product: getSelectedProductString() };
    const formatted = formatTextByTemplate(
      customOcr,
      quickCopyConfig.template,
      quickCopyConfig.regexPattern,
      quickCopyConfig.regexReplace
    );
    const cleanText = (formatted || '').trim();
    if (!cleanText) {
      showToast('Сформированный текст пуст', 'info');
      return;
    }
    navigator.clipboard.writeText(cleanText);
    setCopiedQuick(true);
    setTimeout(() => setCopiedQuick(false), 2000);
    showToast('Скопировано по шаблону в буфер обмена!', 'success');
  };

  const handleSaveQuickCopyConfig = (newCfg: QuickCopyConfig) => {
    setQuickCopyConfig(newCfg);
    storage.setQuickCopyConfig(newCfg);
  };

  const handleLoadHistoryEntry = (entry: OcrHistoryEntry) => {
    setOcrForm(entry.currentVersion);
    setBaseOcrResult(entry.baseVersion);
    setCurrentHistoryId(entry.id);
    setHasEdits(entry.hasEdits);

    const pList = entry.currentVersion.productsList && entry.currentVersion.productsList.length > 0
      ? entry.currentVersion.productsList
      : (entry.currentVersion.product ? entry.currentVersion.product.split('\n').map((s) => s.trim()).filter(Boolean) : []);
    setProductsList(pList);
    setSelectedProductIndices(pList.map((_, i) => i));

    if (entry.currentVersion.fieldAlternatives) {
      setFieldAlternatives(entry.currentVersion.fieldAlternatives);
    }
    setShowResults(true);
    showToast(`Загружен документ: ${entry.docTitle}`, 'info');
  };

  const handleRestoreBaseVersion = (entry: OcrHistoryEntry) => {
    setOcrForm({ ...entry.baseVersion });
    setBaseOcrResult({ ...entry.baseVersion });
    setHasEdits(false);

    const pList = entry.baseVersion.productsList && entry.baseVersion.productsList.length > 0
      ? entry.baseVersion.productsList
      : (entry.baseVersion.product ? entry.baseVersion.product.split('\n').map((s) => s.trim()).filter(Boolean) : []);
    setProductsList(pList);
    setSelectedProductIndices(pList.map((_, i) => i));

    const updatedEntry: OcrHistoryEntry = {
      ...entry,
      currentVersion: { ...entry.baseVersion },
      hasEdits: false,
      editedFields: []
    };
    idbStorage.updateOcrHistory(updatedEntry);
    setHistoryList((prev) => prev.map((e) => (e.id === entry.id ? updatedEntry : e)));
    showToast('Восстановлена исходная базовая версия ИИ!', 'success');
  };

  const handleDeleteHistoryEntry = async (id: string) => {
    await idbStorage.deleteOcrHistory(id);
    const updated = await idbStorage.getOcrHistory();
    setHistoryList(updated);
    if (currentHistoryId === id) {
      setCurrentHistoryId(null);
    }
    showToast('Запись удалена из истории', 'info');
  };

  const handleClearAllHistory = async () => {
    await idbStorage.clearOcrHistory();
    setHistoryList([]);
    setCurrentHistoryId(null);
    showToast('Вся история распознавания очищена', 'info');
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

  const renderFieldActions = (
    fieldKey: FieldKey,
    fieldLabel: string,
    currentValue: string,
    includeFormat = false
  ) => {
    const isRescanning = rescanLoadingField === fieldKey;
    const hasInlineAlts = Boolean(fieldAlternatives[fieldKey]?.length);
    const isInlineOpen = Boolean(showInlineAlternatives[fieldKey]);

    return (
      <div className="flex items-center gap-1">
        {/* Toggle Inline Alternatives if available */}
        {hasInlineAlts && (
          <div className="relative group/tooltip">
            <button
              type="button"
              onClick={() => setShowInlineAlternatives((prev) => ({ ...prev, [fieldKey]: !prev[fieldKey] }))}
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition cursor-pointer border ${
                isInlineOpen
                  ? 'bg-amber-500/25 border-amber-500/50 text-amber-300'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/50 text-slate-400 hover:text-amber-300'
              }`}
              title="Показать/скрыть быстрые варианты ИИ"
            >
              <i className="fa-solid fa-layer-group text-[11px]"></i>
            </button>
            <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover/tooltip:flex items-center px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700/80 text-[10px] text-slate-200 whitespace-nowrap shadow-xl z-20 pointer-events-none">
              {isInlineOpen ? 'Скрыть варианты' : 'Быстрые варианты'}
            </div>
          </div>
        )}

        {/* 1. Rescan button */}
        <div className="relative group/tooltip">
          <button
            type="button"
            onClick={() => handleRescanField(fieldKey, fieldLabel)}
            disabled={isRescanning}
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition cursor-pointer border ${
              isRescanning
                ? 'bg-brand-500/20 border-brand-500/50 text-brand-300 cursor-wait'
                : 'bg-slate-800/80 hover:bg-brand-600/20 border-slate-700/50 hover:border-brand-500/40 text-slate-400 hover:text-brand-300 disabled:opacity-40'
            }`}
            title="Пересканировать только это поле"
          >
            <i className={`fa-solid fa-rotate ${isRescanning ? 'animate-spin text-brand-400' : ''}`}></i>
          </button>
          <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover/tooltip:flex items-center px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700/80 text-[10px] text-slate-200 whitespace-nowrap shadow-xl z-20 pointer-events-none">
            {isRescanning ? 'Поиск...' : 'Пересканировать'}
          </div>
        </div>

        {/* 2. Deep Alternatives search modal button */}
        <div className="relative group/tooltip">
          <button
            type="button"
            onClick={() => handleOpenAlternatives(fieldKey, fieldLabel, currentValue)}
            className="w-7 h-7 rounded-lg bg-slate-800/80 hover:bg-amber-500/20 border border-slate-700/50 hover:border-amber-500/40 text-slate-400 hover:text-amber-300 flex items-center justify-center text-xs transition cursor-pointer"
            title="Глубокий поиск всех вариантов по документу"
          >
            <i className="fa-solid fa-list-check"></i>
          </button>
          <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover/tooltip:flex items-center px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700/80 text-[10px] text-slate-200 whitespace-nowrap shadow-xl z-20 pointer-events-none">
            Глубокий поиск
          </div>
        </div>

        {/* 3. AI Formatting button (optional) */}
        {includeFormat && (
          <div className="relative group/tooltip">
            <button
              type="button"
              onClick={() => handleOpenFormatModal(fieldKey, fieldLabel, currentValue)}
              className="w-7 h-7 rounded-lg bg-brand-600/15 hover:bg-brand-600/30 border border-brand-500/30 hover:border-brand-500/60 text-brand-300 flex items-center justify-center text-xs transition cursor-pointer"
              title="Отформатировать и очистить текст через ИИ с предпросмотром"
            >
              <i className="fa-solid fa-wand-magic-sparkles"></i>
            </button>
            <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover/tooltip:flex items-center px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700/80 text-[10px] text-slate-200 whitespace-nowrap shadow-xl z-20 pointer-events-none">
              ИИ Форматирование
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderInlineAlternatives = (fieldKey: FieldKey) => {
    const alts = fieldAlternatives[fieldKey];
    if (!showInlineAlternatives[fieldKey] || !alts || alts.length === 0) return null;

    return (
      <div className="pt-1.5 flex items-center gap-1.5 flex-wrap animate-fade-in text-[11px]">
        <span className="text-slate-500 font-medium flex items-center gap-1 text-[11px] shrink-0">
          <i className="fa-solid fa-list-check text-amber-400 text-[10px]"></i> Варианты:
        </span>
        {alts.map((alt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSelectInlineAlternative(fieldKey, alt.text)}
            className="px-2 py-0.5 rounded-lg bg-slate-800/90 hover:bg-brand-600/30 text-slate-300 hover:text-brand-200 border border-slate-700/70 hover:border-brand-500/50 transition flex items-center gap-1.5 cursor-pointer group shadow-sm text-left max-w-full"
            title="Нажмите, чтобы заменить значение в поле и скопировать"
          >
            <span className="truncate max-w-[200px]">{alt.text}</span>
            {alt.confidence !== undefined && (
              <span className="text-[10px] px-1 py-0.2 rounded bg-brand-500/20 text-brand-300 font-mono font-medium">
                {alt.confidence}%
              </span>
            )}
          </button>
        ))}
      </div>
    );
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

          <button
            type="button"
            onClick={() => setIsHistoryModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition flex items-center gap-2 border border-slate-700 cursor-pointer shadow-sm"
            title="История всех сессий распознавания документов"
          >
            <i className="fa-solid fa-clock-rotate-left text-brand-400"></i>
            История ({historyList.length})
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
      <div className="pt-2 space-y-3">
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

        {/* Informative Progress Bar while OCR is running */}
        {isOcrLoading && (
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-brand-500/30 shadow-xl space-y-2.5 animate-fade-in">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-medium text-brand-300">
                <i className="fa-solid fa-circle-notch animate-spin text-brand-400"></i>
                <span>{ocrStageText || 'Обработка документов нейросетью...'}</span>
              </div>
              <span className="font-mono font-bold text-white text-xs bg-brand-500/20 px-2 py-0.5 rounded-lg border border-brand-500/30">
                {ocrProgress}%
              </span>
            </div>

            {/* Glowing animated bar */}
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-brand-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-300 relative overflow-hidden shadow-lg shadow-brand-500/50"
                style={{ width: `${ocrProgress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
              <span>Документов в обработке: {selectedCount}</span>
              <span className="text-slate-500">Пожалуйста, подождите...</span>
            </div>
          </div>
        )}
      </div>

      {/* Recognition Output Card */}
      {showResults && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <i className="fa-solid fa-file-signature text-brand-400"></i> Результаты распознавания
              </h3>
              {hasEdits ? (
                <span className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 shadow-sm">
                  ✏️ С изменениями (Базовая версия ИИ сохранена)
                </span>
              ) : (
                <span className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 shadow-sm">
                  ✓ Базовая версия ИИ
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(true)}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer border border-slate-700/60 flex items-center gap-1.5 shadow-sm"
                title="Открыть историю распознаваний и версий документа"
              >
                <i className="fa-solid fa-clock-rotate-left text-brand-400"></i>
                История ({historyList.length})
              </button>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveToRegistry();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* LEFT COLUMN: Metadata fields (docName, docNumber, validFrom/validTo, notes) */}
              <div className="lg:col-span-6 space-y-3.5 flex flex-col justify-between">
                {/* 1. Document Name */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-slate-300 font-medium text-xs flex items-center gap-1.5">
                      <i className="fa-solid fa-file-lines text-brand-400"></i>
                      Название документа
                    </label>
                    {renderFieldActions('docName', 'Название документа', ocrForm.docName)}
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={ocrForm.docName}
                      onChange={(e) => handleFieldChange('docName', e.target.value)}
                      placeholder="например: Паспорт, Сертификат соответствия, Декларация"
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800/90 text-slate-100 font-sans text-xs sm:text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition shadow-inner select-text"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyField('docName', ocrForm.docName)}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-xs transition cursor-pointer border ${
                        copiedField === 'docName'
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/50 hover:border-slate-600 text-slate-400 hover:text-slate-100'
                      }`}
                      title={copiedField === 'docName' ? 'Скопировано!' : 'Скопировать'}
                    >
                      <i className={`fa-solid ${copiedField === 'docName' ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                    </button>
                  </div>
                  {renderInlineAlternatives('docName')}
                </div>

                {/* 2. Document Number */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-slate-300 font-medium text-xs flex items-center gap-1.5">
                      <i className="fa-solid fa-hashtag text-brand-400"></i>
                      Номер документа / Сертификата / Паспорта
                    </label>
                    {renderFieldActions('docNumber', 'Номер документа / Сертификата', ocrForm.docNumber)}
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={ocrForm.docNumber}
                      onChange={(e) => handleFieldChange('docNumber', e.target.value)}
                      placeholder="номер документа или б/н"
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800/90 text-slate-100 font-mono text-xs sm:text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition shadow-inner select-text"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyField('docNumber', ocrForm.docNumber)}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-xs transition cursor-pointer border ${
                        copiedField === 'docNumber'
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/50 hover:border-slate-600 text-slate-400 hover:text-slate-100'
                      }`}
                      title={copiedField === 'docNumber' ? 'Скопировано!' : 'Скопировать'}
                    >
                      <i className={`fa-solid ${copiedField === 'docNumber' ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                    </button>
                  </div>
                  {renderInlineAlternatives('docNumber')}
                </div>

                {/* 3. Dates: Valid From & Valid To */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Valid From */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-slate-300 font-medium text-xs flex items-center gap-1.5">
                        <i className="fa-solid fa-calendar-check text-emerald-400"></i>
                        Действителен С
                      </label>
                      {renderFieldActions('validFrom', 'Дата начала действия', ocrForm.validFrom)}
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={ocrForm.validFrom}
                        onChange={(e) => handleFieldChange('validFrom', e.target.value)}
                        placeholder="ДД.ММ.ГГГГ"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800/90 text-slate-100 font-mono text-xs sm:text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition shadow-inner select-text"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyField('validFrom', ocrForm.validFrom)}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-xs transition cursor-pointer border ${
                          copiedField === 'validFrom'
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                            : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/50 hover:border-slate-600 text-slate-400 hover:text-slate-100'
                        }`}
                        title={copiedField === 'validFrom' ? 'Скопировано!' : 'Скопировать'}
                      >
                        <i className={`fa-solid ${copiedField === 'validFrom' ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                      </button>
                    </div>
                    {renderInlineAlternatives('validFrom')}
                  </div>

                  {/* Valid To */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-slate-300 font-medium text-xs flex items-center gap-1.5">
                        <i className="fa-solid fa-calendar-xmark text-rose-400"></i>
                        Действителен ПО
                      </label>
                      {renderFieldActions('validTo', 'Дата окончания действия', ocrForm.validTo)}
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={ocrForm.validTo}
                        onChange={(e) => handleFieldChange('validTo', e.target.value)}
                        placeholder="ДД.ММ.ГГГГ или Бессрочно"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800/90 text-slate-100 font-mono text-xs sm:text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition shadow-inner select-text"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyField('validTo', ocrForm.validTo)}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-xs transition cursor-pointer border ${
                          copiedField === 'validTo'
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                            : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/50 hover:border-slate-600 text-slate-400 hover:text-slate-100'
                        }`}
                        title={copiedField === 'validTo' ? 'Скопировано!' : 'Скопировать'}
                      >
                        <i className={`fa-solid ${copiedField === 'validTo' ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                      </button>
                    </div>
                    {renderInlineAlternatives('validTo')}
                  </div>
                </div>

                {/* 4. Notes / GOST / Standards */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-slate-300 font-medium text-xs flex items-center gap-1.5">
                      <i className="fa-solid fa-certificate text-indigo-400"></i>
                      Заметки / Орган сертификации / ГОСТ
                    </label>
                    {renderFieldActions('notes', 'Заметки / Орган сертификации / Стандарты ГОСТ', ocrForm.notes, true)}
                  </div>
                  <div className="relative">
                    <textarea
                      rows={3}
                      value={ocrForm.notes}
                      onChange={(e) => handleFieldChange('notes', e.target.value)}
                      placeholder="Орган по сертификации, стандарты ГОСТ / ТР ТС, изготовитель, особые условия..."
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800/90 text-slate-100 font-sans text-xs leading-relaxed focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition shadow-inner resize-y select-text"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyField('notes', ocrForm.notes)}
                      className={`absolute right-2.5 top-2.5 w-7 h-7 rounded-lg flex items-center justify-center text-xs transition cursor-pointer border ${
                        copiedField === 'notes'
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/50 hover:border-slate-600 text-slate-400 hover:text-slate-100'
                      }`}
                      title={copiedField === 'notes' ? 'Скопировано!' : 'Скопировать'}
                    >
                      <i className={`fa-solid ${copiedField === 'notes' ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                    </button>
                  </div>
                  {renderInlineAlternatives('notes')}
                </div>
              </div>

              {/* RIGHT COLUMN: Product / Materials / Models (Itemized list or raw text) */}
              <div className="lg:col-span-6 flex flex-col h-full space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-slate-300 font-medium text-xs flex items-center gap-1.5">
                      <i className="fa-solid fa-boxes-stacked text-brand-400"></i>
                      <span>Наименование продукции / Моделей</span>
                    </label>

                    {/* View mode toggle: List vs Text */}
                    <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setProductViewMode('list')}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition cursor-pointer ${
                          productViewMode === 'list'
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="Отображение списком с отдельными полями и копированием"
                      >
                        Позиции ({productsList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductViewMode('text')}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition cursor-pointer ${
                          productViewMode === 'text'
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="Отображение сплошным текстом"
                      >
                        Текст
                      </button>
                    </div>
                  </div>

                  {renderFieldActions('product', 'Наименование продукции / Объекта', ocrForm.product, true)}
                </div>

                {/* Sub-bar for list selection and bulk operations */}
                {productViewMode === 'list' && productsList.length > 0 && (
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[11px] animate-fade-in flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">
                        Выбрано для шаблона: <strong className="text-brand-300 font-mono">{selectedProductIndices.length}</strong> из {productsList.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={selectAllProducts}
                        className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer text-[10px]"
                        title="Выбрать все позиции"
                      >
                        ✓ Все
                      </button>
                      <button
                        type="button"
                        onClick={deselectAllProducts}
                        className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer text-[10px]"
                        title="Снять выбор со всех позиций"
                      >
                        ✕ Снять
                      </button>
                      <button
                        type="button"
                        onClick={handleCopySelectedProducts}
                        disabled={selectedProductIndices.length === 0}
                        className="px-2 py-0.5 rounded-md bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white font-medium transition cursor-pointer flex items-center gap-1 text-[10px] shadow-sm"
                        title="Скопировать только отмеченные галочками позиции через запятую"
                      >
                        <i className="fa-solid fa-copy text-[9px]"></i>
                        <span>Скопировать выбранные</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Product Content: List or Text */}
                <div className="flex-1 flex flex-col min-h-[220px] lg:min-h-[310px]">
                  {productViewMode === 'list' ? (
                    <div className="flex-1 flex flex-col space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {productsList.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl my-auto space-y-2">
                          <p>Список позиций пуст.</p>
                          <p className="text-[11px] text-slate-600">
                            Переключитесь на режим «Текст» или добавьте строку вручную.
                          </p>
                        </div>
                      ) : (
                        productsList.map((item, idx) => {
                          const isSelected = selectedProductIndices.includes(idx);
                          return (
                            <div
                              key={idx}
                              className={`flex items-center gap-2 p-1 rounded-xl transition border ${
                                isSelected
                                  ? 'bg-slate-950/80 border-slate-800'
                                  : 'bg-slate-950/40 border-transparent opacity-75'
                              }`}
                            >
                              {/* Checkbox for template selection */}
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleProductSelect(idx)}
                                title="Включить позицию в быстрое копирование по шаблону"
                                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-brand-600 focus:ring-brand-500/30 cursor-pointer shrink-0 accent-brand-600 ml-1"
                              />

                              <span className="text-[10px] font-mono text-slate-500 w-5 shrink-0 text-right">
                                #{idx + 1}
                              </span>

                              <div className="relative flex-1 flex items-center">
                                <input
                                  type="text"
                                  value={item}
                                  onChange={(e) => handleUpdateProductItem(idx, e.target.value)}
                                  placeholder={`Позиция #${idx + 1} (например: Труба 133х4,0 мм ст.20 ГОСТ 8732-78)`}
                                  className="w-full pl-3 pr-8 py-2 rounded-xl bg-slate-900/90 border border-slate-800/90 text-slate-100 font-sans text-xs focus:outline-none focus:border-brand-500 select-text"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleCopyProductItem(item, idx)}
                                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] transition cursor-pointer border ${
                                    copiedProductIndex === idx
                                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                                      : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/50 text-slate-400 hover:text-slate-100'
                                  }`}
                                  title="Скопировать эту позицию"
                                >
                                  <i className={`fa-solid ${copiedProductIndex === idx ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveProductItem(idx)}
                                className="w-6 h-6 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-950/30 flex items-center justify-center transition cursor-pointer shrink-0"
                                title="Удалить эту позицию"
                              >
                                <i className="fa-solid fa-xmark text-xs"></i>
                              </button>
                            </div>
                          );
                        })
                      )}

                      <button
                        type="button"
                        onClick={handleAddProductItem}
                        className="w-full py-2 rounded-xl border border-dashed border-slate-800 hover:border-brand-500/60 bg-slate-950/30 hover:bg-brand-950/20 text-slate-400 hover:text-brand-300 text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1.5 mt-1"
                      >
                        <i className="fa-solid fa-plus text-[10px]"></i> Добавить позицию продукции
                      </button>
                    </div>
                  ) : (
                    <div className="relative flex-1 flex flex-col">
                      <textarea
                        value={ocrForm.product}
                        onChange={(e) => handleFieldChange('product', e.target.value)}
                        placeholder="Полное наименование продукции, серии, список модификаций..."
                        className="flex-1 w-full pl-3.5 pr-10 py-3 rounded-xl bg-slate-950/70 border border-slate-800/90 text-slate-100 font-sans text-xs sm:text-sm leading-relaxed focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition shadow-inner resize-y select-text"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyField('product', ocrForm.product)}
                        className={`absolute right-2.5 top-2.5 w-7 h-7 rounded-lg flex items-center justify-center text-xs transition cursor-pointer border ${
                          copiedField === 'product'
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                            : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/50 hover:border-slate-600 text-slate-400 hover:text-slate-100'
                        }`}
                        title={copiedField === 'product' ? 'Скопировано!' : 'Скопировать'}
                      >
                        <i className={`fa-solid ${copiedField === 'product' ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                      </button>
                    </div>
                  )}
                </div>

                {renderInlineAlternatives('product')}

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                  <span>💡 Извлекает полный перечень моделей и точные параметры (толщина стенки, диаметр, марка)</span>
                </div>
              </div>
            </div>

            {/* Quick Copy by Template & RegEx Panel */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-wand-magic-sparkles text-brand-400 text-xs"></i>
                  <span className="text-xs font-bold text-slate-200">
                    Быстрое копирование по шаблону и RegEx
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuickCopyOpen(!isQuickCopyOpen)}
                  className="text-xs text-brand-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {isQuickCopyOpen ? 'Скрыть настройки шаблона' : 'Настроить шаблон'}
                  <i className={`fa-solid ${isQuickCopyOpen ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px]`}></i>
                </button>
              </div>

              {/* Formatted Text Preview & Copy Action */}
              <div className="flex items-stretch gap-2.5">
                <div className="flex-1 p-3 rounded-xl bg-slate-900 border border-slate-800 font-sans text-xs text-slate-200 select-text overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
                  {formatTextByTemplate(
                    { ...ocrForm, product: getSelectedProductString() },
                    quickCopyConfig.template,
                    quickCopyConfig.regexPattern,
                    quickCopyConfig.regexReplace
                  ) || <span className="text-slate-600 italic">Сформированный текст пуст</span>}
                </div>
                <button
                  type="button"
                  onClick={handleQuickCopy}
                  className={`px-4 rounded-xl font-semibold text-xs transition cursor-pointer flex items-center gap-2 shrink-0 border shadow-md ${
                    copiedQuick
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-brand-600 hover:bg-brand-500 border-brand-500 text-white shadow-brand-600/20'
                  }`}
                  title="Скопировать сформированный по шаблону текст в буфер обмена"
                >
                  <i className={`fa-solid ${copiedQuick ? 'fa-check' : 'fa-copy'}`}></i>
                  {copiedQuick ? 'Скопировано!' : 'Копировать'}
                </button>
              </div>

              {/* Config Accordion */}
              {isQuickCopyOpen && (
                <div className="pt-2 border-t border-slate-800/80 space-y-3 animate-fade-in text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <label className="text-slate-400 font-medium">Шаблон подстановки переменных:</label>
                      <div className="flex items-center gap-1 flex-wrap">
                        {['{docName}', '{docNumber}', '{validFrom}', '{validTo}', '{product}', '{notes}'].map((token) => (
                          <button
                            key={token}
                            type="button"
                            onClick={() => handleSaveQuickCopyConfig({ ...quickCopyConfig, template: (quickCopyConfig.template ? quickCopyConfig.template + ' ' : '') + token })}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 font-mono text-[10px] cursor-pointer"
                          >
                            +{token}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="text"
                      value={quickCopyConfig.template}
                      onChange={(e) => handleSaveQuickCopyConfig({ ...quickCopyConfig, template: e.target.value })}
                      placeholder="{docName} №{docNumber} от {validFrom} — {product}"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 font-mono text-xs focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-slate-400 font-medium">Регулярное выражение (RegEx Pattern):</label>
                      <input
                        type="text"
                        value={quickCopyConfig.regexPattern}
                        onChange={(e) => handleSaveQuickCopyConfig({ ...quickCopyConfig, regexPattern: e.target.value })}
                        placeholder="например: \d+х\d+(?:[\.,]\d+)?(?:\s*мм)?"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-brand-300 font-mono text-xs focus:outline-none focus:border-brand-500"
                      />
                      <span className="text-[10px] text-slate-600 block">
                        Оставьте замену пустой для извлечения совпадений
                      </span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 font-medium">Замена RegEx (Replace):</label>
                      <input
                        type="text"
                        value={quickCopyConfig.regexReplace}
                        onChange={(e) => handleSaveQuickCopyConfig({ ...quickCopyConfig, regexReplace: e.target.value })}
                        placeholder="например: $1 или пусто для извлечения"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-brand-300 font-mono text-xs focus:outline-none focus:border-brand-500"
                      />
                      <span className="text-[10px] text-slate-600 block">
                        Шаблон подстановки группы ($1, $2...)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions Footer */}
            <div className="pt-3 flex items-center justify-between border-t border-slate-800">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-xs transition cursor-pointer flex items-center gap-1.5 border border-slate-700/50"
              >
                <i className="fa-solid fa-arrow-rotate-left text-xs"></i>
                Сбросить
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-xs sm:text-sm transition shadow-lg shadow-emerald-600/20 cursor-pointer flex items-center gap-2"
              >
                <i className="fa-solid fa-folder-plus"></i> Сохранить в реестр
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Fullscreen Document Viewer Modal with Zoom, Pan & Rotation */}
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

      {/* OCR History Modal */}
      <OcrHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        history={historyList}
        onLoadEntry={handleLoadHistoryEntry}
        onRestoreBaseVersion={handleRestoreBaseVersion}
        onDeleteEntry={handleDeleteHistoryEntry}
        onClearAllHistory={handleClearAllHistory}
      />

      {/* AI Text Formatting Modal (Before & After comparison) */}
      <FormatTextModal
        isOpen={formatModal.isOpen}
        onClose={() => setFormatModal((prev) => ({ ...prev, isOpen: false }))}
        fieldTitle={formatModal.fieldTitle}
        originalText={formatModal.originalText}
        onApply={(newText) => handleFieldChange(formatModal.fieldKey, newText)}
      />

      {/* Alternatives Popover/Modal */}
      <FieldAlternativesModal
        isOpen={alternativesModal.isOpen}
        onClose={() => setAlternativesModal((prev) => ({ ...prev, isOpen: false }))}
        fieldTitle={alternativesModal.fieldTitle}
        currentValue={alternativesModal.currentValue}
        alternatives={alternativesModal.alternatives}
        isLoading={alternativesModal.isLoading}
        onSelectAlternative={(val) => handleFieldChange(alternativesModal.fieldKey, val)}
        onRefreshAlternatives={() => handleOpenAlternatives(alternativesModal.fieldKey, alternativesModal.fieldTitle, alternativesModal.currentValue)}
      />
    </div>
  );
};
