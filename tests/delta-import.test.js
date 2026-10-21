import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { buildMigrationPlan, LANGUAGE_INTERESTS } from '../src/services/consent/migration.js';
import { snapshotDigest } from '../src/services/consent/baseline-import.js';
import { assessGoNoGo, eventLogProof, executeDelta, prepareDelta, resolveBase } from '../src/services/consent/delta-import.js';
import { resolveTargetList } from '../scripts/consent-preflight.mjs';

const clone = (value) => structuredClone(value);
const sha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const key = 'synthetic-checksum-key';
const enumeration = [{ value: 1, label: 'English' }, { value: 2, label: 'Nederlands' }];
const t0 = '2026-10-21T11:01:06.771Z';
const t1 = '2026-10-28T08:00:00.000Z';
const policy = { acceptedSources: ['Import'], notice: 'Jaap 21 oktober' };

const member = (email, status, extra = {}) => ({ email_address: email, status, list_id: '67fe159b9d', source: 'Import',
  timestamp_opt: '2026-01-01T00:00:00Z', merge_fields: {}, interests: {}, ...extra });

// Baseline at T0: a (nl) and b (en) imported, c suppressed, d pending.
function baseline() {
  const members = [
    member('a@example.test', 'subscribed', { merge_fields: { FNAME: 'Ada', LNAME: 'Lovelace' } }),
    member('b@example.test', 'subscribed', { merge_fields: { FNAME: 'Bob' }, interests: { [LANGUAGE_INTERESTS.en]: true } }),
    member('c@example.test', 'unsubscribed'),
    member('d@example.test', 'pending'),
  ];
  const evidenceByEmail = Object.fromEntries(['a@example.test', 'b@example.test'].map((email) =>
    [email, { granted: true, source: 'mailchimp:Import', notice: policy.notice, recordedAt: '2026-01-01T00:00:00Z' }]));
  const plan = buildMigrationPlan({ members, brevoContacts: [], evidenceByEmail, checksumKey: key,
    targetBrevoListId: 20, languageEnumeration: enumeration });
  const record = { t0, snapshotPath: '/data/consent/migration/base.enc.json', consentPolicy: policy,
    targetList: { exists: true, id: 20 }, sourceChecksum: { mailchimp: snapshotDigest(members, key) } };
  const snapshot = { startedAt: t0, members, brevoContacts: [], plan };
  const journal = { t0, listId: 20, readback: { result: { verified: true } },
    records: { 'a@example.test': { status: 'applied' }, 'b@example.test': { status: 'applied' } },
    suppressions: { 'c@example.test': { status: 'applied' } } };
  const contacts = [
    { email: 'a@example.test', id: 1, listIds: [20], attributes: { LANGUAGE: '2', FIRSTNAME: 'Ada', LASTNAME: 'Lovelace' } },
    { email: 'b@example.test', id: 2, listIds: [20], attributes: { LANGUAGE: '1', FIRSTNAME: 'Bob' } },
  ];
  return { members, record, snapshot, journal, contacts };
}

// Since T0: a unsubscribed, b renamed and switched to nl, c resubscribed,
// d confirmed, e new.
function changedMembers(members) {
  const next = clone(members);
  next[0].status = 'unsubscribed';
  next[1].merge_fields.FNAME = 'Robert';
  next[1].interests = { [LANGUAGE_INTERESTS.nl]: true };
  next[2].status = 'subscribed';
  next[3].status = 'subscribed';
  next.push(member('e@example.test', 'subscribed', { merge_fields: { FNAME: 'Eve' } }));
  return next;
}

function fixture({ edit = (members) => members, contactsEdit = (contacts) => contacts } = {}) {
  const b = baseline();
  const base = resolveBase({ record: b.record, snapshot: b.snapshot, journal: b.journal, key });
  const state = { members: edit(changedMembers(b.members)), contacts: contactsEdit(clone(b.contacts)),
    lists: [{ name: 'CIIIC nieuwsbrief', id: 20, uniqueSubscribers: 2 }], languageEnumeration: clone(enumeration) };
  const { snapshot, record: run } = prepareDelta({ base, inventory: { ...clone(state), target: resolveTargetList(state.lists) },
    startedAt: t1, completedAt: t1, key, snapshotPath: '/data/consent/migration/delta.enc.json' });
  const approval = { t0: t1, baselineT0: t0, snapshotPath: run.snapshotPath, runSha256: sha(run), approvedBy: 'Jaap',
    approvedAt: '2026-10-28T08:30:00.000Z' };
  const automationEvidence = { checkedBy: 'Jaap', checkedAt: '2026-10-28T08:35:00.000Z', listName: 'CIIIC nieuwsbrief',
    scope: 'account-and-list', confirmationDisabled: true, welcomeDisabled: true, marketingDisabled: true };
  const calls = [];
  let crashOn = null;
  const find = (email) => state.contacts.find((contact) => contact.email === email);
  const provider = {
    inventory: async () => clone(state),
    resolveTarget: (lists) => resolveTargetList(lists),
    contact: async (email) => clone(find(email) ?? null),
    removeFromList: async (email, id) => { calls.push('suppress'); find(email).listIds = find(email).listIds.filter((item) => item !== id); },
    upsert: async (email, payload, exists) => {
      calls.push(exists ? 'update' : 'add');
      if (exists) Object.assign(find(email).attributes, payload.attributes);
      else state.contacts.push({ email, id: 9, listIds: payload.listIds, attributes: { ...payload.attributes } });
      if (crashOn === email) { crashOn = null; throw new Error('network lost after provider answer'); }
    },
  };
  const journal = {};
  return { base, state, snapshot, run, approval, automationEvidence, provider, journal, calls,
    crashOn: (email) => { crashOn = email; },
    execute: (apply = true) => executeDelta({ snapshot, run, approval, key, journal, provider, automationEvidence,
      apply, save: async () => {} }) };
}

test('delta plan: post-baseline unsubscribe suppresses, resubscription is held, aggregates carry no addresses', () => {
  const f = fixture();
  assert.deepEqual(f.run.counts, { suppress: 1, update: 1, add: 2, hold: 1, unchanged: 0 });
  assert.deepEqual(f.run.diff.suppressByReason, { unsubscribed: 1 });
  assert.equal(f.run.diff.suppressListMembers, 1);
  assert.deepEqual(f.run.diff.holdByReason, { resubscribed_after_suppression: 1 });
  assert.deepEqual(f.run.diff.updateFields, { language: 1, firstName: 1 });
  assert.deepEqual(f.run.diff.addByLanguage, { nl: 2 });
  assert.deepEqual(f.run.diff.effectiveAfter, { members: 3, suppressed: 2 });
  assert.equal(f.run.destination.verified, true);
  assert.deepEqual(f.snapshot.plan.rows.map((row) => row.action), ['suppress', 'update', 'add', 'add']);
  assert.equal(JSON.stringify(f.run).includes('@'), false);
});

test('members pending again or gone from Mailchimp are suppressed; emptied names are kept and counted', () => {
  const f = fixture({ edit: (members) => {
    members[0].status = 'pending';
    members[1].merge_fields = {};
    members[1].interests = { [LANGUAGE_INTERESTS.en]: true };
    return members;
  } });
  assert.deepEqual(f.run.diff.suppressByReason, { pending: 1 });
  assert.equal(f.run.counts.update, 0);
  assert.equal(f.run.diff.ignored.nameCleared, 1);
  const g = fixture({ edit: (members) => members.filter((item) => item.email_address !== 'a@example.test') });
  assert.deepEqual(g.run.diff.suppressByReason, { missing_from_source: 1 });
});

test('apply: suppressions first, read-back verified, a second identical run makes zero writes', async () => {
  const f = fixture();
  const result = await f.execute();
  assert.deepEqual(f.calls, ['suppress', 'update', 'add', 'add']);
  assert.equal(result.writes, 4);
  assert.equal(result.readback.verified, true);
  assert.equal(result.sampleCount, 4);
  assert.match(result.releaseBlocked, /event logs/);
  const b = f.state.contacts.find((contact) => contact.email === 'b@example.test');
  assert.deepEqual(b.attributes, { LANGUAGE: 2, FIRSTNAME: 'Robert' });
  const again = await f.execute();
  assert.equal(again.writes, 0);
  assert.equal(f.calls.length, 4);
});

test('crash after a provider write resumes from the register without a duplicate mutation', async () => {
  const f = fixture();
  f.crashOn('d@example.test');
  await assert.rejects(f.execute(), /Provider outcome unknown/);
  assert.equal(f.journal.records['d@example.test'].status, 'intent');
  const result = await f.execute();
  assert.equal(result.readback.verified, true);
  assert.deepEqual(f.calls, ['suppress', 'update', 'add', 'add']);
});

test('source and destination drift stop every write', async () => {
  const f = fixture();
  f.state.members[4].merge_fields.FNAME = 'Changed';
  await assert.rejects(f.execute(), /Mailchimp source drift/);
  const g = fixture();
  g.state.contacts[1].attributes.FIRSTNAME = 'Changed';
  await assert.rejects(g.execute(), /destination drift/);
  const h = fixture();
  h.state.lists = [{ name: 'CIIIC nieuwsbrief', id: 21 }];
  await assert.rejects(h.execute(false), /Target list drift/);
  for (const item of [f, g, h]) assert.deepEqual(item.calls, []);
});

test('a Brevo list that no longer matches the base blocks approval', async () => {
  const f = fixture({ contactsEdit: (contacts) => { contacts[1].attributes.LANGUAGE = '2'; return contacts; } });
  assert.equal(f.run.destination.verified, false);
  assert.equal(f.run.destination.issues.languageMismatch, 1);
  await assert.rejects(f.execute(), /Approved delta dry-run/);
  assert.deepEqual(f.calls, []);
});

test('approval binds run, baseline T0, rows and current automation evidence', async () => {
  for (const edit of [
    (f) => { f.approval.runSha256 = 'wrong'; },
    (f) => { f.approval.baselineT0 = '2026-10-19T17:36:35.815Z'; },
    (f) => { f.approval.approvedBy = 'Someone'; },
  ]) {
    const f = fixture();
    edit(f);
    await assert.rejects(f.execute(), /Approved delta dry-run/);
  }
  const g = fixture();
  g.snapshot.plan.rows.find((row) => row.action === 'add').firstName = 'Mallory';
  await assert.rejects(g.execute(), /rows do not match checksum/);
  const h = fixture();
  h.automationEvidence.checkedAt = '2026-10-28T08:00:00.000Z';
  await assert.rejects(h.execute(), /automation evidence/);
  for (const item of [g, h]) assert.deepEqual(item.calls, []);
});

test('an update only overwrites the base state, never a contact changed in between', async () => {
  const f = fixture();
  const original = f.provider.contact;
  f.provider.contact = async (email) => {
    if (email === 'b@example.test') f.state.contacts[1].attributes.LANGUAGE = 2;
    return original(email);
  };
  await assert.rejects(f.execute(), /contact changed after inventory/);
  assert.deepEqual(f.calls, ['suppress']);
});

test('the base must be fully applied and verified; an applied delta becomes the next base', async () => {
  const b = baseline();
  b.journal.readback.result.verified = false;
  assert.throws(() => resolveBase({ record: b.record, snapshot: b.snapshot, journal: b.journal, key }), /not applied and verified/);
  const c = baseline();
  c.journal.records['b@example.test'].status = 'intent';
  assert.throws(() => resolveBase({ record: c.record, snapshot: c.snapshot, journal: c.journal, key }), /not applied and verified/);
  const f = fixture();
  await f.execute();
  const next = resolveBase({ record: f.run, snapshot: f.snapshot, journal: f.journal, key });
  assert.equal(next.baselineT0, t0);
  const { record } = prepareDelta({ base: next, inventory: { ...clone(f.state), target: resolveTargetList(f.state.lists) },
    startedAt: '2026-10-29T08:00:00.000Z', completedAt: '2026-10-29T08:00:00.000Z', key, snapshotPath: '/x' });
  assert.deepEqual(record.counts, { suppress: 0, update: 0, add: 0, hold: 1, unchanged: 4 });
  assert.equal(record.destination.verified, true);
});

test('go/no-go blocks on stale automation evidence and warns on open RBL issue', () => {
  const f = fixture();
  const ok = assessGoNoGo({ record: f.run, automationEvidence: f.automationEvidence, now: '2026-10-29T08:00:00.000Z',
    lists: f.state.lists });
  assert.equal(ok.go, true);
  assert.equal(ok.list.subscribers, 2);
  assert.ok(ok.warnings.some((item) => item.includes('TODO #6')));
  const stale = assessGoNoGo({ record: f.run, automationEvidence: f.automationEvidence, now: '2026-11-05T08:00:00.000Z' });
  assert.equal(stale.go, false);
  assert.equal(stale.blockers.length, 1);
});

test('event-log proof paginates fully and counts only aggregates', async () => {
  const pages = [
    { events: [{ email: 'd@example.test', date: '2026-10-28T09:00:00Z', event: 'requests' },
      { email: 'other@example.test', date: '2026-10-28T09:01:00Z', event: 'delivered' }] },
    { events: [{ email: 'old@example.test', date: '2026-10-27T09:00:00Z', event: 'delivered' }] },
  ];
  const seen = [];
  const request = async (method, endpoint) => {
    seen.push(endpoint);
    if (endpoint.startsWith('/smtp')) return pages[Number(new URLSearchParams(endpoint.split('?')[1]).get('offset')) / 2] ?? { events: [] };
    return { campaigns: [{ status: 'draft' }], count: 1 };
  };
  const proof = await eventLogProof({ request, addresses: new Set(['d@example.test']), since: '2026-10-28T08:00:00Z',
    until: '2026-10-28T10:00:00Z', pageSize: 2 });
  assert.equal(proof.smtp.pages, 2);
  assert.equal(proof.smtp.inWindow, 2);
  assert.equal(proof.smtp.deltaAddressesInWindow, 1);
  assert.equal(proof.verified, false);
  assert.equal(JSON.stringify(proof).includes('@'), false);
  assert.ok(seen.every((endpoint) => !endpoint.includes('@')));
});
