import { Router } from 'express';
export const configRouter = Router();
configRouter.get('/', (req, res) => {
    const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.services.mozilla.com' },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ];
    // Optional custom STUN server
    if (process.env.STUN_SERVER) {
        iceServers.unshift({ urls: process.env.STUN_SERVER });
    }
    // Optional custom TURN server (e.g. coturn on VPS)
    if (process.env.TURN_SERVER) {
        iceServers.push({
            urls: process.env.TURN_SERVER,
            username: process.env.TURN_USERNAME,
            credential: process.env.TURN_CREDENTIAL
        });
    }
    // Determine external URL for QR code
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const defaultPublicUrl = process.env.PUBLIC_URL || `${protocol}://${host}`;
    return res.json({
        iceServers,
        publicUrl: defaultPublicUrl
    });
});
configRouter.get('/app-settings', async (req, res) => {
    try {
        const fs = await import('fs');
        const path = await import('path');
        const configPath = path.join(process.cwd(), 'server', 'config', 'default_settings.json');
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            return res.json({ success: true, settings: JSON.parse(data) });
        }
    }
    catch (err) {
        console.warn('Error reading default_settings.json:', err);
    }
    return res.status(404).json({ success: false, error: 'Конфигурация по умолчанию не найдена' });
});
