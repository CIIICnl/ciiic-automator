/**
 * Jaarevent 2026 Registration Sync
 * 
 * Syncs registration status between Gravity Forms, Mailchimp, and Notion.
 * 
 * Flows:
 * 1. New registration (GF webhook) → Mailchimp JAAREVENT=geregistreerd + Notion jaarevent-2026=geregistreerd
 * 2. Cancellation (GF mu-plugin) → Mailchimp JAAREVENT=geannuleerd + Notion jaarevent-2026=geannuleerd
 * 3. Check-in (future) → Notion jaarevent-2026=aanwezig
 */

import https from 'https';
import crypto from 'crypto';
import { requestCiiicSubscription } from './consent/subscriber.js';
import { hasFieldValue } from './consent/ingress.js';
import { consentRouteEnabled } from './consent/activation.js';

const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_DC = process.env.MAILCHIMP_DC || 'us11';
const MAILCHIMP_LIST_ID = process.env.MAILCHIMP_JAAREVENT_LIST_ID || '0e404ef800';
const CIIIC_LIST_ID = process.env.MAILCHIMP_CIIIC_LIST_ID || '67fe159b9d';

const NOTION_SECRET = process.env.NOTION_SECRET;
const NOTION_CONTACTEN_DS_IDS = (process.env.NOTION_CONTACTEN_DS_IDS || '20811fb08c9e80958d0d000bc8cad8c8,30411fb08c9e8051a530000ba6760e6a').split(',');

const WEBHOOK_SECRET = process.env.JAAREVENT_WEBHOOK_SECRET;

/**
 * Whether the shared HMAC secret is configured.
 * Callers use this to fail loudly on a misconfigured deploy instead of
 * silently accepting unsigned webhooks.
 */
export function isWebhookSecretConfigured() {
  return Boolean(WEBHOOK_SECRET);
}

/**
 * Verify the X-Webhook-Signature header sent by the forms mu-plugin.
 *
 * forms signs the *literal* request body:
 *   hash_hmac('sha256', $payload_json, $secret)  -> lowercase hex
 * so `payload` must be the raw body bytes, never a re-serialised
 * JSON.stringify(req.body) — key order and spacing would differ.
 *
 * Fails closed: no secret, no header, or a malformed header all return false.
 */
export function verifySignature(payload, signature) {
  if (!WEBHOOK_SECRET) return false;
  if (typeof signature !== 'string') return false;
  if (payload === undefined || payload === null || payload.length === 0) return false;

  const provided = signature.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(provided)) return false;

  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
  // Both are now known to be 32 bytes, so timingSafeEqual cannot throw.
  return crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
}

/**
 * Make an HTTPS request (no external deps needed)
 */
function apiRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

/**
 * Update Mailchimp member's JAAREVENT merge field
 * Only patch existing event members. A registration is not newsletter consent.
 * addIfMissing is the pre-consent behaviour, used only while the consent route
 * is not enabled: an opted-in registrant absent from the event audience is
 * added there as subscribed.
 */
export async function updateMailchimpStatus(email, status, { request = apiRequest, addIfMissing = false, firstName = '', lastName = '' } = {}) {
  if (MAILCHIMP_LIST_ID.toLowerCase() === CIIIC_LIST_ID.toLowerCase()) {
    throw new Error('Jaarevent and CIIIC marketing audiences must be separate');
  }
  const emailHash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
  const auth = Buffer.from(`anystring:${MAILCHIMP_API_KEY}`).toString('base64');
  const headers = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
  };

  const result = await request(
    `https://${MAILCHIMP_DC}.api.mailchimp.com/3.0/lists/${MAILCHIMP_LIST_ID}/members/${emailHash}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        merge_fields: { JAAREVENT: status },
      }),
    }
  );

  if (result.status >= 400) {
    if (result.status === 404) {
      if (addIfMissing) {
        const added = await request(
          `https://${MAILCHIMP_DC}.api.mailchimp.com/3.0/lists/${MAILCHIMP_LIST_ID}/members`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              email_address: email.toLowerCase().trim(),
              status: 'subscribed',
              merge_fields: { FNAME: firstName, LNAME: lastName, JAAREVENT: status },
            }),
          }
        );
        if (added.status >= 400) throw new Error(`Mailchimp event member add failed (${added.status})`);
        console.log(`Jaarevent member added with JAAREVENT=${status}`);
        return { added: true, status };
      }
      console.log('Jaarevent member absent; event audience update skipped');
      return { skipped: true, reason: 'not_in_list' };
    }
    throw new Error(`Mailchimp event status update failed (${result.status})`);
  }

  console.log(`Mailchimp Jaarevent status updated to ${status}`);
  return { updated: true, status };
}

/**
 * Find a contact in Notion by email and update jaarevent-2026 status
 */
async function updateNotionStatus(email, status) {
  const headers = {
    'Authorization': `Bearer ${NOTION_SECRET}`,
    'Notion-Version': '2025-09-03',
    'Content-Type': 'application/json',
  };

  // Search across both data sources
  let pageId = null;

  for (const dsId of NOTION_CONTACTEN_DS_IDS) {
    const searchResult = await apiRequest(
      `https://api.notion.com/v1/data_sources/${dsId}/query`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          filter: {
            property: 'emailadres',
            email: { equals: email.toLowerCase().trim() },
          },
          page_size: 1,
        }),
      }
    );

    if (searchResult.status === 200 && searchResult.data.results?.length > 0) {
      pageId = searchResult.data.results[0].id;
      break;
    }
  }

  if (!pageId) {
    console.log('Contact not found in Notion Contacten; event status update skipped');
    return { skipped: true, reason: 'not_in_notion' };
  }

  // Update the jaarevent-2026 select property
  const updateResult = await apiRequest(
    `https://api.notion.com/v1/pages/${pageId}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        properties: {
          'jaarevent-2026': {
            select: { name: status },
          },
        },
      }),
    }
  );

  if (updateResult.status >= 400) {
    throw new Error(`Notion event status update failed (${updateResult.status})`);
  }

  console.log(`Notion jaarevent-2026 updated to ${status}`);
  return { pageId, status };
}

/**
 * Process a new registration from Gravity Forms webhook
 * GF sends form field values keyed by field ID
 */
export async function processRegistration(body, { authenticated = false, consentRoute = consentRouteEnabled(), updateEvent = updateMailchimpStatus, updateNotion = updateNotionStatus, subscribe = requestCiiicSubscription } = {}) {
  // GF webhook payload: field values by ID
  // Field 1: First name, 9: Last name, 2: Email, 3: Organisation, 11: Job title
  // Field 19: Stay informed (checkbox) — opt-in for Mailchimp newsletter
  // Field 25: Attendance, 26: IX engagement, 21/22: Track choices
  const email = body['2'] || body.email;
  const firstName = body['1'] || body.first_name || '';
  const lastName = body['9'] || body.last_name || '';
  const stayInformed = hasFieldValue(body, '19');

  if (!email) {
    throw new Error('No email address in registration payload');
  }
  if (consentRoute && stayInformed && !authenticated) throw new Error('Unauthenticated CIIIC opt-in');

  console.log(`Processing Jaarevent registration; opt-in=${stayInformed}`);

  const results = { stayInformed };

  // Event status does not confer marketing consent or create an event member.
  try {
    results.mailchimp = consentRoute
      ? await updateEvent(email, 'geregistreerd')
      : await updateEvent(email, 'geregistreerd', { addIfMissing: stayInformed, firstName, lastName });
  } catch (err) {
    console.error('Mailchimp event update error:', err.message);
    results.mailchimpError = err.message;
  }

  if (consentRoute && stayInformed) {
    try {
      results.newsletter = await subscribe({
        email, firstName, lastName, language: body.newsletter_language,
        source: 'jaarevent-2026-registration',
        consentEvidence: { kind: 'gravity-forms', signed: true, formId: '13', fieldId: '19', entryId: body.entry_id },
      });
    } catch (err) {
      console.error('CIIIC newsletter opt-in failed:', err.name);
      results.newsletterError = 'retryable';
    }
  }

  // Update Notion
  try {
    results.notion = await updateNotion(email, 'geregistreerd');
  } catch (err) {
    console.error('Notion event update error:', err.message);
    results.notionError = err.message;
  }

  return results;
}

/**
 * Process a status change from the GF mu-plugin
 */
export async function processStatusChange(body) {
  const { email, status, entry_id } = body;

  if (!email || !status) {
    throw new Error('Missing email or status in status change payload');
  }

  // Map GF registration status to our status values
  const statusMap = {
    'cancelled': 'geannuleerd',
    'confirmed': 'geregistreerd',
    'active': 'geregistreerd',
  };

  const mappedStatus = statusMap[status.toLowerCase()] || status;

  console.log(`Processing Jaarevent status change to ${mappedStatus}`);

  const results = { status: mappedStatus, entry_id };

  // Update Mailchimp
  try {
    results.mailchimp = await updateMailchimpStatus(email, mappedStatus);
  } catch (err) {
    console.error('Mailchimp event update error:', err.message);
    results.mailchimpError = err.message;
  }

  // Update Notion
  try {
    results.notion = await updateNotionStatus(email, mappedStatus);
  } catch (err) {
    console.error('Notion event update error:', err.message);
    results.notionError = err.message;
  }

  return results;
}

/**
 * Process a check-in scan (Notion only)
 */
export async function processCheckin(body) {
  const { email } = body;

  if (!email) {
    throw new Error('Missing email in check-in payload');
  }

  console.log('Processing Jaarevent check-in');

  const results = {};

  // Update Mailchimp
  try {
    results.mailchimp = await updateMailchimpStatus(email, 'aanwezig');
  } catch (err) {
    console.error('Mailchimp event update error:', err.message);
    results.mailchimpError = err.message;
  }

  // Update Notion
  try {
    results.notion = await updateNotionStatus(email, 'aanwezig');
  } catch (err) {
    console.error('Notion event update error:', err.message);
    results.notionError = err.message;
  }

  return results;
}
