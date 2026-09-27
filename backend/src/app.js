const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const tenantRoutes = require('./routes/tenant.routes');
const userRoutes = require('./routes/user.routes');
const documentRoutes = require('./routes/document.routes');
const notificationRoutes = require('./routes/notification.routes');
const reportRoutes = require('./routes/report.routes');
const folderRoutes = require('./routes/folder.routes');
const auditRoutes = require('./routes/audit.routes');
const recycleBinRoutes = require('./routes/recycleBin.routes');

const app = express();

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
  frameguard: false,
  contentSecurityPolicy: false
}));

app.use(cors({
  origin: true, // Mirrors incoming request origin dynamically
  credentials: true
}));

// Body Parser with generous limits for large documents/metadata
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Serve Uploads Directory statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Root & Health Check Endpoints
app.get('/', (req, res) => {
  res.json({
    success: true,
    status: 'UP',
    message: '🚀 Enterprise Document Management System (DMS) Backend Engine Active',
    version: '1.0.0',
    frontend_app_url: 'http://localhost:5173',
    api_health_check: 'http://localhost:5000/api/health',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'UP', message: 'Enterprise Document Management System (DMS) Backend Running', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/organizations', tenantRoutes);
app.use('/api/users', userRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/recycle-bin', recycleBinRoutes);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'API Endpoint Not Found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'An internal server error occurred.'
  });
});

module.exports = app;
