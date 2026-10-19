import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { canonicalEmail, compareBaselineReadback } from './migration.js';
import { createLanguageCodec } from './brevo-language.js';

const digest = (value) => crypto.createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
const byEmail = (contacts) => new Map(contacts.map((contact) => [canonicalEmail(contact.email), contact]));
const blocked = (contact, listId) => Boolean(contact?.emailBlacklisted || contact?.listUnsubscribed?.includes(listId));

export function validateApproval({ run, snapshot, approval, key }) {
  if (run.t0 !== snapshot.startedAt || run.snapshotPath !== approval.snapshotPath ||
    approval.t0 !== run.t0 || approval.runSha256 !== digest(run) ||
    approval.approvedBy !== 'Jaap' || !Number.isFinite(Date.parse(approval.approvedAt)) ||
    Date.parse(approval.approvedAt) < Date.parse(run.t0) ||
    digest(run.diff) !== digest(snapshot.plan.diff) ||
    run.sourceChecksum.mailchimp !== snapshotDigest(snapshot.members, key) ||
    run.sourceChecksum.brevo !== snapshotDigest(snapshot.brevoContacts, key) ||
    run.counts.candidate !== snapshot.plan.counts.candidate ||
    run.counts.suppress !== snapshot.plan.counts.suppress ||
    digest(run.batches) !== digest(snapshot.plan.batches) ||
    snapshot.plan.counts.quarantine !== 0) throw new Error('Approved dry-run does not match source export');
}

// Same order-independent HMAC used by preflight, kept here so the workflow is
// testable without importing the command-line module.
export function snapshotDigest(records, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  for (const row of records.map((item) => JSON.stringify(item)).sort()) hmac.update(row).update('\n');
  return hmac.digest('hex');
}

export function checkSourceDrift(snapshot, current, run, key, journal) {
  if (snapshotDigest(current.members, key) !== run.sourceChecksum.mailchimp) throw new Error('Mailchimp source drift; new dry-run and approval required');
  const initial = byEmail(snapshot.brevoContacts);
  const now = byEmail(current.contacts);
  if (now.size !== current.contacts.length || initial.size !== snapshot.brevoContacts.length) throw new Error('Duplicate Brevo identity');
  for (const [email, contact] of now) {
    if (journal.records[email]?.status === 'applied' || journal.records[email]?.status === 'intent' ||
      journal.suppressions[email]?.status === 'applied' || journal.suppressions[email]?.status === 'intent') continue;
    if (digest(contact) !== digest(initial.get(email))) throw new Error('Brevo destination drift; new dry-run and approval required');
  }
  for (const [email] of initial) {
    if (!now.has(email)) throw new Error('Brevo destination drift; new dry-run and approval required');
  }
}

export function rowMatches(row, contact, listId) {
  return Boolean(contact?.listIds?.includes(listId) && !blocked(contact, listId) &&
    Number(contact?.attributes?.LANGUAGE) === Number(row.attributes.LANGUAGE) &&
    (!row.firstName || contact?.attributes?.FIRSTNAME === row.firstName) &&
    (!row.lastName || contact?.attributes?.LASTNAME === row.lastName));
}

export function safeCandidatePayload(row, current, listId) {
  if (blocked(current, listId) || current?.listUnsubscribed?.length) throw new Error('Existing Brevo suppression blocks candidate');
  const attributes = { LANGUAGE: row.attributes.LANGUAGE };
  if (row.firstName) attributes.FIRSTNAME = row.firstName;
  if (row.lastName) attributes.LASTNAME = row.lastName;
  return current ? { attributes, listIds: [listId] } : { email: row.email, attributes, listIds: [listId], updateEnabled: false };
}

function rowDigest(row) { return digest(row); }

export async function executeBaseline({ snapshot, run, approval, key, journal, provider, save, apply = false,
  automationEvidence, now = () => new Date().toISOString() }) {
  validateApproval({ run, snapshot, approval, key });
  if (!automationEvidence?.checkedBy || !automationEvidence?.checkedAt ||
    automationEvidence?.listName !== 'CIIIC nieuwsbrief' ||
    automationEvidence?.confirmationDisabled !== true || automationEvidence?.welcomeDisabled !== true ||
    automationEvidence?.marketingDisabled !== true || automationEvidence?.scope !== 'account-and-list' ||
    !Number.isFinite(Date.parse(automationEvidence.checkedAt)) ||
    Date.parse(automationEvidence.checkedAt) < Date.parse(approval.approvedAt)) {
    throw new Error('Current account and list automation evidence required');
  }
  if (process.env.CIIIC_MARKETING_PROVIDER === 'brevo' || process.env.CIIIC_CONSENT_ROUTE === 'enabled') {
    throw new Error('Provider or writer route already switched');
  }
  if (journal.t0 && journal.t0 !== run.t0) throw new Error('Journal belongs to another dry-run');
  journal.t0 = run.t0;
  journal.records ||= {};
  journal.suppressions ||= {};
  const first = await provider.inventory();
  const second = await provider.inventory();
  if (digest(first) !== digest(second)) throw new Error('Provider changed during inventory');
  checkSourceDrift(snapshot, second, run, key, journal);
  const target = provider.resolveTarget(second.lists);
  const languageCodec = createLanguageCodec(second.languageEnumeration);
  for (const row of snapshot.plan.rows.filter((item) => item.action === 'candidate')) {
    if (Number(row.attributes?.LANGUAGE) !== languageCodec.toValue(row.language)) {
      throw new Error('Brevo LANGUAGE enumeration drift');
    }
  }
  if (run.targetList.exists && target.id !== run.targetList.id) throw new Error('Target list drift');
  if (!run.targetList.exists && target.exists && journal.listId !== target.id) throw new Error('Unapproved target list appeared');
  let listId = journal.listId || target.id;
  if (listId && [2, 3].includes(listId)) throw new Error('Test list selected');
  if (listId) {
    const planned = new Set(snapshot.plan.rows.filter((row) => ['candidate', 'suppress'].includes(row.action))
      .map((row) => row.email));
    if (second.contacts.some((contact) => contact.listIds?.includes(listId) && !planned.has(canonicalEmail(contact.email)))) {
      throw new Error('Unplanned target list membership');
    }
  }
  if (!apply) return { ready: true, t0: run.t0, targetListId: listId, candidates: run.counts.candidate,
    suppressions: run.counts.suppress, writes: 0 };
  if (!listId) {
    // List creation is intentionally after all gates and double inventory.
    listId = await provider.createList('CIIIC nieuwsbrief');
    if (!Number.isSafeInteger(listId) || [2, 3].includes(listId)) throw new Error('Unsafe list ID');
    journal.listId = listId;
    await save(journal);
  }
  // Every suppression is durable before the first candidate mutation.
  const suppressionRows = snapshot.plan.rows.filter((item) => item.action === 'suppress');
  let suppressionIndex = 0;
  for (const batch of snapshot.plan.batches.filter((item) => item.action === 'suppress')) {
    for (const row of suppressionRows.slice(suppressionIndex, suppressionIndex + batch.count)) {
      if (journal.suppressions[row.email] && journal.suppressions[row.email].sourceChecksum !== rowDigest(row)) {
        throw new Error('Suppression journal checksum drift');
      }
      if (!journal.suppressions[row.email]) {
        journal.suppressions[row.email] = { reason: row.reason, sourceChecksum: rowDigest(row),
          batchId: batch.order, batchChecksum: batch.checksum, status: 'recorded', recordedAt: now() };
        await save(journal);
      }
      const current = await provider.contact(row.email);
      if (current?.listIds?.includes(listId)) {
        journal.suppressions[row.email].status = 'intent';
        await save(journal);
        await provider.removeFromList(row.email, listId);
        const after = await provider.contact(row.email);
        if (after?.listIds?.includes(listId)) throw new Error('Suppression read-back failed');
      }
      journal.suppressions[row.email].status = 'applied';
      await save(journal);
    }
    suppressionIndex += batch.count;
  }
  const prior = byEmail(snapshot.brevoContacts);
  let writes = 0;
  const candidateRows = snapshot.plan.rows.filter((item) => item.action === 'candidate');
  let offset = 0;
  for (const batch of snapshot.plan.batches.filter((item) => item.action === 'candidate')) {
    const selected = candidateRows.slice(offset, offset + batch.count);
    offset += batch.count;
    for (const row of selected) {
      const existing = journal.records[row.email];
      if (existing && existing.checksum !== rowDigest(row)) throw new Error('Journal row checksum drift');
      const current = await provider.contact(row.email);
      if (existing?.status === 'applied') {
        if (!rowMatches(row, current, listId)) throw new Error('Applied contact changed; manual reconciliation required');
        continue;
      }
      if (existing?.status === 'intent') {
        if (rowMatches(row, current, listId)) {
          journal.records[row.email] = { ...existing, status: 'applied', providerReference: current.id ?? null, appliedAt: now() };
          delete journal.records[row.email].lastError;
          await save(journal);
          continue;
        }
        if (digest(current) !== digest(prior.get(row.email))) throw new Error('Uncertain provider outcome; manual reconciliation required');
      }
      const payload = safeCandidatePayload(row, current, listId);
      journal.records[row.email] = { status: 'intent', checksum: rowDigest(row), batchId: batch.order,
        batchChecksum: batch.checksum, intendedAt: now() };
      await save(journal);
      // Any transport failure leaves intent. The next run reads the contact
      // before deciding whether a retry is safe.
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
  }
  const latest = await provider.inventory();
  const registryByEmail = Object.fromEntries(Object.keys(journal.suppressions).map((email) => [email, { suppressed: true }]));
  const readback = compareBaselineReadback({ plan: snapshot.plan, contacts: latest.contacts, registryByEmail,
    targetBrevoListId: listId, automationsDisabled: true, readbackComplete: true,
    priorBrevoContacts: snapshot.brevoContacts, languageEnumeration: latest.languageEnumeration });
  if (!readback.verified) throw new Error(`Full read-back failed: ${JSON.stringify(readback.issues)}`);
  const candidates = snapshot.plan.rows.filter((row) => row.action === 'candidate');
  const sample = candidates.filter((_, index) => index % Math.max(1, Math.floor(candidates.length / 10)) === 0).slice(0, 10);
  for (const row of sample) if (!rowMatches(row, await provider.contact(row.email), listId)) throw new Error('Sample read-back failed');
  journal.readback = { checkedAt: now(), result: readback, sampleCount: sample.length, eventLogVerified: false };
  await save(journal);
  return { t0: run.t0, targetListId: listId, writes, readback, sampleCount: sample.length,
    releaseBlocked: 'SMTP and marketing event logs require full-window proof' };
}

export async function readEncrypted(file, key) {
  const payload = JSON.parse(await fs.readFile(file, 'utf8'));
  if (payload.format !== 'aes-256-gcm-v1') throw new Error('Unsupported encrypted file');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, 'base64')), decipher.final()]).toString());
}

export async function writeEncrypted(file, value, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ format: 'aes-256-gcm-v1', iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') }), { mode: 0o600, flag: 'wx' });
  await fs.rename(tmp, file);
  await fs.chmod(file, 0o600);
}

export async function withLock(directory, callback) {
  const lock = path.join(directory, 'baseline-import.lock');
  const handle = await fs.open(lock, 'wx', 0o600);
  try { return await callback(); } finally { await handle.close(); await fs.unlink(lock); }
}
