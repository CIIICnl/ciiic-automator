import crypto from 'node:crypto';
import express from 'express';
import { getConfiguredConsentStore, normalizeEmail } from './store.js';
import { BREVO_LANGUAGE_ATTRIBUTE, createLanguageCodecLoader } from './brevo-language.js';
import { request } from './providers.js';
import { applyEditionSuppression, editionScope, recordEditionDelivery } from './newsletter-editions.js';
import { ADDRESS_SCOPE, NEWSLETTER_SCOPE } from './scopes.js';

// Brevo documents Bearer webhook authentication, not a native signature.
// https://developers.brevo.com/docs/secured-webhooks
export function authorized(header, token) {
  if (!token || typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const actual = Buffer.from(header.slice(7));
  const expected = Buffer.from(token);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function eventTagged(body) {
  const tags = [...(typeof body.tag === 'string' ? body.tag.split(',') : []), ...(Array.isArray(body.tags) ? body.tags : [])];
  return tags.some(tag => typeof tag === 'string' && tag.trim().toLowerCase() === 'event');
}

// `editionCampaigns` maps the Brevo campaign IDs of editions to their consent
// scope (a Set means all newsletter). A delivery is only meaningful for those
// (it is the edition receipt, never a DOI confirmation), and an unsubscribe
// from an edition campaign counts even when its list_id names the edition
// list instead of the main CIIIC list. The unsubscribe is booked on the
// campaign's scope: under an event mail it leaves the newsletter alone,
// unless list_id shows the main list was left as well. Bounces, spam and
// deletion are about the address, so they block every scope (`*`).
// The result is one event, a list of events, or null.
export function mapBrevoMarketingEvent(body, listId, languageCodec = null, editionCampaigns = new Set()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid webhook body');
  const event = body.event;
  const editionCampaign = editionCampaigns.has(Number(body.camp_id));
  const campaignScope = editionCampaign ? (editionCampaigns.get?.(Number(body.camp_id)) ?? NEWSLETTER_SCOPE) : null;
  if (['delivered', 'sent'].includes(event) && !editionCampaign) return null;
  if (!['unsubscribe', 'hard_bounce', 'spam', 'contact_deleted', 'contact_updated', 'delivered', 'sent'].includes(event)) return null;
  const email = normalizeEmail(body.email);
  const timestamp = Number(body.ts_event ?? body.ts);
  if (!Number.isSafeInteger(timestamp) || timestamp < 1) throw new Error('Webhook timestamp required');
  if (event === 'delivered' || event === 'sent') {
    return { email, id: `${event}:${email}:${body.camp_id}:${timestamp}`, type: 'delivery', source: 'brevo',
      campaignId: Number(body.camp_id), occurredAt: new Date(timestamp * 1000).toISOString() };
  }
  // Brevo's marketing email events use event/email/ts_event, and an optional
  // list_id array for unsubscribe. Delivery and list_addition are not DOI.
  // https://developers.brevo.com/docs/marketing-webhooks
  if (event === 'contact_updated') {
    const value = Array.isArray(body.content) ? body.content.find(item => item && typeof item === 'object' && !Array.isArray(item) && item[BREVO_LANGUAGE_ATTRIBUTE] !== undefined) : null;
    if (!value) return null;
    if (!languageCodec) throw new Error('Brevo LANGUAGE codec unavailable');
    let language;
    try { language = languageCodec.fromValue(value[BREVO_LANGUAGE_ATTRIBUTE]); } catch { throw new Error('Invalid Brevo language update'); }
    if (!language) return null;
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify(body.content)).digest('hex');
    return { email, id: `${event}:${email}:${timestamp}:${fingerprint}`, type: 'preference', source: 'brevo-profile', occurredAt: new Date(timestamp * 1000).toISOString(), language };
  }
  if (event === 'contact_deleted') return { email, id: `${event}:${email}:${timestamp}`, type: 'suppress', source: 'brevo', occurredAt: new Date(timestamp * 1000).toISOString(), reason: event, scope: ADDRESS_SCOPE };
  const leftMainList = Array.isArray(body.list_id) && body.list_id.map(Number).includes(Number(listId));
  const id = [event, email, timestamp, body.camp_id ?? '', ...(Array.isArray(body.list_id) ? body.list_id.map(String).sort() : [])].join(':');
  const suppression = scope => ({ email, id, type: 'suppress', source: 'brevo', occurredAt: new Date(timestamp * 1000).toISOString(), reason: event, scope });
  if (event !== 'unsubscribe') return suppression(ADDRESS_SCOPE);
  if (campaignScope && campaignScope !== NEWSLETTER_SCOPE) {
    return leftMainList ? [suppression(campaignScope), suppression(NEWSLETTER_SCOPE)] : suppression(campaignScope);
  }
  // An event campaign the ledger does not know has no scope to book on.
  if (!editionCampaign && eventTagged(body) && !leftMainList) return null;
  if (!editionCampaign && Array.isArray(body.list_id) && !leftMainList) return null;
  return suppression(NEWSLETTER_SCOPE);
}

// Brevo answers 400 when the contact is not (or no longer) in the list; that
// is the state we want, so only other failures make Brevo retry the event.
export function createBrevoListRemover({ apiKey = process.env.BREVO_API_KEY2, transport = request } = {}) {
  return async (listId, email) => {
    if (!apiKey) throw new Error('Brevo API key unavailable');
    const result = await transport(`https://api.brevo.com/v3/contacts/lists/${Number(listId)}/contacts/remove`, {
      method: 'POST', headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ emails: [email] }) });
    if (result.status >= 200 && result.status < 300) return true;
    if (result.status === 400) return false;
    throw new Error('Brevo list removal failed');
  };
}

export function createMarketingRouter({ store, token = process.env.BREVO_MARKETING_WEBHOOK_TOKEN, listId = process.env.BREVO_CIIIC_LIST_ID,
  loadLanguageCodec = createLanguageCodecLoader({ apiKey: process.env.BREVO_API_KEY2, transport: request }),
  removeFromList = createBrevoListRemover() } = {}) {
  const router = express.Router();
  router.post('/brevo', async (req, res) => {
    const listSyntaxValid = typeof listId === 'number' ? Number.isInteger(listId) : typeof listId === 'string' && /^\d+$/.test(listId);
    const list = Number(listId);
    if (!token || !listSyntaxValid || !Number.isSafeInteger(list) || list < 1 || [2, 3].includes(list)) return res.sendStatus(503);
    if (!authorized(req.headers.authorization, token)) return res.sendStatus(403);
    try {
      const events = Array.isArray(req.body) ? req.body : [req.body];
      if (events.length > 100) return res.sendStatus(400);
      // Only profile updates need the LANGUAGE enumeration; a failed lookup
      // falls through to 503 so Brevo retries the batch.
      const languageCodec = events.some(body => body?.event === 'contact_updated') ? await loadLanguageCodec() : null;
      // Validate the full batch before mutation. A provider retry after a DB
      // failure still works because applyEvent is idempotent per recipient.
      const registry = store || getConfiguredConsentStore();
      const editions = registry.listEditions ? await registry.listEditions() : [];
      const editionCampaigns = new Map(editions.flatMap(edition => Object.values(edition.state?.meta?.campaigns ?? {})
        .filter(Boolean).map(campaign => [campaign, editionScope(edition.state)])));
      const mappedEvents = events.flatMap(body => mapBrevoMarketingEvent(body, list, languageCodec, editionCampaigns)).filter(Boolean);
      let applied = 0;
      for (const mapped of mappedEvents) {
          if (mapped.type === 'delivery') {
            const result = await recordEditionDelivery(registry, { campaignId: mapped.campaignId, email: mapped.email,
              occurredAt: mapped.occurredAt, eventId: mapped.id });
            if (result.applied) applied++;
            continue;
          }
          // A global Brevo account can hold other audiences. A profile update
          // without list evidence only applies to a known CIIIC identity.
          if (mapped.type === 'preference' && !registry.get(mapped.email)) continue;
          const result = registry.applyEvent(mapped);
          if (!result.duplicate) applied++;
          // Runs on duplicates too: a retry after a failed list removal must
          // still finish it (route b).
          if (mapped.type === 'suppress' && editions.length) {
            await applyEditionSuppression(registry, mapped.email, { removeFromList, occurredAt: mapped.occurredAt, scope: mapped.scope });
          }
      }
      return res.json({ accepted: true, applied });
    } catch (error) {
      return res.sendStatus(error.message?.startsWith('Invalid') || error.message?.includes('required') ? 400 : 503);
    }
  });
  return router;
}
