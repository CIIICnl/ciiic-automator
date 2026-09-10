Status: afgerond — 2026-09-10 · TODO-adres: geen (uitgevoerd vóór de werkwijze hier stond) · hangt samen met: `publieke-waarden-2` (frontend), `docs/plans/TODO.md` #1 (productie-smoke-test staat nog open)

Uitgevoerd: `src/services/drafts.js`, de `/draft/*`-router in `src/index.js`, `sendDraftResumeEmail()` in `src/services/brevo.js`, het `drafts_data`-volume in `docker-compose.yml` en de README-sectie staan alle in `main`. Van de open vragen onderaan zijn 2 (trust proxy, `app.set('trust proxy', 1)` in `src/index.js`), 4 (herhaalbaar, geen single-use) en 8 (er is een `deleteDraft`) in de bouw beslist; vraag 5 (deliverability) is nooit getoetst en leeft door als TODO-item 1. De tekst hieronder is de oorspronkelijke briefing, ongewijzigd bewaard als naslag.

---

# Briefing: Draft-Resume Endpoints for Publieke Waarden Zelftoets

**Context:** `publicvalues.ciiic.nl` (Astro static site, hosted on Netlify) lets users fill in a multi-step self-assessment and download the result as PDF. We want to add a **"bewaar en ga later verder"** feature: the user enters an email, we store the draft server-side, we email them a magic link like `https://publicvalues.ciiic.nl/?draft=TOKEN` that restores the form when clicked.

The frontend is a static site with no backend. This briefing covers what needs to happen **in `ciiic-automator` (bot.ciiic.nl)** to serve as that backend. The frontend work is tracked separately in the `publieke-waarden-2` repo and does not need your attention.

---

## High-level flow

```
User (publicvalues.ciiic.nl)
    │
    │  1. POST /draft/save { data, email }
    ▼
bot.ciiic.nl (ciiic-automator)
    │
    │  2. store in SQLite, generate token
    │  3. send Brevo email with magic link
    ▼
User's inbox
    │
    │  4. click link → https://publicvalues.ciiic.nl/?draft=TOKEN
    ▼
publicvalues.ciiic.nl
    │
    │  5. GET /draft/:token
    ▼
bot.ciiic.nl returns { data, createdAt }
    │
    ▼
Form is rehydrated in the browser
```

The magic link **is** the auth: anyone holding the token can read that draft. The email copy must tell the user not to share it. 30-day retention, then purged.

---

## What to build

### 1. New service: `src/services/drafts.js`

SQLite-backed store. Suggested dependency: `better-sqlite3` (sync API, no ORM needed, single file DB).

```js
// API surface
export function saveDraft({ data, email }) // → { token, expiresAt }
export function getDraft(token)             // → { data, createdAt, expiresAt } | null
export function purgeExpired()              // → number of rows removed
export function initDraftsDb()              // called once at boot
```

**Schema:**

```sql
CREATE TABLE IF NOT EXISTS drafts (
  token       TEXT PRIMARY KEY,     -- 32 random bytes, base64url
  data        TEXT NOT NULL,        -- JSON-stringified form values
  email       TEXT NOT NULL,        -- lowercased
  created_at  INTEGER NOT NULL,     -- unix ms
  expires_at  INTEGER NOT NULL      -- created_at + 30 days
);
CREATE INDEX IF NOT EXISTS drafts_expires_at ON drafts(expires_at);
CREATE INDEX IF NOT EXISTS drafts_email_created ON drafts(email, created_at);
```

**Token generation:** `crypto.randomBytes(32).toString('base64url')` → ~43 chars, URL-safe.

**Data column size:** expect ≤50 KB per row (the form has ~25 fields with text answers). No need for separate columns per field; store the entire `data` object verbatim so the schema doesn't need to evolve when the form does.

**DB file location:** `/data/drafts.sqlite` inside the container. Docker volume mount required (see §6).

**Purge job:** call `purgeExpired()` on boot and every 6 hours via `setInterval`. Log how many rows were removed.

---

### 2. New endpoints in `src/index.js`

Both under `/draft/*`. Both require CORS (see §5). Both rate-limited (see §4).

#### `POST /draft/save`

**Request body:**
```json
{
  "data": { "...": "form values, any JSON object" },
  "email": "user@example.com"
}
```

**Validation:**
- `data` must be an object, serialized JSON must be ≤ 256 KB (reject with 413 otherwise).
- `email` must match a basic regex (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) and lowercase it before storing. Reject with 400 otherwise.

**Response (success, 200):**
```json
{ "ok": true, "expiresAt": 1745678900000 }
```

Deliberately does **not** return the token — it only goes via email. This means anyone who can submit the form needs access to the inbox they typed in; prevents a trivial "save then immediately fetch" leak if the client is compromised.

**Response (rate limited, 429):**
```json
{ "ok": false, "error": "rate_limited", "retryAfterSeconds": 600 }
```

**Side effects:**
1. Insert row in `drafts` table.
2. Send Brevo email via `sendDraftResumeEmail(email, token, expiresAt)` (see §3).
3. If the email send fails, **delete the just-inserted row** and return 500. Don't leave orphan drafts that the user can't resume.

#### `GET /draft/:token`

**Validation:**
- `token` must match `/^[A-Za-z0-9_-]{40,50}$/`. Reject 400 otherwise (don't hit the DB for garbage tokens).

**Response (success, 200):**
```json
{
  "ok": true,
  "data": { "...": "form values" },
  "createdAt": 1745000000000,
  "expiresAt": 1745678900000
}
```

**Response (not found / expired, 404):**
```json
{ "ok": false, "error": "not_found" }
```

Expired rows may still be in the DB briefly between purge runs — treat `expires_at < now` as 404 at query time too.

---

### 3. New function in `src/services/brevo.js`

```js
export async function sendDraftResumeEmail(recipientEmail, token, expiresAt)
```

Dutch copy. Resume URL: `https://publicvalues.ciiic.nl/?draft=${token}`. Use `noreply@ciiic.nl` / `CIIIC` as sender (matches existing pattern, matches `.env` already in use).

**Subject:** `Je CIIIC Publieke Waarden Zelftoets — ga later verder`

**HTML body (draft — tweak freely):**

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2>Ga verder met je zelftoets</h2>
  <p>Iemand — mogelijk jij — heeft een concept opgeslagen van de CIIIC
  Publieke Waarden Zelftoets en gevraagd om deze link naar dit e-mailadres
  te sturen.</p>

  <p>
    <a href="https://publicvalues.ciiic.nl/?draft=TOKEN_HERE"
       style="display: inline-block; padding: 10px 20px; background-color: #000; color: #fff; text-decoration: none; border-radius: 4px;">
      Ga verder met de zelftoets
    </a>
  </p>

  <p style="color: #666; font-size: 14px;">
    Deze link is <strong>30 dagen</strong> geldig (tot EXPIRES_DATE) en
    bevat je ingevulde antwoorden. <strong>Deel deze link niet</strong> —
    iedereen met deze link kan het concept openen.
  </p>

  <p style="color: #666; font-size: 14px;">
    Heb je dit bericht onverwacht ontvangen? Dan kun je het negeren; het
    concept wordt automatisch verwijderd na 30 dagen.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 12px;">
    Dit is een automatisch bericht van CIIIC. Zie ons
    <a href="https://www.ciiic.nl/privacy-statement">privacy statement</a>
    voor hoe wij met je gegevens omgaan.
  </p>
</body>
</html>
```

Include a plaintext variant too (same structure, just the URL as plain text).

Format the expiry date in Dutch: `new Date(expiresAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })`.

---

### 4. Rate limiting

Simple in-memory token buckets. Two independent limits on `POST /draft/save`:

- **Per IP:** max 5 saves per 15 minutes. Key: `req.ip`.
- **Per email:** max 3 saves per hour. Key: lowercased email.

If either exceeds, 429 with `retryAfterSeconds`. Skip rate limit on `GET /draft/:token` — token guessing is protected by entropy (256-bit token).

**Trust proxy:** the app sits behind Caddy, so add `app.set('trust proxy', 1)` or similar so `req.ip` is the real client IP (currently not set — verify this doesn't break Slack signature verification, which uses the raw body, not the IP).

Suggest `express-rate-limit` (widely used, ~1 small dep) or a 30-line hand-rolled version. Either is fine. Keep state in memory — if the process restarts, counters reset; acceptable for this threat model.

---

### 5. CORS

Only the two `/draft/*` routes need it. Allow:
- `https://publicvalues.ciiic.nl` (production)
- `http://localhost:4321` (Astro dev default)

Methods: `GET, POST, OPTIONS`. Headers: `Content-Type`. No credentials needed.

`cors` npm package is easiest; apply as middleware on a router:

```js
import cors from 'cors';
const draftRouter = express.Router();
draftRouter.use(cors({
  origin: ['https://publicvalues.ciiic.nl', 'http://localhost:4321'],
  methods: ['GET', 'POST', 'OPTIONS'],
}));
draftRouter.post('/save', ...);
draftRouter.get('/:token', ...);
app.use('/draft', draftRouter);
```

---

### 6. Docker / deployment changes

**`docker-compose.yml`** — add a named volume for the SQLite file:

```yaml
services:
  app:
    # ... existing config ...
    volumes:
      - drafts_data:/data

volumes:
  drafts_data:
```

**`Dockerfile`** — if using `better-sqlite3`, it's a native module. Alpine needs build tools. Two options:

A. Switch base to `node:20-slim` (larger but prebuilt binaries usually work). Simpler.

B. Keep Alpine and add build deps:
   ```dockerfile
   RUN apk add --no-cache python3 make g++ && \
       npm ci --only=production && \
       apk del python3 make g++
   ```

Recommend A unless image size is a concern.

Also ensure `/data` exists and is writable. `better-sqlite3` creates the file on first open, but the directory must exist — add `RUN mkdir -p /data` in the Dockerfile or let the volume mount create it.

**`.env`** — no new variables needed. Reuses existing `BREVO_API_KEY2`. Optionally add `DRAFT_DB_PATH=/data/drafts.sqlite` for flexibility (default to that if unset).

**Caddyfile** — no changes. Existing reverse proxy forwards everything to app:3000.

---

### 7. Health check

Extend `GET /health` so `drafts` shows up:

```json
{
  "services": {
    "notion": { ... },
    "brevo": { ... },
    "drafts": { "success": true, "count": 42, "dbPath": "/data/drafts.sqlite" }
  }
}
```

Just run `SELECT COUNT(*) FROM drafts`. If the DB is unreachable, `success: false`.

---

### 8. README updates

Add a section describing the new endpoints, the retention window, and the fact that they're used by `publicvalues.ciiic.nl`. Also add to the root `GET /` service-info JSON.

---

## Testing

### Local

```bash
# Start locally
npm install
npm start

# Save a draft (gets no token back, email is sent)
curl -X POST http://localhost:3000/draft/save \
  -H "Content-Type: application/json" \
  -d '{"data":{"projectName":"Test","q1":"ja"},"email":"you@example.com"}'

# (check inbox, grab token from the link, then:)
curl http://localhost:3000/draft/THE_TOKEN_FROM_EMAIL

# Try rate limit (6 times should trigger 429)
for i in 1 2 3 4 5 6; do
  curl -X POST http://localhost:3000/draft/save \
    -H "Content-Type: application/json" \
    -d '{"data":{"x":1},"email":"you@example.com"}'
  echo
done
```

### Production smoke test (after deploy)

```bash
# From any machine
curl https://bot.ciiic.nl/health  # expect drafts.success: true

# From publicvalues.ciiic.nl origin (Astro dev or browser devtools)
fetch('https://bot.ciiic.nl/draft/save', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({data: {test: true}, email: 'you@ciiic.nl'})
}).then(r => r.json()).then(console.log)
# expect { ok: true, expiresAt: ... }
# should NOT see CORS errors
```

---

## Questions to resolve before/during build

1. **Does `BREVO_API_KEY2` work, and from which Brevo account?** Confirm with a test send. The sender `noreply@ciiic.nl` needs to be a verified sender on that account (it already is for event confirmations, so should be fine).

2. **Is the server behind Caddy already setting `X-Forwarded-For`?** Caddy does by default; just need `app.set('trust proxy', 1)` in Express. Worth a grep of the existing code to make sure this isn't already set in a way that conflicts.

3. **Disk space on the host for `/data`.** A 30-day cap with ≤50KB per draft means even a thousand concurrent drafts is <50MB. Effectively no concern, but worth confirming the volume isn't on a size-constrained mount.

4. **Should `GET /draft/:token` be single-use or repeatable?** Repeatable by default (user may want to resume from multiple devices, or close the tab and come back). If you'd prefer single-use (delete on fetch), say so — it's a one-line change. I'd lean repeatable.

5. **Email deliverability:** the existing event/newsletter confirmation emails already go through `noreply@ciiic.nl`, so SPF/DKIM/DMARC are presumably set up correctly. Worth a quick test send to a Gmail, Outlook, and ciiic.nl address to confirm the draft-resume email lands in the inbox (not spam).

6. **Log retention for the draft endpoints.** Current logs use `console.log` with sender email for event flow. For GDPR minimization, recommend logging only: `ip`, `ok`/`error`, token prefix (first 6 chars) — **not** the email address or the data payload. Flag if you want me to add a structured logger instead.

7. **Abuse: should we bounce spoofed emails?** Someone could submit a draft with a stranger's email address, causing one unwanted email to that stranger per valid save. Rate limit caps this at 3/hour/email. Acceptable, but worth flagging in the privacy considerations. An alternative — requiring email verification before the save is persisted — adds friction we probably don't want for a "save my draft" feature. Confirm you're OK with the current trade-off.

8. **Do you want a deletion endpoint?** E.g. `DELETE /draft/:token` so a user can manually purge their draft before 30 days. Not in scope unless you want it — let me know.

9. **Metrics / monitoring.** Should I add a `/metrics` endpoint or just log counters? For now the health check `count` field is probably enough.

---

## Summary of files that will change

```
ciiic-automator/
├── src/
│   ├── index.js                   (+endpoints, +health extension)
│   └── services/
│       ├── brevo.js               (+sendDraftResumeEmail)
│       └── drafts.js              (new)
├── package.json                   (+better-sqlite3, +cors, +express-rate-limit)
├── Dockerfile                     (base image swap or build-deps)
├── docker-compose.yml             (+volume)
└── README.md                      (+section)
```

No existing behavior should change. All additions.

---

## When you're done

Ping me (Jaap) with either:
- "It's live at bot.ciiic.nl/draft — try it"  → I run the smoke test and then wire up the frontend.
- "Almost there but X is unclear"             → I adjust the briefing or the frontend plan.
