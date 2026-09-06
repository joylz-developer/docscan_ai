import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';

interface Client {
  ws: WebSocket;
  role: 'desktop' | 'mobile';
  sessionId: string;
}

interface Room {
  desktop?: WebSocket;
  mobiles: Set<WebSocket>;
}

export class SignalingHub {
  private rooms: Map<string, Room> = new Map();

  public setup(wss: WebSocketServer) {
    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      let currentSessionId: string | null = null;
      let currentRole: 'desktop' | 'mobile' | null = null;

      ws.on('message', (raw: string | Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          const { type, sessionId, role, data } = msg;

          switch (type) {
            // Register client in a room
            case 'join': {
              currentSessionId = (sessionId || '').trim().toUpperCase();
              currentRole = role || 'desktop';

              if (!currentSessionId) return;

              if (!this.rooms.has(currentSessionId)) {
                this.rooms.set(currentSessionId, { mobiles: new Set() });
              }

              const room = this.rooms.get(currentSessionId)!;

              if (currentRole === 'desktop') {
                room.desktop = ws;
                this.send(ws, { type: 'joined', role: 'desktop', sessionId: currentSessionId });
                // If mobiles already connected, notify desktop
                if (room.mobiles.size > 0) {
                  this.send(ws, { type: 'peer_connected', role: 'mobile' });
                }
              } else {
                room.mobiles.add(ws);
                this.send(ws, { type: 'joined', role: 'mobile', sessionId: currentSessionId });

                if (room.desktop && room.desktop.readyState === WebSocket.OPEN) {
                  // Notify desktop of mobile connection
                  this.send(room.desktop, { type: 'peer_connected', role: 'mobile' });
                  // Notify mobile that desktop is ready
                  this.send(ws, { type: 'peer_connected', role: 'desktop' });
                }
              }
              break;
            }

            // WebRTC Signaling: Forward SDP Offer
            case 'offer': {
              if (!currentSessionId) return;
              const room = this.rooms.get(currentSessionId);
              if (currentRole === 'mobile' && room?.desktop && room.desktop.readyState === WebSocket.OPEN) {
                this.send(room.desktop, { type: 'offer', sdp: data.sdp });
              } else if (currentRole === 'desktop' && room) {
                room.mobiles.forEach((m) => {
                  if (m.readyState === WebSocket.OPEN) {
                    this.send(m, { type: 'offer', sdp: data.sdp });
                  }
                });
              }
              break;
            }

            // WebRTC Signaling: Forward SDP Answer
            case 'answer': {
              if (!currentSessionId) return;
              const room = this.rooms.get(currentSessionId);
              if (currentRole === 'mobile' && room?.desktop && room.desktop.readyState === WebSocket.OPEN) {
                this.send(room.desktop, { type: 'answer', sdp: data.sdp });
              } else if (currentRole === 'desktop' && room) {
                room.mobiles.forEach((m) => {
                  if (m.readyState === WebSocket.OPEN) {
                    this.send(m, { type: 'answer', sdp: data.sdp });
                  }
                });
              }
              break;
            }

            // WebRTC Signaling: Forward ICE Candidate
            case 'candidate': {
              if (!currentSessionId) return;
              const room = this.rooms.get(currentSessionId);
              if (currentRole === 'mobile' && room?.desktop && room.desktop.readyState === WebSocket.OPEN) {
                this.send(room.desktop, { type: 'candidate', candidate: data.candidate });
              } else if (currentRole === 'desktop' && room) {
                room.mobiles.forEach((m) => {
                  if (m.readyState === WebSocket.OPEN) {
                    this.send(m, { type: 'candidate', candidate: data.candidate });
                  }
                });
              }
              break;
            }

            // Fallback Relay: Instant Photo Transfer via WebSocket when WebRTC P2P fails
            case 'photo_relay': {
              if (!currentSessionId) return;
              const room = this.rooms.get(currentSessionId);
              if (room?.desktop && room.desktop.readyState === WebSocket.OPEN) {
                this.send(room.desktop, {
                  type: 'photo_relay',
                  image: data?.image || msg.image
                });
                this.send(ws, { type: 'photo_delivered' });
              } else {
                this.send(ws, { type: 'error', message: 'Компьютер не подключен к сессии' });
              }
              break;
            }

            case 'ping': {
              this.send(ws, { type: 'pong' });
              break;
            }
          }
        } catch (err) {
          console.error('SignalingHub message error:', err);
        }
      });

      ws.on('close', () => {
        if (currentSessionId && this.rooms.has(currentSessionId)) {
          const room = this.rooms.get(currentSessionId)!;

          if (currentRole === 'desktop') {
            room.desktop = undefined;
            room.mobiles.forEach((m) => {
              if (m.readyState === WebSocket.OPEN) {
                this.send(m, { type: 'peer_disconnected', role: 'desktop' });
              }
            });
          } else if (currentRole === 'mobile') {
            room.mobiles.delete(ws);
            if (room.desktop && room.desktop.readyState === WebSocket.OPEN) {
              this.send(room.desktop, { type: 'peer_disconnected', role: 'mobile' });
            }
          }

          if (!room.desktop && room.mobiles.size === 0) {
            this.rooms.delete(currentSessionId);
          }
        }
      });
    });
  }

  private send(ws: WebSocket, data: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }
}

export const signalingHub = new SignalingHub();
