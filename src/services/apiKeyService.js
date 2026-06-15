const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

console.log('\n🔑 ========== API KEY SERVICE INITIALIZATION ==========');
console.log(`🔑 Config API Keys: ${config.apiKeys.length}`);

// Store API key usage statistics (in production, use Redis or Database)
const apiKeyStats = new Map();

// Initialize API keys
const initializeApiKeys = () => {
  console.log(`\n🔑 Initializing API keys...`);
  console.log(`   Total keys to initialize: ${config.apiKeys.length}`);
  
  for (const apiKey of config.apiKeys) {
    if (!apiKeyStats.has(apiKey)) {
      const stats = {
        key: apiKey,
        keyPrefix: apiKey.substring(0, 8),
        createdAt: new Date(),
        totalRequests: 0,
        lastUsed: null,
        isActive: true,
        endpoints: {}
      };
      apiKeyStats.set(apiKey, stats);
      console.log(`   ✅ API Key initialized: ${apiKey.substring(0, 8)}...`);
      logger.info(`API Key initialized: ${apiKey.substring(0, 8)}...`);
    } else {
      console.log(`   ⚠️ API Key already exists: ${apiKey.substring(0, 8)}...`);
    }
  }
  
  console.log(`\n✅ API Key service ready. Total keys in stats: ${apiKeyStats.size}`);
  console.log('=====================================================\n');
};

// Record API key usage
const recordApiKeyUsage = (apiKey, endpoint) => {
  const stats = apiKeyStats.get(apiKey);
  if (stats) {
    stats.totalRequests++;
    stats.lastUsed = new Date();
    stats.lastEndpoint = endpoint;
    
    // Track per endpoint
    if (!stats.endpoints[endpoint]) {
      stats.endpoints[endpoint] = 0;
    }
    stats.endpoints[endpoint]++;
    
    apiKeyStats.set(apiKey, stats);
    
    console.log(`📊 API Usage: ${apiKey.substring(0, 8)}... -> ${endpoint} (Total: ${stats.totalRequests})`);
    logger.debug(`API Key ${apiKey.substring(0, 8)}... used for ${endpoint}`);
  } else {
    console.log(`⚠️ API Usage recorded for unknown key: ${apiKey ? apiKey.substring(0, 8) : 'null'}...`);
  }
};

// Get API key statistics
const getApiKeyStats = (apiKey = null) => {
  if (apiKey) {
    const stats = apiKeyStats.get(apiKey);
    if (stats) {
      console.log(`📊 Retrieving stats for key: ${apiKey.substring(0, 8)}...`);
      return {
        keyPrefix: stats.keyPrefix,
        totalRequests: stats.totalRequests,
        lastUsed: stats.lastUsed,
        lastEndpoint: stats.lastEndpoint,
        endpoints: stats.endpoints,
        createdAt: stats.createdAt,
        isActive: stats.isActive
      };
    }
    return null;
  }
  
  console.log(`📊 Retrieving all API key stats (${apiKeyStats.size} keys)`);
  const allStats = [];
  for (const [key, value] of apiKeyStats) {
    allStats.push({
      keyPrefix: value.keyPrefix,
      totalRequests: value.totalRequests,
      lastUsed: value.lastUsed,
      lastEndpoint: value.lastEndpoint,
      endpoints: value.endpoints,
      createdAt: value.createdAt,
      isActive: value.isActive,
      fullKey: undefined // Don't expose full key
    });
  }
  return allStats;
};

// Validate API key for specific permission
const hasPermission = (apiKey, permission) => {
  const isValid = config.apiKeys.includes(apiKey);
  console.log(`🔐 Permission check: ${apiKey ? apiKey.substring(0, 8) : 'null'}... -> ${permission} = ${isValid}`);
  return isValid;
};

// Rotate API key (create new, optionally revoke old)
const rotateApiKey = async (oldApiKey, newApiKey) => {
  console.log(`🔄 Rotating API key: ${oldApiKey.substring(0, 8)}... -> ${newApiKey.substring(0, 8)}...`);
  logger.info(`API Key rotated: ${oldApiKey.substring(0, 8)}... -> ${newApiKey.substring(0, 8)}...`);
  
  // Transfer stats to new key
  const oldStats = apiKeyStats.get(oldApiKey);
  if (oldStats) {
    const newStats = {
      ...oldStats,
      key: newApiKey,
      keyPrefix: newApiKey.substring(0, 8),
      rotatedFrom: oldApiKey,
      rotatedAt: new Date()
    };
    apiKeyStats.set(newApiKey, newStats);
    apiKeyStats.delete(oldApiKey);
    console.log(`   Stats transferred to new key`);
  }
  
  return true;
};

// Initialize on load
initializeApiKeys();

module.exports = {
  initializeApiKeys,
  recordApiKeyUsage,
  getApiKeyStats,
  hasPermission,
  rotateApiKey
};