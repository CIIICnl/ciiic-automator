#!/usr/bin/env node
// Read-only source inventory. No provider mutation endpoint is reachable here.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildMigrationPlan, CIIIC_LIST_ID, evidenceFromAcceptedSources, publicMigrationSummary } from '../src/services/consent/migration.js';
import { BREVO_LANGUAGE_ATTRIBUTE, languageCodecFromAttributes } from '../src/services/consent/brevo-language.js';

const MAILCHIMP_STATUSES = ['subscribed', 'unsubscribed', 'cleaned', 'pending', 'archived', 'transactional'];
export const TARGET_LIST_NAME = 'CIIIC nieuwsbrief';

async function getJson(url, headers) {
  const response = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Read-only provider request failed: HTTP ${response.status}`);
  return response.json();
}

async function readPages(makeUrl, headers, itemsKey, limit) {
  const all = [];
  let offset = 0;
  let expected = null;
  do {
    const data = await getJson(makeUrl(offset, limit), headers);
    const items = data[itemsKey];
    if (!Array.isArray(items) || !Number.isInteger(data.total_items ?? data.count)) throw new Error('Provider pagination shape changed');
    const total = data.total_items ?? data.count;
    if (expected !== null && total !== expected) throw new Error('Provider count changed during scan; retry later');
    expected = total;
    all.push(...items);
    offset += items.length;
    if (!items.length && offset < total) throw new Error('Provider pagination stalled');
  } while (offset < expected);
  return all;
}

export async function mailchimpMembers() {
  const key = process.env.MAILCHIMP_API_KEY;
  if (!key) throw new Error('MAILCHIMP_API_KEY required');
  const dc = process.env.MAILCHIMP_DC || key.split('-').at(-1);
  if (!/^[a-z0-9]+$/.test(dc)) throw new Error('Invalid Mailchimp data centre');
  const headers = { Authorization: `Basic ${Buffer.from(`anystring:${key}`).toString('base64')}` };
  const members = [];
  for (const status of MAILCHIMP_STATUSES) {
    const rows = await readPages((offset, count) =>
      `https://${dc}.api.mailchimp.com/3.0/lists/${CIIIC_LIST_ID}/members?status=${status}&count=${count}&offset=${offset}`,
    headers, 'members', 1000);
    members.push(...rows.map((row) => ({ ...row, list_id: CIIIC_LIST_ID })));
  }
  return members;
}

function brevoKey() {
  const key = process.env.BREVO_API_KEY2 || process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY2 or BREVO_API_KEY required');
  return key;
}

async function brevoContacts() {
  return readPages((offset, limit) =>
    `https://api.brevo.com/v3/contacts?limit=${limit}&offset=${offset}`,
  { 'api-key': brevoKey() }, 'contacts', 1000);
}

// The production list is a new, dedicated list (hubplan § 2). The dry-run only
// looks it up; creating it belongs to the separately authorized import.
export function resolveTargetList(lists, configuredId) {
  const byName = lists.filter((list) => String(list.name ?? '').trim().toLowerCase() === TARGET_LIST_NAME.toLowerCase());
  if (byName.length > 1) throw new Error('Brevo target list name is ambiguous');
  if (configuredId) {
    const configured = lists.find((list) => Number(list.id) === Number(configuredId));
    if (!configured || (byName[0] && Number(byName[0].id) !== Number(configuredId))) {
      throw new Error('BREVO_CIIIC_LIST_ID does not match the CIIIC nieuwsbrief list');
    }
  }
  const list = byName[0];
  return list ? { name: TARGET_LIST_NAME, exists: true, id: Number(list.id), subscribers: list.uniqueSubscribers ?? list.totalSubscribers ?? null }
    : { name: TARGET_LIST_NAME, exists: false, id: null };
}

async function brevoLists() {
  return readPages((offset, limit) =>
    `https://api.brevo.com/v3/contacts/lists?limit=${limit}&offset=${offset}`,
  { 'api-key': brevoKey() }, 'lists', 50);
}

// The LANGUAGE category values are read live and validated, never assumed.
async function brevoLanguageEnumeration() {
  const data = await getJson('https://api.brevo.com/v3/contacts/attributes', { 'api-key': brevoKey() });
  languageCodecFromAttributes(data);
  return data.attributes.find((attribute) => attribute.name === BREVO_LANGUAGE_ATTRIBUTE).enumeration;
}

export function encryptionKey() {
  const raw = process.env.CONSENT_EXPORT_KEY;
  if (!/^[0-9a-f]{64}$/i.test(raw || '')) throw new Error('CONSENT_EXPORT_KEY must be 32-byte hex');
  return Buffer.from(raw, 'hex');
}

export function snapshotDigest(records, secret) {
  const normalized = records.map((record) => JSON.stringify(record)).sort();
  const hmac = crypto.createHmac('sha256', secret);
  for (const row of normalized) hmac.update(row).update('\n');
  return hmac.digest('hex');
}

async function writeTemporaryEncryptedExport(value, key, registerDir = null) {
  const directory = registerDir || await fs.mkdtemp(path.join(os.tmpdir(), 'ciiic-consent-'));
  await fs.chmod(directory, 0o700);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  const payload = { format: 'aes-256-gcm-v1', expiresAt: value.expiresAt, iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'), ciphertext: encrypted.toString('base64') };
  const file = path.join(directory, registerDir ? `${fileStamp(value.startedAt)}-source-snapshot.enc.json` : 'source-snapshot.enc.json');
  await fs.writeFile(file, JSON.stringify(payload), { mode: 0o600, flag: 'wx' });
  return file;
}

const fileStamp = (iso) => iso.replace(/[:.]/g, '-');

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

// The register directory lives on the durable volume, outside git. A dry-run
// record holds T0, source checksums and the aggregated diff, never addresses.
// Its export is the rollback snapshot and is not auto-expired.
async function writeRunRecord(registerDir, record) {
  const file = path.join(registerDir, `${fileStamp(record.t0)}-dryrun.json`);
  await fs.writeFile(file, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  return file;
}

async function expireOldSnapshots() {
  for (const name of await fs.readdir(os.tmpdir())) {
    if (!name.startsWith('ciiic-consent-')) continue;
    const directory = path.join(os.tmpdir(), name);
    const file = path.join(directory, 'source-snapshot.enc.json');
    try {
      const stat = await fs.lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) continue;
      const payload = JSON.parse(await fs.readFile(file, 'utf8'));
      if (payload.format === 'aes-256-gcm-v1' && Number.isFinite(Date.parse(payload.expiresAt)) &&
        Date.parse(payload.expiresAt) < Date.now()) await fs.rm(directory, { recursive: true });
    } catch {
      // Another process may own the directory, or its export may still be in progress.
    }
  }
}

async function main() {
  await expireOldSnapshots();
  if (process.argv.includes('--cleanup-only')) return;
  const key = encryptionKey();
  const evidencePath = argValue('--evidence');
  const acceptedSources = argValue('--accept-sources');
  const policy = argValue('--policy');
  const registerDir = argValue('--register-dir');
  if (evidencePath && acceptedSources) throw new Error('Use either --evidence or --accept-sources');
  if (registerDir) await fs.mkdir(registerDir, { recursive: true, mode: 0o700 });
  const startedAt = new Date().toISOString();
  const [firstMembers, firstContacts] = await Promise.all([mailchimpMembers(), brevoContacts()]);
  const [members, contacts] = await Promise.all([mailchimpMembers(), brevoContacts()]);
  if (snapshotDigest(firstMembers, key) !== snapshotDigest(members, key) ||
    snapshotDigest(firstContacts, key) !== snapshotDigest(contacts, key)) {
    throw new Error('Source changed during read-only scan; retry later');
  }
  const [languageEnumeration, lists] = await Promise.all([brevoLanguageEnumeration(), brevoLists()]);
  const targetList = resolveTargetList(lists, process.env.BREVO_CIIIC_LIST_ID);
  const evidenceByEmail = evidencePath ? JSON.parse(await fs.readFile(evidencePath, 'utf8'))
    : acceptedSources ? evidenceFromAcceptedSources(members, acceptedSources.split(','), policy) : {};
  const checksumKey = process.env.CONSENT_HMAC_KEY || key;
  const plan = buildMigrationPlan({ members, brevoContacts: contacts, evidenceByEmail, languageEnumeration,
    checksumKey, targetBrevoListId: targetList.id });
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  const exportPath = await writeTemporaryEncryptedExport({ startedAt, completedAt: new Date().toISOString(),
    expiresAt, sourceList: CIIIC_LIST_ID, members, brevoContacts: contacts, plan }, key, registerDir);
  const summary = { t0: startedAt, ...publicMigrationSummary(plan), sourceList: CIIIC_LIST_ID, targetList,
    consentPolicy: evidencePath ? 'evidence-file' : acceptedSources
      ? { acceptedSources: acceptedSources.split(',').map((item) => item.trim()), notice: policy } : 'none (all subscribed quarantined)',
    sourceChecksum: { mailchimp: snapshotDigest(members, checksumKey), brevo: snapshotDigest(contacts, checksumKey) },
    scannedMailchimp: members.length, scannedBrevo: contacts.length, snapshotPath: exportPath,
    expiresAt: registerDir ? null : expiresAt };
  if (registerDir) summary.runRecord = await writeRunRecord(registerDir, summary);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch((error) => {
  // Never print API response bodies, URLs, addresses or credentials.
  const safe = /^(MAILCHIMP_API_KEY required|Invalid Mailchimp data centre|BREVO_API_KEY2 or BREVO_API_KEY required|CONSENT_EXPORT_KEY must be 32-byte hex|Provider pagination shape changed|Provider count changed during scan; retry later|Provider pagination stalled|Source changed during read-only scan; retry later|Brevo LANGUAGE category attribute missing|Brevo LANGUAGE enumeration changed|Brevo LANGUAGE enumeration missing|Brevo target list name is ambiguous|BREVO_CIIIC_LIST_ID does not match the CIIIC nieuwsbrief list|Use either --evidence or --accept-sources|Accepted sources and a policy notice required)$/.test(error.message);
  process.stderr.write(`Consent preflight stopped: ${safe ? error.message : 'read or validation failure; no response body logged'}\n`);
  process.exitCode = 1;
});
