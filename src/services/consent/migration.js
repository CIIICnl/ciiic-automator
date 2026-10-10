import crypto from 'node:crypto';
import { BREVO_LANGUAGE_ATTRIBUTE, createLanguageCodec } from './brevo-language.js';

export const CIIIC_LIST_ID = '67fe159b9d';
export const LANGUAGE_INTERESTS = Object.freeze({ nl: 'ed25c3d4cc', en: 'd32b374b91' });
const NON_ACTIVE = new Set(['unsubscribed', 'cleaned']);
const EXCLUDED = new Set(['pending', 'archived', 'transactional', 'deleted']);

export function canonicalEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function languageFromInterests(interests = {}) {
  const nl = interests[LANGUAGE_INTERESTS.nl] === true;
  const en = interests[LANGUAGE_INTERESTS.en] === true;
  if (nl && en) return { language: null, reason: 'both_language_interests' };
  return { language: en ? 'en' : 'nl', source: en || nl ? 'mailchimp-group' : 'default-nl' };
}

// A source timestamp is useful history, but cannot by itself prove permission.
export function validConsentEvidence(evidence) {
  return Boolean(evidence && evidence.granted === true &&
    typeof evidence.source === 'string' && evidence.source.trim() &&
    typeof evidence.notice === 'string' && evidence.notice.trim() &&
    Number.isFinite(Date.parse(evidence.recordedAt)));
}

// Mailchimp FNAME/LNAME map onto Brevo FIRSTNAME/LASTNAME (hubplan § 2).
// Without FIRSTNAME the newsletter greets with "Beste lezer,".
function nameField(member, key) {
  const value = member.merge_fields?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function classifyMember(member, evidence) {
  const email = canonicalEmail(member.email_address);
  const status = String(member.status ?? '').toLowerCase();
  if (!email) return { action: 'quarantine', reason: 'invalid_identity' };
  if (member.list_id && member.list_id !== CIIIC_LIST_ID) return { action: 'exclude', reason: 'different_audience', email };
  if (EXCLUDED.has(status)) return { action: 'exclude', reason: status, email };
  if (NON_ACTIVE.has(status)) return { action: 'suppress', reason: status, email };
  const lang = languageFromInterests(member.interests);
  if (lang.reason) return { action: 'quarantine', reason: lang.reason, email };
  if (status !== 'subscribed') return { action: 'quarantine', reason: 'unknown_status', email };
  if (!validConsentEvidence(evidence)) return { action: 'quarantine', reason: 'unproven_consent', email };
  return { action: 'candidate', email, language: lang.language, languageSource: lang.source,
    firstName: nameField(member, 'FNAME'), lastName: nameField(member, 'LNAME'),
    consentEvidence: evidence, sourceStatus: status,
    provenance: { listId: CIIIC_LIST_ID, memberId: member.id, source: member.source,
      timestampSignup: member.timestamp_signup, timestampOpt: member.timestamp_opt,
      lastChanged: member.last_changed, mergeFields: member.merge_fields,
      interests: member.interests, tags: member.tags } };
}

function checksum(records, key) {
  const hmac = crypto.createHmac('sha256', key);
  for (const record of records) hmac.update(JSON.stringify(record)).update('\n');
  return hmac.digest('hex');
}

// Brevo contacts carry LANGUAGE as an enumeration number; the caller passes
// the live enumeration (GET /v3/contacts/attributes) so the plan can decode it.
export function buildMigrationPlan({ members, brevoContacts = [], evidenceByEmail = {}, checksumKey, batchSize = 100,
  targetBrevoListId = null, languageEnumeration = null }) {
  if (!checksumKey || !Number.isInteger(batchSize) || batchSize < 1) throw new Error('Checksum key and positive batch size required');
  const languageCodec = languageEnumeration ? createLanguageCodec(languageEnumeration) : null;
  const existingLanguageOf = (contact) => {
    const raw = contact?.attributes?.[BREVO_LANGUAGE_ATTRIBUTE];
    if (raw === undefined || raw === null || String(raw).trim() === '') return null;
    if (!languageCodec) throw new Error('Brevo LANGUAGE enumeration required to read existing contacts');
    try { return languageCodec.fromValue(raw); } catch { return 'invalid'; }
  };
  if (targetBrevoListId !== null && (!Number.isSafeInteger(Number(targetBrevoListId)) || Number(targetBrevoListId) <= 0 ||
    [2, 3].includes(Number(targetBrevoListId)))) throw new Error('Dedicated Brevo CIIIC list ID required');
  const seen = new Map();
  const suppressedIdentities = new Set();
  for (const member of members) {
    const email = canonicalEmail(member.email_address);
    if (!email) continue;
    seen.set(email, (seen.get(email) || 0) + 1);
    if ((!member.list_id || member.list_id === CIIIC_LIST_ID) && NON_ACTIVE.has(String(member.status).toLowerCase())) suppressedIdentities.add(email);
  }
  const blocked = new Set(brevoContacts.filter((contact) => contact.emailBlacklisted ||
    (targetBrevoListId && contact.listUnsubscribed?.includes(Number(targetBrevoListId))))
    .map((contact) => canonicalEmail(contact.email)).filter(Boolean));
  const brevoByEmail = new Map();
  for (const contact of brevoContacts) {
    const email = canonicalEmail(contact.email);
    if (!email) continue;
    const items = brevoByEmail.get(email) || [];
    items.push(contact);
    brevoByEmail.set(email, items);
  }
  const rows = members.map((member) => {
    const email = canonicalEmail(member.email_address);
    const row = classifyMember(member, evidenceByEmail[email]);
    if (email && suppressedIdentities.has(email) && row.action === 'candidate') return { action: 'suppress', reason: 'duplicate_with_suppression', email };
    if (email && seen.get(email) > 1 && row.action !== 'suppress') return { action: 'quarantine', reason: 'duplicate_identity', email };
    if (email && blocked.has(email) && row.action === 'candidate') return { action: 'suppress', reason: 'brevo_blocked', email };
    const existing = brevoByEmail.get(email) || [];
    if (row.action === 'candidate' && !targetBrevoListId && existing.some((item) => item.listUnsubscribed?.length)) {
      return { action: 'quarantine', reason: 'unresolved_brevo_list_suppression', email };
    }
    if (row.action === 'candidate' && existing.length > 1) return { action: 'quarantine', reason: 'duplicate_brevo_identity', email };
    const existingLanguage = row.action === 'candidate' ? existingLanguageOf(existing[0]) : null;
    if (row.action === 'candidate' && existingLanguage && existingLanguage !== row.language) {
      return { action: 'quarantine', reason: 'brevo_language_conflict', email };
    }
    return row;
  });
  if (languageCodec) {
    for (const row of rows) {
      if (row.action !== 'candidate') continue;
      row.attributes = { FIRSTNAME: row.firstName, LASTNAME: row.lastName,
        [BREVO_LANGUAGE_ATTRIBUTE]: languageCodec.toValue(row.language) };
    }
  }
  const rank = { suppress: 0, candidate: 1, quarantine: 2, exclude: 3 };
  rows.sort((a, b) => rank[a.action] - rank[b.action] || String(a.email ?? '').localeCompare(String(b.email ?? '')) || String(a.reason ?? '').localeCompare(String(b.reason ?? '')));
  const counts = { candidate: 0, suppress: 0, quarantine: 0, exclude: 0, reasons: {} };
  for (const row of rows) {
    counts[row.action] += 1;
    if (row.reason) counts.reasons[row.reason] = (counts.reasons[row.reason] || 0) + 1;
  }
  const batches = [];
  for (const action of ['suppress', 'candidate']) {
    const actionRows = rows.filter((row) => row.action === action);
    for (let i = 0; i < actionRows.length; i += batchSize) {
      const slice = actionRows.slice(i, i + batchSize);
      batches.push({ order: batches.length + 1, action, count: slice.length,
        checksum: checksum(slice, checksumKey), status: 'planned_only' });
    }
  }
  return { rows, counts, batches, diff: migrationDiff({ rows, members, brevoByEmail }), gate: {
    providerImportExecutable: false, automationsMustBeDisabled: true,
    readbackRequired: ['membership', BREVO_LANGUAGE_ATTRIBUTE, 'suppressions'],
    partialBatchBlocksCutover: true,
  } };
}

// Aggregates only: what an approved import would change in Brevo. Mailchimp
// `source` values are provider enums ("Hosted Signup Form", "API - Generic"),
// not personal data.
function migrationDiff({ rows, members, brevoByEmail }) {
  const candidates = rows.filter((row) => row.action === 'candidate');
  const tally = (items, keyOf) => items.reduce((acc, item) => {
    const key = keyOf(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const existing = candidates.filter((row) => brevoByEmail.has(row.email));
  return {
    candidatesByLanguage: tally(candidates, (row) => row.language),
    candidatesByLanguageSource: tally(candidates, (row) => row.languageSource),
    candidatesWithoutFirstName: candidates.filter((row) => !row.firstName).length,
    newBrevoContacts: candidates.length - existing.length,
    existingBrevoContacts: existing.length,
    existingFirstNameDiffers: existing.filter((row) => {
      const current = brevoByEmail.get(row.email)[0]?.attributes?.FIRSTNAME;
      return row.firstName && typeof current === 'string' && current.trim() && current.trim() !== row.firstName;
    }).length,
    suppressionsByReason: tally(rows.filter((row) => row.action === 'suppress'), (row) => row.reason),
    consentBasis: consentBasis(members),
  };
}

// Per Mailchimp source: how many CIIIC subscribers there are and how many
// carry an opt-in timestamp or opt-in IP. This is the table Jaap decides on;
// it never grants consent by itself.
export function consentBasis(members) {
  const basis = {};
  for (const member of members) {
    if (member.list_id && member.list_id !== CIIIC_LIST_ID) continue;
    if (String(member.status ?? '').toLowerCase() !== 'subscribed') continue;
    const source = typeof member.source === 'string' && member.source.trim() ? member.source.trim() : '(geen source)';
    const entry = basis[source] || (basis[source] = { subscribed: 0, withTimestampOpt: 0, withIpOpt: 0 });
    entry.subscribed += 1;
    if (Number.isFinite(Date.parse(member.timestamp_opt))) entry.withTimestampOpt += 1;
    if (typeof member.ip_opt === 'string' && member.ip_opt.trim()) entry.withIpOpt += 1;
  }
  return basis;
}

// Builds consent evidence for subscribed CIIIC members whose Mailchimp source
// Jaap accepted as a sufficient basis. `notice` names that decision (who, when,
// on which dry-run); members without an opt-in timestamp stay unproven.
export function evidenceFromAcceptedSources(members, acceptedSources, notice) {
  const accepted = new Set(acceptedSources.map((source) => source.trim()).filter(Boolean));
  if (!accepted.size || typeof notice !== 'string' || !notice.trim()) {
    throw new Error('Accepted sources and a policy notice required');
  }
  const evidence = {};
  for (const member of members) {
    const email = canonicalEmail(member.email_address);
    if (!email || (member.list_id && member.list_id !== CIIIC_LIST_ID)) continue;
    if (String(member.status ?? '').toLowerCase() !== 'subscribed') continue;
    const source = typeof member.source === 'string' && member.source.trim() ? member.source.trim() : '(geen source)';
    if (!accepted.has(source) || !Number.isFinite(Date.parse(member.timestamp_opt))) continue;
    evidence[email] = { granted: true, source: `mailchimp:${source}`, notice: notice.trim(),
      recordedAt: member.timestamp_opt };
  }
  return evidence;
}

export function publicMigrationSummary(plan) {
  return { counts: plan.counts, batches: plan.batches, diff: plan.diff, gate: plan.gate };
}

// Used after a separately authorized baseline import. It only compares a full
// provider readback and the local suppression registry; it cannot import data.
export function compareBaselineReadback({ plan, contacts, registryByEmail, targetBrevoListId,
  automationsDisabled, readbackComplete, priorBrevoContacts = [], languageEnumeration }) {
  const languageCodec = createLanguageCodec(languageEnumeration);
  const languageOf = (contact) => {
    try { return languageCodec.fromValue(contact?.attributes?.[BREVO_LANGUAGE_ATTRIBUTE]); } catch { return null; }
  };
  if (!Number.isSafeInteger(Number(targetBrevoListId)) || Number(targetBrevoListId) <= 0 ||
    [2, 3].includes(Number(targetBrevoListId)) || !automationsDisabled || !readbackComplete) {
    throw new Error('Readback requires target list, disabled automations and complete scan');
  }
  const expected = new Map(plan.rows.filter((row) => row.action === 'candidate').map((row) => [row.email, row]));
  const suppressed = new Set(plan.rows.filter((row) => row.action === 'suppress').map((row) => row.email));
  const actual = new Map(contacts.map((contact) => [canonicalEmail(contact.email), contact]));
  const issues = { missingMembership: 0, extraMembership: 0, languageMismatch: 0,
    missingSuppression: 0, duplicateProviderIdentity: 0, unexpectedSuppression: 0,
    lostExistingBlock: 0 };
  const seen = new Set();
  for (const contact of contacts) {
    const email = canonicalEmail(contact.email);
    if (!email) continue;
    if (seen.has(email)) issues.duplicateProviderIdentity += 1;
    seen.add(email);
    if (contact.listIds?.includes(Number(targetBrevoListId)) && !expected.has(email)) issues.extraMembership += 1;
  }
  for (const [email, row] of expected) {
    const contact = actual.get(email);
    if (!contact?.listIds?.includes(Number(targetBrevoListId))) issues.missingMembership += 1;
    if (languageOf(contact) !== row.language) issues.languageMismatch += 1;
    if (contact?.emailBlacklisted || contact?.listUnsubscribed?.includes(Number(targetBrevoListId))) {
      issues.unexpectedSuppression += 1;
    }
  }
  for (const email of suppressed) {
    if (!registryByEmail[email]?.suppressed) issues.missingSuppression += 1;
  }
  for (const prior of priorBrevoContacts) {
    if (!prior.emailBlacklisted && !prior.listUnsubscribed?.includes(Number(targetBrevoListId))) continue;
    const now = actual.get(canonicalEmail(prior.email));
    if (now && ((prior.emailBlacklisted && !now.emailBlacklisted) ||
      (prior.listUnsubscribed?.includes(Number(targetBrevoListId)) &&
       !now.listUnsubscribed?.includes(Number(targetBrevoListId))))) issues.lostExistingBlock += 1;
  }
  return { verified: Object.values(issues).every((count) => count === 0), issues,
    expectedMembership: expected.size, expectedSuppressions: suppressed.size };
}

export function changesSinceT0(events, t0) {
  const start = Date.parse(t0);
  if (!Number.isFinite(start)) throw new Error('Valid T0 required');
  const receivedTime = (event) => typeof event.receivedAt === 'number' ? event.receivedAt : Date.parse(event.receivedAt);
  for (const event of events) {
    if (!Number.isFinite(receivedTime(event))) throw new Error('Event receivedAt required for rollback delta');
  }
  return events.filter((event) => receivedTime(event) >= start)
    .sort((a, b) => receivedTime(a) - receivedTime(b) || String(a.id).localeCompare(String(b.id)));
}

export async function rollbackDelta(store, t0) {
  if (!store?.listEventsSince) throw new Error('Durable event journal required');
  return changesSinceT0(await store.listEventsSince(t0), t0);
}
