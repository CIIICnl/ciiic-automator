# Uitvoer: TODO 1, draft-resume in productie roken

Rol: uitvoer. Tier: `workhorse`.

## Stand bij vertrek

6 oktober 2026, Fable (stuur): PR #2 (consentvoorbereiding) gereviewd als flagship-review en gemerged als `5350d42`; Coolify `relaybot` heeft automatisch gedeployd, `/health` healthy, nieuwe image bewezen live. De consentroute staat achter `CIIIC_CONSENT_ROUTE` en die variabele ontbreekt in productie, dus Form43/feed7 en de overige aanmeldroutes draaien het oude gedrag. TODO 3 en 4 zijn gesloten, de oorspronkelijke briefing is met bewijs geleverd. Write-up: `docs/plans/done/2026-10.md`. Open: TODO 1, 2 en 5.

## Opdracht

1. Lees `docs/plans/TODO.md` § 1 en `docs/plans/done/draft-resume-endpoints.md` (de brief met de smoke test die nooit is afgevinkt). Gebruik skill `ciiic-coolify` voor de API; alleen GETs tegen Coolify.
2. Controleer `https://bot.ciiic.nl/health`: wat zegt het `drafts`-blok nu? Lokaal faalt de drafts-DB omdat `/data` ontbreekt; in productie moet een persistente `/data`-mount op Coolify-app `relaybot` (`m7z1z547ie42j0d60fy0tvxx`) bestaan. Lees de app-detail en storages via de API; ontbreekt de mount, dan is dat de hoofdbevinding en zet je hem niet zelf aan: schrijf op wat er moet gebeuren en leg het bij Jaap.
3. Bestaat de mount: één testsave via `POST /draft/save` met een testadres, controleer dat de count in `/health` met één omhoog gaat en dat de resume-mail in een Gmail-, Outlook- en ciiic.nl-inbox aankomt (niet in spam). Echte testverzending alleen naar adressen van Jaap; geen echte deelnemersdata.
4. Fix nodig (mount, mailtemplate, spamscore): op een branch met eigen PR, niet direct op `main` (elke push naar `main` deployt). Bevindingen in één regel in `docs/plans/done/register.md`; de `[STALE-PLAN]` in `_reconcile/drift-log.md` over TODO 1 mag dan weg.
5. Niets aan `CIIIC_CONSENT_ROUTE` of andere consentconfiguratie doen; dat is TODO 5 met eigen mandaat. Log de sessie en behoud het doorgeefblok.
6. Overschrijf deze handoff met de volgende opdracht (TODO 2 of de review-en-merge van je eigen PR), neem deze overschrijf-plicht weer op en sluit af met de bijbehorende sluitregel.

## Doorgeefblok: bestaande opdrachten behouden

TODO 2, uitgezette Radar-bronnen beslissen, is een beslisronde met Jaap: per `RADAR_ENABLE_*`-vlag aan in Coolify-env of de bron uit `src/services/radar/config.js`, besluit in `done/decisions.md`.

TODO 5 vraagt afzonderlijk activatiemandaat en concrete acceptatie: autoritatieve DOI-bevestiging, CIIIC-signing-/registerconfiguratie, getekende Form43-feed7 (nu ongetekend, POST JSON naar `list=ciiic`), reconciliation vóór T0 en nieuwsbriefboekhouding; pas dan `CIIIC_CONSENT_ROUTE=enabled`. Geen productieconfiguratie, import, cutover of verzending afleiden uit de gemergde voorbereiding. Oude proefregisters blijven ongeschikt.

De contractbriefings `2026-10-06--from-ciiic-automator--to-forms--ciiic-optin-signature-contract.md` en `2026-10-06--from-ciiic-automator--to-ciiic-nieuwsbrief--editieboekhouding-consent-contract.md` blijven voorbereidingsopdrachten zonder activatiemandaat. De hubbriefing `2026-10-06--from-ciiic-automator--to-jaap-work--form43-actieve-ciiic-feed-blokkeert-consent-deploy.md` blijft staan: de deploy is niet meer geblokkeerd, maar de feed moet bij activatie alsnog getekend worden.

## Extra van Jaap

_(leeg)_
