# Review-en-merge: herstelde consentvoorbereiding PR #2

Rol: stuur. Tier: `flagship-review` (toestemming en migratie); onafhankelijke flagship-review in schone context vereist.

## Stand bij vertrek

6 oktober 2026: herstelronde voor [PR #2](https://github.com/CIIICnl/ciiic-automator/pull/2) op `feat/brevo-consent-preparation` gereed. R1 bewaart bronwijzigingen als intervallen naast exacte callbackmomenten en beslist transactioneel tegen duurzaam bewijs. R2 slaat taalconflicten duurzaam op; eenduidige, bewezen latere correcties kunnen ze opheffen. Versleutelde pending-batches bewaren eventidentiteit en tijdgrenzen bij gedeeltelijke toepassing. De volledige suite heeft 42 groene tests, inclusief tien nieuwe SQLite-/checkpointregressies. [Validatierapport](../reports/brevo-consent-validation-2026-10-06.md) en [runbook](../reference/ciiic-consent-preparation.md) zijn bijgewerkt. Main en productie zijn niet gewijzigd. TODO3/4 en de oorspronkelijke meta-briefing blijven open.

## Opdracht

1. Review de volledige actuele PR #2 tegen de [brief](briefs/brevo-consent-preparation.md), hubplan secties 2–6 en [oorspronkelijke review](../reports/brevo-consent-review-2026-10-06.md). Controleer R1/R2 zelfstandig: beide aankomstvolgordes, scanvensters, late callbacks, conflictbehoud, herstel na gedeeltelijke toepassing en editieblokkering. Draai de volledige suite en controleer CI Node20/22 op de actuele head.
2. Beoordeel vóór merge expliciet de actuele deploy-impact: main deployt automatisch. Verifieer live feedstatus en benodigde register-/signingconfiguratie met alleen-lezen controles. Ongeconfigureerde CIIIC-opt-ins falen gesloten. Leid geen productieconfiguratie, import, activatie, cutover of verzending af uit deze voorbereiding; laat de PR open als veilig deployen niet bewezen is.
3. Bij acceptatie én veilige deploy-impact: merge, verifieer de vereiste live uitkomst, voer `merge-housekeeping` uit en sluit TODO3/4 alleen met bewijs. Bij afwijzing: concrete herstelcriteria op dezelfde PR. TODO5 blijft afzonderlijk activatiewerk met autoritatief DOI-bewijs, consumerkoppelingen en reconciliation vóór T0. Oude proefregisters uit de afgewezen versie zijn geen betrouwbare productiebron.
4. Controleer `~/.claude/bin/meta briefings.sh open ciiic-automator`; sluit de oorspronkelijke briefing alleen na bewijs van alle Done-when-criteria. Log de sessie in JAAP-KB en behoud het doorgeefblok hieronder.
5. Overschrijf deze handoff met de passende vervolgopdracht, neem deze overschrijf-plicht weer op en eindig met de bijbehorende sluitregel. Bij een nog open PR gaat herstel of nieuwe review vóór TODO1.

## Doorgeefblok: bestaande opdrachten behouden

TODO1, draft-resume in productie roken, is nog niet uitgevoerd. Controleer na acceptatie van PR2 `https://bot.ciiic.nl/health` op `drafts.success: true`, één testsave met count +1, resume-mail in inbox bij Gmail/Outlook/ciiic.nl en de persistente `/data`-mount op Coolify `relaybot`. Lees `docs/plans/done/draft-resume-endpoints.md`; gebruik skill `ciiic-coolify`. Eventuele fix op branch met eigen PR; bij succes bevinding in `done/register.md`. Stem echte testverzending af op het mandaat van die sessie.

TODO2, uitgezette Radar-bronnen beslissen, wacht daarna op een beslisronde. TODO5 vraagt afzonderlijk activatiemandaat en concrete acceptatie: autoritatieve DOI-bevestiging, CIIIC-signing-/registerconfiguratie, reconciliation vóór T0 en nieuwsbriefboekhouding. Geen productieconfiguratie, import, cutover of verzending afleiden uit deze codevoorbereiding.

De contractbriefings `2026-10-06--from-ciiic-automator--to-forms--ciiic-optin-signature-contract.md` en `2026-10-06--from-ciiic-automator--to-ciiic-nieuwsbrief--editieboekhouding-consent-contract.md` blijven voorbereidingsopdrachten zonder activatiemandaat.

## Extra van Jaap

_(leeg)_
