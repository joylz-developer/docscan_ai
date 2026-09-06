export class SocketRelayClient {
  private ws: WebSocket | null = null;
  private sessionId: string = '';
  private role: 'desktop' | 'mobile' = 'desktop';
  private pingInterval: any = null;

  public connect(
    sessionId: string,
    role: 'desktop' | 'mobile',
    callbacks: {
      onConnected?: () => void;
      onDisconnected?: () => void;
      onPhotoReceived?: (image: string) => void;
      onPeerConnected?: () => void;
      onError?: (err: any) => void;
    }
  ) {
    this.disconnect();
    this.sessionId = sessionId.trim().toUpperCase();
    this.role = role;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.ws?.send(JSON.stringify({
          type: 'register',
          sessionId: this.sessionId,
          role: this.role
        }));

        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 15000);

        callbacks.onConnected?.();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'photo' && msg.image) {
            callbacks.onPhotoReceived?.(msg.image);
          } else if (msg.type === 'mobile_connected' || msg.type === 'desktop_ready') {
            callbacks.onPeerConnected?.();
          }
        } catch (e) {
          console.warn('Socket message parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.clearInterval();
        callbacks.onDisconnected?.();
      };

      this.ws.onerror = (err) => {
        callbacks.onError?.(err);
      };
    } catch (err) {
      console.warn('WebSocket relay connection exception:', err);
    }
  }

  public sendPhoto(image: string): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: 'photo',
          sessionId: this.sessionId,
          role: this.role,
          image
        }));
        return true;
      } catch (err) {
        console.error('WebSocket sendPhoto error:', err);
        return false;
      }
    }
    return false;
  }

  public isConnected(): boolean {
    return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  private clearInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public disconnect() {
    this.clearInterval();
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
      this.ws = null;
    }
  }
}
