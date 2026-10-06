import crypto from 'node:crypto';
import { canonicalEmail, CIIIC_LIST_ID, languageFromInterests } from './migration.js';

function eventId(member, type, language, key) {
  return crypto.createHmac('sha256', key).update(JSON.stringify([
    canonicalEmail(member.email_address), member.id, type, language,
    member.last_changed || member.timestamp_opt || '',
  ])).digest('hex');
}

/**
 * Mailchimp has no registered webhooks for this audience. Reconcile a complete,
 * paginated snapshot against the durable registry; never infer consent from it.
 * Callers must apply returned events idempotently and retain the source snapshot.
 */
export async function reconcileMailchimpSnapshot({ members, registry, eventKey, snapshotComplete, snapshotAt,
  previousSnapshot = null }) {
  if (!snapshotComplete) throw new Error('Full Mailchimp snapshot required');
  if (!Number.isFinite(Date.parse(snapshotAt))) throw new Error('Snapshot time required');
  if (!eventKey || !registry?.get) throw new Error('Registry and event key required');
  const events = [];
  const reasons = {};
  const seen = new Set();
  const frequency = new Map();
  const previous = new Map();
  if (previousSnapshot) {
    if (previousSnapshot.complete !== true || !Number.isFinite(Date.parse(previousSnapshot.at)) || !Array.isArray(previousSnapshot.members)) {
      throw new Error('Complete previous snapshot required');
    }
    for (const old of previousSnapshot.members) {
      const oldEmail = canonicalEmail(old.email_address);
      if (oldEmail) previous.set(oldEmail, old);
    }
  }
  for (const member of members) {
    const email = canonicalEmail(member.email_address);
    if (email && (!member.list_id || member.list_id === CIIIC_LIST_ID)) {
      frequency.set(email, (frequency.get(email) || 0) + 1);
    }
  }
  let duplicates = 0;
  for (const member of members) {
    const email = canonicalEmail(member.email_address);
    if (!email || (member.list_id && member.list_id !== CIIIC_LIST_ID)) continue;
    if (frequency.get(email) > 1 && !['unsubscribed', 'cleaned'].includes(String(member.status).toLowerCase())) {
      duplicates += 1;
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    const current = await registry.get(email);
    const status = String(member.status ?? '').toLowerCase();
    const when = member.last_changed || member.timestamp_opt;
    if (status === 'unsubscribed' || status === 'cleaned') {
      // Suppression is monotonic. An old source event still blocks marketing.
      events.push({ email, id: eventId(member, 'suppress', status, eventKey),
        type: 'suppress', source: 'mailchimp', occurredAt: when || snapshotAt, reason: status });
      continue;
    }
    if (status !== 'subscribed') {
      reasons[status || 'unknown_status'] = (reasons[status || 'unknown_status'] || 0) + 1;
      continue;
    }
    const preference = languageFromInterests(member.interests);
    if (preference.reason) {
      reasons[preference.reason] = (reasons[preference.reason] || 0) + 1;
      continue;
    }
    const old = previous.get(email);
    if (!old) {
      reasons.no_preference_checkpoint = (reasons.no_preference_checkpoint || 0) + 1;
      continue;
    }
    const oldPreference = languageFromInterests(old.interests);
    if (oldPreference.reason || oldPreference.language === preference.language) continue;
    const currentLanguageTime = typeof current?.languageAt === 'number' ? current.languageAt : Date.parse(current?.languageAt);
    if (Number.isFinite(currentLanguageTime) && currentLanguageTime > Date.parse(previousSnapshot.at)) {
      reasons.concurrent_preference_conflict = (reasons.concurrent_preference_conflict || 0) + 1;
      continue;
    }
    if (current?.language === preference.language) continue;
    events.push({ email, id: eventId({ ...member, last_changed: snapshotAt }, 'preference', preference.language, eventKey),
      type: 'preference', source: 'mailchimp', occurredAt: snapshotAt, language: preference.language });
  }
  return { events, summary: { scanned: seen.size, candidateEvents: events.length, duplicates, skipped: reasons } };
}
