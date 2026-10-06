# Review-en-merge: PR #2 consentvoorbereiding (na R3-herstel)

Rol: stuur. Tier: `flagship-review` (toestemming, auth en migratie): het flagship reviewt en merget, niet de workhorse.

## Stand bij vertrek

6 oktober 2026, Opus (uitvoer): R3 uit [de herreview](../reports/brevo-consent-rereview-2026-10-06.md) hersteld op `feat/brevo-consent-preparation` in `7a52703` + `e42da0e`. De consentroute staat nu achter `CIIIC_CONSENT_ROUTE`: alleen de exacte waarde `enabled` zet hem aan; ongezet draaien newsletter-optin, SXSW en registration het gedrag van vóór de PR, dus live Form43/feed7 blijft na merge werken. Met de schakelaar aan: geen unsigned fallback. `src/index.js` exporteert `app` en boot alleen als entrypoint. Nieuwe `tests/route-activation.test.js` draait de echte app met de live feed7-vorm (veld5 aangevinkt en leeg) en beide schakelaarstanden; uitgaand HTTPS via recorder. 46 tests groen, ook in schone omgeving; CI Node20/22 groen (run 37509389826). R1/R2-herstel onaangeroerd. Geen productie-GETs of -wijzigingen in deze ronde. Main en productie ongewijzigd.

## Opdracht

1. Review [PR #2](https://github.com/CIIICnl/ciiic-automator/pull/2) als onafhankelijke flagship-review, met nadruk op de R3-diff (`efecad7..HEAD`): `src/services/consent/activation.js`, de routewiring in `src/index.js`, de legacy-paden in `newsletter-optin.js`, `sxsw.js` en `jaarevent.js` (`addIfMissing` is teruggezet als oud gedrag, alleen bij uitgezette schakelaar), en `tests/route-activation.test.js`. Toets tegen de herstelcriteria in R3 en de defaulttabel in `docs/reference/ciiic-consent-preparation.md` § Activatieschakelaar.
2. Live hercontrole vóór merge, alleen GETs (skill `ciiic-coolify`): `CIIIC_CONSENT_ROUTE` staat niet in de env van Coolify-app `relaybot` (`m7z1z547ie42j0d60fy0tvxx`); Form43/feed7 heeft nog de vorm uit R3. Wijkt iets af: niet mergen, bevinding in een reviewrapport.
3. Akkoord → merge naar `main` (auto-deploy), check `https://bot.ciiic.nl/health`. Draai daarna `merge-housekeeping`: TODO3 en TODO4 sluiten, oorspronkelijke briefing `2026-10-06--from-jaap-work--to-ciiic-automator--brevo-consent-en-migratievoorbereiding.md` sluiten met bewijs (`briefings.sh evidence` + `close --outcome delivered`). Niet akkoord → reviewrapport in `docs/reports/`, PR open, herstelhandoff.
4. TODO5 blijft afzonderlijk activatiewerk; de schakelaar niet aanzetten, geen productieconfiguratie, import, cutover of verzending vanuit dit mandaat. Oude proefregisters blijven ongeschikt. Log de sessie en behoud het doorgeefblok.
5. Overschrijf deze handoff met de volgende opdracht (bij merge: TODO1 uit het doorgeefblok), neem deze overschrijf-plicht weer op en sluit af met de bijbehorende sluitregel.

## Doorgeefblok: bestaande opdrachten behouden

TODO1, draft-resume in productie roken, is nog niet uitgevoerd. Controleer na acceptatie van PR2 `https://bot.ciiic.nl/health` op `drafts.success: true`, één testsave met count +1, resume-mail in inbox bij Gmail/Outlook/ciiic.nl en de persistente `/data`-mount op Coolify `relaybot`. Lees `docs/plans/done/draft-resume-endpoints.md`; gebruik skill `ciiic-coolify`. Eventuele fix op branch met eigen PR; bij succes bevinding in `done/register.md`. Stem echte testverzending af op het mandaat van die sessie.

TODO2, uitgezette Radar-bronnen beslissen, wacht daarna op een beslisronde. TODO5 vraagt afzonderlijk activatiemandaat en concrete acceptatie: autoritatieve DOI-bevestiging, CIIIC-signing-/registerconfiguratie, getekende Form43-feed, reconciliation vóór T0 en nieuwsbriefboekhouding; pas dan `CIIIC_CONSENT_ROUTE=enabled`. Geen productieconfiguratie, import, cutover of verzending afleiden uit deze codevoorbereiding.

De contractbriefings `2026-10-06--from-ciiic-automator--to-forms--ciiic-optin-signature-contract.md` en `2026-10-06--from-ciiic-automator--to-ciiic-nieuwsbrief--editieboekhouding-consent-contract.md` blijven voorbereidingsopdrachten zonder activatiemandaat. De hubbriefing over Form43 (`2026-10-06--from-ciiic-automator--to-jaap-work--form43-actieve-ciiic-feed-blokkeert-consent-deploy.md`) blijft staan: de deploy is niet meer geblokkeerd, maar de feed moet bij activatie alsnog getekend worden.

## Extra van Jaap

_(leeg)_
