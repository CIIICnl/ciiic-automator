/**
 * Generic newsletter opt-in webhook for Gravity Forms.
 *
 * Any form on forms.ciiic.nl can subscribe opted-in registrants to a
 * Mailchimp audience without a code change here: the field mapping and
 * the target list travel in the webhook feed URL.
 *
 *   POST /webhook/newsletter-optin?list=ixlabs&tag=ixlabs-opening-2026
 *        &email=3&fname=1&lname=2&org=4&optin=5
 *
 * Query parameters:
 *   list   audience alias (see LISTS) or a raw Mailchimp list id  [required]
 *   email  field id of the email address                          [required]
 *   optin  field id of the opt-in checkbox; empty → skipped       [optional]
 *          omit to subscribe every submission (explicit consent forms only)
 *   fname, lname, org  field ids for the merge fields              [optional]
 *   tag    Mailchimp tag to add                                    [optional]
 *
 * The request body is the Gravity Forms "all fields" payload (keys are
 * field ids; checkbox inputs arrive as "<id>.<n>").
 */

import https from 'https';
import crypto from 'crypto';

const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_DC = process.env.MAILCHIMP_DC || 'us11';

// Audience aliases. orgMergeTag: where the organisation lands, if the
// audience has such a merge field.
const LISTS = {
  ciiic: { id: process.env.MAILCHIMP_CIIIC_LIST_ID || '67fe159b9d', orgMergeTag: 'MMERGE6' },
  ixlabs: { id: process.env.MAILCHIMP_IXLABS_LIST_ID || 'cb4026d302', orgMergeTag: null },
};

function apiRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = https.request(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// Field value by id: plain fields sit at body[id]; checkbox inputs at
// body["id.1"], body["id.2"], ... (joined, non-empty ones only).
export function fieldValue(body, id) {
  if (id === undefined || id === null || id === '') return '';
  const key = String(id);
  if (body[key] !== undefined && body[key] !== null && String(body[key]).trim() !== '') {
    return String(body[key]).trim();
  }
  const parts = Object.keys(body)
    .filter((k) => k.startsWith(`${key}.`))
    .map((k) => String(body[k] ?? '').trim())
    .filter(Boolean);
  return parts.join(', ');
}

export function resolveList(alias) {
  if (!alias) return null;
  if (LISTS[alias]) return { alias, ...LISTS[alias] };
  if (/^[a-f0-9]{10}$/i.test(alias)) return { alias, id: alias, orgMergeTag: null };
  return null;
}

async function subscribe({ list, email, firstName, lastName, organisation, tag }) {
  const auth = Buffer.from(`anystring:${MAILCHIMP_API_KEY}`).toString('base64');
  const emailHash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
  const merge_fields = { FNAME: firstName || '', LNAME: lastName || '' };
  if (organisation && list.orgMergeTag) merge_fields[list.orgMergeTag] = organisation;

  // PUT upserts: existing members keep their status, new ones subscribe.
  const result = await apiRequest(
    `https://${MAILCHIMP_DC}.api.mailchimp.com/3.0/lists/${list.id}/members/${emailHash}`,
    {
      method: 'PUT',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email_address: email.toLowerCase().trim(),
        status_if_new: 'subscribed',
        merge_fields,
        tags: [tag].filter(Boolean),
      }),
    }
  );
  if (result.status >= 400) {
    throw new Error(`Mailchimp error ${result.status}: ${JSON.stringify(result.data)}`);
  }
  return result.data;
}

/**
 * Process one webhook call. `query` = parsed URL query, `body` = GF payload.
 */
export async function processNewsletterOptin(query, body) {
  const list = resolveList(query.list);
  if (!list) throw new Error(`Unknown or missing list: ${query.list || '(none)'}`);
  if (!query.email) throw new Error('Missing email field id (?email=)');

  const formId = String(body.form_id || body.formId || '?');
  const email = fieldValue(body, query.email);
  const firstName = fieldValue(body, query.fname);
  const lastName = fieldValue(body, query.lname);
  const organisation = fieldValue(body, query.org);
  const tag = (query.tag || '').trim();

  if (!email) throw new Error(`No email address in payload (form ${formId}, field ${query.email})`);

  const optedIn = query.optin ? Boolean(fieldValue(body, query.optin)) : true;
  console.log(
    `📝 Newsletter opt-in (form ${formId} → ${list.alias}${tag ? `, tag ${tag}` : ''}): ${firstName} ${lastName} <${email}> opt-in=${optedIn}`
  );

  if (!optedIn) return { skipped: true, reason: 'no_optin', email };

  const mc = await subscribe({ list, email, firstName, lastName, organisation, tag });
  console.log(`✅ Mailchimp ${list.alias}: ${email} ${mc.status}${tag ? ` (tag: ${tag})` : ''}`);
  return { subscribed: true, email, list: list.alias, tag, mailchimp_status: mc.status };
}
