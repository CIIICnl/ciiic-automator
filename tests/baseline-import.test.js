import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { buildMigrationPlan } from '../src/services/consent/migration.js';
import { executeBaseline, safeCandidatePayload, snapshotDigest } from '../src/services/consent/baseline-import.js';

const clone = (value) => structuredClone(value);
const sha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const key = 'synthetic-checksum-key';
const enumeration = [{ value: 1, label: 'English' }, { value: 2, label: 'Nederlands' }];
const t0 = '2026-10-19T17:36:35.815Z';

function fixture() {
  const members = [
    { email_address: 'a@example.test', status: 'subscribed', list_id: '67fe159b9d', source: 'Import',
      timestamp_opt: t0, merge_fields: { FNAME: 'Ada', LNAME: 'Lovelace' }, interests: {} },
    { email_address: 'b@example.test', status: 'unsubscribed', list_id: '67fe159b9d' },
  ];
  const contacts = [{ email: 'b@example.test', id: 8, listIds: [41], attributes: {} }];
  const evidenceByEmail = { 'a@example.test': { granted: true, source: 'mailchimp:Import', notice: 'Jaap 19 oktober', recordedAt: t0 } };
  const plan = buildMigrationPlan({ members, brevoContacts: contacts, evidenceByEmail,
    checksumKey: key, targetBrevoListId: 41, languageEnumeration: enumeration, batchSize: 1 });
  const snapshot = { startedAt: t0, members, brevoContacts: contacts, plan };
  const run = { t0, snapshotPath: '/data/consent/migration/source.enc.json',
    sourceChecksum: { mailchimp: snapshotDigest(members, key), brevo: snapshotDigest(contacts, key) },
    diff: plan.diff, counts: plan.counts, batches: plan.batches,
    targetList: { exists: true, id: 41 } };
  const approval = { t0, snapshotPath: run.snapshotPath, runSha256: sha(run), approvedBy: 'Jaap',
    approvedAt: '2026-10-19T18:00:00.000Z', targetFolderId: 10 };
  const automationEvidence = { checkedBy: 'operator', checkedAt: '2026-10-19T18:05:00.000Z',
    listName: 'CIIIC nieuwsbrief', scope: 'account-and-list', confirmationDisabled: true,
    welcomeDisabled: true, marketingDisabled: true };
  const state = { members: clone(members), contacts: clone(contacts), lists: [{ name: 'CIIIC nieuwsbrief', id: 41 }],
    languageEnumeration: clone(enumeration) };
  const calls = [];
  let crashAfterWrite = false;
  const provider = {
    inventory: async () => clone(state),
    resolveTarget: () => ({ exists: true, id: 41 }),
    contact: async (email) => clone(state.contacts.find((contact) => contact.email === email) ?? null),
    removeFromList: async (email, id) => {
      calls.push('suppress');
      state.contacts.find((contact) => contact.email === email).listIds =
        state.contacts.find((contact) => contact.email === email).listIds.filter((item) => item !== id);
    },
    upsert: async (email, payload) => {
      calls.push('candidate');
      state.contacts.push({ email, id: 9, listIds: payload.listIds, attributes: payload.attributes });
      if (crashAfterWrite) { crashAfterWrite = false; throw new Error('network lost after provider answer'); }
    },
  };
  const journal = {};
  return { snapshot, run, approval, automationEvidence, state, provider, journal, calls,
    setCrash: () => { crashAfterWrite = true; },
    execute: (apply = true) => executeBaseline({ snapshot, run, approval, key, journal, provider,
      automationEvidence, apply, save: async () => {} }) };
}

test('suppression precedes candidates; crash after provider write resumes without duplicate mutation', async () => {
  const f = fixture();
  f.setCrash();
  await assert.rejects(f.execute(), /Provider outcome unknown/);
  assert.deepEqual(f.calls, ['suppress', 'candidate']);
  assert.equal(f.journal.records['a@example.test'].status, 'intent');
  assert.equal(f.journal.records['a@example.test'].lastError, 'provider_outcome_unknown');
  const result = await f.execute();
  assert.equal(result.readback.verified, true);
  assert.equal(result.sampleCount, 1);
  assert.deepEqual(f.calls, ['suppress', 'candidate']);
  await f.execute();
  assert.deepEqual(f.calls, ['suppress', 'candidate']);
});

test('source and destination drift stop writes', async () => {
  const f = fixture();
  f.state.members[0].merge_fields.FNAME = 'Changed';
  await assert.rejects(f.execute(), /source drift/);
  assert.equal(f.calls.length, 0);
  const g = fixture();
  g.state.contacts[0].attributes.FIRSTNAME = 'Changed';
  await assert.rejects(g.execute(), /destination drift/);
  assert.equal(g.calls.length, 0);
  const h = fixture();
  h.state.languageEnumeration = [{ value: 1, label: 'English' }, { value: 9, label: 'Nederlands' }];
  await assert.rejects(h.execute(), /LANGUAGE enumeration drift/);
  assert.equal(h.calls.length, 0);
});

test('approval and automation evidence gate every write', async () => {
  const f = fixture();
  f.approval.runSha256 = 'wrong';
  await assert.rejects(f.execute(), /Approved dry-run/);
  const g = fixture();
  g.automationEvidence.marketingDisabled = false;
  await assert.rejects(g.execute(), /automation evidence/);
  assert.equal(g.calls.length, 0);
});

test('read-back checks actual names', async () => {
  const f = fixture();
  f.provider.upsert = async (email, payload) => {
    f.state.contacts.push({ email, id: 9, listIds: payload.listIds,
      attributes: { ...payload.attributes, FIRSTNAME: 'Wrong' } });
  };
  await assert.rejects(f.execute(), /Provider read-back mismatch/);
});

test('existing global and list suppressions cannot be reset', () => {
  const row = { email: 'a@example.test', firstName: 'Ada', lastName: '', attributes: { LANGUAGE: 2 } };
  assert.throws(() => safeCandidatePayload(row, { emailBlacklisted: true }, 41), /suppression/);
  assert.throws(() => safeCandidatePayload(row, { listUnsubscribed: [99] }, 41), /suppression/);
});
