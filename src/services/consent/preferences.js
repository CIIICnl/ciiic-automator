// Keep all choices whose relative order is not proven. Snapshot intervals are
// (previous observation, current observation], never exact modification times.
function supersedes(newer, older) {
  if (newer.from === null) return false;
  if (newer.from > older.to || (newer.openStart && newer.from === older.to)) return true;
  if (newer.from !== newer.to || older.from !== older.to || newer.to !== older.to) return false;
  const priority = source => ['brevo', 'brevo-profile'].includes(source) ? 2 : 1;
  return priority(newer.source) > priority(older.source);
}

export function applyPreference(record, event, language) {
  const observation = event.type === 'preference-observation';
  const to = Date.parse(observation ? event.observedAt : event.occurredAt);
  const from = observation ? (event.previousObservedAt === null ? null : Date.parse(event.previousObservedAt)) : to;
  if (!Number.isFinite(to) || (from !== null && (!Number.isFinite(from) || (observation && from >= to)))) {
    throw new Error('Invalid preference interval');
  }
  const incoming = { id: event.id, source: event.source, language, from, to,
    openStart: observation && from !== null, reason: event.reason || null,
    sourceChangedAt: event.sourceChangedAt || null };
  let candidates = record.preferenceEvidence;
  if (!candidates) {
    // Compatibility with pre-interval records. Existing conflicts stay blocked
    // until newer evidence; no consent or suppression state is changed here.
    candidates = record.languageAt === null ? [] : [{ id: 'legacy', source: record.languageSource,
      language: record.preferenceConflict ? null : record.language,
      from: record.languageAt, to: record.languageAt, openStart: false }];
  }
  const combined = [...candidates, incoming];
  const frontier = combined.filter(candidate => !combined.some(other => other !== candidate && supersedes(other, candidate)));
  frontier.sort((a, b) => a.to - b.to || a.source.localeCompare(b.source) || a.id.localeCompare(b.id));
  record.preferenceEvidence = frontier;
  const languages = new Set(frontier.map(candidate => candidate.language));
  record.preferenceConflict = languages.has(null) || languages.size !== 1;
  record.language = record.preferenceConflict ? null : frontier[0].language;
  const latest = frontier[frontier.length - 1];
  record.languageSource = latest.source;
  record.languageAt = latest.from === latest.to ? latest.to : null;
  record.languageWindow = latest.from === latest.to ? null : { after: latest.from, through: latest.to };
}
