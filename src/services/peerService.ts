import Peer, { DataConnection } from 'peerjs';

export const PEER_CONFIG = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]
  }
};

export class DesktopPeerManager {
  private peer: Peer | null = null;
  private activeConnection: DataConnection | null = null;
  private onPhotoCallback?: (image: string) => void;
  private onStatusCallback?: (status: 'init' | 'ready' | 'connected' | 'error', text: string) => void;

  public init(
    sessionId: string, 
    onPhoto: (image: string) => void,
    onStatus: (status: 'init' | 'ready' | 'connected' | 'error', text: string) => void
  ) {
    this.destroy();
    this.onPhotoCallback = onPhoto;
    this.onStatusCallback = onStatus;

    const peerId = `docscan-app-v1-${sessionId.toUpperCase()}`;
    this.onStatusCallback('init', 'Инициализация WebRTC...');

    try {
      this.peer = new Peer(peerId, PEER_CONFIG);

      this.peer.on('open', () => {
        this.onStatusCallback?.('ready', 'Ожидание подключения...');
      });

      this.peer.on('connection', (conn) => {
        this.activeConnection = conn;

        const confirmConnected = () => {
          this.onStatusCallback?.('connected', 'Телефон подключен (P2P)!');
          try { conn.send({ type: 'handshake_ack' }); } catch (_) {}
        };

        if (conn.open) {
          confirmConnected();
        } else {
          conn.on('open', confirmConnected);
        }

        conn.on('data', (data: any) => {
          if (data && data.type === 'photo' && data.image) {
            this.onPhotoCallback?.(data.image);
          }
        });

        conn.on('close', () => {
          this.onStatusCallback?.('ready', 'Ожидание подключения...');
        });
      });

      this.peer.on('error', (err) => {
        console.warn('Desktop PeerJS warning/error:', err);
        this.onStatusCallback?.('error', 'P2P: ' + (err.type || 'Ошибка соединения'));
      });
    } catch (err: any) {
      console.error('Peer init exception:', err);
      this.onStatusCallback?.('error', 'Ошибка P2P инициализации');
    }
  }

  public destroy() {
    if (this.activeConnection) {
      try { this.activeConnection.close(); } catch (_) {}
      this.activeConnection = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (_) {}
      this.peer = null;
    }
  }
}

export class MobilePeerManager {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;

  public connect(
    targetSessionId: string,
    onConnected: () => void,
    onDisconnected: () => void,
    onError: (msg: string) => void
  ) {
    this.destroy();
    const formattedId = `docscan-app-v1-${targetSessionId.trim().toUpperCase()}`;

    try {
      this.peer = new Peer(PEER_CONFIG);

      this.peer.on('open', () => {
        if (!this.peer) return;
        const conn = this.peer.connect(formattedId, { reliable: true });
        this.connection = conn;

        let connectTimeout = setTimeout(() => {
          if (!conn.open) {
            onError('P2P задерживается файрволом сети. Попробуйте повторно.');
          }
        }, 6000);

        const handleOpen = () => {
          clearTimeout(connectTimeout);
          onConnected();
        };

        conn.on('open', handleOpen);
        if (conn.open) handleOpen();

        conn.on('data', (data: any) => {
          if (data && data.type === 'handshake_ack') {
            handleOpen();
          }
        });

        conn.on('close', () => {
          clearTimeout(connectTimeout);
          this.connection = null;
          onDisconnected();
        });

        conn.on('error', (err) => {
          clearTimeout(connectTimeout);
          onError('Ошибка P2P: ' + (err.message || 'Сбой канала'));
        });
      });

      this.peer.on('error', (err) => {
        onError('Ошибка WebRTC: ' + err.type);
      });
    } catch (err: any) {
      onError('Сбой инициализации камеры/P2P: ' + err.message);
    }
  }

  public sendPhoto(imageBase64: string): boolean {
    if (this.connection && this.connection.open) {
      try {
        this.connection.send({ type: 'photo', image: imageBase64 });
        return true;
      } catch (err) {
        console.error('PeerJS sendPhoto error:', err);
        return false;
      }
    }
    return false;
  }

  public isConnected(): boolean {
    return Boolean(this.connection && this.connection.open);
  }

  public destroy() {
    if (this.connection) {
      try { this.connection.close(); } catch (_) {}
      this.connection = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (_) {}
      this.peer = null;
    }
  }
}
