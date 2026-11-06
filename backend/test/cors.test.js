process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'cors-tests-use-this-local-only-secret-32-chars';
process.env.CORS_ORIGINS = 'http://localhost:8081,http://127.0.0.1:8081';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

test('CORS allows only configured Expo web origins and handles bearer JSON preflight', async () => {
  for (const origin of ['http://localhost:8081', 'http://127.0.0.1:8081']) {
    const response = await request(app)
      .options('/api/v1/auth/login')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

    assert.equal(response.status, 204);
    assert.equal(response.headers['access-control-allow-origin'], origin);
    assert.match(response.headers['access-control-allow-methods'], /POST/);
    assert.match(response.headers['access-control-allow-headers'], /Authorization/i);
    assert.match(response.headers['access-control-allow-headers'], /Content-Type/i);
    assert.match(response.headers.vary, /Origin/i);
  }
});

test('CORS rejects origins outside the explicit allowlist without wildcard headers', async () => {
  const response = await request(app)
    .options('/api/v1/auth/login')
    .set('Origin', 'https://untrusted.example')
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'authorization,content-type');

  assert.equal(response.status, 403);
  assert.equal(response.headers['access-control-allow-origin'], undefined);
  assert.notEqual(response.headers['access-control-allow-origin'], '*');
  assert.equal(response.body.error.code, 'CORS_ORIGIN_DENIED');
});
