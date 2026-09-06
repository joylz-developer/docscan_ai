import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';

import { ocrRouter } from './routes/ocr.js';
import { infoRouter } from './routes/info.js';
import { tunnelRouter } from './routes/tunnel.js';
import { configRouter } from './routes/config.js';
import { signalingHub } from './services/signalingService.js';
import { getPrimaryLocalIp, getLocalIpAddresses } from './utils/network.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins with full header support to prevent any CORS issues
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Increase payload limit for scanned images / base64 documents
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api/ocr', ocrRouter);
app.use('/api/info', infoRouter);
app.use('/api/config', configRouter);
app.use('/api/tunnel', tunnelRouter);

// Setup WebSocket server for WebRTC Signaling & Real-time Relay
const wss = new WebSocketServer({ server, path: '/ws' });
signalingHub.setup(wss);

// Serve static frontend in production (dist directory)
const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // If dist not built yet, friendly message on root
  app.get('/', (req, res) => {
    res.send(`
      <html>
        <head><title>DocScan AI Backend</title></head>
        <body style="font-family: sans-serif; background: #090d16; color: #f1f5f9; padding: 40px; text-align: center;">
          <h1 style="color: #3b82f6;">DocScan AI API Server Active</h1>
          <p>Бэкенд-сервер запущен на порту ${PORT}.</p>
          <p>Для разработки запустите <code>npm run dev</code> или выполните <code>npm run build</code> для сборки интерфейса.</p>
        </body>
      </html>
    `);
  });
}

server.listen(Number(PORT), '0.0.0.0', () => {
  const primaryIp = getPrimaryLocalIp();
  console.log('\n======================================================');
  console.log(`🚀 DocScan AI Server is running!`);
  console.log(`👉 Local:   http://localhost:${PORT}`);
  console.log(`👉 Network: http://${primaryIp}:${PORT} (для открытия со смартфона по Wi-Fi)`);
  console.log(`👉 WebSocket Relay: ws://${primaryIp}:${PORT}/ws`);
  console.log('======================================================\n');
});
