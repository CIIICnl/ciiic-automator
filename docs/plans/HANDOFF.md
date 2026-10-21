# Review-en-merge-sessie: PR #10 Brevo-delta-import

Rol: stuur. Tier van het item: `flagship-review` (TODO #9), dus het flagship reviewt en merget.

## Stand bij vertrek (21 oktober, avond)

PR [#10](https://github.com/CIIICnl/ciiic-automator/pull/10) bouwt de delta-tool volgens [briefs/brevo-delta-import.md](briefs/brevo-delta-import.md): `scripts/consent-delta-import.mjs` met `dry-run`, `go-no-go`, `apply` en `event-log`, kern in `src/services/consent/delta-import.js`, kleine exports in `baseline-import.js` (gedrag gelijk), runbook-subparagraaf "Delta na de baseline". 84/84 tests groen, 11 nieuw. Nog niet op de container gedraaid. De PR-body noemt zeven ontwerpbeslissingen om te toetsen; de belangrijkste: holds (herinschrijving na suppressie, quarantaineredenen) blokkeren de delta niet maar worden geteld, en de grondslag voor nieuwe adds komt uit `consentPolicy` van het baselinerecord.

Planning (door Jaap bevestigd): review uiterlijk zondag 25 oktober, go/no-go maandag 26 oktober, delta woensdag 28 oktober, eerste send donderdag 29 oktober.

## Opdracht

1. Review PR #10 onafhankelijk tegen de brief, met nadruk op: suppressies winnen altijd en gaan eerst; geen pad waarop een bestaande blokkade of eerdere suppressie wordt opgeheven; herstart en tweede run zonder dubbele mutatie; geen adressen in stdout, stderr of het run-record. Fix wat nodig is op de branch, `npm test` groen.
2. Merge, wacht op de Coolify-deploy (`https://bot.ciiic.nl/health`), draai `merge-housekeeping`.
3. Controleer read-only in de container dat het baseline-record `consentPolicy` met `acceptedSources` heeft (anders weigert `resolveBase`) en draai `go-no-go` als rooktest; geen `--apply`.
4. Haal je de review niet vóór zondag 25 oktober, meld dat direct aan Jaap met een voorstel (bijvoorbeeld de delta beperken tot suppressies).
5. Overschrijf deze handoff met de go/no-go van 26 oktober als volgende opdracht, behoud het doorgeefblok hieronder, en neem deze overschrijfplicht weer op als laatste genummerde stap.

## Doorgeefblok: bestaande opdrachten behouden

Nieuwe briefing van ciiic-nieuwsbrief (21 oktober, `tier: flagship-review`): `2026-10-21--from-ciiic-nieuwsbrief--to-ciiic-automator--consent-scope-en-eventlijst.md`. Scope per registerrecord (`newsletter`, `event:<slug>`), scope op de grootboekronde en de afmeldcallback, plus eventlijst IX Labs 18 november (alleen na Jaaps keuze). Nog niet geadopteerd; triëren als TODO-item na de delta, niet vóór 29 oktober laten concurreren met #9.

TODO #10: foutmeldingen-allowlist voor de import-CLI's (workhorse, klein).

TODO #6: Brevo-support is de aanbevolen route op basis van het RBL-rapport van 19 oktober. Alleen met expliciet mandaat een supportbericht of hertest; bewijs van herstel is `delivered` plus sender-IP voor mailbox.org. Clicktracking op de magic link vraagt een afzonderlijk besluit. Dit telt mee in de go/no-go van 26 oktober.

TODO #5 vraagt afzonderlijk activatiemandaat en concrete acceptatie: autoritatieve DOI-bevestiging, CIIIC-signing-/registerconfiguratie, getekende Form43-feed7, reconciliation vóór T0 en nieuwsbriefboekhouding; pas dan `CIIIC_CONSENT_ROUTE=enabled`. Het editiecontract gaat pas live met die activatie: `NEWSLETTER_EDITION_TOKEN` in Coolify en via 1Password naar ciiic-nieuwsbrief, Brevo-marketingwebhook ook voor `delivered`/`sent`, en dan een activatiebriefing naar ciiic-nieuwsbrief. De contractbriefings van 6 oktober naar forms en ciiic-nieuwsbrief en de hubbriefing over Form43/feed7 blijven voorbereidingsopdrachten zonder activatiemandaat.

Radar-nacontrole: kijk in monitor of `springer-vr` en `nature-heritage` items opleverden sinds 9 oktober. Springer met nul items die dag kan een bot-challenge zijn.

Kleine bevinding, geen item: de code-default van `NOTION_CONTACTEN_DS_IDS` in `src/services/jaarevent.js` noemt een tweede data source (`30411fb0…`) die niet meer bestaat; de query krijgt 404 en slaat hem over.

Brevo-huishouding, geen item: lijst 19 "Contacts involved in conversations" (map 18) is door Brevo Conversations aangemaakt; vier draftcampagnes van 6 oktober staan op testlijst 3. Laten staan tot na 29 oktober.

## Extra van Jaap

_(leeg)_
