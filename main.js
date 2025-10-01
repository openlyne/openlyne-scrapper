const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json({ limit: '1mb' }));

// Basic health endpoint
app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'Openlyne Scrapper API. POST /scrape { urls: ["https://..."] }' });
});

/**
 * POST /scrape
 * Body: {
 *   urls: string[],
 *   screenshot?: boolean | 'base64',          // default false; 'base64' returns screenshotBase64 in JSON
 *   concurrency?: number,                      // default 3
 *   format?: 'html' | 'text' | 'markdown',     // default 'html'
 *   clean?: boolean                            // deprecated: if true and format not supplied, behaves like format='text'
 * }
 * Returns: {
 *   results: Array<{
 *     url: string,
 *     elapsedSeconds: number,
 *     content?: string,
 *     contentFormat?: string,
 *     screenshotPath?: string,
 *     screenshotBase64?: string,
 *     error?: string
 *   }>,
 *   meta: { count: number, durationMs: number, durationSeconds: number }
 * }
 */
app.post('/scrape', async (req, res) => {
  let { urls, screenshot = false, concurrency = 3, format = 'html', clean = false } = req.body || {};

  // Backward compatibility: if user passed clean true but no explicit format
  if (clean && !req.body.format) {
    format = 'text';
  }

  if (!['html', 'text', 'markdown'].includes(format)) {
    return res.status(400).json({ error: 'Invalid format. Use html | text | markdown' });
  }

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'Body must include non-empty array "urls"' });
  }

  const startedAll = Date.now();
  let browser;
  try {
    browser = await puppeteer.launch();

    // Ensure screenshot directory exists if using file output
    const fs = require('fs');
    const path = require('path');
    const screenshotDir = path.join(process.cwd(), 'screenshots');
    if (screenshot && screenshot !== 'base64') {
      try { if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir); } catch (_) { /* ignore */ }
    }

    // Expose static screenshots
    if (!app._screenshotsStaticMounted) {
      app.use('/screenshots', express.static(screenshotDir));
      app._screenshotsStaticMounted = true;
    }

    // Simple concurrency control
    const queue = [...urls];
    const results = [];

    const worker = async () => {
      while (queue.length) {
        const url = queue.shift();
        const t0 = Date.now();
        let page;
        try {
          page = await browser.newPage();
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

          // Extract content based on format
          let content;
          if (format === 'html') {
            content = await page.content();
          } else if (format === 'text') {
            content = await page.evaluate(() => {
              const clone = document.body ? document.body.cloneNode(true) : null;
              if (!clone) return '';
              // remove script/style/noscript
              clone.querySelectorAll('script,style,noscript,iframe').forEach(n => n.remove());
              const text = clone.innerText || '';
              return text.replace(/\n{3,}/g, '\n\n').trim();
            });
          } else if (format === 'markdown') {
            // Markdown conversion via Turndown (if installed)
            content = await page.content();
            try {
              const TurndownService = require('turndown');
              const turndownService = new TurndownService({ headingStyle: 'atx' });
              content = turndownService.turndown(content);
            } catch (e) {
              // If turndown missing, fallback to text
              content = await page.evaluate(() => document.body ? document.body.innerText : '');
            }
          }
          let screenshotPath;
          let screenshotBase64;
          if (screenshot) {
            // derive safe filename
            const safe = url.replace(/[^a-z0-9]+/gi, '_').slice(0, 60);
            if (screenshot === 'base64') {
              screenshotBase64 = await page.screenshot({ encoding: 'base64', fullPage: true });
            } else {
              screenshotPath = `screenshots/screenshot_${safe}.png`;
              await page.screenshot({ path: screenshotPath, fullPage: true });
            }
          }
          const elapsedSec = +( (Date.now() - t0) / 1000 ).toFixed(3);
          results.push({
            url,
            elapsedSeconds: elapsedSec,
            content,
            contentFormat: format,
            ...(screenshotPath ? { screenshotPath } : {}),
            ...(screenshotBase64 ? { screenshotBase64 } : {})
          });
        } catch (err) {
          const elapsedSec = +( (Date.now() - t0) / 1000 ).toFixed(3);
          results.push({
            url,
            elapsedSeconds: elapsedSec,
            error: err.message || String(err)
          });
        } finally {
          if (page) {
            try { await page.close(); } catch (_) { /* ignore */ }
          }
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, urls.length) }, () => worker());
    await Promise.all(workers);

    const totalDurationMs = Date.now() - startedAll;
    const totalDurationSeconds = +(totalDurationMs / 1000).toFixed(3);
    // Keep original order if needed
    const resultsInOriginalOrder = urls.map(u => results.find(r => r.url === u));

    res.json({
      results: resultsInOriginalOrder,
      meta: { count: urls.length, durationMs: totalDurationMs, durationSeconds: totalDurationSeconds }
    });
  } catch (error) {
    res.status(500).json({ error: error.message || String(error) });
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) { /* ignore */ }
    }
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Openlyne Scrapper API listening on port ${port}`);
});
