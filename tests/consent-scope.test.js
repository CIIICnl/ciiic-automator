// Contract double for consent scopes (v2): what ciiic-nieuwsbrief can rely
// on when it sends an edition with `scope`. See
// docs/reference/consent-scope-contract.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createConsentStore } from '../src/services/consent/store.js';
import { createMarketingRouter, mapBrevoMarketingEvent } from '../src/services/consent/callbacks.js';
import { createEditionRouter } from '../src/services/consent/edition-routes.js';
import { prepareEdition, claimEditionRecipient } from '../src/services/consent/editions.js';
import { normalizeScope, scopeStatus } from '../src/services/consent/scopes.js';

const NEWS = 'news-0001';
const EVENT = 'event-0001';
const SCOPE = 'event:ixlabs-opening-2026';
const T0 = Date.parse('2026-11-10T08:00:00Z');
const ts = (ms) => Math.floor(ms / 1000);
const evidence = { kind: 'migration-approval', reference: 'Form43 import fixture' };

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciiic-scope-'));
  const store = createConsentStore({ path: path.join(dir, 'consent.sqlite'),
    encryptionKey: crypto.randomBytes(32).toString('hex'), hmacKey: crypto.randomBytes(32).toString('hex'), clock: () => T0 });
  const confirm = (email, scope) => store.applyEvent({ email, id: `approve:${email}`, type: 'confirmed', source: 'migration-approved',
    occurredAt: '2026-10-21T00:00:00Z', evidence, ...(scope ? { scope } : {}) });
  const language = (email) => store.applyEvent({ email, id: `lang:${email}`, type: 'preference', source: 'migration',
    occurredAt: '2026-10-21T00:00:00Z', language: 'nl' });
  return { store, confirm, language, cleanup: () => { store.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

async function withApp(f, run) {
  const removals = [];
  const app = express();
  app.use(express.json());
  app.use('/webhook/marketing', createMarketingRouter({ store: f.store, token: 'hook', listId: 20,
    loadLanguageCodec: async () => null, removeFromList: async (listId, email) => { removals.push([listId, email]); return true; } }));
  app.use('/consent/editions', createEditionRouter({ store: f.store, token: 'edition', enabled: () => true, now: () => T0 }));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (method, url, body, token) => fetch(`${base}${url}`, { method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  try {
    await run({ removals,
      snapshot: (id, body) => call('POST', `/consent/editions/${id}/snapshot`, body, 'edition'),
      status: async (id) => (await call('GET', `/consent/editions/${id}`, null, 'edition')).json(),
      hook: (body) => call('POST', '/webhook/marketing/brevo', body, 'hook') });
  } finally { await new Promise((resolve) => server.close(resolve)); }
}

const body = (recipients, extra = {}) => ({ documentId: 'doc', campaigns: { nl: 301, en: null }, lists: { nl: 401, en: null },
  recipients: recipients.map((email) => ({ email, language: 'nl' })), ...extra });

test('scope names: newsletter, event:<slug>; nothing else, and no scope means newsletter', () => {
  assert.equal(normalizeScope(undefined), 'newsletter');
  assert.equal(normalizeScope(''), 'newsletter');
  assert.equal(normalizeScope('event:ixlabs-opening:2026-11-18'), 'event:ixlabs-opening:2026-11-18');
  for (const bad of ['event:', 'Event:x', 'jaarevent', 'event:has space', '*']) assert.throws(() => normalizeScope(bad), /Invalid consent scope/);
  assert.equal(normalizeScope('*', { allowAddress: true }), '*');
});

test('same address, newsletter and event scope give different exclusion sets; no scope behaves as newsletter', async () => {
  const f = fixture();
  // both: in both scopes. newsOnly: newsletter only. eventOnly: event only.
  // newsGone: unsubscribed from the newsletter, still in the event scope.
  for (const email of ['both@x.test', 'newsonly@x.test', 'newsgone@x.test']) { f.confirm(email); f.language(email); }
  for (const email of ['both@x.test', 'eventonly@x.test', 'newsgone@x.test']) f.confirm(email, SCOPE);
  f.store.applyEvent({ email: 'newsgone@x.test', id: 'u1', type: 'suppress', source: 'brevo', occurredAt: '2026-10-25T00:00:00Z', reason: 'unsubscribe' });
  const everyone = ['both@x.test', 'newsonly@x.test', 'eventonly@x.test', 'newsgone@x.test'];
  try {
    await withApp(f, async ({ snapshot }) => {
      const event = await (await snapshot(EVENT, body(everyone, { scope: SCOPE }))).json();
      assert.equal(event.scope, SCOPE);
      assert.deepEqual(event.excluded, [{ email: 'newsonly@x.test', reason: 'unknown_contact' }]);
      assert.equal(event.excludedMissingLanguage, 0);
      // eventonly has no language preference; the edition language comes from the list.
      assert.equal(event.recipients, 3);

      const unscoped = await (await snapshot(NEWS, body(everyone, { campaigns: { nl: 303, en: null } }))).json();
      const explicit = await (await snapshot('news-0002', body(everyone, { scope: 'newsletter', campaigns: { nl: 302, en: null } }))).json();
      assert.equal(unscoped.scope, 'newsletter');
      assert.deepEqual(unscoped.excluded, [{ email: 'eventonly@x.test', reason: 'unknown_contact' },
        { email: 'newsgone@x.test', reason: 'suppressed' }]);
      assert.deepEqual(explicit.excluded, unscoped.excluded);
      assert.equal(unscoped.recipients, 2);

      // An edition keeps its scope; a refresh cannot switch it.
      assert.equal((await snapshot(EVENT, body(everyone))).status, 400);
    });
  } finally { f.cleanup(); }
});

test('unsubscribe under an event campaign books the event scope and leaves the newsletter alone', async () => {
  const f = fixture();
  for (const email of ['a@x.test', 'b@x.test']) { f.confirm(email); f.language(email); f.confirm(email, SCOPE); }
  try {
    await withApp(f, async ({ snapshot, status, hook, removals }) => {
      await snapshot(EVENT, body(['a@x.test', 'b@x.test'], { scope: SCOPE }));
      await snapshot(NEWS, body(['a@x.test', 'b@x.test'], { campaigns: { nl: 501, en: null }, lists: { nl: 601, en: null } }));
      // Multi-list unsubscribe form: only the event edition list was left.
      const res = await hook({ event: 'unsubscribe', email: 'a@x.test', camp_id: 301, list_id: [401], tag: 'event', ts_event: ts(T0) });
      assert.equal(res.status, 200);
      const record = f.store.get('a@x.test');
      assert.deepEqual(scopeStatus(record, 'newsletter'), { consent: 'confirmed', suppressed: false, preferenceConflict: false });
      assert.equal(scopeStatus(record, SCOPE).suppressed, true);
      assert.equal(record.scopes[SCOPE].suppressionReason, 'unsubscribe');
      // Route b only touches editions of the same scope.
      assert.deepEqual(removals, [[401, 'a@x.test']]);
      assert.equal((await status(EVENT)).suppressed, 1);
      assert.equal((await status(NEWS)).suppressed, 0);
      assert.equal((await status(EVENT)).scope, SCOPE);

      // And the other way round: a newsletter unsubscribe leaves the event scope.
      await hook({ event: 'unsubscribe', email: 'b@x.test', camp_id: 501, list_id: [601], ts_event: ts(T0) });
      const other = f.store.get('b@x.test');
      assert.equal(scopeStatus(other, 'newsletter').suppressed, true);
      assert.equal(scopeStatus(other, SCOPE).suppressed, false);
      assert.deepEqual(removals.at(-1), [601, 'b@x.test']);
      assert.equal((await status(EVENT)).ready, 1);
    });
  } finally { f.cleanup(); }
});

test('an event-campaign unsubscribe that also leaves the main list books both scopes', () => {
  const editions = new Map([[301, SCOPE]]);
  const mapped = mapBrevoMarketingEvent({ event: 'unsubscribe', email: 'a@x.test', camp_id: 301, list_id: [401, 20], ts_event: ts(T0) }, 20, null, editions);
  assert.deepEqual(mapped.map((event) => event.scope), [SCOPE, 'newsletter']);
});

test('an event-tagged campaign outside the ledger never books a newsletter unsubscribe', () => {
  const payload = { event: 'unsubscribe', email: 'a@x.test', camp_id: 999, tag: 'event', ts_event: ts(T0) };
  assert.equal(mapBrevoMarketingEvent(payload, 20), null);
  assert.equal(mapBrevoMarketingEvent({ ...payload, list_id: [777] }, 20), null);
  assert.equal(mapBrevoMarketingEvent({ ...payload, tag: 'nieuwsbrief' }, 20).scope, 'newsletter');
  assert.equal(mapBrevoMarketingEvent({ ...payload, list_id: [20] }, 20).scope, 'newsletter');
});

test('bounce, spam and deletion are address-level and block every scope', async () => {
  const f = fixture();
  for (const email of ['bounce@x.test', 'spam@x.test']) { f.confirm(email); f.language(email); f.confirm(email, SCOPE); }
  try {
    await withApp(f, async ({ snapshot, hook, removals }) => {
      await snapshot(EVENT, body(['bounce@x.test', 'spam@x.test'], { scope: SCOPE }));
      await snapshot(NEWS, body(['bounce@x.test'], { campaigns: { nl: 501, en: null }, lists: { nl: 601, en: null } }));
      await hook({ event: 'hard_bounce', email: 'bounce@x.test', camp_id: 301, tag: 'event', ts_event: ts(T0) });
      await hook({ event: 'spam', email: 'spam@x.test', camp_id: 301, ts_event: ts(T0) });
      for (const email of ['bounce@x.test', 'spam@x.test']) {
        const record = f.store.get(email);
        assert.equal(scopeStatus(record, 'newsletter').suppressed, true);
        assert.equal(scopeStatus(record, SCOPE).suppressed, true);
      }
      assert.deepEqual(removals.sort(), [[401, 'bounce@x.test'], [401, 'spam@x.test'], [601, 'bounce@x.test']]);
    });
    assert.equal(mapBrevoMarketingEvent({ event: 'contact_deleted', email: 'z@x.test', ts_event: ts(T0) }, 20).scope, '*');
  } finally { f.cleanup(); }
});

test('records from before v2: only a plain unsubscribe stays newsletter-only', () => {
  // A v1 record has no addressSuppressed flag; the reason decides.
  assert.equal(scopeStatus({ consent: 'confirmed', suppressed: true, suppressionReason: 'unsubscribed', scopes: { [SCOPE]: { consent: 'confirmed' } } }, SCOPE).suppressed, false);
  for (const reason of ['cleaned', 'brevo_blocked', 'hard_bounce', null]) {
    assert.equal(scopeStatus({ consent: 'confirmed', suppressed: true, suppressionReason: reason, scopes: { [SCOPE]: { consent: 'confirmed' } } }, SCOPE).suppressed, true);
  }
  const f = fixture();
  try {
    // An unscoped Mailchimp "cleaned" suppression (reconciliation route) is address-level...
    f.confirm('c@x.test', SCOPE);
    f.store.applyEvent({ email: 'c@x.test', id: 'c1', type: 'suppress', source: 'mailchimp', occurredAt: '2026-10-25T00:00:00Z', reason: 'cleaned' });
    // ...and a later plain unsubscribe does not undo that.
    f.store.applyEvent({ email: 'c@x.test', id: 'c2', type: 'suppress', source: 'brevo', occurredAt: '2026-10-26T00:00:00Z', reason: 'unsubscribe' });
    assert.equal(scopeStatus(f.store.get('c@x.test'), SCOPE).suppressed, true);
    // Event consent cannot be confirmed over an address-level suppression.
    f.confirm('d@x.test');
    f.store.applyEvent({ email: 'd@x.test', id: 'd1', type: 'suppress', source: 'brevo', occurredAt: '2026-10-25T00:00:00Z', reason: 'hard_bounce', scope: '*' });
    f.confirm('d@x.test', SCOPE);
    assert.equal(scopeStatus(f.store.get('d@x.test'), SCOPE).consent, 'unknown');
  } finally { f.cleanup(); }
});

test('event scope uses the same authoritative-evidence rule; language stays address-level', () => {
  const f = fixture();
  try {
    assert.throws(() => f.store.applyEvent({ email: 'e@x.test', id: 'e1', type: 'confirmed', source: 'form43', occurredAt: '2026-10-21T00:00:00Z',
      evidence: { kind: 'registration', reference: 'entry 1' }, scope: SCOPE }), /authoritative evidence/);
    assert.throws(() => f.store.applyEvent({ email: 'e@x.test', id: 'e2', type: 'preference', source: 'migration', occurredAt: '2026-10-21T00:00:00Z',
      language: 'nl', scope: SCOPE }), /Invalid consent event/);
    assert.throws(() => f.store.applyEvent({ email: 'e@x.test', id: 'e3', type: 'confirmed', source: 'migration-approved', occurredAt: '2026-10-21T00:00:00Z',
      evidence, scope: '*' }), /Invalid consent scope/);
    // Same provider event id in two scopes is two events, not a duplicate.
    f.store.applyEvent({ email: 'e@x.test', id: 'p', type: 'pending', source: 'form', occurredAt: '2026-10-21T00:00:00Z' });
    assert.equal(f.store.applyEvent({ email: 'e@x.test', id: 'p', type: 'pending', source: 'form', occurredAt: '2026-10-21T00:00:00Z', scope: SCOPE }).duplicate, false);
    assert.equal(f.store.get('e@x.test').scopes[SCOPE].consent, 'pending');
  } finally { f.cleanup(); }
});

test('per-recipient claim checks the edition scope', async () => {
  const f = fixture();
  f.confirm('only-event@x.test', SCOPE);
  try {
    await prepareEdition(f.store, 'claim-event', [{ email: 'only-event@x.test', language: 'nl', consent: 'confirmed' }], { scope: SCOPE });
    assert.equal((await claimEditionRecipient(f.store, 'claim-event', 'only-event@x.test', 'nl', 'brevo')).allowed, true);
    await prepareEdition(f.store, 'claim-news', [{ email: 'only-event@x.test', language: 'nl', consent: 'confirmed' }]);
    assert.equal((await claimEditionRecipient(f.store, 'claim-news', 'only-event@x.test', 'nl', 'brevo')).reason, 'current_suppression');
  } finally { f.cleanup(); }
});
