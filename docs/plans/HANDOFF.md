# Uitvoer: herstel voorkeurreconciliation in PR #2

Rol: uitvoer. Tier: `flagship-review` (toestemming en migratie); na herstel een nieuwe flagship-review.

## Stand bij vertrek

6 oktober 2026: Astra heeft [PR #2](https://github.com/CIIICnl/ciiic-automator/pull/2), code-head `f4e89d9`, gereviewd en niet gemerged. De 32 bestaande tests en CI Node20/22 slagen, maar twee aanvullende probes met echte SQLite/checkpoints reproduceren blokkerende fouten. [Reviewrapport](../reports/brevo-consent-review-2026-10-06.md) bevat locaties, reproduceerstappen en herstelcriteria. Main en productie zijn niet gewijzigd. Branch: `feat/brevo-consent-preparation`.

R1: reconciliation gebruikt scantijd als wijzigingstijd, waardoor een oudere Mailchimp-keuze een nieuwere, vertraagd ontvangen Brevo-keuze verdringt. R2: conflicten komen alleen in de scansamenvatting; contacten blijven verzendbaar, en een latere eenduidige broncorrectie verdwijnt door checkpointvervanging. TODO3/4 en de oorspronkelijke automator-meta-briefing blijven open.

## Opdracht

1. Lees het reviewrapport, de [uitvoeringsbrief](briefs/brevo-consent-preparation.md) en het goedgekeurde hubplan secties 2–6. Werk aan dezelfde PR #2; geen nieuwe migratie- of activatiescope.
2. Herstel R1 en R2 met duurzame bron-/conflictbewijzen, veilige verwerking van vertraagde callbacks, gecontroleerd conflictherstel en stabiele retry-identiteit. Voeg regressietests toe voor beide aankomstvolgordes, meerdere scans, herstart, gedeeltelijke toepassing en blokkering door de editieboekhouding. Behoud suppressiemonotoniciteit en bevroren edities; draai de gehele suite.
3. Werk validatierapport en runbook bij, commit en push naar de PR-branch. Laat PR #2 open voor een nieuwe flagship-review in schone context; merge de eigen reparatie niet. Die review moet vóór merge ook de actuele deploy-impact beoordelen. TODO3/4 pas na acceptatie sluiten; TODO5 blijft afzonderlijk geautoriseerde productievoorbereiding.
4. Controleer `~/.claude/bin/meta briefings.sh open ciiic-automator`; sluit de oorspronkelijke briefing pas met bewijs van alle criteria. Log de sessie in JAAP-KB. Behoud het doorgeefblok hieronder.
5. Overschrijf deze handoff met de review-en-merge-opdracht voor de herstelde PR #2, inclusief tier en resterende productiepoorten; neem deze overschrijf-plicht weer op en eindig met de bijbehorende sluitregel.

## Doorgeefblok: bestaande opdrachten behouden

TODO1, draft-resume in productie roken, is nog niet uitgevoerd. Controleer na acceptatie van PR2 `https://bot.ciiic.nl/health` op `drafts.success: true`, één testsave met count +1, resume-mail in inbox bij Gmail/Outlook/ciiic.nl en de persistente `/data`-mount op Coolify `relaybot`. Lees `docs/plans/done/draft-resume-endpoints.md`; gebruik skill `ciiic-coolify`. Eventuele fix op branch met eigen PR; bij succes bevinding in `done/register.md`. Stem echte testverzending af op het mandaat van die sessie.

TODO2, uitgezette Radar-bronnen beslissen, wacht daarna op een beslisronde. TODO5 vraagt afzonderlijk activatiemandaat en concrete acceptatie: autoritatieve DOI-bevestiging, CIIIC-signing-/registerconfiguratie, reconciliation vóór T0 en nieuwsbriefboekhouding. Geen productieconfiguratie, import, cutover of verzending afleiden uit deze codevoorbereiding.

De contractbriefings `2026-10-06--from-ciiic-automator--to-forms--ciiic-optin-signature-contract.md` en `2026-10-06--from-ciiic-automator--to-ciiic-nieuwsbrief--editieboekhouding-consent-contract.md` blijven voorbereidingsopdrachten zonder activatiemandaat.

## Extra van Jaap

_(leeg)_
