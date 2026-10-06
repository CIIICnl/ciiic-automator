import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import express from 'express';
import { verifyCiiicOptinSignature, hasFieldValue, requireCiiicOptinSignature } from '../src/services/consent/ingress.js';
import { processSxswSubmission } from '../src/services/sxsw.js';
import { processNewsletterOptin, resolveList, targetsCiiicAudience } from '../src/services/newsletter-optin.js';
import { processRegistration, updateMailchimpStatus } from '../src/services/jaarevent.js';

const secret = 'synthetic-test-secret';
const body = Buffer.from('{"form_id":26,"9.1":"Ja"}');
const url = '/webhook/newsletter-optin?list=ciiic&email=5&optin=9';
const signature = createHmac('sha256', secret).update(`POST\n${url}\n`).update(body).digest('hex');

test('CIIIC opt-in signature binds path, query and literal body', () => {
  assert.equal(verifyCiiicOptinSignature(body, signature, url, secret), true);
  assert.equal(verifyCiiicOptinSignature(body, signature, url.replace('list=ciiic', 'list=ixlabs'), secret), false);
  assert.equal(verifyCiiicOptinSignature(body, signature, '/webhook/sxsw-newsletter', secret), false);
  assert.equal(verifyCiiicOptinSignature(Buffer.from(body.toString().replace('Ja', 'Nee')), signature, url, secret), false);
  assert.equal(verifyCiiicOptinSignature(body, signature, url, ''), false);
  assert.equal(verifyCiiicOptinSignature(body, '', url, secret), false);
});

test('existing Jaarevent status HMAC verifies the literal raw body', async () => {
  const previous = process.env.JAAREVENT_WEBHOOK_SECRET;
  process.env.JAAREVENT_WEBHOOK_SECRET = secret;
  try {
    const { verifySignature, isWebhookSecretConfigured } = await import('../src/services/jaarevent.js?registration-signature-test');
    const payload = Buffer.from('{"email":"event@example.test", "status":"cancelled"}');
    const signed = createHmac('sha256', secret).update(payload).digest('hex');
    assert.equal(isWebhookSecretConfigured(), true);
    assert.equal(verifySignature(payload, signed), true);
    assert.equal(verifySignature(Buffer.from(payload.toString().replace(', ', ',')), signed), false);
    assert.equal(verifySignature(payload, undefined), false);
  } finally {
    if (previous === undefined) delete process.env.JAAREVENT_WEBHOOK_SECRET;
    else process.env.JAAREVENT_WEBHOOK_SECRET = previous;
  }
});

test('HTTP ingress dispatches a valid signed request and rejects forged or unconfigured requests', async () => {
  const previousSecret = process.env.CIIIC_OPTIN_WEBHOOK_SECRET;
  const app = express();
  app.use(express.json({ verify: (req, _res, bytes) => { req.rawBody = bytes; } }));
  let dispatched = 0;
  app.post('/hook', (req, res) => {
    if (requireCiiicOptinSignature(req, res, () => true) !== true) return;
    dispatched++;
    res.json({ processed: true });
  });
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    const endpoint = `http://127.0.0.1:${server.address().port}/hook?list=ciiic`;
    const signedPath = '/hook?list=ciiic';
    const payload = '{"19.1":"Yes"}';
    process.env.CIIIC_OPTIN_WEBHOOK_SECRET = secret;
    const goodSignature = createHmac('sha256', secret).update(`POST\n${signedPath}\n`).update(payload).digest('hex');
    const send = signature => fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...(signature ? { 'x-ciiic-optin-signature': signature } : {}) }, body: payload });
    const accepted = await send(goodSignature);
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), { processed: true });
    assert.equal(dispatched, 1);
    assert.equal((await send('0'.repeat(64))).status, 403);
    assert.equal(dispatched, 1);
    delete process.env.CIIIC_OPTIN_WEBHOOK_SECRET;
    assert.equal((await send(goodSignature)).status, 503);
    assert.equal(dispatched, 1);
  } finally {
    if (previousSecret === undefined) delete process.env.CIIIC_OPTIN_WEBHOOK_SECRET;
    else process.env.CIIIC_OPTIN_WEBHOOK_SECRET = previousSecret;
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('checkbox subfields and raw CIIIC list id use the protected route', () => {
  assert.equal(hasFieldValue({ '19.1': 'Ja' }, '19'), true);
  assert.equal(hasFieldValue({ '19.1': '' }, '19'), false);
  assert.equal(targetsCiiicAudience({ list: '67fe159b9d' }), true);
  assert.equal(resolveList('0e404ef800'), null);
  assert.equal(targetsCiiicAudience({ list: ['ciiic', 'ixlabs'] }), false);
});

test('SXSW calls the shared adapter only for trusted opt-in and passes explicit language', async () => {
  const calls = [];
  const submission = { form_id: 26, '1': 'Ada', '2': 'Lovelace', '5': 'ada@example.test', '9.1': 'Yes', newsletter_language: 'en' };
  await assert.rejects(processSxswSubmission(submission, { consentRoute: true, subscribe: input => calls.push(input) }), /Unauthenticated/);
  assert.equal(calls.length, 0);
  const result = await processSxswSubmission(submission, { consentRoute: true, authenticated: true, subscribe: async input => { calls.push(input); return { status: 'pending', provider: 'mailchimp' }; } });
  assert.equal(result.status, 'pending');
  assert.deepEqual(calls[0].consentEvidence, { kind: 'gravity-forms', signed: true, formId: '26', fieldId: '9', entryId: undefined });
  assert.equal(calls[0].language, 'en');
});

test('generic CIIIC signup requires a mapped opt-in; IX Labs remains separate', async () => {
  const payload = { form_id: 27, '6': 'reader@example.test', '11.1': 'Yes', newsletter_language: 'en' };
  await assert.rejects(processNewsletterOptin({ list: 'ciiic', email: '6', optin: '11' }, payload, { consentRoute: true }), /Unauthenticated/);
  await assert.rejects(processNewsletterOptin({ list: 'ciiic', email: '6' }, payload, { consentRoute: true, authenticated: true }), /opt-in field is required/);
  let called = false;
  const result = await processNewsletterOptin({ list: '67fe159b9d', email: '6', optin: '11' }, payload, { consentRoute: true, authenticated: true, subscribeCiiic: async input => { called = true; assert.equal(input.language, 'en'); return { status: 'pending', provider: 'mailchimp' }; } });
  assert.equal(result.status, 'pending');
  assert.equal(called, true);
  assert.equal(targetsCiiicAudience({ list: 'ixlabs' }), false);
});

test('Jaarevent without opt-in only changes event status; opt-in failure stays visible', async () => {
  const calls = [];
  const dependencies = {
    consentRoute: true,
    updateEvent: async (_email, status) => { calls.push(['event', status]); return { skipped: true }; },
    updateNotion: async (_email, status) => { calls.push(['notion', status]); return { status }; },
    subscribe: async input => { calls.push(['subscribe', input.language]); throw new Error('synthetic provider timeout'); },
  };
  const noOptin = await processRegistration({ '2': 'event@example.test' }, dependencies);
  assert.equal(noOptin.stayInformed, false);
  assert.deepEqual(calls, [['event', 'geregistreerd'], ['notion', 'geregistreerd']]);
  await assert.rejects(processRegistration({ '2': 'event@example.test', '19.1': 'Yes' }, dependencies), /Unauthenticated/);
  const withOptin = await processRegistration({ '2': 'event@example.test', '19.1': 'Yes', newsletter_language: 'nl' }, { ...dependencies, authenticated: true });
  assert.equal(withOptin.newsletterError, 'retryable');
  assert.equal(calls.at(-2)[0], 'subscribe');
  assert.equal(calls.at(-1)[0], 'notion');
});

test('Jaarevent event-member transport PATCHes the event audience and never POSTs on 404', async () => {
  const calls = [];
  const result = await updateMailchimpStatus('event@example.test', 'geregistreerd', {
    request: async (url, options) => { calls.push({ url, options }); return { status: 404, data: {} }; },
  });
  assert.deepEqual(result, { skipped: true, reason: 'not_in_list' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, 'PATCH');
  assert.match(calls[0].url, /\/lists\/0e404ef800\/members\//);
  assert.deepEqual(JSON.parse(calls[0].options.body), { merge_fields: { JAAREVENT: 'geregistreerd' } });
});
