// Brevo keeps the newsletter language in the category attribute LANGUAGE
// (since 2026-10-08; the text attribute TAAL is gone). Writes take the
// enumeration number, reads return it as a digit string. The numbers are not
// trusted blindly: the codec is built from the live enumeration and refuses
// anything that does not map to exactly English and Nederlands.
export const BREVO_LANGUAGE_ATTRIBUTE = 'LANGUAGE';
const LANGUAGE_BY_LABEL = Object.freeze({ english: 'en', nederlands: 'nl' });

export function createLanguageCodec(enumeration) {
  if (!Array.isArray(enumeration)) throw new Error('Brevo LANGUAGE enumeration missing');
  const valueByLanguage = {};
  const languageByValue = new Map();
  for (const item of enumeration) {
    const value = Number(item?.value);
    const language = LANGUAGE_BY_LABEL[String(item?.label ?? '').trim().toLowerCase()];
    if (!Number.isSafeInteger(value) || !language || valueByLanguage[language] !== undefined) {
      throw new Error('Brevo LANGUAGE enumeration changed');
    }
    valueByLanguage[language] = value;
    languageByValue.set(String(value), language);
  }
  if (enumeration.length !== 2 || valueByLanguage.nl === undefined || valueByLanguage.en === undefined) {
    throw new Error('Brevo LANGUAGE enumeration changed');
  }
  return Object.freeze({
    toValue(language) {
      const value = valueByLanguage[language];
      if (value === undefined) throw new Error('Invalid language');
      return value;
    },
    // Accepts the stored number (as number or digit string) and, for webhook
    // payloads, the label. Empty means "no preference"; anything else throws.
    fromValue(raw) {
      if (raw === undefined || raw === null || String(raw).trim() === '') return null;
      const text = String(raw).trim();
      const language = /^\d+$/.test(text) ? languageByValue.get(text) : LANGUAGE_BY_LABEL[text.toLowerCase()];
      if (!language) throw new Error('Invalid Brevo language value');
      return language;
    },
  });
}

export function languageCodecFromAttributes(data) {
  const attribute = Array.isArray(data?.attributes) ? data.attributes.find(item => item?.name === BREVO_LANGUAGE_ATTRIBUTE) : null;
  if (!attribute || attribute.category !== 'category') throw new Error('Brevo LANGUAGE category attribute missing');
  return createLanguageCodec(attribute.enumeration);
}

// Reads GET /v3/contacts/attributes once per process. A failed read is not
// cached, so the next request retries instead of staying broken.
export function createLanguageCodecLoader({ apiKey, transport }) {
  let pending = null;
  return () => {
    pending ??= (async () => {
      if (!apiKey) throw new Error('Brevo API key missing for LANGUAGE enumeration');
      const result = await transport('https://api.brevo.com/v3/contacts/attributes', { method: 'GET', headers: { 'api-key': apiKey } });
      if (result.status !== 200) throw new Error(`Brevo attribute lookup failed (${result.status})`);
      return languageCodecFromAttributes(result.data);
    })().catch((error) => { pending = null; throw error; });
    return pending;
  };
}
