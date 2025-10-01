const logger = require('../logger');

module.exports = function errorHandler(err, req, res, _next) { // eslint-disable-line no-unused-vars
  logger.error({ err, reqId: req.id }, 'Unhandled error');
  if (res.headersSent) return;
  res.status(err.statusCode || 500).json({ error: err.message || 'Internal Server Error' });
};
