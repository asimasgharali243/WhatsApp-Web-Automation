const Redis = require('ioredis');

const redis = new Redis({
  host: '127.0.0.1',
  port: 6379,
});

redis.on('connect', () => {
  console.log('✅ Node.js connected to Redis!');
  redis.set('test', 'working').then(() => {
    return redis.get('test');
  }).then((result) => {
    console.log('✅ Redis test:', result);
    redis.quit();
    process.exit(0);
  });
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err.message);
  process.exit(1);
});