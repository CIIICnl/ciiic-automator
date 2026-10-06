import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { EventEmitter } from 'node:events';
import https from 'node:https';
import { consentRouteEnabled } from '../src/services/consent/activation.js';

// Exercises the real route wiring of src/index.js. Outbound HTTPS is replaced
// by a recorder, so nothing reaches Mailchimp or Notion.
// App logging is muted: interleaved with the runner's stdout protocol it made
// the run flaky ("Unable to deserialize cloned data").
for (const level of ['log', 'error']) test.mock.method(console, level, () => {});
const outbound = [];
let mailchimpStatus = 200;
test.mock.method(https, 'request', (options, onResponse) => {
  const call = { host: options.hostname, path: options.path, method: options.method, body: '' };
  outbound.push(call);
  const req = new EventEmitter();
  req.write = chunk => { call.body += chunk; };
  req.end = () => {
    const res = new EventEmitter();
    res.statusCode = options.hostname.endsWith('mailchimp.com') ? (call.method === 'PATCH' && mailchimpStatus === 404 ? 404 : 200) : 200;
    onResponse(res);
    res.emit('data', JSON.stringify(options.hostname.endsWith('notion.com') ? { results: [] } : { status: 'subscribed' }));
    res.emit('end');
  };
  return req;
});

const consentEnv = ['CIIIC_CONSENT_ROUTE', 'CIIIC_OPTIN_WEBHOOK_SECRET', 'CONSENT_KEY', 'CONSENT_HMAC_KEY', 'CONSENT_DB_PATH'];
const saved = Object.fromEntries(consentEnv.map(key => [key, process.env[key]]));
for (const key of consentEnv) delete process.env[key];

const { app } = await import('../src/index.js');
const server = await new Promise(resolve => {
  const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
});
test.after(async () => {
  await new Promise(resolve => server.close(resolve));
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

// Live Form43/feed7 shape, verified 2026-10-06: unsigned POST JSON to list=ciiic.
const form43Path = '/webhook/newsletter-optin?list=ciiic&tag=ixlabs-opening-2026&email=3&fname=1&lname=2&org=4&optin=5';
const form43 = optin => JSON.stringify({ form_id: '43', entry_id: '1', '1': 'Ada', '2': 'Lovelace', '3': 'ada@example.test', '4': 'Engine', '5.1': optin });
const checked = form43('I want to stay informed about CIIIC and IX Labs');
const empty = form43('');

function post(path, body, headers = {}) {
  outbound.length = 0;
  return fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });
}
const mailchimpCalls = () => outbound.filter(call => call.host.endsWith('mailchimp.com'));
const sign = (path, body, secret) => createHmac('sha256', secret).update(`POST\n${path}\n`).update(body).digest('hex');

test('only the exact value "enabled" switches the consent route on', () => {
  assert.equal(consentRouteEnabled({}), false);
  for (const value of ['true', '1', 'Enabled', 'on', '']) assert.equal(consentRouteEnabled({ CIIIC_CONSENT_ROUTE: value }), false);
  assert.equal(consentRouteEnabled({ CIIIC_CONSENT_ROUTE: 'enabled' }), true);
});

test('default config: live Form43 feed keeps the pre-consent Mailchimp path', async () => {
  const response = await post(form43Path, checked);
  assert.equal(response.status, 200);
  const calls = mailchimpCalls();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'PUT');
  assert.match(calls[0].path, /^\/3\.0\/lists\/67fe159b9d\/members\/[0-9a-f]{32}$/);
  const sent = JSON.parse(calls[0].body);
  assert.equal(sent.status_if_new, 'subscribed');
  assert.deepEqual(sent.tags, ['ixlabs-opening-2026']);
  assert.equal(sent.merge_fields.MMERGE6, 'Engine');

  const skipped = await post(form43Path, empty);
  assert.equal(skipped.status, 200);
  assert.equal((await skipped.json()).reason, 'no_optin');
  assert.equal(outbound.length, 0);
});

test('default config: SXSW and Jaarevent registration keep their pre-consent paths unsigned', async () => {
  const sxsw = await post('/webhook/sxsw-newsletter', JSON.stringify({ form_id: 26, '1': 'Ada', '2': 'L', '5': 'ada@example.test', '9.1': 'Yes' }));
  assert.equal(sxsw.status, 200);
  assert.equal(mailchimpCalls().length, 1);
  assert.match(mailchimpCalls()[0].path, /\/lists\/67fe159b9d\/members\//);
  assert.deepEqual(JSON.parse(mailchimpCalls()[0].body).tags, ['sxsw-london-2026-public']);

  mailchimpStatus = 404;
  try {
    const registration = await post('/webhook/registration', JSON.stringify({ '1': 'Ada', '9': 'L', '2': 'ada@example.test', '19.1': 'Yes' }));
    assert.equal(registration.status, 200);
    const [patch, add] = mailchimpCalls();
    assert.equal(patch.method, 'PATCH');
    assert.equal(add.method, 'POST');
    assert.match(add.path, /\/lists\/0e404ef800\/members$/);
    assert.equal(JSON.parse(add.body).merge_fields.JAAREVENT, 'geregistreerd');

    const noOptin = await post('/webhook/registration', JSON.stringify({ '2': 'ada@example.test' }));
    assert.equal(noOptin.status, 200);
    assert.deepEqual(mailchimpCalls().map(call => call.method), ['PATCH']);
  } finally {
    mailchimpStatus = 200;
  }
});

test('enabled route: no unsigned fallback, signing and registry keys required', async () => {
  process.env.CIIIC_CONSENT_ROUTE = 'enabled';
  try {
    // Without the signing secret every CIIIC-bound call fails closed, also an empty opt-in.
    assert.equal((await post(form43Path, checked)).status, 503);
    assert.equal((await post(form43Path, empty)).status, 503);
    assert.equal(outbound.length, 0);

    const secret = 'synthetic-route-secret';
    process.env.CIIIC_OPTIN_WEBHOOK_SECRET = secret;
    assert.equal((await post(form43Path, checked)).status, 403);
    assert.equal((await post(form43Path, checked, { 'x-ciiic-optin-signature': '0'.repeat(64) })).status, 403);
    assert.equal(outbound.length, 0);

    const signedEmpty = await post(form43Path, empty, { 'x-ciiic-optin-signature': sign(form43Path, empty, secret) });
    assert.equal(signedEmpty.status, 200);
    assert.equal(outbound.length, 0);

    // Signed opt-in without registry keys: the consent store refuses, no legacy subscribe.
    const signedChecked = await post(form43Path, checked, { 'x-ciiic-optin-signature': sign(form43Path, checked, secret) });
    assert.equal(signedChecked.status, 503);
    assert.equal(mailchimpCalls().length, 0);
  } finally {
    delete process.env.CIIIC_CONSENT_ROUTE;
    delete process.env.CIIIC_OPTIN_WEBHOOK_SECRET;
  }
});
