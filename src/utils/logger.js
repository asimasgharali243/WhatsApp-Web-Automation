const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logStream = fs.createWriteStream(path.join(logDir, 'app.log'), { flags: 'a' });

const log = (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} [${level.toUpperCase()}]: ${message}`;
  console.log(logEntry);
  logStream.write(logEntry + '\n');
};

const info = (message, data = null) => log('info', message, data);
const error = (message, data = null) => log('error', message, data);
const warn = (message, data = null) => log('warn', message, data);

module.exports = {
  info,
  error,
  warn,
};