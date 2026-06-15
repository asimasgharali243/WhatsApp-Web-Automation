const { Worker } = require('bullmq');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { MessageMedia } = require('whatsapp-web.js');
const { getClient, isClientReady } = require('./whatsappClient');
const logger = require('./utils/logger');
const config = require('./config');

console.log('👷 WORKER STARTING...');

const connection = {
  host: config.redis.host,
  port: config.redis.port,
};

// Store user clients (in production, use Redis)
const userClients = new Map();

// Load user clients on startup (from sessions folder)
const loadUserClients = async () => {
  const sessionsPath = path.join(process.cwd(), 'sessions');
  if (fs.existsSync(sessionsPath)) {
    const users = fs.readdirSync(sessionsPath);
    for (const user of users) {
      console.log(`📱 Found session for user: ${user}`);
    }
  }
};

loadUserClients();

async function deleteTempFile(filePath) {
  try {
    if (filePath && await fs.pathExists(filePath)) {
      await fs.remove(filePath);
      console.log(`🗑️ Deleted: ${path.basename(filePath)}`);
    }
  } catch (error) {
    console.error(`Failed to delete: ${error.message}`);
  }
}

const worker = new Worker('invoice-queue', async (job) => {
  console.log(`\n📨 JOB ${job.id}: ${job.data.number}`);
  
  const { number, filePath, fileName, caption, tempFile, userId } = job.data;
  let localFilePath = filePath;
  let isTempFile = false;
  
  try {
    // Use user-specific client if userId provided, otherwise use main client
    let client;
    let isReady;
    
    if (userId) {
      // For multi-user, need to get user's client from routes
      // This requires accessing the userSessions map from routes
      // For now, use main client
      client = getClient();
      isReady = isClientReady();
    } else {
      client = getClient();
      isReady = isClientReady();
    }
    
    if (!isReady) {
      throw new Error('WhatsApp client not ready');
    }
    
    const cleanNumber = number.toString().replace(/\D/g, '');
    const chatId = `${cleanNumber}@c.us`;
    
    if (!await fs.pathExists(localFilePath)) {
      throw new Error(`File not found: ${localFilePath}`);
    }
    
    // Random delay (10-40 seconds)
    const randomDelay = Math.floor(Math.random() * 30000) + 10000;
    console.log(`⏳ Waiting ${Math.round(randomDelay/1000)} seconds...`);
    await new Promise(resolve => setTimeout(resolve, randomDelay));
    
    console.log(`📎 Sending: ${fileName || path.basename(localFilePath)}`);
    const media = MessageMedia.fromFilePath(localFilePath);
    const result = await client.sendMessage(chatId, media, {
      caption: caption || `📄 Your document: ${fileName || path.basename(localFilePath)}`
    });
    
    console.log(`✅ Sent to ${cleanNumber}! Message ID: ${result.id.id}`);
    
    if (isTempFile && localFilePath) {
      await deleteTempFile(localFilePath);
    }
    
    return { success: true, messageId: result.id.id };
    
  } catch (error) {
    console.error(`❌ Failed: ${error.message}`);
    
    if (isTempFile && localFilePath && await fs.pathExists(localFilePath)) {
      await deleteTempFile(localFilePath);
    }
    
    throw error;
  }
}, { connection, concurrency: 1 });

worker.on('completed', (job) => {
  console.log(`✅ JOB ${job.id} COMPLETED`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ JOB ${job.id} FAILED: ${err.message}`);
});

worker.on('error', (err) => {
  console.error('❌ WORKER ERROR:', err.message);
});

console.log('✅ WORKER READY - Waiting for jobs...');

module.exports = worker;