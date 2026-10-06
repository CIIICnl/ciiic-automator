import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createConsentStore } from '../src/services/consent/store.js';
import { reconcileMailchimpSnapshot } from '../src/services/consent/reconciliation.js';
import { applyReconciliation, readCheckpoint } from '../scripts/consent-reconcile.mjs';
import { prepareEdition, claimEditionRecipient } from '../src/services/consent/editions.js';
import { LANGUAGE_INTERESTS } from '../src/services/consent/migration.js';

const email = 'review@example.test';
const second = 'second@example.test';
const at = minute => `2026-10-06T10:${String(minute).padStart(2, '0')}:00Z`;
const member = (language, changed = 1, address = email) => ({
  id: address, email_address: address, list_id: '67fe159b9d', status: 'subscribed',
  interests: { [LANGUAGE_INTERESTS.nl]: ['nl', 'both'].includes(language),
    [LANGUAGE_INTERESTS.en]: ['en', 'both'].includes(language) }, last_changed: at(changed),
});

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ciiic-reconcile-'));
  await fs.chmod(dir, 0o700);
  const encryptionKey = crypto.randomBytes(32);
  const eventKey = crypto.randomBytes(32).toString('hex');
  const options = { path: path.join(dir, 'registry.sqlite'), encryptionKey: encryptionKey.toString('hex'), hmacKey: eventKey };
  let store = createConsentStore(options);
  t.after(async () => { store.close(); await fs.rm(dir, { recursive: true, force: true }); });
  const checkpointFile = path.join(dir, 'checkpoint.enc');
  return {
    get store() { return store; },
    restart() { store.close(); store = createConsentStore(options); },
    checkpointFile, encryptionKey, eventKey,
    scan(members, minute, registry = store) {
      return applyReconciliation({ members, snapshotAt: at(minute), registry, checkpointFile, encryptionKey, eventKey });
    },
    preference(language, minute, address = email) {
      return store.applyEvent({ id: `${address}-${language}-${minute}`, email: address, source: 'brevo-profile',
        type: 'preference', language, occurredAt: at(minute) });
    },
    seed(address = email) {
      store.applyEvent({ id: 'consent', email: address, type: 'confirmed', source: 'migration-approved',
        occurredAt: at(0), evidence: { kind: 'migration-approval', reference: 'synthetic' } });
      this.preference('nl', 0, address);
    },
  };
}

for (const order of ['callback-first', 'scan-first', 'callback-between-plan-and-apply']) {
  test(`R1: overlapping choices quarantine with ${order}, restart and repeated scans`, async t => {
    const f = await fixture(t);
    f.seed();
    await f.scan([member('nl', 0)], 0);
    const baseline = await readCheckpoint(f.checkpointFile, f.encryptionKey);
    if (order === 'callback-first') f.preference('nl', 3);
    if (order === 'callback-between-plan-and-apply') {
      const plan = await reconcileMailchimpSnapshot({ members: [member('en')], registry: f.store,
        eventKey: f.eventKey, snapshotAt: at(5), snapshotComplete: true, previousSnapshot: baseline });
      f.preference('nl', 3);
      for (const event of plan.events) f.store.applyEvent(event);
    }
    await f.scan([member('en')], 5);
    if (order === 'scan-first') {
      assert.equal(f.store.get(email).language, 'en');
      assert.equal(f.store.get(email).languageAt, null);
      f.restart();
      f.preference('nl', 3);
    }
    assert.equal(f.store.get(email).preferenceConflict, true);
    assert.equal(f.store.get(email).language, null);
    assert.equal(f.store.get(email).consent, 'confirmed');
    const observation = f.store.listEventsSince(0).find(event => event.type === 'preference-observation');
    assert.equal(observation.sourceChangedAt, at(1));
    assert.equal(observation.observedAt, at(5));
    assert.equal(observation.occurredAt, undefined);
    f.restart();
    await f.scan([member('en', 7)], 10); // unrelated profile change cannot clear conflict
    await f.scan([member('en', 7)], 15);
    assert.equal(f.store.get(email).preferenceConflict, true);
    assert.equal((await prepareEdition(f.store, 'conflict', [f.store.get(email)])).recipients, 0);
    // An exact choice later than the entire observation interval resolves it.
    f.preference('nl', 6);
    assert.equal(f.store.get(email).preferenceConflict, false);
    assert.equal(f.store.get(email).language, 'nl');
  });
}

test('R2: both interests block existing/new editions, correction survives restart and preserves suppression', async t => {
  const f = await fixture(t);
  f.seed();
  f.seed(second);
  const rows = language => [member(language), member(language, 1, second)];
  await f.scan(rows('nl'), 0);
  await prepareEdition(f.store, 'already-prepared', [f.store.get(email)]);
  f.store.applyEvent({ id: 'unsubscribe', email: second, type: 'suppress', source: 'mailchimp', occurredAt: at(1) });
  await f.scan(rows('both'), 5);
  f.restart();
  assert.equal(f.store.get(email).preferenceConflict, true);
  assert.equal((await claimEditionRecipient(f.store, 'already-prepared', email, 'nl', 'brevo')).allowed, false);
  assert.equal((await prepareEdition(f.store, 'new-conflicted', [f.store.get(email)])).excludedConflict, 1);
  await f.scan(rows('both'), 6);
  await f.scan(rows('en'), 10);
  f.restart();
  await f.scan(rows('en'), 15);
  assert.equal(f.store.get(email).language, 'en');
  assert.equal(f.store.get(email).preferenceConflict, false);
  assert.equal(f.store.get(second).suppressed, true);
  assert.equal(f.store.get(second).language, 'en');
  assert.equal((await prepareEdition(f.store, 'corrected', [f.store.get(email), f.store.get(second)])).en, 1);
  assert.equal((await claimEditionRecipient(f.store, 'corrected', email, 'en', 'brevo')).allowed, true);
  assert.equal((await claimEditionRecipient(f.store, 'already-prepared', email, 'nl', 'brevo')).allowed, false);
});

test('conflict correction respects frozen assignment and cannot create cross-provider retry', async t => {
  const f = await fixture(t);
  f.seed();
  f.seed(second);
  await f.scan([member('nl')], 0);
  await prepareEdition(f.store, 'frozen', [f.store.get(email), f.store.get(second)]);
  assert.equal((await claimEditionRecipient(f.store, 'frozen', second, 'nl', 'mailchimp')).allowed, true);
  await f.scan([member('both')], 5);
  await f.scan([member('en', 6)], 10);
  assert.equal(f.store.get(email).language, 'en');
  await assert.rejects(prepareEdition(f.store, 'frozen', [f.store.get(email)]), /frozen/);
  assert.equal((await claimEditionRecipient(f.store, 'frozen', email, 'en', 'brevo')).reason, 'wrong_language');
  assert.equal((await claimEditionRecipient(f.store, 'frozen', email, 'nl', 'brevo')).allowed, true);
  assert.equal((await claimEditionRecipient(f.store, 'frozen', email, 'nl', 'mailchimp')).reason, 'unknown');
});

test('partial preference batch replays identical IDs/windows before newer scan after restart', async t => {
  const f = await fixture(t);
  f.seed();
  f.seed(second);
  await f.scan([member('nl'), member('nl', 0, second)], 0);
  const flaky = { get: f.store.get, applyEvent(event) {
    if (event.email === second) throw new Error('simulated crash');
    return f.store.applyEvent(event);
  } };
  await assert.rejects(f.scan([member('en'), member('en', 1, second)], 5, flaky), /simulated/);
  assert.equal((await readCheckpoint(f.checkpointFile, f.encryptionKey)).at, at(0));
  const pending = await readCheckpoint(`${f.checkpointFile}.pending`, f.encryptionKey);
  assert.equal(pending.events.length, 2);
  assert.equal((await fs.readFile(`${f.checkpointFile}.pending`, 'utf8')).includes(email), false);
  f.restart();
  f.preference('nl', 3);
  f.preference('nl', 3, second);
  await f.scan([member('en', 7), member('en', 7, second)], 10);
  assert.equal(f.store.get(email).preferenceConflict, true);
  assert.equal(f.store.get(second).preferenceConflict, true);
  const events = f.store.listEventsSince(0).filter(event => event.type === 'preference-observation');
  assert.deepEqual(events.map(event => event.id).sort(), pending.events.map(event => event.id).sort());
  assert.ok(events.every(event => event.observedAt === at(5)));
  assert.equal((await readCheckpoint(f.checkpointFile, f.encryptionKey)).at, at(10));
  assert.equal(await readCheckpoint(`${f.checkpointFile}.pending`, f.encryptionKey), null);
});

test('non-overlapping source change resolves concurrent conflict, delayed older callback cannot revive it', async t => {
  const f = await fixture(t);
  f.seed();
  await f.scan([member('nl')], 0);
  await f.scan([member('en')], 5);
  f.preference('nl', 3);
  assert.equal(f.store.get(email).preferenceConflict, true);
  await f.scan([member('nl', 6)], 10);
  assert.equal(f.store.get(email).preferenceConflict, false);
  f.preference('en', 4);
  assert.equal(f.store.get(email).language, 'nl');
  assert.equal(f.store.get(email).preferenceConflict, false);
});

test('initial invalid interests quarantine even without a source checkpoint', async t => {
  const f = await fixture(t);
  f.seed();
  await f.scan([member('both')], 5);
  assert.equal(f.store.get(email).preferenceConflict, true);
  await f.scan([member('en', 6)], 10);
  assert.equal(f.store.get(email).language, 'en');
});

test('paginated scan uses previous scan start, not completion, as the conservative lower bound', async t => {
  const f = await fixture(t);
  f.seed();
  await applyReconciliation({ members: [member('nl')], registry: f.store, checkpointFile: f.checkpointFile,
    encryptionKey: f.encryptionKey, eventKey: f.eventKey, snapshotStartedAt: at(0), snapshotAt: at(5) });
  // The previous scan may have read this row before this exact callback.
  f.preference('nl', 3);
  await f.scan([member('en', 2)], 10);
  assert.equal(f.store.get(email).preferenceConflict, true);
  const observation = f.store.listEventsSince(0).find(event => event.type === 'preference-observation');
  assert.equal(observation.previousObservedAt, at(0));
});

test('partial conflict batch is recovered before correction and leaves consent unchanged', async t => {
  const f = await fixture(t);
  f.seed();
  f.seed(second);
  await f.scan([member('nl'), member('nl', 0, second)], 0);
  const flaky = { get: f.store.get, applyEvent(event) {
    if (event.email === second) throw new Error('simulated crash');
    return f.store.applyEvent(event);
  } };
  await assert.rejects(f.scan([member('both'), member('both', 1, second)], 5, flaky), /simulated/);
  f.restart();
  await f.scan([member('en', 6), member('en', 6, second)], 10);
  for (const address of [email, second]) {
    assert.equal(f.store.get(address).language, 'en');
    assert.equal(f.store.get(address).preferenceConflict, false);
    assert.equal(f.store.get(address).consent, 'confirmed');
  }
  const observations = f.store.listEventsSince(0).filter(event => event.type === 'preference-observation');
  assert.equal(observations.length, 4);
  assert.equal(observations.filter(event => event.reason === 'both_language_interests').length, 2);
});
