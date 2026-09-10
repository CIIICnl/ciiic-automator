# TODO — ciiic-automator

Leeswijzer in het kort (volledig: skill `werkwijze`): _In progress_ is een claimbord, max 3 claims, leeg is de goede staat. _Open werk_ staat top-down op prioriteit; nummers zijn vaste adressen. Eén item is ≤ ~12 regels en draagt een toetsbaar "klaar als" — heb je meer nodig, schrijf dan een brief in `briefs/` en laat het item ernaar verwijzen. Budget: **< 300 regels** (kleine repo). Geshipt werk verdwijnt hier: één regel in _Recently done_, write-up naar `done/`, nummer naar `done/register.md`.

## In progress

_(leeg)_

## Open werk

### 1. Draft-resume in productie roken

**[delegeerbaar]** De endpoints staan live (`POST /draft/save`, `GET /draft/:token`), maar de smoke test uit de brief is nooit afgevinkt. Open vragen die daarbij horen: landt de resume-mail bij Gmail, Outlook én ciiic.nl in de inbox (niet in spam), en klopt de `/data`-volume-mount op de Coolify-app zodat de SQLite niet bij elke redeploy leegloopt.

Brief (afgerond, als naslag): `done/draft-resume-endpoints.md`.

Klaar als: `https://bot.ciiic.nl/health` toont `drafts.success: true` met een count die na een testsave met één omhoog gaat, en een testmail is in drie inboxen aangekomen; bevindingen in één regel in `done/register.md`.

### 2. De uitgezette Radar-bronnen beslissen

**[delegeerbaar]** Zes bronnen hangen achter een `RADAR_ENABLE_*`-vlag (`immersivewire`, `springer-vr`, `nature-heritage`, `eurekalert`, `uploadvr`) en staan daarmee de facto uit. De recon zegt waarom: Springer en Nature blokkeren server-side fetch (`reference/radar-fase2-recon-2026-07-09.md`). Dat is een besluit dat niemand genomen heeft, geen configuratie.

Klaar als: elke vlag is óf in de Coolify-env van `relaybot` gezet, óf de bron is uit `src/services/radar/config.js` verwijderd; het besluit per bron staat in één regel in `done/decisions.md`.

### 3. Geen enkele geautomatiseerde test

`package.json` heeft alleen `start` en `dev`. De repo draagt inmiddels een HMAC-geverifieerde webhook, een rate-limited draft-store en een radar-pipeline met zeven bronparsers — alle drie stil kapot te krijgen. Een minimale node:test-suite over de pure stukken (signature-verificatie, token-validatie, dedup) is goedkoper dan de eerste keer dat het misgaat.

Klaar als: `npm test` draait en faalt op een moedwillig gebroken signature-check.

## Recently done

- 2026-09 — Draft-resume endpoints voor publicvalues.ciiic.nl (brief afgerond, zie `done/register.md`)
- 2026-09 — HMAC-signature op `/webhook/registration-status` (`ca39d36`)
- 2026-09 — Generieke newsletter-opt-in webhook voor Gravity Forms (`b86cabf`)
