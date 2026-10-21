import crypto from 'node:crypto';
import { canonicalEmail, classifyMember, compareBaselineReadback, evidenceFromAcceptedSources } from './migration.js';
import { createLanguageCodec } from './brevo-language.js';
import { assertAutomationEvidence, assertProviderFlagsUnset, checkSourceDrift, orderedBatchChecksum, rowMatches,
  safeCandidatePayload, sameContactState, snapshotDigest } from './baseline-import.js';

// A delta is the difference between the effective state of list 20 after the
// last applied run (baseline or delta) and the Mailchimp source now. Same
// rules as the baseline: suppressions first, every outcome read back, a
// restart never repeats a mutation blind, and the tool never sends or cuts over.
export const DELTA_ACTIONS = Object.freeze(['suppress', 'update', 'add']);
const TEST_LISTS = [2, 3];
const RELEASE_BLOCKED = 'SMTP and marketing event logs require full-window proof';

const digest = (value) => crypto.createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
const byEmail = (contacts) => new Map(contacts.map((contact) => [canonicalEmail(contact.email), contact]));
const blocked = (contact, listId) => Boolean(contact?.emailBlacklisted || contact?.listUnsubscribed?.includes(listId));
const tally = (acc, key) => { acc[key] = (acc[key] || 0) + 1; return acc; };

function assertListId(listId) {
  if (!Number.isSafeInteger(listId) || listId < 1 || TEST_LISTS.includes(listId)) throw new Error('Dedicated Brevo CIIIC list ID required');
}

// Effective state per address: { member: true, language, firstName, lastName } or { member: false }.
export function baselineEffective(plan) {
  const state = {};
  for (const row of plan.rows) {
    if (row.action === 'suppress') state[row.email] = { member: false };
    else if (row.action === 'candidate' && state[row.email]?.member !== false) {
      state[row.email] = { member: true, language: row.language, firstName: row.firstName || '', lastName: row.lastName || '' };
    }
  }
  return state;
}

// One row per address, with the same duplicate rule as the baseline plan:
// a suppression among duplicates wins, other duplicates are held.
function currentRows(members, evidenceByEmail) {
  const rank = { suppress: 0, quarantine: 1, candidate: 2, exclude: 3 };
  const seen = new Map();
  let invalidIdentity = 0;
  for (const member of members) {
    const email = canonicalEmail(member.email_address);
    if (email) seen.set(email, (seen.get(email) || 0) + 1);
    else invalidIdentity += 1;
  }
  const rows = new Map();
  for (const member of members) {
    const email = canonicalEmail(member.email_address);
    if (!email) continue;
    let row = classifyMember(member, evidenceByEmail[email]);
    if (seen.get(email) > 1 && row.action !== 'suppress') row = { action: 'quarantine', reason: 'duplicate_identity', email };
    const prior = rows.get(email);
    if (!prior || rank[row.action] < rank[prior.action]) rows.set(email, row);
  }
  return { rows, invalidIdentity };
}

// Brevo writes only non-empty names, so the attribute set mirrors the baseline payload.
function attributesOf(state, codec) {
  const attributes = { LANGUAGE: codec.toValue(state.language) };
  if (state.firstName) attributes.FIRSTNAME = state.firstName;
  if (state.lastName) attributes.LASTNAME = state.lastName;
  return attributes;
}

// Compares a full provider read against an effective state. Reuses the
// baseline comparison, so the same nine counters apply.
export function compareEffective({ effective, contacts, listId, languageEnumeration, priorBrevoContacts = [] }) {
  const rows = Object.entries(effective).map(([email, state]) => (state.member
    ? { action: 'candidate', email, language: state.language, firstName: state.firstName, lastName: state.lastName }
    : { action: 'suppress', email }));
  const registryByEmail = Object.fromEntries(rows.filter((row) => row.action === 'suppress')
    .map((row) => [row.email, { suppressed: true }]));
  return compareBaselineReadback({ plan: { rows }, contacts, registryByEmail, targetBrevoListId: listId,
    automationsDisabled: true, readbackComplete: true, priorBrevoContacts, languageEnumeration });
}

export function buildDeltaPlan({ members, brevoContacts, base, evidenceByEmail = {}, listId, languageEnumeration, checksumKey }) {
  if (!checksumKey) throw new Error('Checksum key required');
  assertListId(listId);
  const codec = createLanguageCodec(languageEnumeration);
  const brevo = new Map();
  for (const contact of brevoContacts) {
    const email = canonicalEmail(contact.email);
    if (!email) continue;
    if (brevo.has(email)) throw new Error('Duplicate Brevo identity');
    brevo.set(email, contact);
  }
  const { rows: current, invalidIdentity } = currentRows(members, evidenceByEmail);
  const effective = structuredClone(base);
  const rows = [];
  const holdByReason = {};
  const ignored = { nameCleared: 0, invalidIdentity };
  let unchanged = 0;
  for (const email of [...new Set([...Object.keys(base), ...current.keys()])].sort()) {
    const was = base[email];
    const row = current.get(email);
    if (row?.action === 'candidate') {
      if (was?.member) {
        // An emptied Mailchimp name never clears Brevo: the old name stays and is counted.
        if ((!row.firstName && was.firstName) || (!row.lastName && was.lastName)) ignored.nameCleared += 1;
        const next = { member: true, language: row.language, firstName: row.firstName || was.firstName,
          lastName: row.lastName || was.lastName };
        if (next.language === was.language && next.firstName === was.firstName && next.lastName === was.lastName) {
          unchanged += 1;
          continue;
        }
        rows.push({ action: 'update', email, language: next.language, firstName: next.firstName, lastName: next.lastName,
          attributes: attributesOf(next, codec),
          before: { email, language: was.language, firstName: was.firstName, lastName: was.lastName, attributes: attributesOf(was, codec) } });
        effective[email] = next;
      } else if (was) {
        // Lifting a suppression needs explicit policy; until then it is held.
        tally(holdByReason, 'resubscribed_after_suppression');
      } else {
        const contact = brevo.get(email);
        let existingLanguage = null;
        try { existingLanguage = codec.fromValue(contact?.attributes?.LANGUAGE); } catch { existingLanguage = 'invalid'; }
        if (blocked(contact, listId)) {
          rows.push({ action: 'suppress', email, reason: 'brevo_blocked', wasMember: false });
          effective[email] = { member: false };
        } else if (contact?.listUnsubscribed?.length) tally(holdByReason, 'brevo_list_suppression');
        else if (existingLanguage && existingLanguage !== row.language) tally(holdByReason, 'brevo_language_conflict');
        else {
          const next = { member: true, language: row.language, firstName: row.firstName || '', lastName: row.lastName || '' };
          rows.push({ action: 'add', email, language: next.language, firstName: next.firstName, lastName: next.lastName,
            attributes: attributesOf(next, codec), existingContact: Boolean(contact) });
          effective[email] = next;
        }
      }
    } else if (row?.action === 'suppress') {
      if (was && !was.member) { unchanged += 1; continue; }
      rows.push({ action: 'suppress', email, reason: row.reason, wasMember: Boolean(was?.member) });
      effective[email] = { member: false };
    } else if (row?.action === 'quarantine') {
      // A held member keeps its previous Brevo state.
      tally(holdByReason, row.reason);
    } else if (was?.member) {
      // Pending again, archived, transactional or gone from Mailchimp: no longer a subscriber.
      rows.push({ action: 'suppress', email, reason: row?.reason ?? 'missing_from_source', wasMember: true });
      effective[email] = { member: false };
    } else if (was) unchanged += 1;
  }
  const rank = { suppress: 0, update: 1, add: 2 };
  rows.sort((a, b) => rank[a.action] - rank[b.action] || a.email.localeCompare(b.email));
  const of = (action) => rows.filter((row) => row.action === action);
  const counts = { suppress: of('suppress').length, update: of('update').length, add: of('add').length,
    hold: Object.values(holdByReason).reduce((sum, count) => sum + count, 0), unchanged };
  const stateCount = (state) => Object.values(state).reduce((acc, item) => tally(acc, item.member ? 'members' : 'suppressed'), { members: 0, suppressed: 0 });
  const diff = {
    addByLanguage: of('add').reduce((acc, row) => tally(acc, row.language), {}),
    addExistingBrevoContact: of('add').filter((row) => row.existingContact).length,
    updateFields: of('update').reduce((acc, row) => {
      for (const field of ['language', 'firstName', 'lastName']) if (row[field] !== row.before[field]) tally(acc, field);
      return acc;
    }, {}),
    suppressByReason: of('suppress').reduce((acc, row) => tally(acc, row.reason), {}),
    suppressListMembers: of('suppress').filter((row) => row.wasMember).length,
    holdByReason, ignored,
    effectiveBefore: stateCount(base), effectiveAfter: stateCount(effective),
  };
  const rowsChecksum = Object.fromEntries(DELTA_ACTIONS.map((action) => [action, orderedBatchChecksum(of(action), checksumKey)]));
  return { rows, counts, diff, rowsChecksum, effective };
}

// The base must be a fully applied, verified run; otherwise a delta would
// stack on an unknown list state.
export function resolveBase({ record, snapshot, journal, key }) {
  const isDelta = record.kind === 'delta';
  if (snapshot.startedAt !== record.t0 || journal.t0 !== record.t0 || journal.readback?.result?.verified !== true ||
    record.sourceChecksum?.mailchimp !== snapshotDigest(snapshot.members, key)) {
    throw new Error('Base run is not applied and verified');
  }
  const rows = isDelta ? snapshot.plan.rows : snapshot.plan.rows.filter((row) => ['candidate', 'suppress'].includes(row.action));
  for (const row of rows) {
    const entry = row.action === 'suppress' ? journal.suppressions?.[row.email] : journal.records?.[row.email];
    if (entry?.status !== 'applied') throw new Error('Base run is not applied and verified');
  }
  const policy = record.consentPolicy;
  if (!Array.isArray(policy?.acceptedSources) || !policy.acceptedSources.length || typeof policy.notice !== 'string') {
    throw new Error('Base consent policy required');
  }
  const listId = isDelta ? snapshot.listId : Number(journal.listId || record.targetList?.id);
  assertListId(listId);
  return { kind: isDelta ? 'delta' : 'baseline', t0: record.t0, baselineT0: isDelta ? record.baselineT0 : record.t0,
    listId, consentPolicy: policy, effective: isDelta ? snapshot.effective : baselineEffective(snapshot.plan),
    priorBrevoContacts: snapshot.brevoContacts };
}

// Read-only: builds the encrypted snapshot and the address-free run record.
export function prepareDelta({ base, inventory, startedAt, completedAt, key, snapshotPath }) {
  const target = inventory.target;
  if (!target?.exists || target.id !== base.listId) throw new Error('Target list drift');
  const evidenceByEmail = evidenceFromAcceptedSources(inventory.members, base.consentPolicy.acceptedSources, base.consentPolicy.notice);
  const plan = buildDeltaPlan({ members: inventory.members, brevoContacts: inventory.contacts, base: base.effective,
    evidenceByEmail, listId: base.listId, languageEnumeration: inventory.languageEnumeration, checksumKey: key });
  const destination = compareEffective({ effective: base.effective, contacts: inventory.contacts, listId: base.listId,
    languageEnumeration: inventory.languageEnumeration, priorBrevoContacts: base.priorBrevoContacts });
  const snapshot = { startedAt, completedAt, baselineT0: base.baselineT0, base: { kind: base.kind, t0: base.t0 },
    listId: base.listId, members: inventory.members, brevoContacts: inventory.contacts,
    plan: { rows: plan.rows, counts: plan.counts, diff: plan.diff }, effective: plan.effective };
  const record = { kind: 'delta', t0: startedAt, baselineT0: base.baselineT0, base: { kind: base.kind, t0: base.t0 },
    consentPolicy: base.consentPolicy, targetList: { name: target.name, id: target.id },
    counts: plan.counts, diff: plan.diff, rowsChecksum: plan.rowsChecksum,
    destination: { verified: destination.verified, issues: destination.issues },
    sourceChecksum: { mailchimp: snapshotDigest(inventory.members, key), brevo: snapshotDigest(inventory.contacts, key) },
    scannedMailchimp: inventory.members.length, scannedBrevo: inventory.contacts.length, snapshotPath };
  return { snapshot, record };
}

export function validateDeltaApproval({ run, snapshot, approval, key }) {
  if (run.kind !== 'delta' || run.t0 !== snapshot.startedAt || run.snapshotPath !== approval.snapshotPath ||
    approval.t0 !== run.t0 || approval.baselineT0 !== run.baselineT0 || snapshot.baselineT0 !== run.baselineT0 ||
    digest(snapshot.base) !== digest(run.base) || approval.runSha256 !== digest(run) || approval.approvedBy !== 'Jaap' ||
    !Number.isFinite(Date.parse(approval.approvedAt)) || Date.parse(approval.approvedAt) < Date.parse(run.t0) ||
    digest(run.diff) !== digest(snapshot.plan.diff) || digest(run.counts) !== digest(snapshot.plan.counts) ||
    run.targetList?.id !== snapshot.listId || run.destination?.verified !== true ||
    run.sourceChecksum.mailchimp !== snapshotDigest(snapshot.members, key) ||
    run.sourceChecksum.brevo !== snapshotDigest(snapshot.brevoContacts, key)) {
    throw new Error('Approved delta dry-run does not match source export');
  }
  if (snapshot.plan.rows.some((row) => !DELTA_ACTIONS.includes(row.action)) || DELTA_ACTIONS.some((action) =>
    orderedBatchChecksum(snapshot.plan.rows.filter((row) => row.action === action), key) !== run.rowsChecksum?.[action])) {
    throw new Error('Approved delta rows do not match checksum');
  }
}

export async function executeDelta({ snapshot, run, approval, key, journal, provider, save, apply = false,
  automationEvidence, now = () => new Date().toISOString() }) {
  validateDeltaApproval({ run, snapshot, approval, key });
  assertAutomationEvidence(automationEvidence, approval.approvedAt);
  assertProviderFlagsUnset();
  if (journal.t0 && journal.t0 !== run.t0) throw new Error('Journal belongs to another dry-run');
  journal.t0 = run.t0;
  journal.kind = 'delta';
  journal.records ||= {};
  journal.suppressions ||= {};
  const first = await provider.inventory();
  const second = await provider.inventory();
  if (digest(first) !== digest(second)) throw new Error('Provider changed during inventory');
  checkSourceDrift(snapshot, second, run, key, journal);
  const listId = snapshot.listId;
  const target = provider.resolveTarget(second.lists);
  if (!target.exists || target.id !== listId || TEST_LISTS.includes(listId)) throw new Error('Target list drift');
  const codec = createLanguageCodec(second.languageEnumeration);
  const rows = snapshot.plan.rows;
  for (const row of rows.filter((item) => item.action !== 'suppress')) {
    if (Number(row.attributes.LANGUAGE) !== codec.toValue(row.language)) throw new Error('Brevo LANGUAGE enumeration drift');
  }
  if (!apply) return { ready: true, t0: run.t0, baselineT0: run.baselineT0, targetListId: listId, counts: run.counts, writes: 0 };
  const prior = byEmail(snapshot.brevoContacts);
  let writes = 0;
  // Every suppression is durable before the first update or add.
  for (const row of rows.filter((item) => item.action === 'suppress')) {
    const entry = journal.suppressions[row.email];
    if (entry && entry.checksum !== digest(row)) throw new Error('Suppression journal checksum drift');
    if (!entry) {
      journal.suppressions[row.email] = { reason: row.reason, checksum: digest(row), status: 'recorded', recordedAt: now() };
      await save(journal);
    }
    const current = await provider.contact(row.email);
    if (current?.listIds?.includes(listId)) {
      // Unlinking is idempotent, so an uncertain outcome may be retried.
      journal.suppressions[row.email].status = 'intent';
      await save(journal);
      await provider.removeFromList(row.email, listId);
      writes += 1;
      const after = await provider.contact(row.email);
      if (after?.listIds?.includes(listId)) throw new Error('Suppression read-back failed');
    }
    journal.suppressions[row.email] = { ...journal.suppressions[row.email], status: 'applied', appliedAt: now() };
    await save(journal);
  }
  for (const row of rows.filter((item) => item.action !== 'suppress')) {
    const existing = journal.records[row.email];
    if (existing && existing.checksum !== digest(row)) throw new Error('Journal row checksum drift');
    const current = await provider.contact(row.email);
    if (existing?.status === 'applied') {
      if (!rowMatches(row, current, listId)) throw new Error('Applied contact changed; manual reconciliation required');
      continue;
    }
    if (existing?.status === 'intent' && rowMatches(row, current, listId)) {
      journal.records[row.email] = { ...existing, status: 'applied', providerReference: current.id ?? null, appliedAt: now() };
      delete journal.records[row.email].lastError;
      await save(journal);
      continue;
    }
    if (!sameContactState(current, prior.get(row.email))) {
      throw new Error(existing ? 'Uncertain provider outcome; manual reconciliation required'
        : 'Brevo contact changed after inventory; new dry-run and approval required');
    }
    if (row.action === 'update' && !rowMatches(row.before, current, listId)) {
      throw new Error('Brevo contact no longer matches base; manual reconciliation required');
    }
    const payload = row.action === 'update' ? { attributes: row.attributes } : safeCandidatePayload(row, current, listId);
    journal.records[row.email] = { action: row.action, status: 'intent', checksum: digest(row), intendedAt: now() };
    await save(journal);
    try {
      await provider.upsert(row.email, payload, Boolean(current));
    } catch {
      journal.records[row.email].lastError = 'provider_outcome_unknown';
      await save(journal);
      throw new Error('Provider outcome unknown; read-back required before retry');
    }
    writes += 1;
    const after = await provider.contact(row.email);
    if (!rowMatches(row, after, listId)) {
      journal.records[row.email].lastError = 'readback_mismatch';
      await save(journal);
      throw new Error('Provider read-back mismatch');
    }
    journal.records[row.email] = { ...journal.records[row.email], status: 'applied', providerReference: after.id ?? null, appliedAt: now() };
    delete journal.records[row.email].lastError;
    await save(journal);
  }
  const latest = await provider.inventory();
  const readback = compareEffective({ effective: snapshot.effective, contacts: latest.contacts, listId,
    languageEnumeration: latest.languageEnumeration, priorBrevoContacts: snapshot.brevoContacts });
  if (!readback.verified) throw new Error(`Full read-back failed: ${JSON.stringify(readback.issues)}`);
  const step = Math.max(1, Math.floor(rows.length / 10));
  const sample = rows.filter((_, index) => index % step === 0).slice(0, 10);
  for (const row of sample) {
    const contact = await provider.contact(row.email);
    if (row.action === 'suppress' ? contact?.listIds?.includes(listId) : !rowMatches(row, contact, listId)) {
      throw new Error('Sample read-back failed');
    }
  }
  journal.readback = { checkedAt: now(), result: readback, sampleCount: sample.length, eventLogVerified: false };
  await save(journal);
  return { t0: run.t0, baselineT0: run.baselineT0, targetListId: listId, writes, readback, sampleCount: sample.length,
    releaseBlocked: RELEASE_BLOCKED };
}

// Full-window, fully paginated proof that the delta caused no mail. Only
// aggregates leave this function; `addresses` are the delta rows.
export async function eventLogProof({ request, addresses, since, until, pageSize = 500 }) {
  const start = Date.parse(since);
  const end = Date.parse(until);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new Error('Valid event-log window required');
  const day = (ms) => new Date(ms).toISOString().slice(0, 10);
  const smtp = { pages: 0, read: 0, inWindow: 0, deltaAddressesInWindow: 0, byEvent: {} };
  for (let offset = 0; ; offset += pageSize) {
    const data = await request('GET', `/smtp/statistics/events?limit=${pageSize}&offset=${offset}` +
      `&startDate=${day(start)}&endDate=${day(end)}&sort=desc`);
    const events = data?.events ?? [];
    if (!Array.isArray(events)) throw new Error('Provider pagination shape changed');
    smtp.pages += 1;
    smtp.read += events.length;
    for (const event of events) {
      const at = Date.parse(event.date);
      if (!Number.isFinite(at)) throw new Error('Provider pagination shape changed');
      if (at < start || at > end) continue;
      smtp.inWindow += 1;
      tally(smtp.byEvent, String(event.event ?? 'unknown'));
      if (addresses.has(canonicalEmail(event.email))) smtp.deltaAddressesInWindow += 1;
    }
    if (events.length < pageSize) break;
  }
  const marketing = { read: 0, sentInWindow: 0, active: 0 };
  for (let offset = 0, total = null; total === null || offset < total;) {
    const data = await request('GET', `/emailCampaigns?limit=100&offset=${offset}`);
    const campaigns = data?.campaigns ?? [];
    if (!Array.isArray(campaigns) || !Number.isInteger(data?.count ?? 0)) throw new Error('Provider pagination shape changed');
    total = data?.count ?? 0;
    marketing.read += campaigns.length;
    offset += campaigns.length;
    for (const campaign of campaigns) {
      const sentAt = Date.parse(campaign.sentDate);
      if (Number.isFinite(sentAt) && sentAt >= start && sentAt <= end) marketing.sentInWindow += 1;
      if (['queued', 'in_process', 'inProcess'].includes(campaign.status)) marketing.active += 1;
    }
    if (!campaigns.length) break;
  }
  return { since, until, smtp, marketing,
    verified: smtp.deltaAddressesInWindow === 0 && marketing.sentInWindow === 0 && marketing.active === 0 };
}

// Read-only go/no-go for the day before the delta. Blockers stop the delta;
// warnings are for Jaap to weigh.
export function assessGoNoGo({ record, automationEvidence, maxAgeDays = 3, now = new Date().toISOString(), rblOpen = true, lists = [] }) {
  const blockers = [];
  const warnings = [];
  if (record.destination?.verified !== true) blockers.push('Brevo list differs from the last applied run');
  try {
    assertAutomationEvidence(automationEvidence, new Date(Date.parse(now) - maxAgeDays * 86400000).toISOString());
  } catch { blockers.push(`Automation evidence missing or older than ${maxAgeDays} days`); }
  try { assertProviderFlagsUnset(); } catch { blockers.push('Provider or writer route already switched'); }
  if (record.counts.hold) warnings.push(`${record.counts.hold} addresses held (see holdByReason)`);
  if (record.diff.ignored?.nameCleared) warnings.push(`${record.diff.ignored.nameCleared} emptied names kept in Brevo`);
  if (rblOpen) warnings.push('TODO #6 open: delivery to mailbox.org via Brevo not yet proven');
  const list = lists.find((item) => Number(item.id) === record.targetList.id);
  return { go: blockers.length === 0, blockers, warnings, checkedAt: now,
    list: { id: record.targetList.id, name: list?.name ?? null, subscribers: list?.uniqueSubscribers ?? list?.totalSubscribers ?? null },
    counts: record.counts, diff: record.diff, destination: record.destination };
}
