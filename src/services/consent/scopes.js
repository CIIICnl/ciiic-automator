// Consent purpose per register record. `newsletter` is the original
// register: the top-level consent/suppressed fields, so records written
// before scopes existed keep their meaning without a migration. An
// `event:<slug>` scope lives in `record.scopes[scope]`. `*` is not a
// purpose but an address-level suppression (hard bounce, spam complaint,
// deleted contact): it blocks every scope. See
// docs/reference/consent-scope-contract.md.
export const NEWSLETTER_SCOPE = 'newsletter';
export const ADDRESS_SCOPE = '*';
const EVENT_SCOPE = /^event:[a-z0-9][a-z0-9:._-]{0,99}$/;

// Calls without a scope are newsletter calls (the contract before v2).
export function normalizeScope(value, { allowAddress = false } = {}) {
  if (value === undefined || value === null || value === '') return NEWSLETTER_SCOPE;
  if (value === NEWSLETTER_SCOPE || EVENT_SCOPE.test(value)) return value;
  if (allowAddress && value === ADDRESS_SCOPE) return value;
  throw new Error('Invalid consent scope');
}

// Records written before v2 carry one top-level suppression without saying
// whether it was about the newsletter or the address. Only a plain
// unsubscribe is newsletter-only; anything else (cleaned, bounce, Brevo
// blocklist, unknown) is treated as address-level, which can only exclude
// more, never mail more.
// The same reading applies to a suppression that arrives without a scope
// (reconciliation, subscriber route): callers that know better pass one.
const NEWSLETTER_ONLY_REASONS = new Set(['unsubscribe', 'unsubscribed']);
export function unscopedSuppressionIsAddressLevel(reason) {
  return !NEWSLETTER_ONLY_REASONS.has(reason);
}

export function addressSuppressed(record) {
  if (typeof record?.addressSuppressed === 'boolean') return record.addressSuppressed;
  return Boolean(record?.suppressed && unscopedSuppressionIsAddressLevel(record.suppressionReason));
}

/**
 * The consent state of one purpose, or null when the register has no record
 * for that purpose (`unknown_contact`). Language and its conflict flag are
 * address-level and shared by all scopes.
 */
export function scopeStatus(record, scope = NEWSLETTER_SCOPE) {
  if (!record) return null;
  if (scope === NEWSLETTER_SCOPE) {
    // A record that only exists for an event scope has no newsletter record.
    // Records without scopes keep their v1 reading.
    if (record.scopes && record.consent === 'unknown' && !record.suppressed) return null;
    return { consent: record.consent, suppressed: Boolean(record.suppressed), preferenceConflict: Boolean(record.preferenceConflict) };
  }
  const entry = record.scopes?.[scope];
  if (!entry) return null;
  return { consent: entry.consent, suppressed: Boolean(entry.suppressed) || addressSuppressed(record),
    preferenceConflict: Boolean(record.preferenceConflict) };
}

export function eligible(status) {
  return Boolean(status && !status.suppressed && !status.preferenceConflict && status.consent === 'confirmed');
}

// Exclusion reasons in the order the edition contract reports them.
export function exclusionReason(status) {
  if (!status) return 'unknown_contact';
  if (status.suppressed) return 'suppressed';
  if (status.consent !== 'confirmed') return 'consent_not_confirmed';
  if (status.preferenceConflict) return 'preference_conflict';
  return null;
}
