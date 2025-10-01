const http = require('http');
const app = require('./app');
const config = require('./config');
const logger = require('./logger');
const { closeBrowser } = require('./lib/scraper');

const server = http.createServer(app);

server.listen(config.port, () => {
  logger.info({ port: config.port }, 'Openlyne Scrapper API listening');
});

async function shutdown(signal) {
  logger.warn({ signal }, 'Shutting down...');
  server.close(async (err) => {
    if (err) {
      logger.error({ err }, 'Error closing server');
      process.exit(1);
    }
    await closeBrowser();
    logger.info('Shutdown complete');
    process.exit(0);
  });
  // Fallback force exit
  setTimeout(() => { logger.error('Force exit after timeout'); process.exit(1); }, 10000).unref();
}

['SIGINT','SIGTERM'].forEach(sig => process.on(sig, () => shutdown(sig)));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  shutdown('uncaughtException');
});
