const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const { initDatabase } = require('./src/config/db');
const { setSocketIO } = require('./src/services/notification.service');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Register Socket.IO instance into notification service
setSocketIO(io);

io.on('connection', (socket) => {
  // User room join event for targeted notifications
  socket.on('join_user_room', (userId) => {
    if (userId) {
      const roomName = `user_${userId}`;
      socket.join(roomName);
    }
  });
});

// Process Exception Guards to ensure server never crashes unexpectedly
process.on('uncaughtException', (err) => {
  console.error('[Backend Uncaught Exception Guard]:', err.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Backend Unhandled Rejection Guard]:', reason);
});

// Handle server error events (Automatically clears port 5000 using taskkill if occupied by old process)
const { execSync } = require('child_process');

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    try {
      const netstatOutput = execSync(`netstat -ano | findstr :${PORT}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = netstatOutput.split('\n');
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[1].endsWith(`:${PORT}`) && parts[3] === 'LISTENING') {
          const targetPid = parts[4];
          if (targetPid && parseInt(targetPid) !== process.pid && parseInt(targetPid) > 0) {
            execSync(`taskkill /F /PID ${targetPid}`, { stdio: 'ignore' });
          }
        }
      });
    } catch (e) {}
    setTimeout(() => {
      server.listen(PORT, '0.0.0.0');
    }, 400);
  } else {
    console.error('Server Listen Error:', err);
  }
});

// Initialize Database & Start Listening
async function startServer() {
  try {
    await initDatabase();
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`===========================================================`);
      console.log(`🚀 Enterprise DMS Backend Server is active on port ${PORT}`);
      console.log(`🌐 Base URL: http://localhost:${PORT}`);
      console.log(`===========================================================`);
    });
  } catch (err) {
    console.error('Fatal: Failed to initialize backend server:', err);
  }
}

startServer();
