/**
 * SXSW London 2026 newsletter opt-in
 *
 * Receives the Gravity Forms webhook from Form 26 (public) and Form 27
 * (roundtable). When the "Stay informed" checkbox is ticked, subscribes
 * the contact to the main CIIIC Mailchimp list.
 */

import { requestCiiicSubscription } from './consent/subscriber.js';
import { hasFieldValue } from './consent/ingress.js';

// Form-id → field-id mapping. Lets us extract the same logical fields
// regardless of which form fired the webhook.
const FIELD_MAP = {
  26: { firstName: '1', lastName: '2', email: '5', newsletter: '9' },
  27: { firstName: '2', lastName: '3', email: '6', newsletter: '11' },
};

/**
 * Process a Gravity Forms webhook payload from Form 26 or 27.
 * Returns { skipped: true } when the opt-in checkbox is empty.
 */
export async function processSxswSubmission(body, { authenticated = false, subscribe = requestCiiicSubscription } = {}) {
  const formId = String(body.form_id || body.formId || '').trim();
  const map = FIELD_MAP[formId];
  if (!map) {
    throw new Error(`Unknown SXSW form id: ${formId}`);
  }

  const email = (body[map.email] || '').trim();
  const firstName = (body[map.firstName] || '').trim();
  const lastName = (body[map.lastName] || '').trim();

  if (!email) {
    throw new Error('No email address in SXSW payload');
  }

  const source = formId === '26' ? 'sxsw-london-2026-public' : 'sxsw-london-2026-roundtable';
  const optedIn = hasFieldValue(body, map.newsletter);

  console.log(`SXSW opt-in received: opt-in=${optedIn}`);

  if (!optedIn) {
    return { skipped: true, reason: 'no_optin' };
  }
  if (!authenticated) throw new Error('Unauthenticated CIIIC opt-in');
  return subscribe({
    email, firstName, lastName, language: body.newsletter_language, source,
    consentEvidence: { kind: 'gravity-forms', signed: true, formId, fieldId: map.newsletter, entryId: body.entry_id },
  });
}
