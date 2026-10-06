#!/usr/bin/env node
// Mailchimp is GET-only here. Local encrypted registry and checkpoint are updated.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createConsentStore } from '../src/services/consent/store.js';
import { mailchimpMembers, snapshotDigest } from './consent-preflight.mjs';
import { reconcileMailchimpSnapshot } from '../src/services/consent/reconciliation.js';

function key() {
  const value = process.env.CONSENT_KEY;
  if (!/^[0-9a-f]{64}$/i.test(value || '')) throw new Error('CONSENT_KEY must be 32-byte hex');
  return Buffer.from(value, 'hex');
}

export async function readCheckpoint(file, encryptionKey) {
  try {
    const payload = JSON.parse(await fs.readFile(file, 'utf8'));
    if (payload.format !== 'aes-256-gcm-v1') throw new Error('Invalid encrypted checkpoint');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(payload.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
    const snapshot = JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, 'base64')),
      decipher.final()]).toString('utf8'));
    if (snapshot.complete !== true || !Array.isArray(snapshot.members)) throw new Error('Incomplete checkpoint');
    return snapshot;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function writeCheckpoint(file, snapshot, encryptionKey) {
  const directory = path.dirname(path.resolve(file));
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  if (((await fs.stat(directory)).mode & 0o077) !== 0) throw new Error('Checkpoint directory must be private');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(snapshot)), cipher.final()]);
  const payload = JSON.stringify({ format: 'aes-256-gcm-v1', iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') });
  const temporary = `${file}.${crypto.randomBytes(8).toString('hex')}.tmp`;
  try {
    await fs.writeFile(temporary, payload, { mode: 0o600, flag: 'wx' });
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

export async function withCheckpointLock(file, work) {
  const directory = path.dirname(path.resolve(file));
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  if (((await fs.stat(directory)).mode & 0o077) !== 0) throw new Error('Checkpoint directory must be private');
  const lockFile = `${file}.lock`;
  let lock;
  try {
    lock = await fs.open(lockFile, 'wx', 0o600);
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('Checkpoint writer already active; inspect stale lock before recovery');
    throw error;
  }
  try {
    return await work();
  } finally {
    await lock.close();
    await fs.rm(lockFile, { force: true });
  }
}

export async function applyReconciliation({ members, registry, checkpointFile, encryptionKey, eventKey,
  snapshotAt }) {
  const previousSnapshot = await readCheckpoint(checkpointFile, encryptionKey);
  const result = await reconcileMailchimpSnapshot({ members, registry, eventKey, snapshotComplete: true,
    snapshotAt, previousSnapshot });
  for (const event of result.events) registry.applyEvent(event);
  const snapshot = { complete: true, at: snapshotAt, members: members.map((member) => ({
    id: member.id, email_address: member.email_address, status: member.status, list_id: member.list_id,
    interests: member.interests, last_changed: member.last_changed, timestamp_opt: member.timestamp_opt,
  })) };
  await writeCheckpoint(checkpointFile, snapshot, encryptionKey);
  return { ...result.summary, applied: result.events.length, checkpointCreated: !previousSnapshot };
}

async function main() {
  const checkpointFile = process.env.CONSENT_CHECKPOINT_PATH;
  const dbPath = process.env.CONSENT_DB_PATH;
  if (!checkpointFile || !dbPath || path.resolve(checkpointFile).startsWith(`${process.cwd()}${path.sep}`)) {
    throw new Error('Private checkpoint and DB paths outside repository required');
  }
  const encryptionKey = key();
  const eventKey = process.env.CONSENT_HMAC_KEY;
  if (!eventKey || Buffer.byteLength(eventKey) < 32) throw new Error('CONSENT_HMAC_KEY required');
  await withCheckpointLock(checkpointFile, async () => {
    const first = await mailchimpMembers();
    const members = await mailchimpMembers();
    if (snapshotDigest(first, eventKey) !== snapshotDigest(members, eventKey)) {
      throw new Error('Mailchimp changed during scan');
    }
    const registry = createConsentStore({ path: dbPath, encryptionKey: process.env.CONSENT_KEY, hmacKey: eventKey });
    try {
      const summary = await applyReconciliation({ members, registry, checkpointFile, encryptionKey,
        eventKey, snapshotAt: new Date().toISOString() });
      process.stdout.write(`${JSON.stringify(summary)}\n`);
    } finally {
      registry.close();
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(() => {
  process.stderr.write('Consent reconciliation stopped; no provider response or identity logged\n');
  process.exitCode = 1;
});
