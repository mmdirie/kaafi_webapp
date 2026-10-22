import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

process.env.SUPABASE_URL ??= 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY ??= 'test-anon-key';
process.env.FRONTEND_ORIGIN ??= 'http://localhost:5500';

const { createApp } = await import('../src/app.js');
const app = createApp();
let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test('health endpoint returns the standard success response and security headers', async () => {
  const response = await fetch(`${baseUrl}/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { success: true, data: { status: 'ok' } });
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});

test('CORS rejects origins outside the allowlist with a consistent error', async () => {
  const response = await fetch(`${baseUrl}/health`, {
    headers: { Origin: 'https://untrusted.example' }
  });
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.deepEqual(body, {
    success: false,
    error: { code: 'CORS_ORIGIN_DENIED', message: 'This origin is not allowed to access the API.' }
  });
});
