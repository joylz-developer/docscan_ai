import { AiProvider, SavedDoc, FieldPrompts, DEFAULT_FIELD_PROMPTS, OcrHistoryEntry, QuickCopyConfig, AppSettingsConfig } from '../types';

export const STORAGE_KEYS = {
  PROVIDER: 'docscan_provider',
  API_KEY: 'docscan_api_key',
  MODEL: 'docscan_model',
  CUSTOM_MODEL_ID: 'docscan_custom_model_id',
  CUSTOM_HOST: 'docscan_custom_host',
  SAVED_DOCS: 'docscan_saved_docs',
  CUSTOM_PROMPTS: 'docscan_custom_prompts',
  QUICK_COPY_TEMPLATE: 'docscan_quick_copy_template',
  QUICK_COPY_PATTERN: 'docscan_quick_copy_pattern',
  QUICK_COPY_REPLACE: 'docscan_quick_copy_replace'
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
        const parsed = JSON.parse(data);
        if (parsed.product === 'Наименование продукции, оборудования, модели или объекта сертификации') {
          parsed.product = DEFAULT_FIELD_PROMPTS.product;
        }
        return { ...DEFAULT_FIELD_PROMPTS, ...parsed };
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

  getCustomModelId(): string {
    return localStorage.getItem(STORAGE_KEYS.CUSTOM_MODEL_ID) || '';
  },
  setCustomModelId(id: string) {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_MODEL_ID, id);
  },

  getQuickCopyConfig(): QuickCopyConfig {
    return {
      template: localStorage.getItem(STORAGE_KEYS.QUICK_COPY_TEMPLATE) || '{docName} №{docNumber} от {validFrom} — {product}',
      regexPattern: localStorage.getItem(STORAGE_KEYS.QUICK_COPY_PATTERN) || '',
      regexReplace: localStorage.getItem(STORAGE_KEYS.QUICK_COPY_REPLACE) || ''
    };
  },
  setQuickCopyConfig(cfg: QuickCopyConfig) {
    localStorage.setItem(STORAGE_KEYS.QUICK_COPY_TEMPLATE, cfg.template || '');
    localStorage.setItem(STORAGE_KEYS.QUICK_COPY_PATTERN, cfg.regexPattern || '');
    localStorage.setItem(STORAGE_KEYS.QUICK_COPY_REPLACE, cfg.regexReplace || '');
  },

  exportAppSettings(): AppSettingsConfig {
    return {
      version: '1.1.0',
      exportedAt: new Date().toISOString(),
      provider: this.getProvider(),
      model: this.getModel(),
      customModelId: this.getCustomModelId(),
      prompts: this.getCustomPrompts(),
      quickCopy: this.getQuickCopyConfig()
    };
  },

  importAppSettings(cfg: AppSettingsConfig) {
    if (cfg.provider) this.setProvider(cfg.provider);
    if (cfg.model) this.setModel(cfg.model);
    if (cfg.customModelId !== undefined) this.setCustomModelId(cfg.customModelId);
    if (cfg.prompts) this.setCustomPrompts({ ...DEFAULT_FIELD_PROMPTS, ...cfg.prompts });
    if (cfg.quickCopy) this.setQuickCopyConfig(cfg.quickCopy);
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

/**
 * IndexedDB storage for large scans (pages) and OCR state to avoid localStorage 5MB limits
 */
function getDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const req = window.indexedDB.open('docscan_ai_db', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('keyval')) {
        db.createObjectStore('keyval');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keyval', 'readonly');
      const store = tx.objectStore('keyval');
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keyval', 'readwrite');
      const store = tx.objectStore('keyval');
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('idbSet failed for', key, e);
  }
}

async function idbDelete(key: string): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keyval', 'readwrite');
      const store = tx.objectStore('keyval');
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('idbDelete failed for', key, e);
  }
}

export const idbStorage = {
  async getPages(): Promise<import('../types').DocPage[]> {
    const pages = await idbGet<import('../types').DocPage[]>('docscan_pages');
    return Array.isArray(pages) ? pages : [];
  },
  async setPages(pages: import('../types').DocPage[]): Promise<void> {
    await idbSet('docscan_pages', pages);
  },
  async getOcrState(): Promise<{ form: import('../types').OCRResult; showResults: boolean } | null> {
    return await idbGet<{ form: import('../types').OCRResult; showResults: boolean }>('docscan_ocr_state');
  },
  async setOcrState(state: { form: import('../types').OCRResult; showResults: boolean }): Promise<void> {
    await idbSet('docscan_ocr_state', state);
  },
  async getOcrHistory(): Promise<OcrHistoryEntry[]> {
    const list = await idbGet<OcrHistoryEntry[]>('docscan_ocr_history');
    return Array.isArray(list) ? list : [];
  },
  async addOcrHistory(entry: OcrHistoryEntry): Promise<void> {
    const list = await this.getOcrHistory();
    const updated = [entry, ...list.filter(e => e.id !== entry.id)].slice(0, 50);
    await idbSet('docscan_ocr_history', updated);
  },
  async updateOcrHistory(entry: OcrHistoryEntry): Promise<void> {
    const list = await this.getOcrHistory();
    const updated = list.map(e => e.id === entry.id ? entry : e);
    await idbSet('docscan_ocr_history', updated);
  },
  async deleteOcrHistory(id: string): Promise<void> {
    const list = await this.getOcrHistory();
    await idbSet('docscan_ocr_history', list.filter(e => e.id !== id));
  },
  async clearOcrHistory(): Promise<void> {
    await idbDelete('docscan_ocr_history');
  },
  async clearAll(): Promise<void> {
    await idbDelete('docscan_pages');
    await idbDelete('docscan_ocr_state');
  }
};

