# TODO — ciiic-automator

Leeswijzer in het kort (volledig: skill `werkwijze`): _In progress_ is een claimbord, max 3 claims, leeg is de goede staat. _Open werk_ staat top-down op prioriteit; nummers zijn vaste adressen. Eén item is ≤ ~12 regels en draagt een toetsbaar "klaar als" — heb je meer nodig, schrijf dan een brief in `briefs/` en laat het item ernaar verwijzen. Budget: **< 300 regels** (kleine repo). Geshipt werk verdwijnt hier: één regel in _Recently done_, write-up naar `done/`, nummer naar `done/register.md`.

## In progress

- #4 Brevo-consentvoorbereiding - @mac - `feat/brevo-consent-preparation` - klaar als: synthetische acceptatiematrix groen en PR met flagship-reviewoverdracht.

## Open werk

### 1. Draft-resume in productie roken

**[delegeerbaar]** De endpoints staan live (`POST /draft/save`, `GET /draft/:token`), maar de smoke test uit de brief is nooit afgevinkt. Open vragen die daarbij horen: landt de resume-mail bij Gmail, Outlook én ciiic.nl in de inbox (niet in spam), en klopt de `/data`-volume-mount op de Coolify-app zodat de SQLite niet bij elke redeploy leegloopt.

Brief (afgerond, als naslag): `done/draft-resume-endpoints.md`.

Klaar als: `https://bot.ciiic.nl/health` toont `drafts.success: true` met een count die na een testsave met één omhoog gaat, en een testmail is in drie inboxen aangekomen; bevindingen in één regel in `done/register.md`.

### 2. De uitgezette Radar-bronnen beslissen

**[delegeerbaar]** Zes bronnen hangen achter een `RADAR_ENABLE_*`-vlag (`immersivewire`, `springer-vr`, `nature-heritage`, `eurekalert`, `uploadvr`) en staan daarmee de facto uit. De recon zegt waarom: Springer en Nature blokkeren server-side fetch (`reference/radar-fase2-recon-2026-07-09.md`). Dat is een besluit dat niemand genomen heeft, geen configuratie.

Klaar als: elke vlag is óf in de Coolify-env van `relaybot` gezet, óf de bron is uit `src/services/radar/config.js` verwijderd; het besluit per bron staat in één regel in `done/decisions.md`.

### 3. Kritieke routes missen een vaste regressietest

Op `main` heeft `package.json` alleen `start` en `dev`. De repo draagt inmiddels een HMAC-geverifieerde webhook, een rate-limited draft-store en een radar-pipeline met zeven bronparsers — alle drie stil kapot te krijgen. Een minimale node:test-suite over de pure stukken (signature-verificatie, token-validatie, dedup) is goedkoper dan de eerste keer dat het misgaat.

Klaar als: `npm test` draait en faalt op een moedwillig gebroken signature-check. De uitvoering van #4 neemt deze minimale testbasis mee; pas na review en merge dit item sluiten.

### 4. CIIIC-inschrijfpaden delen nog geen toestemming- en taalcontract

**[flagship-review] [delegeerbaar]** (toestemming, auth en migratie). Drie writers kunnen zonder gedeeld register uiteenlopen; afmelden moet afmelden blijven en iedere actieve ontvanger krijgt één taal. Goed gedaan: één provideradapter, duurzaam suppressieregister en controleerbare migratievoorbereiding volgens [de uitvoeringsbrief](briefs/brevo-consent-preparation.md).

Bron: `2026-10-06--from-jaap-work--to-ciiic-automator--brevo-consent-en-migratievoorbereiding.md`. Klaar als: synthetische statusmatrix, callback-auth/retry, DOI-limiet en deterministische dry-run slagen; owner/listbinding live geverifieerd; PR met bewijs gereviewd. Import, accountinrichting, cutover en verzending vragen afzonderlijk mandaat.

## Recently done

- 2026-09 — Draft-resume endpoints voor publicvalues.ciiic.nl (brief afgerond, zie `done/register.md`)
- 2026-09 — HMAC-signature op `/webhook/registration-status` (`ca39d36`)
- 2026-09 — Generieke newsletter-opt-in webhook voor Gravity Forms (`b86cabf`)
