import crypto from 'node:crypto';
import { getConfiguredConsentStore, normalizeEmail, normalizeLanguage } from './store.js';
import { getConfiguredProvider } from './providers.js';

function validEvidence(evidence) {
  return evidence && typeof evidence === 'object' && evidence.kind === 'gravity-forms' && evidence.signed === true && String(evidence.formId || '').length > 0 && String(evidence.fieldId || '').length > 0;
}

/** A signup request never changes an existing contact's status or preference. */
export async function requestCiiicSubscription(input, { store = getConfiguredConsentStore(), provider = getConfiguredProvider(), clock = () => Date.now() } = {}) {
  const email = normalizeEmail(input?.email);
  const language = normalizeLanguage(input?.language);
  if (!validEvidence(input?.consentEvidence) || !input.source) throw new Error('Trusted consent evidence required');
  const local = store.get(email);
  if (local?.suppressed) return { status: 'skipped', provider: provider.name, reason: 'suppressed' };
  if (local?.consent === 'confirmed') return { status: 'skipped', provider: provider.name, reason: 'existing' };
  // A lookup error fails closed. Existing provider contacts may be unsubscribed,
  // pending or subscribed: an anonymous signup cannot modify any of them.
  const existing = await provider.read(email);
  if (store.get(email)?.suppressed) return { status: 'skipped', provider: provider.name, reason: 'suppressed' };
  if (existing?.suppressed) {
    store.applyEvent({ email, id: `provider-suppressed:${provider.name}:${store.identity(email)}`, type: 'suppress', source: provider.name, occurredAt: new Date(clock()).toISOString(), reason: existing.status });
    return { status: 'skipped', provider: provider.name, reason: 'suppressed' };
  }
  if (existing?.exists) return { status: 'skipped', provider: provider.name, reason: 'existing' };
  if (local?.consent === 'pending') return { status: 'skipped', provider: provider.name, reason: 'pending' };
  if (!store.reserveRequest(email, input.source)) return { status: 'skipped', provider: provider.name, reason: 'recipient_limit' };
  const eventId = `signup:${crypto.randomUUID()}`;
  store.applyEvent({ email, id: eventId, type: 'pending', source: input.source, occurredAt: new Date(clock()).toISOString(), evidence: input.consentEvidence });
  store.applyEvent({ email, id: `${eventId}:language`, type: 'preference', source: input.source, occurredAt: new Date(clock()).toISOString(), language });
  // The reservation remains after a timeout or 5xx: the provider may have
  // accepted the request, so an automatic retry could send a second DOI mail.
  await provider.requestDoi({ email, firstName: input.firstName, lastName: input.lastName, language });
  return { status: 'pending', provider: provider.name };
}
