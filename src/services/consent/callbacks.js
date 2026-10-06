import crypto from 'node:crypto';
import express from 'express';
import { getConfiguredConsentStore, normalizeEmail } from './store.js';

// Brevo documents Bearer webhook authentication, not a native signature.
// https://developers.brevo.com/docs/secured-webhooks
function authorized(header, token) {
  if (!token || typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const actual = Buffer.from(header.slice(7));
  const expected = Buffer.from(token);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function mapBrevoMarketingEvent(body, listId) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid webhook body');
  const event = body.event;
  if (!['unsubscribe', 'hard_bounce', 'spam', 'contact_deleted', 'contact_updated'].includes(event)) return null;
  const email = normalizeEmail(body.email);
  const timestamp = Number(body.ts_event ?? body.ts);
  if (!Number.isSafeInteger(timestamp) || timestamp < 1) throw new Error('Webhook timestamp required');
  // Brevo's marketing email events use event/email/ts_event, and an optional
  // list_id array for unsubscribe. Delivery and list_addition are not DOI.
  // https://developers.brevo.com/docs/marketing-webhooks
  if (event === 'contact_updated') {
    const value = Array.isArray(body.content) ? body.content.find(item => item && typeof item === 'object' && !Array.isArray(item) && (item.TAAL !== undefined || item.taal !== undefined)) : null;
    if (!value) return null;
    const language = String(value.TAAL ?? value.taal).trim().toLowerCase();
    if (!['nl', 'en'].includes(language)) throw new Error('Invalid Brevo language update');
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify(body.content)).digest('hex');
    return { email, id: `${event}:${email}:${timestamp}:${fingerprint}`, type: 'preference', source: 'brevo-profile', occurredAt: new Date(timestamp * 1000).toISOString(), language };
  }
  if (event === 'contact_deleted') return { email, id: `${event}:${email}:${timestamp}`, type: 'suppress', source: 'brevo', occurredAt: new Date(timestamp * 1000).toISOString(), reason: event };
  if (event === 'unsubscribe' && Array.isArray(body.list_id) && !body.list_id.map(Number).includes(Number(listId))) return null;
  const id = [event, email, timestamp, body.camp_id ?? '', ...(Array.isArray(body.list_id) ? body.list_id.map(String).sort() : [])].join(':');
  return { email, id, type: 'suppress', source: 'brevo', occurredAt: new Date(timestamp * 1000).toISOString(), reason: event };
}

export function createMarketingRouter({ store, token = process.env.BREVO_MARKETING_WEBHOOK_TOKEN, listId = process.env.BREVO_CIIIC_LIST_ID } = {}) {
  const router = express.Router();
  router.post('/brevo', (req, res) => {
    const listSyntaxValid = typeof listId === 'number' ? Number.isInteger(listId) : typeof listId === 'string' && /^\d+$/.test(listId);
    const list = Number(listId);
    if (!token || !listSyntaxValid || !Number.isSafeInteger(list) || list < 1 || [2, 3].includes(list)) return res.sendStatus(503);
    if (!authorized(req.headers.authorization, token)) return res.sendStatus(403);
    try {
      const events = Array.isArray(req.body) ? req.body : [req.body];
      if (events.length > 100) return res.sendStatus(400);
      // Validate the full batch before mutation. A provider retry after a DB
      // failure still works because applyEvent is idempotent per recipient.
      const mappedEvents = events.map(body => mapBrevoMarketingEvent(body, list)).filter(Boolean);
      let applied = 0;
      for (const mapped of mappedEvents) {
          const registry = store || getConfiguredConsentStore();
          // A global Brevo account can hold other audiences. A profile update
          // without list evidence only applies to a known CIIIC identity.
          if (mapped.type === 'preference' && !registry.get(mapped.email)) continue;
          const result = registry.applyEvent(mapped);
          if (!result.duplicate) applied++;
      }
      return res.json({ accepted: true, applied });
    } catch (error) {
      return res.sendStatus(error.message?.startsWith('Invalid') || error.message?.includes('required') ? 400 : 503);
    }
  });
  return router;
}
