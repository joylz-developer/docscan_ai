import React, { useState, useEffect } from 'react';
import { useApp, MODEL_PRESETS } from '../../context/AppContext';
import { AiProvider } from '../../types';

export const SettingsTab: React.FC = () => {
  const { provider, apiKey, model, saveApiSettings, clearApiSettings } = useApp();

  const [selectedProvider, setSelectedProvider] = useState<AiProvider>(provider);
  const [selectedModel, setSelectedModel] = useState<string>(model);
  const [customModelId, setCustomModelId] = useState<string>('');
  const [isCustomModel, setIsCustomModel] = useState<boolean>(false);
  const [inputApiKey, setInputApiKey] = useState<string>(apiKey);

  useEffect(() => {
    setSelectedProvider(provider);
    setInputApiKey(apiKey);

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
  }, [provider, apiKey, model]);

  const handleProviderChange = (newProvider: AiProvider) => {
    setSelectedProvider(newProvider);
    const defaultModel = MODEL_PRESETS[newProvider][0].id;
    setSelectedModel(defaultModel);
    setIsCustomModel(false);
  };

  const handleModelChange = (val: string) => {
    setSelectedModel(val);
    if (val === 'custom') {
      setIsCustomModel(true);
    } else {
      setIsCustomModel(false);
    }
  };

  const handleSave = () => {
    const finalModel = isCustomModel ? customModelId.trim() : selectedModel;
    saveApiSettings(selectedProvider, inputApiKey.trim(), finalModel);
  };

  const handleClear = () => {
    setInputApiKey('');
    clearApiSettings();
  };

  const getKeyUrl =
    selectedProvider === 'openrouter'
      ? 'https://openrouter.ai/keys'
      : 'https://aistudio.google.com/app/apikey';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <i className="fa-solid fa-robot text-brand-400"></i> Настройки провайдера и модели ИИ
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Выберите ИИ-сервис (OpenRouter или Gemini) и введите ваш API-ключ. Запросы безопасно проксируются через сервер без CORS-ошибок.
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
                onChange={(e) => setCustomModelId(e.target.value)}
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
              onChange={(e) => setInputApiKey(e.target.value)}
              placeholder={selectedProvider === 'openrouter' ? 'sk-or-v1-...' : 'AIzaSy...'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
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
    </div>
  );
};
