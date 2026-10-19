# Review-en-merge: Brevo-baseline-importtool (PR #8)

Rol: stuur. Tier: `flagship-review`; onafhankelijke flagship-review en merge.

## Stand bij vertrek

19 oktober 2026, PR [#8](https://github.com/CIIICnl/ciiic-automator/pull/8) op branch `feat/brevo-baseline-import`, commit `3b13346`, wacht op onafhankelijke review. De uitvoersessie bouwde de expliciete `--apply`-CLI, versleuteld hervatregister, lijstbinding, suppressies vóór kandidaten, volledige read-back inclusief namen en steekproef van tien. `npm test` (63 tests), Docker-build, diff-check en GitHub CI op Node 20/22 groen. De importtool en preflight zitten in de image. Geen providerwrites uitgevoerd.

TODO #7 blijft open. Jaaps akkoord op het concrete diff is nog niet ontvangen; de definitieve dry-run blijft T0 `2026-10-19T17:36:35.815Z` met 2.161 kandidaten, 464 suppressies, 24 pending en 0 quarantaine. Register en export staan op `/data/consent/migration`. De tool vereist een gedateerd akkoordbestand en actueel automation-attest op dat volume. SMTP- en marketingeventlogs over het volledige importvenster zijn bewust nog niet bewezen; de tool geeft geen cutover-vrijgave. Writers blijven tot na 29 oktober Mailchimp.

De migratiebriefing van 19 oktober en de geadopteerde opdracht van 8 oktober blijven ongeleverd. De afhankelijke importbriefing bij jaap-work blijft geblokkeerd. De planningsbriefing naar ciiic-nieuwsbrief bevat nog geen werkelijk lijst-ID of bevestigde delta-datum.

## Opdracht

1. Review [PR #8](https://github.com/CIIICnl/ciiic-automator/pull/8) onafhankelijk tegen [de uitvoerbrief](briefs/brevo-baseline-import.md): akkoord- en driftpoorten, lijstbinding, suppressies, onderbroken providerantwoord, idempotentie, taal en namen, volledige read-back en geen PII in uitvoer. Controleer ook dat de CLI in de image draait. Draai tests of controleer groene CI; corrigeer bevindingen en merge pas na voldane criteria. Verifieer vóór merge live dat `CIIIC_CONSENT_ROUTE` niet `enabled` is en Form43/feed7 nog op het oude Mailchimp-pad zit.
2. Na merge: voer `merge-housekeeping` uit en werk TODO #7 bij als codegereed maar nog wachtend op Jaaps diff-akkoord en productie-uitvoering. Sluit de migratiebriefings niet op basis van de code. Geen import, supportbericht of testmail zonder hun eigen mandaat.
3. Bepaal de volgende uitvoeropdracht op basis van de feitelijke stand: eerst het concrete diff-akkoord registreren, dan onder apart uitvoeringsmandaat de baseline met automationbewijs en volledige eventlogcontrole uitvoeren. Publiceer pas daarna het werkelijke lijst-ID en de bevestigde delta-datum naar ciiic-nieuwsbrief.
4. Overschrijf deze handoff met de volgende opdracht, behoud onderstaand onuitgevoerd werk en neem deze overschrijfplicht weer op als laatste genummerde stap.

## Doorgeefblok: bestaande opdrachten behouden

TODO #6: Brevo-support is de aanbevolen route op basis van het RBL-rapport van 19 oktober. Alleen met expliciet mandaat een supportbericht of hertest; bewijs van herstel is `delivered` plus sender-IP voor mailbox.org. Clicktracking op de magic link vraagt een afzonderlijk besluit. Geen herstel afleiden uit oud bewijs.

TODO #5 vraagt afzonderlijk activatiemandaat en concrete acceptatie: autoritatieve DOI-bevestiging, CIIIC-signing-/registerconfiguratie, getekende Form43-feed7, reconciliation vóór T0 en nieuwsbriefboekhouding; pas dan `CIIIC_CONSENT_ROUTE=enabled`. Geen productieconfiguratie of writer-cutover afleiden uit de importtool. Oude proefregisters blijven ongeschikt. Het editiecontract gaat pas live met die activatie: `NEWSLETTER_EDITION_TOKEN` in Coolify en via 1Password naar ciiic-nieuwsbrief, Brevo-marketingwebhook ook voor `delivered`/`sent`, en dan een activatiebriefing naar ciiic-nieuwsbrief.

De contractbriefings `2026-10-06--from-ciiic-automator--to-forms--ciiic-optin-signature-contract.md` en `2026-10-06--from-ciiic-automator--to-ciiic-nieuwsbrief--editieboekhouding-consent-contract.md` blijven voorbereidingsopdrachten zonder activatiemandaat. De hubbriefing `2026-10-06--from-ciiic-automator--to-jaap-work--form43-actieve-ciiic-feed-blokkeert-consent-deploy.md` blijft staan: de feed moet bij activatie alsnog getekend worden.

Radar-nacontrole: kijk in monitor of `springer-vr` en `nature-heritage` items opleverden sinds 9 oktober. Springer met nul items die dag kan een bot-challenge zijn.

Kleine bevinding, geen item: de code-default van `NOTION_CONTACTEN_DS_IDS` in `src/services/jaarevent.js` noemt een tweede data source (`30411fb0…`) die niet meer bestaat; de query krijgt 404 en slaat hem over.

## Extra van Jaap

_(leeg)_
