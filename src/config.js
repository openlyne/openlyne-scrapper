require('dotenv').config();

const parseList = (val) => (val ? val.split(',').map(s => s.trim()).filter(Boolean) : []);

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  headless: (process.env.HEADLESS || 'true').toLowerCase() !== 'false',
  navigationTimeoutMs: parseInt(process.env.SCRAPE_NAV_TIMEOUT_MS || '45000', 10),
  maxConcurrency: parseInt(process.env.SCRAPE_MAX_CONCURRENCY || '5', 10),
  defaultConcurrency: parseInt(process.env.SCRAPE_DEFAULT_CONCURRENCY || '3', 10),
  allowMarkdown: (process.env.ALLOW_MARKDOWN || 'true').toLowerCase() === 'true',
  apiKeys: (() => {
    if (process.env.API_KEYS) return parseList(process.env.API_KEYS);
    if (process.env.API_KEY) return [process.env.API_KEY];
    return [];
  })(),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '60', 10),
  allowOrigins: parseList(process.env.CORS_ALLOW_ORIGINS || ''),
  screenshotDir: process.env.SCREENSHOT_DIR || 'screenshots',
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || '1mb',
};
