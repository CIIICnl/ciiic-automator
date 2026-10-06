import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { applyPreference } from './preferences.js';

export function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email');
  return email;
}

export function normalizeLanguage(value) {
  if (value === undefined || value === null || value === '') return 'nl';
  const language = String(value).trim().toLowerCase();
  if (language !== 'nl' && language !== 'en') throw new Error('Invalid language');
  return language;
}

function keyBytes(value) {
  if (!/^[a-f0-9]{64}$/i.test(value || '')) throw new Error('CONSENT_KEY must be 32-byte hex');
  return Buffer.from(value, 'hex');
}

export function createConsentStore({ path: dbPath, encryptionKey, hmacKey, clock = () => Date.now() } = {}) {
  if (!dbPath || dbPath === ':memory:') throw new Error('Durable CONSENT_DB_PATH required');
  if (path.resolve(dbPath).startsWith(`${process.cwd()}${path.sep}`)) throw new Error('Consent DB cannot live inside repository');
  if (!hmacKey || Buffer.byteLength(hmacKey) < 32) throw new Error('CONSENT_HMAC_KEY too short');
  const key = keyBytes(encryptionKey);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 });
  const directory = fs.statSync(path.dirname(dbPath));
  if ((directory.mode & 0o077) !== 0) throw new Error('Consent DB directory must be private');
  const db = new Database(dbPath);
  fs.chmodSync(dbPath, 0o600);
  db.pragma('journal_mode = DELETE');
  db.pragma('busy_timeout = 5000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS metadata (name TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS contacts (identity TEXT PRIMARY KEY, encrypted TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS events (event_key TEXT PRIMARY KEY, identity TEXT NOT NULL, received_at INTEGER NOT NULL, encrypted TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS requests (identity TEXT PRIMARY KEY, requested_at INTEGER NOT NULL, encrypted TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS editions (edition_id TEXT PRIMARY KEY, version INTEGER NOT NULL, encrypted TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS events_received_at ON events(received_at);
  `);

  const identity = email => crypto.createHmac('sha256', hmacKey).update(normalizeEmail(email)).digest('hex');
  const eventKey = id => crypto.createHmac('sha256', hmacKey).update(String(id)).digest('hex');
  const encrypt = value => {
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
    const body = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
    return Buffer.concat([nonce, cipher.getAuthTag(), body]).toString('base64');
  };
  const decrypt = value => {
    const data = Buffer.from(value, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString());
  };
  const sentinel = crypto.createHmac('sha256', hmacKey).update(key).update('ciiic-consent-v1').digest('hex');
  const storedSentinel = db.prepare("SELECT value FROM metadata WHERE name = 'key_sentinel'").get();
  if (storedSentinel && storedSentinel.value !== sentinel) {
    db.close();
    throw new Error('Consent registry key mismatch');
  }
  if (!storedSentinel) {
    const hasData = ['contacts', 'events', 'requests', 'editions'].some(table => db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get());
    if (hasData) { db.close(); throw new Error('Consent registry missing key sentinel'); }
    db.prepare("INSERT INTO metadata(name,value) VALUES ('key_sentinel',?)").run(sentinel);
  }
  const get = email => {
    const row = db.prepare('SELECT encrypted FROM contacts WHERE identity = ?').get(identity(email));
    return row ? decrypt(row.encrypted) : null;
  };
  const applyEvent = db.transaction(event => {
    const email = normalizeEmail(event.email);
    if (!event.id || !event.source || !['preference', 'preference-observation', 'suppress', 'pending', 'confirmed'].includes(event.type)) throw new Error('Invalid consent event');
    const occurredAt = Date.parse((event.type === 'preference-observation' ? event.observedAt : event.occurredAt) || '');
    if (!Number.isFinite(occurredAt)) throw new Error('Event time required');
    if (event.type === 'confirmed' && (!event.evidence || !['provider-confirmation', 'migration-approval'].includes(event.evidence.kind) || typeof event.evidence.reference !== 'string' || !event.evidence.reference.trim() || !['brevo-confirmation', 'mailchimp-confirmation', 'migration-approved'].includes(event.source))) throw new Error('Confirmed consent requires authoritative evidence');
    const keyId = eventKey(`${event.source}:${event.id}:${email}`);
    if (db.prepare('SELECT 1 FROM events WHERE event_key = ?').get(keyId)) return { duplicate: true, record: get(email) };
    const prior = get(email);
    const record = prior || { identity: identity(email), email, consent: 'unknown', language: null, languageSource: null, languageAt: null, preferenceConflict: false, suppressed: false, suppressionReason: null, suppressionAt: null, updatedAt: null };
    if (event.type === 'suppress') {
      record.suppressed = true;
      record.suppressionReason = event.reason || event.source;
      record.suppressionAt = Math.max(record.suppressionAt || 0, occurredAt);
    } else if (event.type === 'preference' || event.type === 'preference-observation') {
      const language = event.type === 'preference-observation' && event.reason ? null : normalizeLanguage(event.language);
      applyPreference(record, event, language);
    } else if (event.type === 'pending') {
      if (record.consent === 'unknown') record.consent = 'pending';
    } else if (event.type === 'confirmed' && !record.suppressed) {
      record.consent = 'confirmed';
      record.consentEvidence = event.evidence;
      record.consentAt = occurredAt;
    }
    record.updatedAt = clock();
    const receivedAt = clock();
    db.prepare('INSERT INTO events(event_key, identity, received_at, encrypted) VALUES (?, ?, ?, ?)').run(keyId, identity(email), receivedAt, encrypt({ ...event, email }));
    db.prepare('INSERT INTO contacts(identity, encrypted) VALUES (?, ?) ON CONFLICT(identity) DO UPDATE SET encrypted=excluded.encrypted').run(identity(email), encrypt(record));
    return { duplicate: false, record };
  });
  const reserveRequest = db.transaction((email, source) => {
    const normalized = normalizeEmail(email);
    const id = identity(normalized);
    const now = clock();
    const prior = db.prepare('SELECT requested_at FROM requests WHERE identity = ?').get(id);
    if (prior && now - prior.requested_at < 86400000) return false;
    db.prepare('INSERT INTO requests(identity, requested_at, encrypted) VALUES (?, ?, ?) ON CONFLICT(identity) DO UPDATE SET requested_at=excluded.requested_at, encrypted=excluded.encrypted').run(id, now, encrypt({ email: normalized, source, state: 'uncertain' }));
    return true;
  });
  const getEdition = id => {
    const row = db.prepare('SELECT version, encrypted FROM editions WHERE edition_id = ?').get(id);
    return row ? { version: row.version, state: decrypt(row.encrypted) } : null;
  };
  const listEventsSince = t0 => {
    const from = typeof t0 === 'number' ? t0 : Date.parse(t0);
    if (!Number.isFinite(from)) throw new Error('Invalid T0');
    return db.prepare('SELECT received_at, encrypted FROM events WHERE received_at >= ? ORDER BY received_at, event_key').all(from).map(row => ({ ...decrypt(row.encrypted), receivedAt: row.received_at }));
  };
  const putEdition = db.transaction((id, state, expectedVersion = null) => {
    if (!/^[a-zA-Z0-9:_-]{1,100}$/.test(id)) throw new Error('Invalid edition id');
    const prior = db.prepare('SELECT version FROM editions WHERE edition_id = ?').get(id);
    if ((prior?.version ?? null) !== expectedVersion) {
      const error = new Error('Edition version conflict');
      error.code = 'VERSION_CONFLICT';
      throw error;
    }
    const version = (prior?.version ?? 0) + 1;
    db.prepare('INSERT INTO editions(edition_id, version, encrypted) VALUES (?, ?, ?) ON CONFLICT(edition_id) DO UPDATE SET version=excluded.version, encrypted=excluded.encrypted').run(id, version, encrypt(state));
    return version;
  });
  return { get, applyEvent, reserveRequest, listEventsSince, getEdition, putEdition, identity, close: () => db.close() };
}

let configuredStore;
export function getConfiguredConsentStore() {
  if (!configuredStore) configuredStore = createConsentStore({ path: process.env.CONSENT_DB_PATH || '/data/consent/registry.sqlite', encryptionKey: process.env.CONSENT_KEY, hmacKey: process.env.CONSENT_HMAC_KEY });
  return configuredStore;
}
