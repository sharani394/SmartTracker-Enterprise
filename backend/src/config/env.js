const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function readPositiveInteger(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function readCorsOrigins(value) {
  if (value === undefined) {
    return process.env.NODE_ENV === 'production'
      ? []
      : ['http://localhost:8081', 'http://127.0.0.1:8081'];
  }
  if (!value.trim()) return [];
  return [...new Set(value.split(',').map((origin) => origin.trim()).filter(Boolean).map((origin) => {
    let parsed;
    try { parsed = new URL(origin); } catch { throw new Error(`Invalid CORS origin: ${origin}`); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error(`CORS_ORIGINS entries must be exact http(s) origins without paths: ${origin}`);
    }
    return origin;
  }))];
}

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '0.0.0.0',
  port: readPositiveInteger('PORT', 5000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smarttracker',
  mongoServerSelectionTimeoutMs: readPositiveInteger(
    'MONGODB_SERVER_SELECTION_TIMEOUT_MS',
    5000
  ),
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || '1mb',
  corsOrigins: readCorsOrigins(process.env.CORS_ORIGINS),
  jwtSecret: process.env.JWT_SECRET || '',
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenDays: readPositiveInteger('REFRESH_TOKEN_DAYS', 30),
  emailVerificationMinutes: readPositiveInteger('EMAIL_VERIFICATION_MINUTES', 15),
  primaryAdminCodeMinutes: readPositiveInteger('PRIMARY_ADMIN_CODE_MINUTES', 30),
  adminInvitationMinutes: readPositiveInteger('ADMIN_INVITATION_MINUTES', 1440),
  bcryptRounds: readPositiveInteger('BCRYPT_ROUNDS', 12),
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: readPositiveInteger('SMTP_PORT', 587),
  smtpUser: process.env.SMTP_USER || '',
  smtpPassword: process.env.SMTP_PASSWORD || '',
  emailFrom: process.env.EMAIL_FROM || '',
};

if (config.jwtSecret && config.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters.');
}
if (!config.jwtSecret) {
  throw new Error('JWT_SECRET is required. Set a random value of at least 32 characters in backend/.env.');
}
if (config.bcryptRounds < 10 || config.bcryptRounds > 15) {
  throw new Error('BCRYPT_ROUNDS must be an integer from 10 to 15.');
}

module.exports = config;
