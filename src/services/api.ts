import { AiProvider, OCRResult, ServerInfo } from '../types';

export async function fetchServerInfo(): Promise<ServerInfo | null> {
  try {
    const res = await fetch('/api/info');
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Unable to fetch /api/info:', err);
    return null;
  }
}

export interface OCRParams {
  provider: AiProvider;
  model: string;
  apiKey: string;
  imageBase64: string;
}

export async function sendOCRRequest(params: OCRParams): Promise<OCRResult> {
  const res = await fetch('/api/ocr', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params)
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.error || `Ошибка сервера (${res.status})`);
  }

  return json.data as OCRResult;
}

export async function fetchTunnelStatus(): Promise<import('../types').TunnelStatus> {
  try {
    const res = await fetch('/api/tunnel/status');
    return await res.json();
  } catch (err) {
    return { status: 'stopped', url: null };
  }
}

export async function startTunnel(): Promise<import('../types').TunnelStatus> {
  const res = await fetch('/api/tunnel/start', { method: 'POST' });
  return await res.json();
}

export async function stopTunnel(): Promise<import('../types').TunnelStatus> {
  const res = await fetch('/api/tunnel/stop', { method: 'POST' });
  return await res.json();
}

