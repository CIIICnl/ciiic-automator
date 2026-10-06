import crypto from 'node:crypto';
import { normalizeEmail } from './store.js';

async function request(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
  let data;
  try { data = await response.json(); } catch { data = {}; }
  return { status: response.status, data };
}

export function createMailchimpProvider({ apiKey = process.env.MAILCHIMP_API_KEY, dc = process.env.MAILCHIMP_DC || 'us11', listId = process.env.MAILCHIMP_CIIIC_LIST_ID || '67fe159b9d', transport = request } = {}) {
  if (!apiKey || !/^[a-z0-9-]+$/i.test(dc) || listId !== '67fe159b9d' || listId === (process.env.MAILCHIMP_JAAREVENT_LIST_ID || '0e404ef800')) throw new Error('Mailchimp CIIIC list binding invalid');
  const base = `https://${dc}.api.mailchimp.com/3.0/lists/${listId}/members`;
  const headers = { Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`, 'Content-Type': 'application/json' };
  const memberUrl = email => `${base}/${crypto.createHash('md5').update(normalizeEmail(email)).digest('hex')}`;
  return {
    name: 'mailchimp',
    async read(email) {
      const result = await transport(memberUrl(email), { method: 'GET', headers });
      if (result.status === 404) return null;
      if (result.status !== 200) throw new Error(`Mailchimp lookup failed (${result.status})`);
      return { exists: true, status: result.data.status, suppressed: ['unsubscribed', 'cleaned'].includes(result.data.status) };
    },
    async requestDoi({ email, firstName, lastName, language }) {
      const result = await transport(base, { method: 'POST', headers, body: JSON.stringify({ email_address: normalizeEmail(email), status: 'pending', merge_fields: { FNAME: firstName || '', LNAME: lastName || '' }, interests: { ed25c3d4cc: language === 'nl', d32b374b91: language === 'en' } }) });
      if (result.status < 200 || result.status >= 300) throw new Error(`Mailchimp DOI request failed (${result.status})`);
      if (result.data.status !== 'pending') throw new Error('Mailchimp did not return pending status');
      return { pending: true };
    },
  };
}

export function createBrevoProvider({ apiKey = process.env.BREVO_API_KEY2, listId = process.env.BREVO_CIIIC_LIST_ID, templateId = process.env.BREVO_DOI_TEMPLATE_ID, redirectionUrl = process.env.BREVO_DOI_REDIRECT_URL, transport = request } = {}) {
  const listSyntaxValid = typeof listId === 'number' ? Number.isInteger(listId) : typeof listId === 'string' && /^\d+$/.test(listId);
  const templateSyntaxValid = typeof templateId === 'number' ? Number.isInteger(templateId) : typeof templateId === 'string' && /^\d+$/.test(templateId);
  const list = Number(listId);
  const template = Number(templateId);
  if (!apiKey || !listSyntaxValid || !Number.isSafeInteger(list) || list < 1 || [2, 3].includes(list) || !templateSyntaxValid || !Number.isSafeInteger(template) || template < 1) throw new Error('Brevo DOI configuration incomplete or test list selected');
  if (!/^https:\/\//.test(redirectionUrl || '')) throw new Error('Brevo DOI redirect must be HTTPS');
  const headers = { 'api-key': apiKey, 'Content-Type': 'application/json' };
  return {
    name: 'brevo',
    async read(email) {
      const result = await transport(`https://api.brevo.com/v3/contacts/${encodeURIComponent(normalizeEmail(email))}`, { method: 'GET', headers });
      if (result.status === 404) return null;
      if (result.status !== 200) throw new Error(`Brevo lookup failed (${result.status})`);
      return { exists: true, status: result.data.emailBlacklisted ? 'unsubscribed' : 'existing', suppressed: Boolean(result.data.emailBlacklisted || result.data.listUnsubscribed?.includes(list)), listIds: result.data.listIds || [] };
    },
    async requestDoi({ email, firstName, lastName, language }) {
      const result = await transport('https://api.brevo.com/v3/contacts/doubleOptinConfirmation', { method: 'POST', headers, body: JSON.stringify({ email: normalizeEmail(email), includeListIds: [list], templateId: template, redirectionUrl, attributes: { FIRSTNAME: firstName || '', LASTNAME: lastName || '', TAAL: language } }) });
      if (result.status !== 201) throw new Error(`Brevo DOI request failed (${result.status})`);
      return { pending: true };
    },
  };
}

export function getConfiguredProvider() {
  const name = process.env.CIIIC_MARKETING_PROVIDER || 'mailchimp';
  if (name === 'mailchimp') return createMailchimpProvider();
  if (name === 'brevo') return createBrevoProvider();
  throw new Error('Unknown CIIIC marketing provider');
}
