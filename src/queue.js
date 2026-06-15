const { Queue } = require('bullmq');
const config = require('./config');
const logger = require('./utils/logger');

const connection = {
  host: config.redis.host,
  port: config.redis.port,
};

const invoiceQueue = new Queue('invoice-queue', {
  connection,
  defaultJobOptions: {
    attempts: config.queue.maxRetries,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

invoiceQueue.on('error', (err) => {
  logger.error('Queue encountered an error', { error: err.message });
});

module.exports = invoiceQueue;