require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs-extra');
const { initClient } = require('./whatsappClient');
const routes = require('./routes');
const { initializeApiKeys } = require('./services/apiKeyService');
const logger = require('./utils/logger');
const config = require('./config');

// Ensure required directories exist
const dirs = ['./temp', './invoices', './sessions', './logs'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created: ${dir}`);
  }
});

// Initialize API keys
initializeApiKeys();

// Start cleanup service
require('./utils/cleanup');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: config.allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { success: false, error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api', routes);

// Public health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'WhatsApp Invoice Server',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    whatsapp_ready: require('./whatsappClient').isClientReady()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'WhatsApp Invoice Server',
    version: '2.0.0',
    description: 'Send invoices via WhatsApp',
    endpoints: {
      users: {
        register: 'POST /api/user/register',
        get: 'GET /api/user/:userId',
        list: 'GET /api/users',
        delete: 'DELETE /api/user/:userId'
      },
      invoices: {
        send: 'POST /api/send',
        send_bulk: 'POST /api/send-bulk'
      },
      status: {
        system: 'GET /api/status',
        health: 'GET /health'
      }
    },
    authentication: 'x-api-key header required for all /api/* endpoints',
    api_key: config.apiKeys[0]?.substring(0, 8) + '...'
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
const server = app.listen(config.port, async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 WHATSAPP INVOICE SERVER v2.0');
  console.log('='.repeat(60));
  console.log(`📡 Port: ${config.port}`);
  console.log(`🔐 API Keys: ${config.apiKeys.length} configured`);
  console.log(`📁 Temp dir: ${config.temp.path}`);
  console.log(`💚 Health: http://localhost:${config.port}/health`);
  console.log('='.repeat(60) + '\n');
  
  // Initialize WhatsApp client
  try {
    await initClient();
    logger.info('WhatsApp client initialization started');
  } catch (error) {
    logger.error('Failed to initialize WhatsApp client', { error: error.message });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, closing server...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, closing server...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = app;