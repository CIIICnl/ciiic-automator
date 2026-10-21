import test from 'node:test';
import assert from 'node:assert/strict';
import { brevoRequest } from '../src/services/consent/baseline-provider.js';

process.env.BREVO_API_KEY = 'test-key';
const waits = [];
const wait = async (ms) => { waits.push(ms); };
const reply = (status, body = null, headers = {}) => ({
  ok: status >= 200 && status < 300, status, headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  json: async () => body,
});

test('GET retries a 429 with Retry-After and then succeeds', async () => {
  waits.length = 0;
  let calls = 0;
  const fetcher = async () => (++calls === 1 ? reply(429, null, { 'retry-after': '3' }) : reply(200, { email: 'x' }));
  const result = await brevoRequest('GET', '/contacts/x', null, fetcher, { wait });
  assert.deepEqual(result, { email: 'x' });
  assert.equal(calls, 2);
  assert.deepEqual(waits, [3000]);
});

test('GET retries a timeout with backoff and gives up after four attempts', async () => {
  waits.length = 0;
  let calls = 0;
  const fetcher = async () => { calls += 1; const error = new Error('t'); error.name = 'TimeoutError'; throw error; };
  await assert.rejects(brevoRequest('GET', '/contacts/x', null, fetcher, { wait }), /t/);
  assert.equal(calls, 4);
  assert.deepEqual(waits, [2000, 4000, 6000]);
});

test('writes are never retried on 429 or timeout', async () => {
  waits.length = 0;
  let calls = 0;
  const fetcher = async () => { calls += 1; return reply(429); };
  await assert.rejects(brevoRequest('POST', '/contacts', { email: 'x' }, fetcher, { wait }), /Brevo POST failed \(429\)/);
  assert.equal(calls, 1);
  assert.deepEqual(waits, []);
});
