import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { extractPagesFromPdf, readFileAsBase64 } from '../../services/pdfService';
import { generateDemoCertificateBase64 } from '../../services/demoGenerator';
import { sendOCRRequest } from '../../services/api';
import { OCRResult } from '../../types';

export const ScanningTab: React.FC = () => {
  const {
    pages,
    addPage,
    togglePageSelect,
    removePage,
    selectAllPages,
    deselectAllPages,
    clearPages,
    applyRange,
    saveRegistryDoc,
    provider,
    model,
    apiKey,
    setActiveTab,
    setIsWebcamModalOpen
  } = useApp();

  const { showToast } = useToast();

  const [rangeInput, setRangeInput] = useState('');
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [isDropOver, setIsDropOver] = useState(false);

  const [ocrForm, setOcrForm] = useState<OCRResult>({
    docName: '',
    docNumber: '',
    product: '',
    validFrom: '',
    validTo: '',
    notes: ''
  });
  const [showResults, setShowResults] = useState(false);

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

  const handleDemoCertificate = () => {
    const b64 = generateDemoCertificateBase64();
    if (b64) {
      addPage(b64);
      showToast('Тестовый сертификат добавлен в галерею', 'success');
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
      // Send the first selected page to OCR
      const result = await sendOCRRequest({
        provider,
        model,
        apiKey,
        imageBase64: selected[0].src
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
    setOcrForm({
      docName: '',
      docNumber: '',
      product: '',
      validFrom: '',
      validTo: '',
      notes: ''
    });
    setShowResults(false);
  };

  return (
    <div className="space-y-6">
      {/* Action Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs cursor-pointer transition flex items-center gap-2 shadow-lg shadow-brand-600/20">
            <i className="fa-solid fa-upload"></i> Загрузить PDF / Изображения
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
            onClick={handleDemoCertificate}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition flex items-center gap-2 border border-slate-700 cursor-pointer"
          >
            <i className="fa-solid fa-file-shield text-brand-400"></i> Тестовый сертификат
          </button>

          <button
            onClick={() => setIsWebcamModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition flex items-center gap-2 border border-slate-700 cursor-pointer"
          >
            <i className="fa-solid fa-camera text-emerald-400"></i> Веб-камера ПК
          </button>
        </div>

        <button
          onClick={clearPages}
          className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 text-xs transition border border-slate-700/50 cursor-pointer"
        >
          <i className="fa-solid fa-trash"></i> Очистить все
        </button>
      </div>

      {/* Dropzone Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDropOver(true);
        }}
        onDragLeave={() => setIsDropOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDropOver(false);
          if (e.dataTransfer.files?.length) {
            handleFiles(e.dataTransfer.files);
          }
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition cursor-pointer ${
          isDropOver
            ? 'border-brand-500 bg-brand-950/20'
            : 'border-slate-800 hover:border-brand-500 bg-slate-900/30'
        }`}
      >
        <i className="fa-solid fa-cloud-arrow-up text-3xl text-slate-500 mb-2 block"></i>
        <p className="text-xs font-medium text-slate-300">
          {isProcessingFiles
            ? 'Обработка файлов...'
            : 'Перетащите сюда сканы или файлы PDF (или нажмите для выбора)'}
        </p>
        <p className="text-[11px] text-slate-500 mt-1">Поддерживаются форматы PNG, JPG, WEBP, PDF</p>
      </div>

      {/* Gallery Toolbar & Selection */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-300">Выбор страниц ({pages.filter(p => p.selected).length}/{pages.length}):</span>
          <button
            onClick={selectAllPages}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700 cursor-pointer"
          >
            Все
          </button>
          <button
            onClick={deselectAllPages}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700 cursor-pointer"
          >
            Снять
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={rangeInput}
            onChange={(e) => setRangeInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleApplyRange()}
            placeholder="например: 1-3, 5"
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 w-36 focus:outline-none focus:border-brand-500"
          />
          <button
            onClick={handleApplyRange}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 cursor-pointer"
          >
            Применить
          </button>
        </div>
      </div>

      {/* Pages Gallery Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {pages.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 border border-slate-800/50 rounded-2xl bg-slate-900/20">
            <i className="fa-solid fa-folder-open text-3xl mb-2 block text-slate-600"></i>
            <p className="text-xs">Галерея пуста. Отсканируйте со смартфона или загрузите файл.</p>
          </div>
        ) : (
          pages.map((page, index) => (
            <div
              key={page.id}
              className={`relative group bg-slate-900 border rounded-xl overflow-hidden shadow-lg transition ${
                page.selected
                  ? 'border-brand-500 ring-2 ring-brand-500/30'
                  : 'border-slate-800'
              }`}
            >
              <div
                onClick={() => togglePageSelect(page.id)}
                className="aspect-[3/4] bg-slate-950 flex items-center justify-center overflow-hidden cursor-pointer"
              >
                <img
                  src={page.src}
                  alt={`Страница ${index + 1}`}
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="p-2 flex items-center justify-between text-[11px] bg-slate-900/90 border-t border-slate-800">
                <span className="font-mono text-slate-400">#{index + 1}</span>
                <div className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={page.selected}
                    onChange={() => togglePageSelect(page.id)}
                    className="rounded bg-slate-950 border-slate-700 text-brand-500 focus:ring-0 cursor-pointer"
                  />
                  <button
                    onClick={() => removePage(page.id)}
                    className="text-slate-500 hover:text-rose-400 p-1 transition cursor-pointer"
                    title="Удалить страницу"
                  >
                    <i className="fa-solid fa-trash text-xs"></i>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recognition Action Launcher */}
      <div className="pt-2">
        <button
          onClick={handleRunOCR}
          disabled={isOcrLoading || pages.filter((p) => p.selected).length === 0}
          className={`w-full py-3.5 rounded-2xl font-semibold text-sm shadow-xl transition flex items-center justify-center gap-2 cursor-pointer ${
            isOcrLoading || pages.filter((p) => p.selected).length === 0
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-brand-600/20'
          }`}
        >
          {isOcrLoading ? (
            <>
              <i className="fa-solid fa-circle-notch animate-spin"></i> Обработка нейросетью через сервер...
            </>
          ) : (
            <>
              <i className="fa-solid fa-wand-magic-sparkles"></i> Распознать выбранные документы через ИИ
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
              ✓ Готово
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveToRegistry();
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs"
          >
            <div className="space-y-1">
              <label className="text-slate-400 font-medium">Название документа</label>
              <input
                type="text"
                value={ocrForm.docName}
                onChange={(e) => setOcrForm({ ...ocrForm, docName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-400 font-medium">Номер документа / Сертификата</label>
              <input
                type="text"
                value={ocrForm.docNumber}
                onChange={(e) => setOcrForm({ ...ocrForm, docNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-brand-300 font-mono font-bold focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-slate-400 font-medium">Наименование продукции / Объекта</label>
              <input
                type="text"
                value={ocrForm.product}
                onChange={(e) => setOcrForm({ ...ocrForm, product: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-400 font-medium">Дата начала действия</label>
              <input
                type="text"
                value={ocrForm.validFrom}
                onChange={(e) => setOcrForm({ ...ocrForm, validFrom: e.target.value })}
                placeholder="ДД.ММ.ГГГГ"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-400 font-medium">Дата окончания действия</label>
              <input
                type="text"
                value={ocrForm.validTo}
                onChange={(e) => setOcrForm({ ...ocrForm, validTo: e.target.value })}
                placeholder="ДД.ММ.ГГГГ"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-rose-400 font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-slate-400 font-medium">Заметки / Требования ГОСТ</label>
              <textarea
                rows={2}
                value={ocrForm.notes}
                onChange={(e) => setOcrForm({ ...ocrForm, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-brand-500"
              ></textarea>
            </div>

            <div className="pt-2 flex justify-end gap-3 border-t border-slate-800 md:col-span-2">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition cursor-pointer"
              >
                Сбросить
              </button>
              <button
                type="button"
                onClick={handleSaveToRegistry}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs transition flex items-center gap-1.5 shadow-lg shadow-brand-600/20 cursor-pointer"
              >
                <i className="fa-solid fa-floppy-disk"></i> Сохранить в реестр
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
