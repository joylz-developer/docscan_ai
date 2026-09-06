import { AiProvider, SavedDoc } from '../types';

export const STORAGE_KEYS = {
  PROVIDER: 'docscan_provider',
  API_KEY: 'docscan_api_key',
  MODEL: 'docscan_model',
  CUSTOM_HOST: 'docscan_custom_host',
  SAVED_DOCS: 'docscan_saved_docs'
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
