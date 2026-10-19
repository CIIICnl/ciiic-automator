import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { buildMigrationPlan } from '../src/services/consent/migration.js';
import { executeBaseline, safeCandidatePayload, snapshotDigest } from '../src/services/consent/baseline-import.js';
import { resolveTargetList } from '../scripts/consent-preflight.mjs';

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
    resolveTarget: (lists) => resolveTargetList(lists),
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

test('approved rows remain bound to their batch HMAC before any provider read', async () => {
  for (const edit of [
    (f) => { f.snapshot.plan.rows.find((row) => row.action === 'candidate').firstName = 'Eve'; },
    (f) => { f.snapshot.plan.rows.find((row) => row.action === 'suppress').reason = 'changed'; },
    (f) => { f.snapshot.plan.rows.push(clone(f.snapshot.plan.rows.find((row) => row.action === 'candidate'))); },
  ]) {
    const f = fixture();
    edit(f);
    let reads = 0;
    f.provider.inventory = async () => { reads += 1; return clone(f.state); };
    await assert.rejects(f.execute(false), /batch rows do not match checksum/);
    assert.equal(reads, 0);
    assert.equal(f.calls.length, 0);
  }
});

test('journal list id must resolve to the current named target, also on read-only inspection', async () => {
  for (const lists of [[], [{ name: 'Renamed', id: 41 }], [{ name: 'CIIIC nieuwsbrief', id: 42 }]]) {
    const f = fixture();
    f.run.targetList = { exists: false, id: null };
    f.approval.runSha256 = sha(f.run);
    f.journal.listId = 41;
    f.state.lists = lists;
    await assert.rejects(f.execute(false), /Journal target list drift/);
    assert.equal(f.calls.length, 0);
  }
});

test('read-only inspection makes no writes', async () => {
  const f = fixture();
  f.provider.createList = async () => { throw new Error('write'); };
  const result = await f.execute(false);
  assert.equal(result.writes, 0);
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.journal.records, {});
});

test('candidate changes between inventory and contact read stop before upsert', async () => {
  for (const change of [
    (contact) => { contact.attributes.LANGUAGE = 1; },
    (contact) => { contact.attributes.FIRSTNAME = 'Changed'; },
    (contact) => { contact.listUnsubscribed = [99]; },
    (contact) => { contact.emailBlacklisted = true; },
  ]) {
    const f = fixture();
    f.snapshot.brevoContacts.push({ email: 'a@example.test', id: 9, listIds: [], attributes: {} });
    f.state.contacts.push(clone(f.snapshot.brevoContacts.at(-1)));
    f.run.sourceChecksum.brevo = snapshotDigest(f.snapshot.brevoContacts, key);
    f.approval.runSha256 = sha(f.run);
    const original = f.provider.contact;
    f.provider.contact = async (email) => {
      if (email === 'a@example.test') change(f.state.contacts.find((contact) => contact.email === email));
      return original(email);
    };
    await assert.rejects(f.execute(), /contact changed after inventory/);
    assert.deepEqual(f.calls, ['suppress']);
  }
});

test('metadata differences do not create false drift on candidate read or intent retry', async () => {
  const f = fixture();
  const original = f.provider.contact;
  f.provider.contact = async (email) => {
    const contact = await original(email);
    return contact && { ...contact, modifiedAt: '2026-10-19T19:00:00Z', statistics: { sent: 3 } };
  };
  f.setCrash();
  await assert.rejects(f.execute(), /Provider outcome unknown/);
  const result = await f.execute();
  assert.equal(result.writes, 0);
  assert.deepEqual(f.calls, ['suppress', 'candidate']);
});

test('intent retry accepts harmless single-contact metadata before retrying', async () => {
  const f = fixture();
  const prior = { email: 'a@example.test', id: 9, listIds: [], attributes: {} };
  f.snapshot.brevoContacts.push(clone(prior));
  f.state.contacts.push(clone(prior));
  f.run.sourceChecksum.brevo = snapshotDigest(f.snapshot.brevoContacts, key);
  f.approval.runSha256 = sha(f.run);
  f.journal.records = { 'a@example.test': { status: 'intent',
    checksum: sha(f.snapshot.plan.rows.find((row) => row.action === 'candidate')) } };
  const original = f.provider.contact;
  f.provider.contact = async (email) => {
    const contact = await original(email);
    return contact && { ...contact, createdAt: 'provider-only metadata' };
  };
  f.provider.upsert = async (email, payload) => {
    f.calls.push('candidate');
    const contact = f.state.contacts.find((item) => item.email === email);
    contact.listIds = payload.listIds;
    contact.attributes = payload.attributes;
  };
  const result = await f.execute();
  assert.equal(result.writes, 1);
  assert.deepEqual(f.calls, ['suppress', 'candidate']);
});

test('intent and applied readback reject a new opt-out on another list', async () => {
  for (const status of ['intent', 'applied']) {
    const f = fixture();
    f.snapshot.brevoContacts.push({ email: 'a@example.test', id: 9, listIds: [], attributes: {} });
    f.state.contacts.push({ email: 'a@example.test', id: 9, listIds: [41], listUnsubscribed: [99],
      attributes: { FIRSTNAME: 'Ada', LASTNAME: 'Lovelace', LANGUAGE: 2 } });
    f.run.sourceChecksum.brevo = snapshotDigest(f.snapshot.brevoContacts, key);
    f.approval.runSha256 = sha(f.run);
    f.journal.records = { 'a@example.test': { status, checksum: sha(f.snapshot.plan.rows.find((row) => row.action === 'candidate')) } };
    await assert.rejects(f.execute(), /manual reconciliation required/);
    assert.deepEqual(f.calls, ['suppress']);
  }
});
