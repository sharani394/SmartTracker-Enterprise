const { AppError } = require('./errorHandler');

const ALLOWED_METHODS = 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS';
const ALLOWED_HEADERS = 'Authorization,Content-Type';

function createCorsMiddleware(allowedOrigins) {
  const allowlist = new Set(allowedOrigins);

  return function corsMiddleware(req, res, next) {
    const origin = req.get('Origin');

    if (!origin) {
      if (req.method === 'OPTIONS') return res.sendStatus(204);
      return next();
    }

    res.vary('Origin');
    if (!allowlist.has(origin)) {
      if (req.method === 'OPTIONS') {
        return res.status(403).json({
          error: { code: 'CORS_ORIGIN_DENIED', message: 'This browser origin is not allowed.' },
        });
      }
      return next(new AppError('This browser origin is not allowed.', 403, 'CORS_ORIGIN_DENIED'));
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
    res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    res.setHeader('Access-Control-Max-Age', '600');

    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  };
}

module.exports = { createCorsMiddleware };
