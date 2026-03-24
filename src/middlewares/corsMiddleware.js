const appConfig = require('../config/appConfig');

function corsMiddleware(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', appConfig.corsOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
}

module.exports = corsMiddleware;
