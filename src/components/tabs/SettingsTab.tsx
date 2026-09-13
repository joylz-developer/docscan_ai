import React, { useState, useEffect } from 'react';
import { useApp, MODEL_PRESETS } from '../../context/AppContext';
import { AiProvider, FieldPrompts, DEFAULT_FIELD_PROMPTS } from '../../types';
import { testApiConnection } from '../../services/api';
import { useToast } from '../../context/ToastContext';

export const SettingsTab: React.FC = () => {
  const {
    provider,
    apiKey,
    model,
    customPrompts,
    saveCustomPrompts,
    resetCustomPrompts,
    saveApiSettings,
    clearApiSettings
  } = useApp();

  const { showToast } = useToast();

  const [selectedProvider, setSelectedProvider] = useState<AiProvider>(provider);
  const [selectedModel, setSelectedModel] = useState<string>(model);
  const [customModelId, setCustomModelId] = useState<string>('');
  const [isCustomModel, setIsCustomModel] = useState<boolean>(false);
  const [inputApiKey, setInputApiKey] = useState<string>(apiKey);

  // Prompts state
  const [promptsForm, setPromptsForm] = useState<FieldPrompts>(customPrompts);
  const [showPromptsConfig, setShowPromptsConfig] = useState<boolean>(false);

  // Connection test state
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  useEffect(() => {
    setSelectedProvider(provider);
    setInputApiKey(apiKey);
    setPromptsForm(customPrompts);

    const presets = MODEL_PRESETS[provider] || [];
    const exists = presets.some((p) => p.id === model);
    if (exists) {
      setSelectedModel(model);
      setIsCustomModel(false);
    } else {
      setSelectedModel('custom');
      setIsCustomModel(true);
      setCustomModelId(model);
    }
  }, [provider, apiKey, model, customPrompts]);

  const handleProviderChange = (newProvider: AiProvider) => {
    setSelectedProvider(newProvider);
    const defaultModel = MODEL_PRESETS[newProvider][0].id;
    setSelectedModel(defaultModel);
    setIsCustomModel(false);
    setTestResult(null);
  };

  const handleModelChange = (val: string) => {
    setSelectedModel(val);
    if (val === 'custom') {
      setIsCustomModel(true);
    } else {
      setIsCustomModel(false);
    }
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    const activeModel = isCustomModel ? customModelId.trim() : selectedModel;
    const activeKey = inputApiKey.trim();

    if (!activeKey) {
      showToast('Сначала укажите API-ключ для проверки', 'error');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await testApiConnection({
        provider: selectedProvider,
        model: activeModel,
        apiKey: activeKey
      });
      setTestResult(res);
      if (res.success) {
        showToast(res.message || 'Соединение успешно!', 'success');
      } else {
        showToast(res.error || 'Ошибка проверки соединения', 'error');
      }
    } catch (err: any) {
      const msg = err.message || 'Не удалось связаться с сервером';
      setTestResult({ success: false, error: msg });
      showToast(msg, 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const finalModel = isCustomModel ? customModelId.trim() : selectedModel;
    saveApiSettings(selectedProvider, inputApiKey.trim(), finalModel);
    saveCustomPrompts(promptsForm);
  };

  const handleClear = () => {
    setInputApiKey('');
    clearApiSettings();
    setTestResult(null);
  };

  const handleResetPrompts = () => {
    resetCustomPrompts();
    setPromptsForm(DEFAULT_FIELD_PROMPTS);
  };

  const getKeyUrl =
    selectedProvider === 'openrouter'
      ? 'https://openrouter.ai/keys'
      : 'https://aistudio.google.com/app/apikey';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Main AI Settings Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <i className="fa-solid fa-robot text-brand-400"></i> Настройки провайдера и модели ИИ
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Выберите ИИ-сервис (OpenRouter или Gemini), укажите ключ и проверьте соединение. Запросы безопасно проксируются через сервер без ошибок CORS.
          </p>
        </div>

        <div className="space-y-4 text-xs">
          {/* Provider Selector */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">Провайдер API</label>
            <select
              value={selectedProvider}
              onChange={(e) => handleProviderChange(e.target.value as AiProvider)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium focus:outline-none focus:border-brand-500 cursor-pointer"
            >
              <option value="openrouter">OpenRouter API (Все модели: Gemini, Claude, GPT, Qwen)</option>
              <option value="gemini">Google Gemini API (Прямое подключение)</option>
            </select>
          </div>

          {/* Preset Model Selector */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">Выбор нейросети (Модели)</label>
            <select
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium focus:outline-none focus:border-brand-500 cursor-pointer"
            >
              {(MODEL_PRESETS[selectedProvider] || []).map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Model ID Field */}
          {isCustomModel && (
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">Пользовательский ID модели</label>
              <input
                type="text"
                value={customModelId}
                onChange={(e) => {
                  setCustomModelId(e.target.value);
                  setTestResult(null);
                }}
                placeholder="например: meta-llama/llama-3.2-11b-vision-instruct:free"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-brand-300 font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
          )}

          {/* API Key Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 font-medium">API Key (Ключ доступа)</label>
              <a
                href={getKeyUrl}
                target="_blank"
                rel="noreferrer"
                className="text-brand-400 hover:underline flex items-center gap-1"
              >
                Получить ключ <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
              </a>
            </div>
            <input
              type="password"
              value={inputApiKey}
              onChange={(e) => {
                setInputApiKey(e.target.value);
                setTestResult(null);
              }}
              placeholder={selectedProvider === 'openrouter' ? 'sk-or-v1-...' : 'AIzaSy...'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Test Connection Button & Status */}
          <div className="pt-2">
            <div className="flex items-center gap-3">
              <button
                onClick={handleTestConnection}
                disabled={isTesting || !inputApiKey.trim()}
                className={`px-4 py-2 rounded-xl font-medium text-xs transition flex items-center gap-2 cursor-pointer shadow-sm ${
                  isTesting || !inputApiKey.trim()
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/40'
                    : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {isTesting ? (
                  <>
                    <i className="fa-solid fa-circle-notch animate-spin text-emerald-400"></i>
                    Проверка подключения...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-plug text-emerald-400"></i>
                    Проверить соединение
                  </>
                )}
              </button>

              <span className="text-[11px] text-slate-500">
                Отправляет проверочный запрос к API
              </span>
            </div>

            {testResult && (
              <div
                className={`mt-3 p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-fade-in ${
                  testResult.success
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                }`}
              >
                <i
                  className={`fa-solid ${
                    testResult.success ? 'fa-circle-check text-emerald-400' : 'fa-triangle-exclamation text-rose-400'
                  } mt-0.5`}
                ></i>
                <div className="leading-relaxed">
                  <div className="font-semibold">
                    {testResult.success ? 'Соединение успешно!' : 'Ошибка подключения:'}
                  </div>
                  <div className="text-[11px] mt-0.5 opacity-90">
                    {testResult.message || testResult.error}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Buttons Bar */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={handleClear}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 text-xs transition border border-slate-700/50 cursor-pointer"
          >
            Удалить ключ
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs transition shadow-lg shadow-brand-600/20 cursor-pointer"
          >
            Сохранить настройки
          </button>
        </div>
      </div>

      {/* Prompts Configuration Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <i className="fa-solid fa-sliders text-brand-400"></i> Промпты для распознавания полей документа
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Инструкции, по которым нейросеть извлекает реквизиты из отсканированного сертификата или паспорта.
            </p>
          </div>
          <button
            onClick={() => setShowPromptsConfig(!showPromptsConfig)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer border border-slate-700"
          >
            {showPromptsConfig ? 'Скрыть промпты' : 'Настроить промпты'}
          </button>
        </div>

        {showPromptsConfig && (
          <div className="space-y-3.5 text-xs pt-2 border-t border-slate-800/80 animate-fade-in">
            <div className="space-y-1">
              <label className="text-slate-300 font-medium">1. Название документа (docName)</label>
              <textarea
                rows={2}
                value={promptsForm.docName}
                onChange={(e) => setPromptsForm({ ...promptsForm, docName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs focus:outline-none focus:border-brand-500 resize-y"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-medium">2. Номер документа / сертификата (docNumber)</label>
              <textarea
                rows={2}
                value={promptsForm.docNumber}
                onChange={(e) => setPromptsForm({ ...promptsForm, docNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs focus:outline-none focus:border-brand-500 resize-y"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-medium">3. Наименование продукции / объекта (product)</label>
              <textarea
                rows={8}
                value={promptsForm.product}
                onChange={(e) => setPromptsForm({ ...promptsForm, product: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs focus:outline-none focus:border-brand-500 resize-y leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-slate-300 font-medium">4. Дата начала (validFrom)</label>
                <textarea
                  rows={2}
                  value={promptsForm.validFrom}
                  onChange={(e) => setPromptsForm({ ...promptsForm, validFrom: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs focus:outline-none focus:border-brand-500 resize-y"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">5. Дата окончания (validTo)</label>
                <textarea
                  rows={2}
                  value={promptsForm.validTo}
                  onChange={(e) => setPromptsForm({ ...promptsForm, validTo: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs focus:outline-none focus:border-brand-500 resize-y"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-medium">6. Заметки, ГОСТ, ТР ТС, орган сертификации (notes)</label>
              <textarea
                rows={2}
                value={promptsForm.notes}
                onChange={(e) => setPromptsForm({ ...promptsForm, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs focus:outline-none focus:border-brand-500 resize-y"
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={handleResetPrompts}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs transition cursor-pointer border border-slate-700/50"
              >
                Сбросить по умолчанию
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs transition shadow-md cursor-pointer"
              >
                Сохранить промпты
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
