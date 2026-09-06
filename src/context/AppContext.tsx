import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { DocPage, SavedDoc, AiProvider, ModelPreset, ServerInfo, PairingStatus, TunnelStatus, ConnectionChannelType, FieldPrompts, DEFAULT_FIELD_PROMPTS } from '../types';
import { storage } from '../services/storage';
import { fetchServerInfo, fetchTunnelStatus, startTunnel, stopTunnel } from '../services/api';
import { UnifiedWebRTCClient } from '../services/webrtcService';
import { useToast } from './ToastContext';

export const MODEL_PRESETS: Record<AiProvider, ModelPreset[]> = {
  openrouter: [
    { id: 'google/gemini-2.5-flash', name: 'Google Gemini 2.5 Flash (Рекомендуемая)' },
    { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Бесплатно)' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'qwen/qwen-2.5-vl-72b-instruct:free', name: 'Qwen 2.5 VL 72B (Бесплатно)' },
    { id: 'custom', name: '✏️ Ввести ID модели вручную...' }
  ],
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'custom', name: '✏️ Ввести ID модели вручную...' }
  ]
};

function generateSessionCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

interface AppContextType {
  activeTab: number;
  setActiveTab: (tab: number) => void;
  pages: DocPage[];
  addPage: (src: string) => void;
  togglePageSelect: (id: string) => void;
  removePage: (id: string) => void;
  removeSelectedPages: () => void;
  movePage: (index: number, direction: 'left' | 'right') => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  selectAllPages: () => void;
  deselectAllPages: () => void;
  clearPages: () => void;
  applyRange: (rangeStr: string) => void;
  
  savedDocs: SavedDoc[];
  saveRegistryDoc: (doc: Omit<SavedDoc, 'id'>) => void;
  deleteRegistryDoc: (id: number) => void;
  exportCSV: () => void;

  provider: AiProvider;
  setProvider: (provider: AiProvider) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  model: string;
  setModel: (model: string) => void;
  customHost: string;
  setCustomHost: (host: string) => void;
  customPrompts: import('../types').FieldPrompts;
  saveCustomPrompts: (prompts: import('../types').FieldPrompts) => void;
  resetCustomPrompts: () => void;
  saveApiSettings: (p: AiProvider, k: string, m: string) => void;
  clearApiSettings: () => void;

  sessionId: string;
  reconnectSession: () => void;
  pairingStatus: PairingStatus;
  pairingStatusText: string;
  connectionChannel: ConnectionChannelType;
  serverInfo: ServerInfo | null;
  pairingUrl: string;

  tunnelStatus: import('../types').TunnelStatus;
  startTunnelAction: () => Promise<void>;
  stopTunnelAction: () => Promise<void>;

  isMobileMode: boolean;
  mobileSessionParam: string;

  isWebcamModalOpen: boolean;
  setIsWebcamModalOpen: (open: boolean) => void;
  isServerGuideModalOpen: boolean;
  setIsServerGuideModalOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<number>(1);
  const [pages, setPages] = useState<DocPage[]>([]);
  const [savedDocs, setSavedDocs] = useState<SavedDoc[]>(() => storage.getSavedDocs());

  const [provider, setProviderState] = useState<AiProvider>(() => storage.getProvider());
  const [apiKey, setApiKeyState] = useState<string>(() => storage.getApiKey());
  const [model, setModelState] = useState<string>(() => storage.getModel());
  const [customHost, setCustomHostState] = useState<string>(() => storage.getCustomHost());
  const [customPrompts, setCustomPromptsState] = useState<FieldPrompts>(() => storage.getCustomPrompts());
  
  const [sessionId, setSessionId] = useState<string>(() => generateSessionCode());
  const [pairingStatus, setPairingStatus] = useState<PairingStatus>('init');
  const [pairingStatusText, setPairingStatusText] = useState<string>('Инициализация...');
  const [connectionChannel, setConnectionChannel] = useState<ConnectionChannelType>('disconnected');
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [tunnelStatus, setTunnelStatus] = useState<TunnelStatus>({ status: 'stopped', url: null });

  const [isWebcamModalOpen, setIsWebcamModalOpen] = useState<boolean>(false);
  const [isServerGuideModalOpen, setIsServerGuideModalOpen] = useState<boolean>(false);

  // Mobile mode detection
  const [isMobileMode, setIsMobileMode] = useState<boolean>(false);
  const [mobileSessionParam, setMobileSessionParam] = useState<string>('');

  const webrtcClientRef = useRef<UnifiedWebRTCClient | null>(null);

  useEffect(() => {
    // Detect URL params
    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get('session');
    const isMobileHash = window.location.hash === '#mobile';

    if (sessionParam || isMobileHash) {
      setIsMobileMode(true);
      setMobileSessionParam(sessionParam || '');
    }

    // Fetch server info & tunnel status
    fetchServerInfo().then((info) => {
      if (info) setServerInfo(info);
    });

    fetchTunnelStatus().then((status) => {
      setTunnelStatus(status);
      if (status.status === 'running' && status.url) {
        setCustomHostState(status.url);
        storage.setCustomHost(status.url);
      }
    });
  }, []);

  const startTunnelAction = useCallback(async () => {
    setTunnelStatus({ status: 'starting', url: null });
    showToast('Запуск интернет-туннеля Cloudflare...', 'info');

    try {
      const res = await startTunnel();
      setTunnelStatus(res);

      if (res.status === 'running' && res.url) {
        setCustomHostState(res.url);
        storage.setCustomHost(res.url);
        showToast('Интернет-туннель успешно запущен! QR-код обновлен.', 'success');
      } else {
        showToast('Не удалось запустить туннель: ' + (res.error || 'Неизвестная ошибка'), 'error');
      }
    } catch (err: any) {
      setTunnelStatus({ status: 'error', url: null, error: err.message });
      showToast('Ошибка запуска туннеля: ' + err.message, 'error');
    }
  }, [showToast]);

  const stopTunnelAction = useCallback(async () => {
    try {
      const res = await stopTunnel();
      setTunnelStatus(res);
      setCustomHostState('');
      storage.setCustomHost('');
      showToast('Интернет-туннель остановлен. QR-код переключен на локальную сеть.', 'info');
    } catch (err: any) {
      showToast('Ошибка остановки туннеля: ' + err.message, 'error');
    }
  }, [showToast]);

  const addPage = useCallback((src: string) => {
    setPages((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random().toString(36).substring(2, 6),
        src,
        selected: true
      }
    ]);
  }, []);

  const togglePageSelect = useCallback((id: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  }, []);

  const removePage = useCallback((id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const removeSelectedPages = useCallback(() => {
    setPages((prev) => prev.filter((p) => !p.selected));
    showToast('Выбранные страницы удалены', 'info');
  }, [showToast]);

  const movePage = useCallback((index: number, direction: 'left' | 'right') => {
    setPages((prev) => {
      const newIdx = direction === 'left' ? index - 1 : index + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      const item = copy.splice(index, 1)[0];
      copy.splice(newIdx, 0, item);
      return copy;
    });
  }, []);

  const reorderPages = useCallback((fromIndex: number, toIndex: number) => {
    setPages((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length || toIndex < 0 || toIndex >= prev.length) return prev;
      const copy = [...prev];
      const item = copy.splice(fromIndex, 1)[0];
      copy.splice(toIndex, 0, item);
      return copy;
    });
  }, []);

  const selectAllPages = useCallback(() => {
    setPages((prev) => prev.map((p) => ({ ...p, selected: true })));
  }, []);

  const deselectAllPages = useCallback(() => {
    setPages((prev) => prev.map((p) => ({ ...p, selected: false })));
  }, []);

  const clearPages = useCallback(() => {
    setPages([]);
  }, []);

  const saveCustomPrompts = useCallback((prompts: FieldPrompts) => {
    setCustomPromptsState(prompts);
    storage.setCustomPrompts(prompts);
    showToast('Промпты для поиска полей сохранены', 'success');
  }, [showToast]);

  const resetCustomPrompts = useCallback(() => {
    setCustomPromptsState(DEFAULT_FIELD_PROMPTS);
    storage.resetCustomPrompts();
    showToast('Промпты сброшены к значениям по умолчанию', 'info');
  }, [showToast]);

  const applyRange = useCallback((rangeStr: string) => {
    const val = rangeStr.trim();
    if (!val) return;

    setPages((prev) => {
      const updated = prev.map((p) => ({ ...p, selected: false }));
      const parts = val.split(',');

      parts.forEach((part) => {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map((n) => parseInt(n.trim(), 10));
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = start; i <= end; i++) {
              if (updated[i - 1]) updated[i - 1].selected = true;
            }
          }
        } else {
          const idx = parseInt(part.trim(), 10);
          if (!isNaN(idx) && updated[idx - 1]) updated[idx - 1].selected = true;
        }
      });

      return updated;
    });
  }, []);

  // Registry Operations
  const saveRegistryDoc = useCallback((doc: Omit<SavedDoc, 'id'>) => {
    const newDoc: SavedDoc = { ...doc, id: Date.now() };
    setSavedDocs((prev) => {
      const next = [newDoc, ...prev];
      storage.setSavedDocs(next);
      return next;
    });
    showToast('Запись сохранена в реестр', 'success');
  }, [showToast]);

  const deleteRegistryDoc = useCallback((id: number) => {
    setSavedDocs((prev) => {
      const next = prev.filter((d) => d.id !== id);
      storage.setSavedDocs(next);
      return next;
    });
    showToast('Запись удалена из реестра', 'info');
  }, [showToast]);

  const exportCSV = useCallback(() => {
    if (savedDocs.length === 0) {
      showToast('Реестр пуст', 'error');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += 'Документ;Номер;Продукция;Действителен С;Действителен ПО;Заметки\n';

    savedDocs.forEach((d) => {
      csvContent += `"${d.name}";"${d.number}";"${d.product}";"${d.validFrom}";"${d.validTo}";"${d.notes}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `docscan_registry_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Файл CSV успешно экспортирован', 'success');
  }, [savedDocs, showToast]);

  // AI & Provider Settings
  const saveApiSettings = useCallback((p: AiProvider, k: string, m: string) => {
    setProviderState(p);
    setApiKeyState(k);
    setModelState(m);
    storage.setProvider(p);
    storage.setApiKey(k);
    storage.setModel(m);
    showToast('Настройки ИИ провайдера сохранены', 'success');
  }, [showToast]);

  const clearApiSettings = useCallback(() => {
    setApiKeyState('');
    storage.removeApiKey();
    showToast('API-ключ удален', 'info');
  }, [showToast]);

  const setCustomHost = useCallback((h: string) => {
    setCustomHostState(h);
    storage.setCustomHost(h);
  }, []);

  // One-URL / One-QR Pairing initialization for Desktop
  const initDesktopConnection = useCallback((currentCode: string) => {
    if (isMobileMode) return;

    if (webrtcClientRef.current) {
      webrtcClientRef.current.destroy();
    }

    const client = new UnifiedWebRTCClient({
      sessionId: currentCode,
      role: 'desktop',
      onPhotoReceived: (image) => {
        addPage(image);
        showToast('Снимок получен со смартфона!', 'success');
      },
      onStatusChange: (status, channel) => {
        setPairingStatus(status === 'connected' ? 'connected' : status === 'connecting' ? 'init' : 'ready');
        setConnectionChannel(channel);

        if (status === 'connected') {
          let label = 'Телефон подключен!';
          if (channel === 'local_wifi') label = 'Прямой P2P (Wi-Fi)';
          else if (channel === 'stun_p2p') label = 'Интернет P2P (STUN)';
          else if (channel === 'turn_relay') label = 'Защищенный TURN Relay';
          else if (channel === 'ws_relay') label = 'Серверный Relay (VPS)';
          setPairingStatusText(label);
        } else {
          setPairingStatusText('Ожидание подключения...');
        }
      }
    });

    webrtcClientRef.current = client;
    client.init();
  }, [isMobileMode, addPage, showToast]);

  const reconnectSession = useCallback(() => {
    const newCode = generateSessionCode();
    setSessionId(newCode);
    initDesktopConnection(newCode);
    showToast('Сгенерирована новая сессия сопряжения', 'info');
  }, [initDesktopConnection, showToast]);

  useEffect(() => {
    if (!isMobileMode && sessionId) {
      initDesktopConnection(sessionId);
    }
    return () => {
      webrtcClientRef.current?.destroy();
    };
  }, [isMobileMode, sessionId, initDesktopConnection]);

  // Compute pairing URL (One-URL / One-QR)
  let baseUrl = window.location.origin;
  if (customHost) {
    let host = customHost.trim();
    if (!host.startsWith('http://') && !host.startsWith('https://')) {
      host = 'https://' + host;
    }
    baseUrl = host;
  } else if (window.location.hostname === 'localhost' && serverInfo?.primaryIp) {
    baseUrl = `http://${serverInfo.primaryIp}:${serverInfo.port || 3000}`;
  }
  const pairingUrl = `${baseUrl.replace(/\/+$/, '')}/?session=${sessionId}#mobile`;

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
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
        savedDocs,
        saveRegistryDoc,
        deleteRegistryDoc,
        exportCSV,
        customPrompts,
        saveCustomPrompts,
        resetCustomPrompts,
        provider,
        setProvider: setProviderState,
        apiKey,
        setApiKey: setApiKeyState,
        model,
        setModel: setModelState,
        customHost,
        setCustomHost,
        saveApiSettings,
        clearApiSettings,
        sessionId,
        reconnectSession,
        pairingStatus,
        pairingStatusText,
        connectionChannel,
        serverInfo,
        pairingUrl,
        tunnelStatus,
        startTunnelAction,
        stopTunnelAction,
        isMobileMode,
        mobileSessionParam,
        isWebcamModalOpen,
        setIsWebcamModalOpen,
        isServerGuideModalOpen,
        setIsServerGuideModalOpen
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
