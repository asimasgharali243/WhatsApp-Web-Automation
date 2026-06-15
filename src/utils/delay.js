const config = require('../config');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getRandomDelay = () => {
  // FIXED: Use config.queue instead of config.invoice
  const { minDelayMs, maxDelayMs } = config.queue;
  return Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1) + minDelayMs);
};

const waitWithRandomDelay = async () => {
  const delayMs = getRandomDelay();
  await delay(delayMs);
};

module.exports = {
  delay,
  getRandomDelay,
  waitWithRandomDelay,
};