export interface DocPage {
  id: string;
  src: string;
  selected: boolean;
}

export interface SavedDoc {
  id: number;
  name: string;
  number: string;
  product: string;
  validFrom: string;
  validTo: string;
  notes: string;
}

export type AiProvider = 'openrouter' | 'gemini';

export interface ModelPreset {
  id: string;
  name: string;
}

export interface OCRResult {
  docName: string;
  docNumber: string;
  product: string;
  validFrom: string;
  validTo: string;
  notes: string;
}

export type PairingStatus = 'init' | 'ready' | 'connected' | 'error';

export interface ServerInfo {
  status: string;
  version: string;
  port: number;
  primaryIp: string;
  localIps: string[];
  hasServerOpenRouterKey: boolean;
  hasServerGeminiKey: boolean;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

export interface TunnelStatus {
  status: 'stopped' | 'starting' | 'running' | 'error';
  url: string | null;
  error?: string | null;
}

export type ConnectionChannelType = 'local_wifi' | 'stun_p2p' | 'turn_relay' | 'ws_relay' | 'connecting' | 'disconnected';


