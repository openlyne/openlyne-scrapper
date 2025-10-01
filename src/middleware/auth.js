const crypto = require('crypto');
const { apiKeys } = require('../config');

function safeEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

module.exports = function bearerAuth(req, res, next) {
  if (!apiKeys.length) return next(); // Auth disabled if no keys configured
  if (req.path === '/' || req.path === '/health') return next();

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = auth.slice(7).trim();
  const ok = apiKeys.some(k => safeEquals(k, token));
  if (!ok) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
};
