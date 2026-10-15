import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createConsentStore } from '../src/services/consent/store.js';
import { createMarketingRouter } from '../src/services/consent/callbacks.js';
import { createEditionRouter } from '../src/services/consent/edition-routes.js';

const EDITION = '3f6c1d2e-0000-4000-8000-000000000001';
const T0 = Date.parse('2026-10-22T08:00:00Z');

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciiic-editions-'));
  let now = T0;
  const store = createConsentStore({ path: path.join(dir, 'consent.sqlite'),
    encryptionKey: crypto.randomBytes(32).toString('hex'), hmacKey: crypto.randomBytes(32).toString('hex'), clock: () => now });
  const confirm = (email, language) => {
    store.applyEvent({ email, id: `approve:${email}`, type: 'confirmed', source: 'migration-approved',
      occurredAt: '2026-10-15T00:00:00Z', evidence: { kind: 'migration-approval', reference: 'dry-run fixture' } });
    store.applyEvent({ email, id: `lang:${email}`, type: 'preference', source: 'migration', occurredAt: '2026-10-15T00:00:00Z', language });
  };
  return { store, confirm, now: () => now, setNow: (value) => { now = value; },
    cleanup: () => { store.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

async function withApp(f, { enabled = true, removals = [], failRemoval = () => false, inList = () => true } = {}, run) {
  const app = express();
  app.use(express.json());
  const removeFromList = async (listId, email) => {
    if (failRemoval()) throw new Error('Brevo list removal failed');
    if (!inList(email)) return false;
    removals.push([listId, email]);
    return true;
  };
  app.use('/webhook/marketing', createMarketingRouter({ store: f.store, token: 'hook-secret', listId: 44,
    loadLanguageCodec: async () => null, removeFromList }));
  app.use('/consent/editions', createEditionRouter({ store: f.store, token: 'edition-secret', enabled: () => enabled, now: f.now }));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (method, url, body, token) => fetch(`${base}${url}`, { method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  try {
    await run({
      snapshot: (body, token = 'edition-secret') => call('POST', `/consent/editions/${EDITION}/snapshot`, body, token),
      status: async () => (await call('GET', `/consent/editions/${EDITION}`, null, 'edition-secret')).json(),
      hook: (body) => call('POST', '/webhook/marketing/brevo', body, 'hook-secret'),
    });
  } finally { await new Promise((resolve) => server.close(resolve)); }
}

const snapshotBody = (recipients) => ({ documentId: 'doc-42', campaigns: { nl: 101, en: 102 }, lists: { nl: 201, en: 202 }, recipients });
const ts = (ms) => Math.floor(ms / 1000);

test('snapshot registers, refreshes before freeze and reports exclusions', async () => {
  const f = fixture();
  f.confirm('nl@example.test', 'nl');
  f.confirm('en@example.test', 'en');
  f.confirm('off@example.test', 'nl');
  f.store.applyEvent({ email: 'off@example.test', id: 'u1', type: 'suppress', source: 'mailchimp', occurredAt: '2026-10-16T00:00:00Z', reason: 'unsubscribed' });
  try {
    await withApp(f, {}, async ({ snapshot, status }) => {
      const first = await (await snapshot(snapshotBody([
        { email: 'NL@example.test', language: 'nl' }, { email: 'en@example.test', language: 'en' },
        { email: 'off@example.test', language: 'nl' }, { email: 'stranger@example.test', language: 'nl' }]))).json();
      assert.deepEqual({ ...first, excluded: undefined }, { editionId: EDITION, recipients: 2, nl: 1, en: 1,
        excludedConflict: 0, excludedMissingLanguage: 0, excluded: undefined, languageDiffersFromRegister: 0 });
      assert.deepEqual(first.excluded, [{ email: 'off@example.test', reason: 'suppressed' },
        { email: 'stranger@example.test', reason: 'unknown_contact' }]);
      // Refresh: same edition, en reader moved to the NL list by the newsletter.
      const second = await (await snapshot(snapshotBody([
        { email: 'nl@example.test', language: 'nl' }, { email: 'en@example.test', language: 'nl' }]))).json();
      assert.equal(second.nl, 2);
      assert.equal(second.languageDiffersFromRegister, 1);
      const current = await status();
      assert.equal(current.frozen, false);
      assert.equal(current.documentId, 'doc-42');
      assert.deepEqual(current.campaigns, { nl: 101, en: 102 });
    });
  } finally { f.cleanup(); }
});

test('delivered event freezes and confirms; snapshot is refused afterwards', async () => {
  const f = fixture();
  f.confirm('nl@example.test', 'nl');
  f.confirm('en@example.test', 'en');
  try {
    await withApp(f, {}, async ({ snapshot, status, hook }) => {
      await snapshot(snapshotBody([{ email: 'nl@example.test', language: 'nl' }, { email: 'en@example.test', language: 'en' }]));
      const delivered = { event: 'delivered', email: 'nl@example.test', camp_id: 101, ts_event: ts(T0) };
      assert.equal((await hook(delivered)).status, 200);
      assert.equal((await hook(delivered)).status, 200);
      await hook({ event: 'delivered', email: 'stray@example.test', camp_id: 102, ts_event: ts(T0) });
      const current = await status();
      assert.equal(current.frozen, true);
      assert.equal(current.sent, 1);
      assert.equal(current.ready, 1);
      assert.deepEqual(current.anomalies, { delivered_outside_snapshot: 1 });
      // A delivery for an unrelated campaign is ignored entirely.
      await hook({ event: 'delivered', email: 'en@example.test', camp_id: 999, ts_event: ts(T0) });
      assert.equal((await status()).sent, 1);
      const refused = await snapshot(snapshotBody([{ email: 'nl@example.test', language: 'nl' }]));
      assert.equal(refused.status, 409);
      const body = await refused.json();
      assert.equal(body.error, 'frozen');
      assert.equal(body.summary.sent, 1);
    });
  } finally { f.cleanup(); }
});

test('unsubscribe from an edition campaign suppresses and removes from the edition list (route b)', async () => {
  const f = fixture();
  f.confirm('nl@example.test', 'nl');
  f.confirm('en@example.test', 'en');
  const removals = [];
  let fail = true;
  try {
    await withApp(f, { removals, failRemoval: () => { const value = fail; fail = false; return value; } }, async ({ snapshot, status, hook }) => {
      await snapshot(snapshotBody([{ email: 'nl@example.test', language: 'nl' }, { email: 'en@example.test', language: 'en' }]));
      // list_id names the edition list, not main list 44: still a CIIIC unsubscribe.
      const unsubscribe = { event: 'unsubscribe', email: 'en@example.test', camp_id: 102, list_id: [202], ts_event: ts(T0) };
      assert.equal((await hook(unsubscribe)).status, 503);
      assert.equal(f.store.get('en@example.test').suppressed, true);
      assert.equal((await status()).ready, 2);
      assert.equal((await hook(unsubscribe)).status, 200);
      assert.deepEqual(removals, [[202, 'en@example.test']]);
      const current = await status();
      assert.equal(current.suppressed, 1);
      assert.equal(current.lastSuppressionAt, new Date(ts(T0) * 1000).toISOString());
      // A later delivery to that address is an anomaly, not a send.
      await hook({ event: 'delivered', email: 'en@example.test', camp_id: 102, ts_event: ts(T0) + 60 });
      assert.deepEqual((await status()).anomalies, { delivered_after_suppression: 1 });
    });
  } finally { f.cleanup(); }
});

test('one external and one newsletter removal are counted once each, per language, across a refresh', async () => {
  const f = fixture();
  for (const [email, language] of [['nl-a@example.test', 'nl'], ['nl-b@example.test', 'nl'], ['en-c@example.test', 'en'], ['en-d@example.test', 'en']]) {
    f.confirm(email, language);
  }
  // Brevo answers 400 ("not in the list") for nl-b: the newsletter removed it first.
  const inList = new Set(['nl-a@example.test', 'en-c@example.test', 'en-d@example.test']);
  const removals = [];
  const all = [{ email: 'nl-a@example.test', language: 'nl' }, { email: 'nl-b@example.test', language: 'nl' },
    { email: 'en-c@example.test', language: 'en' }, { email: 'en-d@example.test', language: 'en' }];
  try {
    await withApp(f, { removals, inList: (email) => inList.has(email) }, async ({ snapshot, status, hook }) => {
      await snapshot(snapshotBody(all));
      // External: en-c unsubscribes; route (b) takes it off edition list 202.
      await hook({ event: 'unsubscribe', email: 'en-c@example.test', camp_id: 102, list_id: [202], ts_event: ts(T0) });
      // Handmatig: the newsletter takes nl-b off list 201 itself (its removed_total = 1),
      // and Brevo's unsubscribe for nl-b reaches us afterwards.
      inList.delete('nl-b@example.test');
      await hook({ event: 'unsubscribe', email: 'nl-b@example.test', list_id: [44], ts_event: ts(T0) + 60 });
      let current = await status();
      assert.equal(current.suppressed, 2);
      assert.equal(current.removedByAutomator, 1);
      assert.deepEqual(removals, [[202, 'en-c@example.test']]);
      assert.deepEqual(current.byLanguage.en, { ready: 1, unknown: 0, sent: 0, suppressed: 1, removedByAutomator: 1,
        lastSuppressionAt: new Date(ts(T0) * 1000).toISOString() });
      assert.deepEqual(current.byLanguage.nl, { ready: 1, unknown: 0, sent: 0, suppressed: 1, removedByAutomator: 0,
        lastSuppressionAt: new Date((ts(T0) + 60) * 1000).toISOString() });
      // Draft refresh from the main list re-adds both: they come back as
      // excluded, the ledger keeps them suppressed and keeps the times.
      const refreshed = await (await snapshot(snapshotBody(all))).json();
      assert.deepEqual(refreshed.excluded.map((row) => [row.email, row.reason]).sort(),
        [['en-c@example.test', 'suppressed'], ['nl-b@example.test', 'suppressed']]);
      assert.equal(refreshed.recipients, 2);
      current = await status();
      assert.equal(current.ready, 2);
      assert.equal(current.suppressed, 2);
      assert.equal(current.byLanguage.en.removedByAutomator, 1);
      assert.equal(current.byLanguage.nl.removedByAutomator, 0);
      assert.equal(current.lastSuppressionAt, new Date((ts(T0) + 60) * 1000).toISOString());
      // A refresh that leaves them out entirely does not reset the counter either.
      await snapshot(snapshotBody([all[0], all[3]]));
      assert.equal((await status()).suppressed, 2);
    });
  } finally { f.cleanup(); }
});

test('uncertain outcome stays open: ready entries are never marked sent by time', async () => {
  const f = fixture();
  f.confirm('nl@example.test', 'nl');
  f.confirm('late@example.test', 'nl');
  try {
    await withApp(f, {}, async ({ snapshot, status, hook }) => {
      await snapshot(snapshotBody([{ email: 'nl@example.test', language: 'nl' }, { email: 'late@example.test', language: 'nl' }]));
      await hook({ event: 'delivered', email: 'nl@example.test', camp_id: 101, ts_event: ts(T0) });
      assert.equal((await status()).uncertain, false);
      f.setNow(T0 + 25 * 3600 * 1000);
      const current = await status();
      assert.equal(current.uncertain, true);
      assert.equal(current.ready, 1);
      assert.equal(current.sent, 1);
    });
  } finally { f.cleanup(); }
});

test('edition routes fail closed: consent route off, missing or wrong token, bad input', async () => {
  const f = fixture();
  try {
    await withApp(f, { enabled: false }, async ({ snapshot }) => {
      assert.equal((await snapshot(snapshotBody([]))).status, 503);
    });
    await withApp(f, {}, async ({ snapshot }) => {
      assert.equal((await snapshot(snapshotBody([]), 'wrong')).status, 403);
      assert.equal((await snapshot({ ...snapshotBody([]), lists: { nl: 3, en: 202 } })).status, 400);
      assert.equal((await snapshot({ ...snapshotBody([]), campaigns: { nl: 101, en: null } })).status, 400);
      assert.equal((await snapshot(snapshotBody([{ email: 'x@example.test', language: 'de' }]))).status, 400);
    });
  } finally { f.cleanup(); }
});
