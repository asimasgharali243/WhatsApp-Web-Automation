const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const logger = require('./logger');

const cleanOldTempFiles = async () => {
  const tempDir = config.temp.path;
  const retentionHours = config.temp.retentionHours;
  const now = Date.now();
  
  try {
    if (!await fs.pathExists(tempDir)) {
      return;
    }
    
    const files = await fs.readdir(tempDir);
    let deletedCount = 0;
    let deletedSize = 0;
    
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = await fs.stat(filePath);
      const ageHours = (now - stats.mtimeMs) / (1000 * 60 * 60);
      
      if (ageHours > retentionHours) {
        const size = stats.size;
        await fs.remove(filePath);
        deletedCount++;
        deletedSize += size;
      }
    }
    
    if (deletedCount > 0) {
      logger.info(`🧹 Cleaned ${deletedCount} old temp files (${(deletedSize / 1024 / 1024).toFixed(2)} MB)`);
    }
  } catch (error) {
    logger.error('Cleanup failed', { error: error.message });
  }
};

// Run cleanup every hour
setInterval(cleanOldTempFiles, 60 * 60 * 1000);

// Run initial cleanup on startup
cleanOldTempFiles();

module.exports = { cleanOldTempFiles };