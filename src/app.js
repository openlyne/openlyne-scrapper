const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const config = require('./config');
const logger = require('./logger');
const requestId = require('./middleware/requestId');
const auth = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const { scrapeMany } = require('./lib/scraper');

const app = express();

app.use(requestId);
app.use((req, _res, next) => { req.startTime = Date.now(); next(); });
app.use(express.json({ limit: config.requestBodyLimit }));
app.use(helmet());

if (config.allowOrigins.length) {
  app.use(cors({ origin: (origin, cb) => {
    if (!origin || config.allowOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS not allowed'), false);
  }}));
} else {
  app.use(cors());
}

app.use(rateLimit({ windowMs: config.rateLimitWindowMs, max: config.rateLimitMax }));
app.use(auth);

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'Openlyne Scrapper API. POST /scrape { urls: [...] }' });
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const VALID_FORMATS = ['html', 'text', 'markdown'];

app.post('/scrape', async (req, res, next) => {
  try {
    let { urls, screenshot = false, concurrency, format = 'html', clean = false } = req.body || {};

    if (clean && !req.body.format) format = 'text';
    if (!Array.isArray(urls) || !urls.length) return res.status(400).json({ error: 'urls must be non-empty array' });
    if (!VALID_FORMATS.includes(format)) return res.status(400).json({ error: `Invalid format. Use ${VALID_FORMATS.join(' | ')}` });
    if (format === 'markdown' && !config.allowMarkdown) return res.status(400).json({ error: 'Markdown disabled' });

    concurrency = parseInt(concurrency || config.defaultConcurrency, 10);
    if (Number.isNaN(concurrency) || concurrency < 1) concurrency = config.defaultConcurrency;
    if (concurrency > config.maxConcurrency) concurrency = config.maxConcurrency;

    // Basic URL validation & protocol restriction
    const normalized = [];
    for (const u of urls) {
      try {
        const urlObj = new URL(u);
        if (!['http:', 'https:'].includes(urlObj.protocol)) return res.status(400).json({ error: `Unsupported protocol in ${u}` });
        normalized.push(urlObj.toString());
      } catch (e) { return res.status(400).json({ error: `Invalid URL: ${u}` }); }
    }

    const { results, meta } = await scrapeMany({ urls: normalized, screenshot, format, concurrency });
    res.json({ results, meta });
  } catch (err) {
    next(err);
  } finally {
    const ms = Date.now() - req.startTime;
    logger.info({ route: '/scrape', ms, reqId: req.id }, 'scrape completed');
  }
});

app.use(errorHandler);

module.exports = app;
