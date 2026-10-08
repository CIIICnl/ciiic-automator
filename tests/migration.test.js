import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildMigrationPlan, compareBaselineReadback, languageFromInterests, LANGUAGE_INTERESTS,
  changesSinceT0 } from '../src/services/consent/migration.js';
import { reconcileMailchimpSnapshot } from '../src/services/consent/reconciliation.js';
import { applyReconciliation, readCheckpoint, withCheckpointLock } from '../scripts/consent-reconcile.mjs';

const languageEnumeration = [{ value: 1, label: 'English' }, { value: 2, label: 'Nederlands' }];
const evidence = { granted: true, source: 'form-42', notice: 'newsletter-2026', recordedAt: '2026-01-01T00:00:00Z' };
const member = (email, status = 'subscribed', interests = {}) => ({
  id: email, email_address: email, status, interests, list_id: '67fe159b9d', last_changed: '2026-10-06T10:00:00Z',
});

test('preflight orders suppressions first and never promotes unsupported consent', () => {
  const members = [
    member('nl@example.test'),
    member('en@example.test', 'subscribed', { [LANGUAGE_INTERESTS.en]: true }),
    member('unknown@example.test'),
    member('off@example.test', 'unsubscribed'),
    member('pending@example.test', 'pending'),
    member('both@example.test', 'subscribed', { [LANGUAGE_INTERESTS.nl]: true, [LANGUAGE_INTERESTS.en]: true }),
    member('DUP@example.test'), member('dup@example.test'),
    { ...member('elsewhere@example.test'), list_id: '0e404ef800' },
  ];
  const plan = buildMigrationPlan({ members,
    evidenceByEmail: { 'nl@example.test': evidence, 'en@example.test': evidence, 'dup@example.test': evidence },
    checksumKey: 'fixture-secret', batchSize: 1,
    brevoContacts: [{ email: 'en@example.test', emailBlacklisted: true }] });
  assert.deepEqual(plan.counts, { candidate: 1, suppress: 2, quarantine: 4, exclude: 2,
    reasons: { unsubscribed: 1, brevo_blocked: 1, both_language_interests: 1,
      duplicate_identity: 2, unproven_consent: 1, pending: 1, different_audience: 1 } });
  assert.deepEqual(plan.batches.map((batch) => batch.action), ['suppress', 'suppress', 'candidate']);
  assert.equal(plan.gate.providerImportExecutable, false);
  assert.equal(JSON.stringify(plan.batches).includes('@'), false);
  assert.deepEqual(languageFromInterests({}), { language: 'nl', source: 'default-nl' });
  assert.equal(buildMigrationPlan({ members: [member('nl@example.test')], evidenceByEmail: { 'nl@example.test': evidence },
    checksumKey: 'fixture-secret' }).batches[0].checksum,
  buildMigrationPlan({ members: [member('nl@example.test')], evidenceByEmail: { 'nl@example.test': evidence },
    checksumKey: 'fixture-secret' }).batches[0].checksum);
});

test('stale Mailchimp preference cannot replace newer choice; suppression still wins', async () => {
  const registry = { get: async () => ({ language: 'en', languageAt: '2026-10-07T00:00:00Z', suppressed: false }) };
  const members = [member('older@example.test'), member('off@example.test', 'unsubscribed')];
  const result = await reconcileMailchimpSnapshot({ members, registry, eventKey: 'fixture-secret',
    snapshotComplete: true, snapshotAt: '2026-10-08T00:00:00Z' });
  assert.deepEqual(result.events.map((event) => event.type), ['suppress']);
  assert.equal(JSON.stringify(result.summary).includes('@'), false);
  await assert.rejects(reconcileMailchimpSnapshot({ members, registry, eventKey: 'fixture-secret',
    snapshotComplete: false, snapshotAt: '2026-10-08T00:00:00Z' }), /Full Mailchimp snapshot/);
});

test('unrelated Mailchimp profile edit cannot overwrite a Brevo language choice', async () => {
  const prior = member('reader@example.test', 'subscribed', { [LANGUAGE_INTERESTS.nl]: true });
  const updated = { ...prior, last_changed: '2026-10-09T00:00:00Z', merge_fields: { FNAME: 'changed' } };
  const registry = { get: async () => ({ language: 'en', languageAt: Date.parse('2026-10-08T00:00:00Z') }) };
  const result = await reconcileMailchimpSnapshot({ members: [updated], registry, eventKey: 'fixture-secret',
    snapshotComplete: true, snapshotAt: '2026-10-10T00:00:00Z',
    previousSnapshot: { complete: true, at: '2026-10-07T00:00:00Z', members: [prior] } });
  assert.equal(result.events.length, 0);
  const changed = { ...updated, interests: { [LANGUAGE_INTERESTS.en]: true } };
  const ambiguous = await reconcileMailchimpSnapshot({ members: [changed], registry, eventKey: 'fixture-secret',
    snapshotComplete: true, snapshotAt: '2026-10-10T00:00:00Z',
    previousSnapshot: { complete: true, at: '2026-10-07T00:00:00Z', members: [prior] } });
  assert.equal(ambiguous.events[0].type, 'preference-observation');
  assert.equal(ambiguous.events[0].previousObservedAt, '2026-10-07T00:00:00Z');
  assert.equal(ambiguous.events[0].occurredAt, undefined);
});

test('rollback delta retains every change since T0 in causal order', () => {
  const events = [{ id: 'before', occurredAt: '2026-10-05T00:00:00Z', receivedAt: '2026-10-05T00:00:00Z' },
    { id: 'preference', occurredAt: '2026-10-07T00:00:00Z', receivedAt: '2026-10-07T00:00:00Z' },
    { id: 'suppress', occurredAt: '2026-09-01T00:00:00Z', receivedAt: '2026-10-06T00:00:00Z' }];
  assert.deepEqual(changesSinceT0(events, '2026-10-06T00:00:00Z').map((event) => event.id), ['suppress', 'preference']);
});

test('baseline readback verifies membership, language, and durable suppression', () => {
  const plan = buildMigrationPlan({ members: [member('yes@example.test'), member('off@example.test', 'unsubscribed')],
    evidenceByEmail: { 'yes@example.test': evidence }, checksumKey: 'fixture-secret' });
  const input = { plan, contacts: [{ email: 'yes@example.test', listIds: [42], attributes: { LANGUAGE: '2' } }],
    registryByEmail: { 'off@example.test': { suppressed: true } }, targetBrevoListId: 42,
    automationsDisabled: true, readbackComplete: true, languageEnumeration };
  assert.equal(compareBaselineReadback(input).verified, true);
  assert.deepEqual(compareBaselineReadback({ ...input, contacts: [{ email: 'yes@example.test', listIds: [42],
    attributes: { LANGUAGE: '1' } }] }).issues.languageMismatch, 1);
  assert.equal(compareBaselineReadback({ ...input, contacts: [{ email: 'yes@example.test', listIds: [42],
    attributes: { TAAL: 'nl' } }] }).issues.languageMismatch, 1);
  assert.throws(() => compareBaselineReadback({ ...input, languageEnumeration: undefined }), /enumeration missing/);
  assert.equal(compareBaselineReadback({ ...input, registryByEmail: {} }).verified, false);
  assert.equal(compareBaselineReadback({ ...input, contacts: [{ email: 'yes@example.test', listIds: [42],
    attributes: { LANGUAGE: '2' }, emailBlacklisted: true }] }).issues.unexpectedSuppression, 1);
  assert.equal(compareBaselineReadback({ ...input, priorBrevoContacts: [{ email: 'yes@example.test',
    emailBlacklisted: true }] }).issues.lostExistingBlock, 1);
  assert.equal(compareBaselineReadback({ ...input, priorBrevoContacts: [{ email: 'yes@example.test',
    listUnsubscribed: [42] }] }).issues.lostExistingBlock, 1);
  assert.throws(() => compareBaselineReadback({ ...input, automationsDisabled: false }), /disabled automations/);
  assert.throws(() => compareBaselineReadback({ ...input, targetBrevoListId: 3 }), /target list/);
});

test('existing Brevo LANGUAGE is decoded through the enumeration before conflict checks', () => {
  const members = [member('nl@example.test'), member('en@example.test', 'subscribed', { [LANGUAGE_INTERESTS.en]: true }),
    member('odd@example.test')];
  const evidenceByEmail = Object.fromEntries(members.map((row) => [row.email_address, evidence]));
  const brevoContacts = [{ email: 'nl@example.test', attributes: { LANGUAGE: '2' } },
    { email: 'en@example.test', attributes: { LANGUAGE: '2' } }, { email: 'odd@example.test', attributes: { LANGUAGE: '7' } }];
  const plan = buildMigrationPlan({ members, brevoContacts, evidenceByEmail, checksumKey: 'fixture-secret', languageEnumeration });
  assert.deepEqual(plan.rows.map((row) => [row.email, row.action, row.reason ?? null]), [
    ['nl@example.test', 'candidate', null],
    ['en@example.test', 'quarantine', 'brevo_language_conflict'],
    ['odd@example.test', 'quarantine', 'brevo_language_conflict']]);
  assert.deepEqual(plan.gate.readbackRequired, ['membership', 'LANGUAGE', 'suppressions']);
  assert.throws(() => buildMigrationPlan({ members, brevoContacts, evidenceByEmail, checksumKey: 'fixture-secret' }),
    /enumeration required/);
});

test('failed reconciliation keeps old checkpoint and idempotent retry can finish', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ciiic-reconcile-test-'));
  await fs.chmod(directory, 0o700);
  const file = path.join(directory, 'checkpoint.enc.json');
  const encryptionKey = crypto.randomBytes(32);
  const ids = new Set();
  let failOnce = true;
  const registry = { get: async () => null, applyEvent(event) {
    if (event.email === 'second@example.test' && failOnce) { failOnce = false; throw new Error('simulated local failure'); }
    ids.add(event.id);
  } };
  const args = { members: [member('first@example.test', 'unsubscribed'),
    member('second@example.test', 'cleaned')], registry, checkpointFile: file, encryptionKey,
    eventKey: 'fixture-secret', snapshotAt: '2026-10-06T12:00:00Z' };
  try {
    await assert.rejects(applyReconciliation(args), /simulated/);
    assert.equal(await readCheckpoint(file, encryptionKey), null);
    const result = await applyReconciliation(args);
    assert.equal(result.applied, 2);
    assert.equal(ids.size, 2);
    assert.equal((await readCheckpoint(file, encryptionKey)).complete, true);
    assert.equal((await fs.stat(file)).mode & 0o077, 0);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('checkpoint lock rejects concurrent writers and releases after completion', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ciiic-reconcile-lock-'));
  await fs.chmod(directory, 0o700);
  const file = path.join(directory, 'checkpoint.enc.json');
  try {
    await withCheckpointLock(file, async () => {
      await assert.rejects(withCheckpointLock(file, async () => {}), /writer already active/);
    });
    assert.equal(await withCheckpointLock(file, async () => 42), 42);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
