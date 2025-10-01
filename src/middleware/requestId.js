const { randomUUID } = require('crypto');

module.exports = function requestId(req, res, next) {
  const header = req.headers['x-request-id'];
  req.id = header || randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
};
