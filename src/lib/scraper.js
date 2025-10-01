const puppeteer = require('puppeteer');
const logger = require('../logger');
const config = require('../config');

let browserPromise;
function resolveExecutablePath() {
  const fs = require('fs');
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/lib/chromium/chrome'
  ].filter(Boolean);
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch (_) { /* ignore */ }
  }
  return undefined; // Let puppeteer try its bundled path if present
}

function launchOptions() {
  const executablePath = resolveExecutablePath();
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage', // uses /tmp instead of /dev/shm
    '--disable-gpu',
    '--no-zygote',
    '--no-first-run',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-client-side-phishing-detection',
    '--disable-default-apps',
    '--disable-dev-tools',
    '--disable-features=site-per-process,TranslateUI',
    '--disable-hang-monitor',
    '--disable-notifications',
    '--disable-popup-blocking',
    '--disable-prompt-on-repost',
    '--disable-sync',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-default-browser-check'
  ];
  return {
    headless: config.headless !== false, // ensure boolean
    executablePath,
    args
  };
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch(launchOptions());
    const browser = await browserPromise;
    browser.on('disconnected', () => {
      logger.warn('Browser disconnected');
      browserPromise = undefined; // allow relaunch
    });
  }
  return browserPromise;
}

async function closeBrowser() {
  if (browserPromise) {
    try { (await browserPromise).close(); } catch (e) { logger.warn({ err: e }, 'Error closing browser'); }
    browserPromise = undefined;
  }
}

async function scrapeMany({ urls, screenshot, format, concurrency }) {
  const startedAll = Date.now();
  const browser = await getBrowser();

  // No local screenshot directory needed when only returning base64

  const queue = [...urls];
  const results = [];
  const maxWorkers = Math.min(concurrency, urls.length, config.maxConcurrency);

  const worker = async () => {
    while (queue.length) {
      const url = queue.shift();
      const t0 = Date.now();
      let page;
      try {
        page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2', timeout: config.navigationTimeoutMs });
        let content;
        if (format === 'html') {
          content = await page.content();
        } else if (format === 'text') {
          content = await page.evaluate(() => {
            const clone = document.body ? document.body.cloneNode(true) : null;
            if (!clone) return '';
            clone.querySelectorAll('script,style,noscript,iframe').forEach(n => n.remove());
            const text = clone.innerText || '';
            return text.replace(/\n{3,}/g, '\n\n').trim();
          });
        } else if (format === 'markdown') {
          let html = await page.content();
          try {
            const TurndownService = require('turndown');
            const turndownService = new TurndownService({ headingStyle: 'atx' });
            content = turndownService.turndown(html);
          } catch (e) {
            content = await page.evaluate(() => document.body ? document.body.innerText : '');
          }
        }
        let screenshotBase64;
        if (screenshot) {
          screenshotBase64 = await page.screenshot({ fullPage: true, encoding: 'base64' });
        }
        const elapsedSec = +((Date.now() - t0) / 1000).toFixed(3);
        results.push({
          url,
          elapsedSeconds: elapsedSec,
          content,
          contentFormat: format,
          ...(screenshotBase64 ? { screenshotBase64 } : {})
        });
      } catch (err) {
        const elapsedSec = +((Date.now() - t0) / 1000).toFixed(3);
        results.push({ url, elapsedSeconds: elapsedSec, error: err.message || String(err) });
      } finally {
        if (page) { try { await page.close(); } catch (_) { /* ignore */ } }
      }
    }
  };

  await Promise.all(Array.from({ length: maxWorkers }, () => worker()));
  const totalDurationMs = Date.now() - startedAll;
  const totalDurationSeconds = +(totalDurationMs / 1000).toFixed(3);
  const ordered = urls.map(u => results.find(r => r.url === u));
  return { results: ordered, meta: { count: urls.length, durationMs: totalDurationMs, durationSeconds: totalDurationSeconds } };
}

module.exports = { scrapeMany, closeBrowser };
