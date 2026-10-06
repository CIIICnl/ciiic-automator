import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createConsentStore } from '../src/services/consent/store.js';
import { prepareEdition, claimEditionRecipient, confirmEditionSend,
  editionSummary } from '../src/services/consent/editions.js';

function store() {
  const editions = new Map();
  const contacts = new Map();
  return {
    contacts,
    async get(email) { return contacts.get(email); },
    async getEdition(id) { return editions.get(id) || null; },
    async putEdition(id, state, expectedVersion) {
      const current = editions.get(id);
      if ((current?.version ?? null) !== expectedVersion) {
        const error = new Error('Conflict'); error.code = 'VERSION_CONFLICT'; throw error;
      }
      editions.set(id, { state, version: (current?.version ?? 0) + 1 });
    },
  };
}

test('one edition freezes both languages and unknown provider response blocks cross-provider retry', async () => {
  const db = store();
  db.contacts.set('nl@example.test', { consent: 'confirmed', suppressed: false });
  db.contacts.set('en@example.test', { consent: 'confirmed', suppressed: false });
  const recipients = [
    { email: 'nl@example.test', language: 'nl', consent: 'confirmed' },
    { email: 'en@example.test', language: 'en', consent: 'confirmed' },
  ];
  assert.deepEqual(await prepareEdition(db, 'edition-1', recipients), { recipients: 2, nl: 1, en: 1,
    excludedConflict: 0, excludedMissingLanguage: 0 });
  const first = await claimEditionRecipient(db, 'edition-1', 'nl@example.test', 'nl', 'brevo');
  assert.equal(first.allowed, true);
  assert.deepEqual(await claimEditionRecipient(db, 'edition-1', 'nl@example.test', 'nl', 'mailchimp'),
    { allowed: false, reason: 'unknown' });
  await assert.rejects(prepareEdition(db, 'edition-1', recipients), /frozen/);
  assert.deepEqual(await claimEditionRecipient(db, 'edition-1', 'en@example.test', 'nl', 'brevo'),
    { allowed: false, reason: 'wrong_language' });
  await confirmEditionSend(db, 'edition-1', 'nl@example.test', 'brevo', 'provider-message-id');
  assert.deepEqual(await claimEditionRecipient(db, 'edition-1', 'nl@example.test', 'nl', 'mailchimp'),
    { allowed: false, reason: 'sent' });
  assert.deepEqual(await editionSummary(db, 'edition-1'),
    { frozen: true, nl: 1, en: 1, ready: 1, unknown: 0, sent: 1, suppressed: 0 });
});

test('current suppression removes an assigned recipient before provider claim', async () => {
  const db = store();
  db.contacts.set('en@example.test', { consent: 'confirmed', suppressed: true });
  await prepareEdition(db, 'edition-2', [{ email: 'en@example.test', language: 'en', consent: 'confirmed' }]);
  assert.deepEqual(await claimEditionRecipient(db, 'edition-2', 'en@example.test', 'en', 'brevo'),
    { allowed: false, reason: 'current_suppression' });
  assert.equal((await editionSummary(db, 'edition-2')).suppressed, 1);
});

test('two durable workers can claim a recipient only once', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ciiic-edition-test-'));
  fs.chmodSync(directory, 0o700);
  const dbPath = path.join(directory, 'registry.sqlite');
  const options = { path: dbPath, encryptionKey: 'a'.repeat(64), hmacKey: 'b'.repeat(64) };
  const first = createConsentStore(options);
  const second = createConsentStore(options);
  try {
    first.applyEvent({ email: 'reader@example.test', id: 'proof-1', type: 'confirmed',
      source: 'migration-approved', occurredAt: '2026-10-06T00:00:00Z',
      evidence: { kind: 'migration-approval', reference: 'synthetic-fixture' } });
    await prepareEdition(first, 'edition-concurrent', [{ email: 'reader@example.test',
      language: 'nl', consent: 'confirmed' }]);
    const results = await Promise.all([
      claimEditionRecipient(first, 'edition-concurrent', 'reader@example.test', 'nl', 'brevo'),
      claimEditionRecipient(second, 'edition-concurrent', 'reader@example.test', 'nl', 'mailchimp'),
    ]);
    assert.equal(results.filter((result) => result.allowed).length, 1);
    assert.equal(results.filter((result) => result.reason === 'unknown').length, 1);
  } finally {
    first.close(); second.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
