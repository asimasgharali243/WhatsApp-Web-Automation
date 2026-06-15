require('dotenv').config();
const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // API Keys - split comma-separated string into array
  apiKeys: (process.env.API_KEYS || process.env.DEFAULT_API_KEY || '').split(',').map(k => k.trim()),
  defaultApiKey: process.env.DEFAULT_API_KEY,
  
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT) || 6379,
  },
  
  whatsapp: {
    headless: process.env.PUPPETEER_HEADLESS === 'true',
    sessionPath: path.join(process.cwd(), 'sessions'),
  },
  
  temp: {
    path: path.join(process.cwd(), 'temp'),
    retentionHours: parseInt(process.env.TEMP_FILE_RETENTION_HOURS) || 24,
    maxFileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024,
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },
  
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
  
  queue: {
    minDelayMs: 10000,
    maxDelayMs: 40000,
    batchSize: 20,
    batchDelayMs: 60000,
    maxRetries: 3,
  },
};