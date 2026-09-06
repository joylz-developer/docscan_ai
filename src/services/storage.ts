import { AiProvider, SavedDoc, FieldPrompts, DEFAULT_FIELD_PROMPTS } from '../types';

export const STORAGE_KEYS = {
  PROVIDER: 'docscan_provider',
  API_KEY: 'docscan_api_key',
  MODEL: 'docscan_model',
  CUSTOM_HOST: 'docscan_custom_host',
  SAVED_DOCS: 'docscan_saved_docs',
  CUSTOM_PROMPTS: 'docscan_custom_prompts'
};

export const storage = {
  getProvider(): AiProvider {
    return (localStorage.getItem(STORAGE_KEYS.PROVIDER) as AiProvider) || 'openrouter';
  },
  setProvider(provider: AiProvider) {
    localStorage.setItem(STORAGE_KEYS.PROVIDER, provider);
  },

  getApiKey(): string {
    return localStorage.getItem(STORAGE_KEYS.API_KEY) || localStorage.getItem('gemini_api_key') || '';
  },
  setApiKey(key: string) {
    localStorage.setItem(STORAGE_KEYS.API_KEY, key);
  },
  removeApiKey() {
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
    localStorage.removeItem('gemini_api_key');
  },

  getModel(): string {
    return localStorage.getItem(STORAGE_KEYS.MODEL) || 'google/gemini-2.5-flash';
  },
  setModel(model: string) {
    localStorage.setItem(STORAGE_KEYS.MODEL, model);
  },

  getCustomHost(): string {
    return localStorage.getItem(STORAGE_KEYS.CUSTOM_HOST) || '';
  },
  setCustomHost(host: string) {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_HOST, host);
  },

  getCustomPrompts(): FieldPrompts {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_PROMPTS);
      if (data) {
        return { ...DEFAULT_FIELD_PROMPTS, ...JSON.parse(data) };
      }
    } catch (_) {}
    return { ...DEFAULT_FIELD_PROMPTS };
  },
  setCustomPrompts(prompts: FieldPrompts) {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_PROMPTS, JSON.stringify(prompts));
  },
  resetCustomPrompts() {
    localStorage.removeItem(STORAGE_KEYS.CUSTOM_PROMPTS);
  },

  getSavedDocs(): SavedDoc[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SAVED_DOCS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  setSavedDocs(docs: SavedDoc[]) {
    localStorage.setItem(STORAGE_KEYS.SAVED_DOCS, JSON.stringify(docs));
  }
};
