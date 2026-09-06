import { WebSocket } from 'ws';
export class RelayHub {
    sessions = new Map();
    setup(wss) {
        wss.on('connection', (ws, req) => {
            let currentSessionId = null;
            let currentRole = null;
            ws.on('message', (message) => {
                try {
                    const payload = JSON.parse(message.toString());
                    const { type, sessionId, role, data } = payload;
                    if (type === 'register') {
                        currentSessionId = (sessionId || '').toUpperCase().trim();
                        currentRole = role || 'desktop';
                        if (!currentSessionId)
                            return;
                        if (!this.sessions.has(currentSessionId)) {
                            this.sessions.set(currentSessionId, { mobiles: new Set() });
                        }
                        const session = this.sessions.get(currentSessionId);
                        if (currentRole === 'desktop') {
                            session.desktop = ws;
                            ws.send(JSON.stringify({ type: 'registered', sessionId: currentSessionId, role: 'desktop' }));
                        }
                        else {
                            session.mobiles.add(ws);
                            ws.send(JSON.stringify({ type: 'registered', sessionId: currentSessionId, role: 'mobile' }));
                            // Notify desktop that a mobile device connected
                            if (session.desktop && session.desktop.readyState === WebSocket.OPEN) {
                                session.desktop.send(JSON.stringify({ type: 'mobile_connected', sessionId: currentSessionId }));
                            }
                            // Ack mobile that desktop is ready
                            if (session.desktop && session.desktop.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify({ type: 'desktop_ready', sessionId: currentSessionId }));
                            }
                        }
                    }
                    else if (type === 'photo') {
                        // Forward photo from mobile to desktop
                        if (currentSessionId && this.sessions.has(currentSessionId)) {
                            const session = this.sessions.get(currentSessionId);
                            if (session.desktop && session.desktop.readyState === WebSocket.OPEN) {
                                session.desktop.send(JSON.stringify({
                                    type: 'photo',
                                    sessionId: currentSessionId,
                                    image: data?.image || payload.image
                                }));
                                // Acknowledge to mobile
                                ws.send(JSON.stringify({ type: 'photo_delivered_ack' }));
                            }
                            else {
                                ws.send(JSON.stringify({ type: 'error', message: 'Десктоп не подключен к сессии' }));
                            }
                        }
                    }
                    else if (type === 'ping') {
                        ws.send(JSON.stringify({ type: 'pong' }));
                    }
                }
                catch (err) {
                    console.error('RelayHub message error:', err);
                }
            });
            ws.on('close', () => {
                if (currentSessionId && this.sessions.has(currentSessionId)) {
                    const session = this.sessions.get(currentSessionId);
                    if (currentRole === 'desktop') {
                        session.desktop = undefined;
                        // Notify all mobiles
                        session.mobiles.forEach(m => {
                            if (m.readyState === WebSocket.OPEN) {
                                m.send(JSON.stringify({ type: 'desktop_disconnected' }));
                            }
                        });
                    }
                    else if (currentRole === 'mobile') {
                        session.mobiles.delete(ws);
                        if (session.desktop && session.desktop.readyState === WebSocket.OPEN) {
                            session.desktop.send(JSON.stringify({ type: 'mobile_disconnected' }));
                        }
                    }
                    if (!session.desktop && session.mobiles.size === 0) {
                        this.sessions.delete(currentSessionId);
                    }
                }
            });
        });
    }
}
