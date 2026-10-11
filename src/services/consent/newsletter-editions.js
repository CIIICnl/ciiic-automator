// Edition contract with ciiic-nieuwsbrief. The newsletter app builds two
// static Brevo edition lists (NL, EN) and two draft campaigns; a person
// presses send in Brevo. It cannot claim per recipient before that attempt,
// so the ledger is filled from the other side: a snapshot when the edition
// is prepared, and Brevo marketing events (delivered, unsubscribe, ...) per
// campaign afterwards. See docs/reference/ciiic-consent-preparation.md
// § Editiecontract met nieuwsbrief.
import { canonicalEmail } from './migration.js';
import { editionSummary, prepareEdition } from './editions.js';

const LANGUAGES = ['nl', 'en'];
// A frozen edition with recipients still `ready` and no Brevo event for this
// long is "uncertain": the campaign may be queued, suspended or partially
// sent. The ledger keeps those entries open; it never marks them sent.
export const UNCERTAIN_AFTER_MS = 24 * 3600 * 1000;

function positiveId(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function perLanguageIds(value, label, { required }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  const ids = {};
  for (const language of LANGUAGES) {
    const raw = value[language];
    if (raw === null || raw === undefined) {
      if (language === 'nl' || required) throw new Error(`Invalid ${label}`);
      ids[language] = null;
      continue;
    }
    const id = positiveId(raw);
    if (!id) throw new Error(`Invalid ${label}`);
    ids[language] = id;
  }
  return ids;
}

export function validateSnapshot(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid snapshot body');
  if (typeof body.documentId !== 'string' || !body.documentId.trim() || body.documentId.length > 200) throw new Error('Invalid documentId');
  const campaigns = perLanguageIds(body.campaigns, 'campaigns', { required: false });
  const lists = perLanguageIds(body.lists, 'lists', { required: false });
  for (const language of LANGUAGES) {
    if ((campaigns[language] === null) !== (lists[language] === null)) throw new Error('Invalid campaigns');
  }
  if ([lists.nl, lists.en].some((id) => id === 2 || id === 3)) throw new Error('Invalid lists');
  if (!Array.isArray(body.recipients) || body.recipients.length > 50000) throw new Error('Invalid recipients');
  const recipients = body.recipients.map((row) => {
    const email = canonicalEmail(row?.email);
    if (!email || !LANGUAGES.includes(row?.language)) throw new Error('Invalid recipient');
    if (campaigns[row.language] === null) throw new Error('Recipient language has no campaign');
    return { email, language: row.language };
  });
  return { documentId: body.documentId.trim(), campaigns, lists, recipients };
}

async function allEditions(store) {
  if (!store?.listEditions) throw new Error('Durable edition store required');
  return store.listEditions();
}

export async function findEditionByCampaign(store, campaignId) {
  const id = positiveId(campaignId);
  if (!id) return null;
  for (const edition of await allEditions(store)) {
    const campaigns = edition.state?.meta?.campaigns ?? {};
    const language = LANGUAGES.find((lang) => campaigns[lang] === id);
    if (language) return { editionId: edition.editionId, language, meta: edition.state.meta };
  }
  return null;
}

/**
 * Register or refresh the snapshot. Eligibility comes from the consent
 * register; the language comes from the newsletter, because that is the
 * Brevo list the person is actually in. Refused once frozen.
 */
export async function registerSnapshot(store, editionId, body, { now = () => Date.now() } = {}) {
  const snapshot = validateSnapshot(body);
  for (const edition of await allEditions(store)) {
    if (edition.editionId === editionId) continue;
    const other = edition.state?.meta?.campaigns ?? {};
    if (LANGUAGES.some((lang) => snapshot.campaigns[lang] && Object.values(other).includes(snapshot.campaigns[lang]))) {
      throw new Error('Campaign already belongs to another edition');
    }
  }
  const existing = await store.getEdition(editionId);
  if (existing?.state?.frozen) {
    const error = new Error('Edition is frozen after first provider attempt');
    error.code = 'FROZEN';
    throw error;
  }
  const excluded = [];
  let languageDiffersFromRegister = 0;
  const contacts = [];
  for (const recipient of snapshot.recipients) {
    const record = await store.get(recipient.email);
    let reason = null;
    if (!record) reason = 'unknown_contact';
    else if (record.suppressed) reason = 'suppressed';
    else if (record.consent !== 'confirmed') reason = 'consent_not_confirmed';
    else if (record.preferenceConflict) reason = 'preference_conflict';
    if (reason) { excluded.push({ email: recipient.email, reason }); continue; }
    if (record.language && record.language !== recipient.language) languageDiffersFromRegister += 1;
    contacts.push({ email: recipient.email, language: recipient.language, consent: 'confirmed' });
  }
  const meta = { documentId: snapshot.documentId, campaigns: snapshot.campaigns, lists: snapshot.lists,
    snapshotAt: new Date(now()).toISOString(), lastEventAt: null, lastSuppressionAt: null, anomalies: {} };
  const counts = await prepareEdition(store, editionId, contacts, meta);
  return { ...counts, excluded, languageDiffersFromRegister };
}

async function updateEdition(store, editionId, change) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await store.getEdition(editionId);
    if (!current) return null;
    const state = structuredClone(current.state);
    const value = change(state);
    if (value === false) return null;
    try {
      await store.putEdition(editionId, state, current.version);
      return value;
    } catch (error) {
      if (error.code !== 'VERSION_CONFLICT' || attempt === 4) throw error;
    }
  }
  return null;
}

/**
 * A Brevo delivered/sent event is the provider receipt: it claims and
 * confirms in one step and freezes the edition on the first one. Deliveries
 * outside the snapshot, in the wrong language or after suppression are kept
 * as anomaly counts; they are never silently accepted.
 */
export async function recordEditionDelivery(store, { campaignId, email: rawEmail, occurredAt, eventId }) {
  const email = canonicalEmail(rawEmail);
  const edition = await findEditionByCampaign(store, campaignId);
  if (!edition || !email) return { applied: false, reason: 'not_an_edition_campaign' };
  const result = await updateEdition(store, edition.editionId, (state) => {
    state.frozen = true;
    state.meta.lastEventAt = occurredAt;
    const entry = state.assignments[email];
    const flag = (name) => { state.meta.anomalies[name] = (state.meta.anomalies[name] || 0) + 1; return { applied: true, anomaly: name }; };
    if (!entry) return flag('delivered_outside_snapshot');
    if (entry.outcome === 'sent') return false;
    if (entry.language !== edition.language) return flag('delivered_wrong_language');
    if (entry.outcome === 'suppressed') return flag('delivered_after_suppression');
    state.assignments[email] = { ...entry, outcome: 'sent', provider: 'brevo',
      receipt: { campaignId: Number(campaignId), eventId, occurredAt } };
    return { applied: true, editionId: edition.editionId };
  });
  return result ?? { applied: false, reason: 'duplicate' };
}

/**
 * Suppression route (b): the automator owns the Brevo account, so it removes
 * a suppressed contact from every edition list where it is still `ready`.
 * The entry flips to `suppressed` only after Brevo accepted the removal; a
 * failure throws, so the webhook answers 503 and Brevo retries.
 */
export async function applyEditionSuppression(store, rawEmail, { removeFromList, occurredAt }) {
  const email = canonicalEmail(rawEmail);
  if (!email) return 0;
  let removed = 0;
  for (const edition of await allEditions(store)) {
    const entry = edition.state?.assignments?.[email];
    if (!entry || entry.outcome !== 'ready') continue;
    const listId = edition.state.meta?.lists?.[entry.language];
    if (listId) await removeFromList(listId, email);
    await updateEdition(store, edition.editionId, (state) => {
      if (state.assignments[email]?.outcome !== 'ready') return false;
      state.assignments[email].outcome = 'suppressed';
      state.meta.lastSuppressionAt = occurredAt;
      return true;
    });
    removed += 1;
  }
  return removed;
}

export async function editionStatus(store, editionId, { now = () => Date.now() } = {}) {
  const edition = await store.getEdition(editionId);
  if (!edition) return null;
  const summary = await editionSummary(store, editionId);
  const meta = edition.state.meta ?? {};
  const lastSignal = Date.parse(meta.lastEventAt ?? '') || null;
  const uncertain = Boolean(edition.state.frozen && summary.ready > 0 && lastSignal &&
    now() - lastSignal > UNCERTAIN_AFTER_MS);
  return { ...summary, documentId: meta.documentId ?? null, campaigns: meta.campaigns ?? null,
    snapshotAt: meta.snapshotAt ?? null, lastEventAt: meta.lastEventAt ?? null,
    lastSuppressionAt: meta.lastSuppressionAt ?? null, anomalies: meta.anomalies ?? {}, uncertain };
}
