# Uitvoer: veilige deployvoorbereiding PR #2

Rol: uitvoer. Tier: `flagship-review` (toestemming, auth en migratie); na herstel onafhankelijke flagship-review.

## Stand bij vertrek

6 oktober 2026: Astra heeft code-head `714d982` van [PR #2](https://github.com/CIIICnl/ciiic-automator/pull/2) opnieuw gereviewd. R1/R2 geaccepteerd; 42 tests en CI Node20/22 groen. Merge afgewezen op R3: live Form43/feed7 is actief en stuurt naar `list=ciiic`, zonder signingheader; productie mist de signing-/registersleutels. Merge naar main zou deze actieve route HTTP 503 laten geven. De aanname dat Form43 buiten CIIIC valt klopt niet. Main en productie zijn ongewijzigd. TODO3/4 en de oorspronkelijke briefing blijven open.

## Opdracht

1. Lees de [uitvoeringsbrief](briefs/brevo-consent-preparation.md) en [nieuwe review R3](../reports/brevo-consent-rereview-2026-10-06.md). Herstel op de bestaande branch `feat/brevo-consent-preparation`; behoud het geaccepteerde R1/R2-herstel.
2. Maak codevoorbereiding veilig te deployen zonder impliciete activatie van de nieuwe consentroute op de actieve Form43-feed. Scheid zo nodig de live routeomschakeling van de voorbereidende modules; leg het defaultgedrag expliciet vast. Geen unsigned fallback in de nieuwe consentroute. Geen feedbestemming, productieconfiguratie, import, cutover of verzending wijzigen vanuit dit mandaat. De hubbriefing `2026-10-06--from-ciiic-automator--to-jaap-work--form43-actieve-ciiic-feed-blokkeert-consent-deploy.md` corrigeert de cross-repo uitgangsaanname.
3. Test de daadwerkelijke routewiring met de live configuratievorm, aangevinkt én leeg veld5 en de nieuwe expliciet geconfigureerde route. Draai de volledige suite en CI. Actualiseer runbook, validatiebewijs en PR-body; accepteer geen verlies van signing, suppressies of DOI-bescherming in de nieuwe code.
4. Laat PR #2 open voor onafhankelijke flagship-review, inclusief nieuwe live feed-/env-controle vóór merge. TODO5 blijft afzonderlijk activatiewerk; oude proefregisters blijven ongeschikt. Controleer open meta-briefings, sluit alleen met bewijs, log de sessie en behoud het doorgeefblok.
5. Overschrijf deze handoff met de review-en-merge-opdracht voor PR #2, neem deze overschrijf-plicht weer op en sluit af met de bijbehorende sluitregel.

## Doorgeefblok: bestaande opdrachten behouden

TODO1, draft-resume in productie roken, is nog niet uitgevoerd. Controleer na acceptatie van PR2 `https://bot.ciiic.nl/health` op `drafts.success: true`, één testsave met count +1, resume-mail in inbox bij Gmail/Outlook/ciiic.nl en de persistente `/data`-mount op Coolify `relaybot`. Lees `docs/plans/done/draft-resume-endpoints.md`; gebruik skill `ciiic-coolify`. Eventuele fix op branch met eigen PR; bij succes bevinding in `done/register.md`. Stem echte testverzending af op het mandaat van die sessie.

TODO2, uitgezette Radar-bronnen beslissen, wacht daarna op een beslisronde. TODO5 vraagt afzonderlijk activatiemandaat en concrete acceptatie: autoritatieve DOI-bevestiging, CIIIC-signing-/registerconfiguratie, reconciliation vóór T0 en nieuwsbriefboekhouding. Geen productieconfiguratie, import, cutover of verzending afleiden uit deze codevoorbereiding.

De contractbriefings `2026-10-06--from-ciiic-automator--to-forms--ciiic-optin-signature-contract.md` en `2026-10-06--from-ciiic-automator--to-ciiic-nieuwsbrief--editieboekhouding-consent-contract.md` blijven voorbereidingsopdrachten zonder activatiemandaat.

## Extra van Jaap

_(leeg)_
