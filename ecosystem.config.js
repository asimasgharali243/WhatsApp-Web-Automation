module.exports = {
  apps: [{
    name: 'whatsapp-worker',
    script: 'src/worker.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
    },
    error_file: './logs/worker-error.log',
    out_file: './logs/worker-out.log',
    log_file: './logs/worker-combined.log',
    time: true,
    max_memory_restart: '500M'
  }, {
    name: 'whatsapp-api',
    script: 'src/app.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
    },
    error_file: './logs/api-error.log',
    out_file: './logs/api-out.log',
    log_file: './logs/api-combined.log',
    time: true,
    wait_ready: true,
    listen_timeout: 50000,
    max_memory_restart: '500M'
  }]
};