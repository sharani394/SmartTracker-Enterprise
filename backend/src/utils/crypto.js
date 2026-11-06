const crypto = require('node:crypto');
const config = require('../config/env');

function digestSecret(value) {
  return crypto.createHmac('sha256', config.jwtSecret).update(value).digest('hex');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left || '');
  const rightBuffer = Buffer.from(right || '');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function createNumericCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function createOpaqueToken() {
  return crypto.randomBytes(48).toString('base64url');
}

module.exports = { digestSecret, safeEqual, createNumericCode, createOpaqueToken };
