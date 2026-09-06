export type ConnectionChannelType = 'local_wifi' | 'stun_p2p' | 'turn_relay' | 'ws_relay' | 'connecting' | 'disconnected';

export interface WebRTCClientOptions {
  sessionId: string;
  role: 'desktop' | 'mobile';
  onPhotoReceived?: (base64Image: string) => void;
  onStatusChange?: (status: 'disconnected' | 'connecting' | 'connected', channelType: ConnectionChannelType) => void;
  onError?: (err: any) => void;
}

export class UnifiedWebRTCClient {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private options: WebRTCClientOptions;
  private pingTimer: any = null;
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' }
  ];
  private channelType: ConnectionChannelType = 'connecting';
  private isConnected: boolean = false;

  constructor(options: WebRTCClientOptions) {
    this.options = options;
  }

  public async init() {
    this.destroy();

    // Fetch dynamic ICE servers configuration from server
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        if (data.iceServers && data.iceServers.length > 0) {
          this.iceServers = data.iceServers;
        }
      }
    } catch (_) {}

    this.connectSignaling();
  }

  private connectSignaling() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    this.options.onStatusChange?.('connecting', 'connecting');

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        // Register in session room
        this.sendWs({
          type: 'join',
          sessionId: this.options.sessionId,
          role: this.options.role
        });

        this.pingTimer = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.sendWs({ type: 'ping' });
          }
        }, 15000);
      };

      this.ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case 'peer_connected': {
              // Start WebRTC negotiation: Mobile creates offer, or Desktop creates offer
              if (this.options.role === 'mobile') {
                await this.createOffer();
              }
              // Even before WebRTC completes, mark WS relay ready
              if (!this.isConnected) {
                this.channelType = 'ws_relay';
                this.options.onStatusChange?.('connected', 'ws_relay');
              }
              break;
            }

            case 'offer': {
              if (this.options.role === 'desktop') {
                await this.handleOffer(msg.sdp);
              }
              break;
            }

            case 'answer': {
              if (this.options.role === 'mobile') {
                await this.handleAnswer(msg.sdp);
              }
              break;
            }

            case 'candidate': {
              if (msg.candidate && this.pc) {
                try {
                  await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                } catch (e) {
                  console.warn('Error adding ICE candidate:', e);
                }
              }
              break;
            }

            case 'photo_relay': {
              if (msg.image && this.options.onPhotoReceived) {
                this.options.onPhotoReceived(msg.image);
              }
              break;
            }

            case 'peer_disconnected': {
              this.options.onStatusChange?.('disconnected', 'disconnected');
              this.isConnected = false;
              break;
            }
          }
        } catch (err) {
          console.error('WebSocket message parsing error:', err);
        }
      };

      this.ws.onclose = () => {
        this.options.onStatusChange?.('disconnected', 'disconnected');
        this.isConnected = false;
      };

      this.ws.onerror = (err) => {
        this.options.onError?.(err);
      };
    } catch (err) {
      this.options.onError?.(err);
    }
  }

  private setupPeerConnection() {
    if (this.pc) {
      try { this.pc.close(); } catch (_) {}
    }

    this.pc = new RTCPeerConnection({ iceServers: this.iceServers });

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        // Inspect candidate type for UI indicators
        const candStr = event.candidate.candidate;
        if (candStr.includes(' typ host ')) {
          this.channelType = 'local_wifi';
        } else if (candStr.includes(' typ srflx ') || candStr.includes(' typ prflx ')) {
          if (this.channelType !== 'local_wifi') this.channelType = 'stun_p2p';
        } else if (candStr.includes(' typ relay ')) {
          if (this.channelType !== 'local_wifi' && this.channelType !== 'stun_p2p') {
            this.channelType = 'turn_relay';
          }
        }

        this.sendWs({
          type: 'candidate',
          data: { candidate: event.candidate }
        });
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      if (this.pc?.iceConnectionState === 'connected' || this.pc?.iceConnectionState === 'completed') {
        this.isConnected = true;
        this.options.onStatusChange?.('connected', this.channelType);
      } else if (this.pc?.iceConnectionState === 'failed' || this.pc?.iceConnectionState === 'disconnected') {
        // Fallback to WebSocket Relay if WebRTC drops
        this.channelType = 'ws_relay';
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.options.onStatusChange?.('connected', 'ws_relay');
        } else {
          this.options.onStatusChange?.('disconnected', 'disconnected');
        }
      }
    };

    // Desktop receives data channel
    this.pc.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel(this.dataChannel);
    };
  }

  private setupDataChannel(channel: RTCDataChannel) {
    channel.onopen = () => {
      this.isConnected = true;
      this.options.onStatusChange?.('connected', this.channelType);
    };

    channel.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'photo' && payload.image) {
          this.options.onPhotoReceived?.(payload.image);
        }
      } catch (err) {
        console.error('DataChannel parse error:', err);
      }
    };

    channel.onclose = () => {
      // Fallback to WS relay if open
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.channelType = 'ws_relay';
        this.options.onStatusChange?.('connected', 'ws_relay');
      }
    };
  }

  private async createOffer() {
    this.setupPeerConnection();
    if (!this.pc) return;

    this.dataChannel = this.pc.createDataChannel('docscan_data', { ordered: true });
    this.setupDataChannel(this.dataChannel);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    this.sendWs({
      type: 'offer',
      data: { sdp: this.pc.localDescription }
    });
  }

  private async handleOffer(sdp: RTCSessionDescriptionInit) {
    this.setupPeerConnection();
    if (!this.pc) return;

    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    this.sendWs({
      type: 'answer',
      data: { sdp: this.pc.localDescription }
    });
  }

  private async handleAnswer(sdp: RTCSessionDescriptionInit) {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  private sendWs(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public sendPhoto(imageBase64: string): boolean {
    // 1. Try direct WebRTC DataChannel
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify({ type: 'photo', image: imageBase64 }));
        return true;
      } catch (e) {
        console.warn('DataChannel send failed, falling back to WebSocket relay:', e);
      }
    }

    // 2. Seamless Fallback: send via WebSocket Relay
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.sendWs({
          type: 'photo_relay',
          sessionId: this.options.sessionId,
          image: imageBase64
        });
        return true;
      } catch (e) {
        console.error('WebSocket relay send failed:', e);
        return false;
      }
    }

    return false;
  }

  public destroy() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch (_) {}
      this.dataChannel = null;
    }
    if (this.pc) {
      try { this.pc.close(); } catch (_) {}
      this.pc = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
      this.ws = null;
    }
    this.isConnected = false;
  }
}
