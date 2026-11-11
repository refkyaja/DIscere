import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { templateRouter } from './routes/template.js';
import { sesiRouter } from './routes/sesi.js';
import { guruRouter } from './routes/guru.js';
import { papanRouter } from './routes/papan.js';
import { aiRouter } from './routes/ai.js';
import { adminRouter } from './routes/admin.js';
import { errorHandler } from './middleware/error.js';
import { setupMultiplayerSocket } from './realtime/sesi.js';
import { setupBoardSocket } from './realtime/papan.js';

const app = express();
const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Endpoint health check & server network info
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/info/server', (_req, res) => {
  const ip = getLocalIp();
  res.json({
    localIp: ip,
    port: config.port,
    networkUrl: `http://${ip}:${config.port}`,
  });
});

// Rute API Auth
app.use('/api/auth', authRouter);
app.use('/api/template', templateRouter);
app.use('/api/sesi', sesiRouter);
app.use('/api/guru', guruRouter);
app.use('/api/papan', papanRouter);
app.use('/api/ai', aiRouter);
app.use('/api/admin', adminRouter);

// Setup Socket.IO multiplayer & papan tulis
setupMultiplayerSocket(io);
setupBoardSocket(io);

// Socket.IO event handler dasar
io.on('connection', (socket) => {
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

// Layani client/dist jika file build tersedia (SPA fallback)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '../../client/dist');

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(clientDist, 'index.html'));
    }
    next();
  });
}

// Error handler terpusat
app.use(errorHandler);

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const host = '0.0.0.0';
server.listen(config.port, host, () => {
  const localIp = getLocalIp();
  console.log(`Discere server aktif di http://${host}:${config.port}`);
  console.log(`- Local:   http://localhost:${config.port}`);
  console.log(`- Network: http://${localIp}:${config.port}`);
});
