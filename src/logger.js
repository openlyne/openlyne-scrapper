const pino = require('pino');
const { env } = require('./config');

// Pretty print in development for readability
const logger = pino(env === 'development' ? {
  transport: {
    target: 'pino-pretty',
    options: { translateTime: 'SYS:standard', ignore: 'pid,hostname' }
  },
  level: process.env.LOG_LEVEL || 'info'
} : { level: process.env.LOG_LEVEL || 'info' });

module.exports = logger;
