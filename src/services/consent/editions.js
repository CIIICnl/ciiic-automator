import { canonicalEmail } from './migration.js';

function validRecipient(contact) {
  const email = canonicalEmail(contact.email);
  if (!email) throw new Error('Recipient needs valid identity');
  return email;
}

async function cas(store, editionId, change) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await store.getEdition(editionId);
    const result = await change(current?.state ?? null);
    if (result.write === false) return result.value;
    try {
      await store.putEdition(editionId, result.state, current?.version ?? null);
      return result.value;
    } catch (error) {
      if (error.code !== 'VERSION_CONFLICT' || attempt === 4) throw error;
    }
  }
  throw new Error('Edition state could not be reserved');
}

/** Set or refresh the one-language snapshot, only before any provider attempt. */
export async function prepareEdition(store, editionId, contacts) {
  if (!editionId || !store?.getEdition || !store?.putEdition) throw new Error('Durable edition store required');
  const assignments = {};
  const seen = new Set();
  let excludedConflict = 0;
  let excludedMissingLanguage = 0;
  for (const contact of contacts) {
    const email = validRecipient(contact);
    if (seen.has(email)) throw new Error('Duplicate recipient identity');
    seen.add(email);
    if (contact.suppressed || contact.consent !== 'confirmed') continue;
    if (contact.preferenceConflict) { excludedConflict += 1; continue; }
    if (!['nl', 'en'].includes(contact.language)) { excludedMissingLanguage += 1; continue; }
    assignments[email] = { language: contact.language, outcome: 'ready' };
  }
  return cas(store, editionId, async (current) => {
    if (current?.frozen) throw new Error('Edition is frozen after first provider attempt');
    for (const [email, entry] of Object.entries(current?.assignments ?? {})) {
      if (entry.outcome === 'suppressed') {
        if (assignments[email]) assignments[email] = { ...assignments[email], outcome: 'suppressed' };
      }
    }
    return { state: { frozen: false, assignments }, value: {
      recipients: Object.values(assignments).filter((row) => row.outcome === 'ready').length,
      nl: Object.values(assignments).filter((row) => row.outcome === 'ready' && row.language === 'nl').length,
      en: Object.values(assignments).filter((row) => row.outcome === 'ready' && row.language === 'en').length,
      excludedConflict, excludedMissingLanguage,
    } };
  });
}

/**
 * Persist an unknown-outcome claim before touching any provider. A crash or
 * timeout then blocks retries until provider delivery is reconciled.
 */
export async function claimEditionRecipient(store, editionId, emailInput, language, provider) {
  const email = canonicalEmail(emailInput);
  if (!email || !['nl', 'en'].includes(language) || !provider) throw new Error('Invalid edition claim');
  return cas(store, editionId, async (current) => {
    if (!current?.assignments?.[email]) return { write: false, value: { allowed: false, reason: 'outside_snapshot' } };
    const entry = current.assignments[email];
    if (entry.language !== language) return { write: false, value: { allowed: false, reason: 'wrong_language' } };
    if (entry.outcome !== 'ready') return { write: false, value: { allowed: false, reason: entry.outcome } };
    const consent = await store.get(email);
    if (!consent || consent.suppressed || consent.preferenceConflict || consent.consent !== 'confirmed') {
      const state = structuredClone(current);
      state.assignments[email].outcome = 'suppressed';
      return { state, value: { allowed: false, reason: 'current_suppression' } };
    }
    const state = structuredClone(current);
    state.frozen = true;
    state.assignments[email] = { ...entry, outcome: 'unknown', provider, claimedAt: new Date().toISOString() };
    return { state, value: { allowed: true, email, language, provider } };
  });
}

/** Only a verified provider receipt resolves an unknown claim as sent. */
export async function confirmEditionSend(store, editionId, emailInput, provider, receipt) {
  const email = canonicalEmail(emailInput);
  if (!email || !provider || !receipt) throw new Error('Provider receipt required');
  return cas(store, editionId, async (current) => {
    const entry = current?.assignments?.[email];
    if (!entry || entry.provider !== provider || entry.outcome !== 'unknown') throw new Error('No matching unknown claim');
    const state = structuredClone(current);
    state.assignments[email] = { ...entry, outcome: 'sent', receipt };
    return { state, value: { sent: true } };
  });
}

export async function editionSummary(store, editionId) {
  const state = (await store.getEdition(editionId))?.state;
  if (!state) return null;
  const summary = { frozen: state.frozen, nl: 0, en: 0, ready: 0, unknown: 0, sent: 0, suppressed: 0 };
  for (const entry of Object.values(state.assignments)) {
    summary[entry.language] += 1;
    summary[entry.outcome] += 1;
  }
  return summary;
}
