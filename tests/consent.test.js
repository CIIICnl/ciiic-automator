import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import { createConsentStore } from '../src/services/consent/store.js';
import { requestCiiicSubscription } from '../src/services/consent/subscriber.js';
import { createBrevoProvider, createMailchimpProvider } from '../src/services/consent/providers.js';
import { createMarketingRouter, mapBrevoMarketingEvent } from '../src/services/consent/callbacks.js';
import { createLanguageCodec, createLanguageCodecLoader, languageCodecFromAttributes } from '../src/services/consent/brevo-language.js';

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciiic-consent-'));
  let now = Date.parse('2026-10-06T12:00:00Z');
  const options = { path: path.join(dir, 'consent.sqlite'), encryptionKey: crypto.randomBytes(32).toString('hex'), hmacKey: crypto.randomBytes(32).toString('hex'), clock: () => now };
  const store = createConsentStore(options);
  return { store, options, setNow: value => { now = value; }, cleanup: () => { store.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

const email = 'Person+tag@example.org';
const evidence = { kind: 'gravity-forms', formId: '13', fieldId: '19', signed: true };

async function withRouter(options, run) {
  const app = express();
  app.use(express.json());
  app.use('/webhook/marketing', createMarketingRouter(options));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const endpoint = `http://127.0.0.1:${server.address().port}/webhook/marketing/brevo`;
    const post = (body, token = 'synthetic-secret') => fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    await run(post);
  } finally { await new Promise(resolve => server.close(resolve)); }
}

test('recipient cap survives restart and uncertain provider request', async () => {
  const f = fixture();
  let sends = 0;
  const provider = { name: 'brevo', read: async () => null, requestDoi: async () => { sends++; throw new Error('timeout'); } };
  const input = { email, language: 'en', source: 'gf13', consentEvidence: evidence };
  try {
    await assert.rejects(requestCiiicSubscription(input, { store: f.store, provider, clock: () => Date.parse('2026-10-06T12:00:00Z') }), /timeout/);
    f.store.close();
    const reopened = createConsentStore(f.options);
    try {
      assert.deepEqual(await requestCiiicSubscription(input, { store: reopened, provider }), { status: 'skipped', provider: 'brevo', reason: 'pending' });
      assert.equal(sends, 1);
      assert.equal(reopened.get(email).consent, 'pending');
    } finally { reopened.close(); }
  } finally { fs.rmSync(path.dirname(f.options.path), { recursive: true, force: true }); }
});

test('suppression is sticky and stale preference cannot overwrite newer Brevo preference', () => {
  const f = fixture();
  try {
    const at = '2026-10-06T10:00:00Z';
    f.store.applyEvent({ email, id: 'a', type: 'preference', source: 'brevo-profile', occurredAt: at, language: 'en' });
    f.store.applyEvent({ email, id: 'b', type: 'preference', source: 'mailchimp', occurredAt: '2026-10-05T10:00:00Z', language: 'nl' });
    assert.equal(f.store.get(email).language, 'en');
    f.store.applyEvent({ email, id: 'c', type: 'suppress', source: 'mailchimp', occurredAt: '2026-10-04T10:00:00Z' });
    f.store.applyEvent({ email, id: 'd', type: 'confirmed', source: 'brevo-confirmation', occurredAt: '2026-10-06T11:00:00Z', evidence: { kind: 'provider-confirmation', reference: 'synthetic' } });
    assert.equal(f.store.get(email).suppressed, true);
    assert.notEqual(f.store.get(email).consent, 'confirmed');
    assert.equal(f.store.applyEvent({ email, id: 'c', type: 'suppress', source: 'mailchimp', occurredAt: '2026-10-04T10:00:00Z' }).duplicate, true);
  } finally { f.cleanup(); }
});

test('existing provider member is never changed by anonymous signup', async () => {
  const f = fixture();
  let sends = 0;
  const provider = { name: 'mailchimp', read: async () => ({ exists: true, status: 'subscribed' }), requestDoi: async () => { sends++; } };
  try {
    const result = await requestCiiicSubscription({ email, language: 'en', source: 'gf13', consentEvidence: evidence }, { store: f.store, provider });
    assert.equal(result.reason, 'existing');
    assert.equal(sends, 0);
    assert.equal(f.store.get(email), null);
  } finally { f.cleanup(); }
});

test('provider adapters request DOI only and reject test lists', async () => {
  const calls = [];
  const attributes = { attributes: [{ name: 'LANGUAGE', category: 'category', enumeration: [{ value: 1, label: 'English' }, { value: 2, label: 'Nederlands' }] }] };
  const transport = async (url, options) => {
    if (url.endsWith('/contacts/attributes')) return { status: 200, data: attributes };
    calls.push({ url, options });
    return { status: url.includes('doubleOptin') ? 201 : 200, data: { status: 'pending' } };
  };
  const mc = createMailchimpProvider({ apiKey: 'test', transport });
  await mc.requestDoi({ email, language: 'en' });
  assert.equal(JSON.parse(calls[0].options.body).status, 'pending');
  assert.deepEqual(JSON.parse(calls[0].options.body).interests, { ed25c3d4cc: false, d32b374b91: true });
  assert.throws(() => createBrevoProvider({ apiKey: 'test', listId: 3, templateId: 1, redirectionUrl: 'https://example.org', transport }), /test list/);
  const brevo = createBrevoProvider({ apiKey: 'test', listId: 44, templateId: 1, redirectionUrl: 'https://example.org', transport });
  await brevo.requestDoi({ email, language: 'nl' });
  assert.equal(JSON.parse(calls[1].options.body).includeListIds[0], 44);
  assert.deepEqual(JSON.parse(calls[1].options.body).attributes, { FIRSTNAME: '', LASTNAME: '', LANGUAGE: 2 });
  await brevo.requestDoi({ email, language: 'en' });
  assert.equal(JSON.parse(calls[2].options.body).attributes.LANGUAGE, 1);
  assert.equal('TAAL' in JSON.parse(calls[2].options.body).attributes, false);
  await assert.rejects(brevo.requestDoi({ email, language: 'de' }), /Invalid language/);
});

test('Brevo callback maps real marketing payload, never delivery to confirmation', () => {
  const payload = { id: 7, email, event: 'unsubscribe', ts_event: 1791288000, list_id: [44] };
  const mapped = mapBrevoMarketingEvent(payload, 44);
  assert.equal(mapped.type, 'suppress');
  assert.equal(mapBrevoMarketingEvent({ ...payload, event: 'delivered' }, 44), null);
  assert.equal(mapBrevoMarketingEvent({ ...payload, list_id: [88] }, 44), null);
  assert.equal(mapBrevoMarketingEvent({ ...payload, email: 'different@example.org' }, 44).id === mapped.id, false);
});

test('edition compare-and-swap requires current version', () => {
  const f = fixture();
  try {
    assert.equal(f.store.putEdition('edition-1', { recipients: [] }), 1);
    assert.deepEqual(f.store.getEdition('edition-1'), { version: 1, state: { recipients: [] } });
    assert.throws(() => f.store.putEdition('edition-1', { recipients: [] }, null), { code: 'VERSION_CONFLICT' });
  } finally { f.cleanup(); }
});

test('late older unsubscribe is in received-at delta and wrong keys fail closed', () => {
  const f = fixture();
  try {
    const t0 = Date.parse('2026-10-06T09:00:00Z');
    f.store.applyEvent({ email, id: 'late', type: 'suppress', source: 'mailchimp', occurredAt: '2026-09-01T00:00:00Z' });
    assert.equal(f.store.listEventsSince(t0).length, 1);
    assert.equal(fs.readFileSync(f.options.path).includes(Buffer.from(email)), false);
    assert.throws(() => createConsentStore({ ...f.options, hmacKey: crypto.randomBytes(32).toString('hex') }), /key mismatch/);
    assert.throws(() => createConsentStore({ ...f.options, encryptionKey: crypto.randomBytes(32).toString('hex') }), /key mismatch/);
  } finally { f.cleanup(); }
});

test('five concurrent retries trigger one DOI request and keep first language', async () => {
  const f = fixture();
  let sends = 0;
  const provider = { name: 'brevo', read: async () => { await new Promise(resolve => setImmediate(resolve)); return null; }, requestDoi: async () => { sends++; return { pending: true }; } };
  try {
    const attempts = Array.from({ length: 5 }, (_, index) => requestCiiicSubscription({ email, language: index ? 'nl' : 'en', source: 'gf13', consentEvidence: evidence }, { store: f.store, provider }));
    const results = await Promise.all(attempts);
    assert.equal(results.filter(result => result.status === 'pending').length, 1);
    assert.equal(sends, 1);
    assert.equal(f.store.get(email).language, 'en');
    assert.equal(f.store.get(email).consent, 'pending');
  } finally { f.cleanup(); }
});

test('suppression arriving during provider lookup prevents DOI', async () => {
  const f = fixture();
  let release;
  let sends = 0;
  const provider = { name: 'brevo', read: () => new Promise(resolve => { release = resolve; }), requestDoi: async () => { sends++; } };
  try {
    const attempt = requestCiiicSubscription({ email, source: 'gf13', consentEvidence: evidence }, { store: f.store, provider });
    f.store.applyEvent({ email, id: 'late-unsub', type: 'suppress', source: 'mailchimp', occurredAt: '2026-10-05T00:00:00Z' });
    release(null);
    assert.equal((await attempt).reason, 'suppressed');
    assert.equal(sends, 0);
  } finally { f.cleanup(); }
});

test('same-source same-time preference conflicts quarantine in either order until newer update', () => {
  for (const order of [['nl', 'en'], ['en', 'nl']]) {
    const f = fixture();
    try {
      order.forEach((language, index) => f.store.applyEvent({ email, id: `same-${index}`, type: 'preference', source: 'brevo-profile', occurredAt: '2026-10-06T10:00:00Z', language }));
      const conflicted = f.store.get(email);
      assert.equal(conflicted.preferenceConflict, true);
      assert.equal(conflicted.language, null);
      f.store.applyEvent({ email, id: 'other-same-time', type: 'preference', source: 'mailchimp', occurredAt: '2026-10-06T10:00:00Z', language: 'nl' });
      assert.equal(f.store.get(email).preferenceConflict, true);
      f.store.applyEvent({ email, id: 'newer', type: 'preference', source: 'brevo-profile', occurredAt: '2026-10-06T10:01:00Z', language: 'en' });
      assert.equal(f.store.get(email).preferenceConflict, false);
      assert.equal(f.store.get(email).language, 'en');
    } finally { f.cleanup(); }
  }
});

const languageEnumeration = [{ value: 1, label: 'English' }, { value: 2, label: 'Nederlands' }];

test('Brevo LANGUAGE codec follows the live enumeration and refuses drift', async () => {
  const codec = createLanguageCodec(languageEnumeration);
  assert.equal(codec.toValue('en'), 1);
  assert.equal(codec.toValue('nl'), 2);
  assert.throws(() => codec.toValue('de'), /Invalid language/);
  assert.equal(codec.fromValue('1'), 'en');
  assert.equal(codec.fromValue(2), 'nl');
  assert.equal(codec.fromValue('Nederlands'), 'nl');
  assert.equal(codec.fromValue(''), null);
  assert.throws(() => codec.fromValue('3'), /Invalid Brevo language value/);
  assert.equal(createLanguageCodec([{ value: 7, label: 'Nederlands' }, { value: 9, label: 'English' }]).toValue('nl'), 7);
  for (const drifted of [[{ value: 1, label: 'English' }], [...languageEnumeration, { value: 3, label: 'Deutsch' }],
    [{ value: 1, label: 'English' }, { value: 2, label: 'English' }], [{ value: 'x', label: 'English' }, { value: 2, label: 'Nederlands' }]]) {
    assert.throws(() => createLanguageCodec(drifted), /enumeration changed/);
  }
  assert.throws(() => languageCodecFromAttributes({ attributes: [{ name: 'LANGUAGE', category: 'normal', type: 'text' }] }), /category attribute missing/);
  assert.throws(() => languageCodecFromAttributes({ attributes: [{ name: 'TAAL', category: 'normal', type: 'text' }] }), /category attribute missing/);
  let reads = 0;
  let fail = true;
  const load = createLanguageCodecLoader({ apiKey: 'test', transport: async () => {
    reads++;
    if (fail) { fail = false; return { status: 500, data: {} }; }
    return { status: 200, data: { attributes: [{ name: 'LANGUAGE', category: 'category', enumeration: languageEnumeration }] } };
  } });
  await assert.rejects(load(), /lookup failed/);
  assert.equal((await load()).toValue('nl'), 2);
  await load();
  assert.equal(reads, 2);
});

test('Brevo profile update maps LANGUAGE value or label to a preference', () => {
  const codec = createLanguageCodec(languageEnumeration);
  const body = { email, event: 'contact_updated', ts_event: 1791288000, content: [{ LANGUAGE: '1' }] };
  assert.equal(mapBrevoMarketingEvent(body, 44, codec).language, 'en');
  assert.equal(mapBrevoMarketingEvent({ ...body, content: [{ LANGUAGE: 'Nederlands' }] }, 44, codec).language, 'nl');
  assert.equal(mapBrevoMarketingEvent({ ...body, content: [{ TAAL: 'en' }] }, 44, codec), null);
  assert.equal(mapBrevoMarketingEvent({ ...body, content: [{ LANGUAGE: '' }] }, 44, codec), null);
  assert.throws(() => mapBrevoMarketingEvent({ ...body, content: [{ LANGUAGE: '5' }] }, 44, codec), /Invalid Brevo language update/);
  assert.throws(() => mapBrevoMarketingEvent(body, 44), /codec unavailable/);
});

test('profile update reads the enumeration lazily and asks for a retry when it cannot', async () => {
  const f = fixture();
  const update = { email, event: 'contact_updated', ts_event: 1791288000, content: [{ LANGUAGE: '1' }] };
  try {
    f.store.applyEvent({ email, id: 'known', type: 'preference', source: 'mailchimp', occurredAt: '2026-10-05T10:00:00Z', language: 'nl' });
    let loads = 0;
    const broken = async () => { loads++; throw new Error('Brevo attribute lookup failed (500)'); };
    await withRouter({ store: f.store, token: 'synthetic-secret', listId: 44, loadLanguageCodec: broken }, async post => {
      assert.equal((await post({ id: 1, email, event: 'unsubscribe', ts_event: 1791288000, list_id: [88] })).status, 200);
      assert.equal(loads, 0);
      assert.equal((await post(update)).status, 503);
      assert.equal(f.store.get(email).language, 'nl');
    });
    const working = async () => createLanguageCodec(languageEnumeration);
    await withRouter({ store: f.store, token: 'synthetic-secret', listId: 44, loadLanguageCodec: working }, async post => {
      assert.equal((await post(update)).status, 200);
      assert.equal(f.store.get(email).language, 'en');
    });
  } finally { f.cleanup(); }
});

test('marketing callback requires configured Bearer token and valid CIIIC list', async () => {
  const f = fixture();
  const body = { id: 1, email, event: 'unsubscribe', ts_event: 1791288000, list_id: [44] };
  try {
    await withRouter({ store: f.store, token: 'synthetic-secret', listId: 44 }, async post => {
      assert.equal((await post(body, null)).status, 403);
      assert.equal((await post(body, 'wrong-secret')).status, 403);
      assert.equal(f.store.get(email), null);
      assert.equal((await post(body)).status, 200);
      assert.equal(f.store.get(email).suppressed, true);
    });
    for (const invalid of [undefined, 'abc', 0, 2, 3, -1, 1.5]) {
      await withRouter({ store: f.store, token: 'synthetic-secret', listId: invalid }, async post => {
        assert.equal((await post(body)).status, 503);
      });
    }
    await withRouter({ store: f.store, token: '', listId: 44 }, async post => {
      assert.equal((await post(body)).status, 503);
    });
  } finally { f.cleanup(); }
});

test('callback validates whole batch and retries after partial DB failure without double application', async () => {
  const f = fixture();
  const second = 'second@example.org';
  const batch = [email, second].map((address, index) => ({ id: 7, email: address, event: 'unsubscribe', ts_event: 1791288000 + index, list_id: [44] }));
  try {
    await withRouter({ store: f.store, token: 'synthetic-secret', listId: 44 }, async post => {
      assert.equal((await post([batch[0], { event: 'unsubscribe', ts_event: 1791288001 }])).status, 400);
      assert.equal(f.store.get(email), null);
    });
    let failOnce = true;
    const flakyStore = { get: f.store.get, applyEvent: event => {
      if (event.email === second && failOnce) { failOnce = false; throw new Error('storage unavailable'); }
      return f.store.applyEvent(event);
    } };
    await withRouter({ store: flakyStore, token: 'synthetic-secret', listId: 44 }, async post => {
      assert.equal((await post(batch)).status, 503);
      assert.equal(f.store.get(email).suppressed, true);
      assert.equal(f.store.get(second), null);
      const retry = await post(batch);
      assert.equal(retry.status, 200);
      assert.deepEqual(await retry.json(), { accepted: true, applied: 1 });
      assert.equal(f.store.get(second).suppressed, true);
    });
  } finally { f.cleanup(); }
});

test('address reservation is durable for 24 hours and language rejects unknown values', () => {
  const f = fixture();
  try {
    assert.equal(f.store.reserveRequest(email, 'gf13'), true);
    f.setNow(Date.parse('2026-10-07T11:59:59Z'));
    assert.equal(f.store.reserveRequest(email, 'gf26'), false);
    f.setNow(Date.parse('2026-10-07T12:00:00Z'));
    assert.equal(f.store.reserveRequest(email, 'gf26'), true);
    assert.throws(() => f.store.applyEvent({ email, id: 'bad-language', type: 'preference', source: 'brevo-profile', occurredAt: '2026-10-07T12:00:00Z', language: 'de' }), /Invalid language/);
  } finally { f.cleanup(); }
});
