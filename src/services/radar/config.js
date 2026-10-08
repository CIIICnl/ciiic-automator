/**
 * Radar signals — configuration + v1 source allowlist.
 *
 * The relay scans this allowlist daily, extracts event candidates, dedups them
 * and POSTs them to the monitor Radar ingest endpoint. Monitor owns the store
 * (`monitor_signals`) and the promote-to-Notion action; the relay never writes
 * to Notion here. See:
 *   - monitor/docs/todos/radar-signals-design.md
 *   - _meta/.../from-monitor--to-ciiic-automator--radar-signals-ingest.md
 *   - docs/radar-source-recon-2026-07-09.md (which sources are machine-readable)
 */

// Ingest endpoint on monitor (contract: POST { signals: [...] }, bearer auth).
export const INGEST_URL =
  process.env.RADAR_INGEST_URL || 'https://monitor.ciiic.nl/api/radar/ingest';

// Shared bearer secret with monitor (RADAR_INGEST_SECRET, must match both sides).
export const INGEST_SECRET = process.env.RADAR_INGEST_SECRET || '';

// Scan-health endpoint on monitor (POST { reports: [...] }, same bearer). Defaults
// to the /scan-report sibling of the ingest URL. See scanreport.js for the contract.
export const SCAN_REPORT_URL =
  process.env.RADAR_SCAN_REPORT_URL ||
  INGEST_URL.replace(/\/ingest\/?$/, '/scan-report');

// Relevance floor for POSTing at all. Monitor shows >= 50 in the default inbox;
// we post a bit lower so borderline items are still available under the fold,
// but drop clear noise to save ingest volume. Override via RADAR_RELEVANCE_FLOOR.
export const RELEVANCE_FLOOR = Number(process.env.RADAR_RELEVANCE_FLOOR ?? 30);

// Cap on new/changed items processed per source per run (guards LLM cost and a
// runaway first run against XRMust's 4600-event backlog). Override per env.
export const MAX_ITEMS_PER_SOURCE = Number(process.env.RADAR_MAX_PER_SOURCE ?? 40);

// Daily scan time (local Europe/Amsterdam hour, 24h). Override via RADAR_SCAN_HOUR.
export const SCAN_HOUR = Number(process.env.RADAR_SCAN_HOUR ?? 7);

// Local seen-store / watermark DB (Docker volume at /data).
export const DB_PATH = process.env.RADAR_DB_PATH || '/data/radar.sqlite';

// A descriptive UA so source operators can identify the scanner.
export const USER_AGENT =
  process.env.RADAR_USER_AGENT || 'ciiic-radar/1.0 (+https://bot.ciiic.nl)';

/**
 * Source allowlist. Each entry:
 *   key       stable source key sent as `source` in the signal
 *   type      event | research | funding | news   (drives extractor + date semantics)
 *   label     human name (logs)
 *   method    api | csv | arxiv | research-rss | news-rss | sedia
 *   enabled   toggle without code change
 *
 * Phase 1 = events. Phase 2 = research + funding (see
 * docs/radar-fase2-recon-2026-07-09.md for which feeds proved machine-readable).
 * Phase 2c = news (RSS feeds probed live 2026-07-09; see
 * monitor/docs/reference/radar-sources-news.md).
 * The philosophy is unchanged: reliably-parseable feeds ship ON; scrape /
 * newsletter-LLM sources are scaffolded OFF behind a flag until hardened.
 */
export const SOURCES = [
  // ---- events (phase 1) ---------------------------------------------------
  {
    key: 'xrmust',
    type: 'event',
    label: 'XRMust — XR Agenda',
    method: 'api',
    // WP REST custom post type; incremental via orderby=modified.
    apiBase: 'https://xrmust.com/wp-json/wp/v2/all-events',
    enabled: true,
  },
  {
    key: 'immersive-filmmaking-sheet',
    type: 'event',
    label: 'Immersive Filmmaking Calendar (Google Sheet)',
    method: 'csv',
    sheetId: '1kFw_-vefPcqAVVZOaw5YeK67IH7JiaTS2RH9lWNr4hk',
    // Empty = export the first (default) tab; the first tab's gid is NOT 0 here,
    // and export?format=csv&gid=0 400s. Set RADAR_SHEET_GID to target another tab.
    gid: process.env.RADAR_SHEET_GID || '',
    enabled: true,
  },

  // ---- research (phase 2) -------------------------------------------------
  // Narrow feeds: every item gets an LLM relevance pass.
  {
    key: 'arxiv-hci',
    type: 'research',
    label: 'arXiv cs.HC',
    method: 'arxiv',
    arxivCat: 'cs.HC',
    enabled: true,
  },
  {
    key: 'arxiv-gr',
    type: 'research',
    label: 'arXiv cs.GR',
    method: 'arxiv',
    arxivCat: 'cs.GR',
    enabled: true,
  },
  {
    key: 'frontiers-vr',
    type: 'research',
    label: 'Frontiers in Virtual Reality',
    method: 'research-rss',
    rssUrl: 'https://www.frontiersin.org/journals/virtual-reality/rss',
    enabled: true,
  },
  {
    key: 'computers-graphics',
    type: 'research',
    label: 'Elsevier — Computers & Graphics',
    method: 'research-rss',
    rssUrl: 'https://rss.sciencedirect.com/publication/science/00978493',
    enabled: true,
  },
  // Springer + Nature served a JS bot-challenge page to server-side fetch on
  // 2026-07-09; from the production box both returned real RSS on 2026-10-08.
  // Springer is still intermittent elsewhere, so a challenge day yields 0 items
  // (visible in the scan-report), not a crash. Switched on in the relaybot
  // Coolify env (RADAR_ENABLE_SPRINGER=1 / RADAR_ENABLE_NATURE=1).
  {
    key: 'springer-vr',
    type: 'research',
    label: 'Springer — Virtual Reality',
    method: 'research-rss',
    rssUrl: 'https://link.springer.com/search.rss?facet-journal-id=10055&query=&sortOrder=newestFirst',
    enabled: process.env.RADAR_ENABLE_SPRINGER === '1',
  },
  {
    key: 'nature-heritage',
    type: 'research',
    label: 'Nature — Scientific Reports (XR-filtered)',
    method: 'research-rss',
    rssUrl: 'https://www.nature.com/srep.rss',
    keywordFilter: true,
    enabled: process.env.RADAR_ENABLE_NATURE === '1',
  },

  // ---- news (phase 2c) ----------------------------------------------------
  // Per-article RSS feeds; every fresh item (max RADAR_NEWS_MAX_AGE_DAYS old)
  // gets an LLM relevance pass. The news prompt weights cultural/creative/policy
  // angles up and consumer-gaming down — the floor drops hardware-review noise.
  {
    key: 'xrmust-news',
    type: 'news',
    label: 'XRMust — XR Magazine (news)',
    method: 'news-rss',
    // Separate from the 'xrmust' events API: this is the editorial WP posts feed
    // (immersive storytelling/industry pieces) — the most on-remit news source.
    rssUrl: 'https://xrmust.com/feed/',
    enabled: true,
  },
  {
    key: 'ar-insider',
    type: 'news',
    label: 'AR Insider',
    method: 'news-rss',
    rssUrl: 'https://arinsider.co/feed/',
    enabled: true,
  },
  {
    key: 'voices-of-vr',
    type: 'news',
    label: 'Voices of VR (Kent Bye)',
    method: 'news-rss',
    // Podcast feed (200-item history) — the news-rss max-age cutoff keeps the
    // first run to recent episodes.
    rssUrl: 'https://voicesofvr.com/feed/',
    enabled: true,
  },
  {
    key: 'roadtovr',
    type: 'news',
    label: 'Road to VR',
    method: 'news-rss',
    // Consumer-leaning; the news extractor scores gaming/hardware items low, so
    // mostly industry/policy pieces clear the floor.
    rssUrl: 'https://www.roadtovr.com/feed/',
    enabled: true,
  },
  // Left out (decided 2026-10-08, see docs/plans/done/decisions.md): UploadVR
  // (high volume, overlaps Road to VR), xrtoday.com (522 on recon), Immersive
  // Wire (multi-item digests; single-item extraction mis-dated events) and
  // EurekAlert (feed URL 404s).

  // ---- funding (phase 2) --------------------------------------------------
  // EU calls via the SEDIA search-API (one query covers several programmes; each
  // topic is tagged with its matching seed source key). NOT CIIIC's own schemes.
  {
    key: 'eu-sedia',
    type: 'funding',
    label: 'EU Funding & Tenders (SEDIA search-API)',
    method: 'sedia',
    enabled: true,
  },
  // National funds are single-page scrapes (Filmfonds, CNC, Medienboard,
  // Stimuleringsfonds); coe.int/vaf.be block plain fetch. Scaffolded OFF → phase 2b.
];

export function enabledSources() {
  return SOURCES.filter((s) => s.enabled);
}

export function isConfigured() {
  return Boolean(INGEST_SECRET);
}
