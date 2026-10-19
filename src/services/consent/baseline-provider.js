import { mailchimpMembers, brevoContacts, brevoLists, brevoLanguageEnumeration, resolveTargetList } from '../../../scripts/consent-preflight.mjs';

async function brevo(method, endpoint, body, fetcher) {
  const key = process.env.BREVO_API_KEY2 || process.env.BREVO_API_KEY;
  if (!key) throw new Error('Brevo API key required');
  const response = await fetcher(`https://api.brevo.com/v3${endpoint}`, {
    method, headers: { 'api-key': key, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000),
  });
  if (method === 'GET' && response.status === 404) return null;
  if (!response.ok) throw new Error(`Brevo ${method} failed (${response.status})`);
  return response.status === 204 ? null : response.json();
}

export function createBaselineProvider({ folderId, fetcher = fetch } = {}) {
  if (!Number.isSafeInteger(folderId) || folderId < 1) throw new Error('Approved Brevo folder ID required');
  return {
    inventory: async () => {
      const [members, contacts, lists, languageEnumeration] = await Promise.all([
        mailchimpMembers(), brevoContacts(), brevoLists(), brevoLanguageEnumeration(),
      ]);
      return { members, contacts, lists, languageEnumeration };
    },
    resolveTarget: (lists) => resolveTargetList(lists, process.env.BREVO_CIIIC_LIST_ID),
    createList: async (name) => {
      const result = await brevo('POST', '/contacts/lists', { name, folderId }, fetcher);
      return Number(result?.id);
    },
    contact: (email) => brevo('GET', `/contacts/${encodeURIComponent(email)}?identifierType=email_id`, null, fetcher),
    removeFromList: (email, listId) => brevo('PUT',
      `/contacts/${encodeURIComponent(email)}?identifierType=email_id`, { unlinkListIds: [listId] }, fetcher),
    upsert: async (email, payload, exists) => {
      if (exists) await brevo('PUT', `/contacts/${encodeURIComponent(email)}?identifierType=email_id`, payload, fetcher);
      else await brevo('POST', '/contacts', payload, fetcher);
    },
  };
}
