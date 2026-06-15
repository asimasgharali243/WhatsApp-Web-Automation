const config = require('../config');
const logger = require('../utils/logger');

console.log('\n🔐 ========== AUTH MIDDLEWARE INITIALIZATION ==========');
console.log(`🔐 Available API keys: ${config.apiKeys.length}`);
config.apiKeys.forEach((key, idx) => {
  console.log(`   Key ${idx + 1}: ${key.substring(0, 8)}...`);
});
console.log('=====================================================\n');

// Validate API Key
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const requestPath = req.method + ' ' + req.path;
  const requestTime = new Date().toISOString();
  
  console.log(`\n🔐 [${requestTime}] Auth validation for: ${requestPath}`);
  console.log(`   Headers x-api-key: ${apiKey ? apiKey.substring(0, 8) + '...' : 'MISSING'}`);
  console.log(`   Query apiKey: ${req.query.apiKey ? req.query.apiKey.substring(0, 8) + '...' : 'MISSING'}`);
  console.log(`   Client IP: ${req.ip}`);
  console.log(`   User-Agent: ${req.headers['user-agent'] ? req.headers['user-agent'].substring(0, 50) : 'Unknown'}`);
  
  if (!apiKey) {
    console.log(`❌ Auth FAILED: No API key provided`);
    logger.warn(`Missing API Key from ${req.ip} for ${requestPath}`);
    return res.status(401).json({ 
      success: false,
      error: 'API Key required',
      message: 'Please provide valid API key in x-api-key header'
    });
  }
  
  // Check if API key is valid
  const isValidKey = config.apiKeys.includes(apiKey);
  
  if (!isValidKey) {
    console.log(`❌ Auth FAILED: Invalid API key: ${apiKey.substring(0, 8)}...`);
    console.log(`   Expected one of: ${config.apiKeys.map(k => k.substring(0, 8) + '...').join(', ')}`);
    logger.warn(`Invalid API Key attempt from ${req.ip}: ${apiKey.substring(0, 8)}...`);
    return res.status(401).json({ 
      success: false,
      error: 'Invalid API Key',
      message: 'The provided API key is invalid'
    });
  }
  
  // Attach API key info to request
  req.apiKey = apiKey;
  req.clientId = `client_${apiKey.substring(0, 8)}`;
  
  console.log(`✅ Auth SUCCESS: ${req.clientId}`);
  console.log(`   API key validated: ${apiKey.substring(0, 8)}...`);
  
  next();
};

// Optional API Key (for public endpoints)
const optionalApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  console.log(`🔓 Optional auth check for: ${req.method} ${req.path}`);
  
  if (apiKey && config.apiKeys.includes(apiKey)) {
    req.apiKey = apiKey;
    req.isAuthenticated = true;
    console.log(`   Optional auth: Valid key provided (${apiKey.substring(0, 8)}...)`);
  } else {
    req.isAuthenticated = false;
    console.log(`   Optional auth: No valid key provided`);
  }
  
  next();
};

// Log API usage
const logApiUsage = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const statusText = statusCode >= 400 ? '❌' : '✅';
    
    console.log(`${statusText} API Call Complete: ${req.method} ${req.path} | Status: ${statusCode} | Duration: ${duration}ms | Client: ${req.clientId || 'unknown'}`);
    
    if (statusCode >= 400) {
      logger.warn(`API Call failed: ${req.method} ${req.path} | Status: ${statusCode} | Duration: ${duration}ms`);
    } else {
      logger.info(`API Call: ${req.method} ${req.path} | Status: ${statusCode} | Duration: ${duration}ms | Client: ${req.clientId || 'unknown'}`);
    }
  });
  
  next();
};

module.exports = {
  validateApiKey,
  optionalApiKey,
  logApiUsage
};