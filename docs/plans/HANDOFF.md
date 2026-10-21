# Uitvoersessie: delta-importtool bouwen volgens brief `brevo-delta-import.md`

Rol: uitvoer. Tier van het item: `flagship-review` (TODO #9); de PR wacht op review-en-merge door het flagship.

## Stand bij vertrek (21 oktober)

De Brevo-baseline is op productie geleverd: lijst `CIIIC nieuwsbrief` ID 20, 2.163 writes na 464 suppressies, read-back schoon, steekproef tien, geen mail in het venster. PR [#9](https://github.com/CIIICnl/ciiic-automator/pull/9) (merge `e064f46`) bevat bewijs, besluit, timeout-fix in de preflight en 429-backoff in de provider; 73 tests groen, Coolify uitgerold (container `…-115557291206`). Idempotentie: zie de sectie onderaan [het rapport](../reports/brevo-baseline-import-2026-10-21.md). Beide migratiebriefings (8 en 19 oktober) zijn met bewijs gesloten; de briefing met lijst-ID 20 en delta 28 oktober staat bij ciiic-nieuwsbrief. CIIIC-KB `applications/relaybot.md` bijgewerkt.

Jaap bevestigde: go/no-go maandag 26 oktober, delta woensdag 28 oktober, eerste send donderdag 29 oktober. Writers blijven tot na 29 oktober Mailchimp.

## Opdracht

1. Bouw de delta-tool volgens [briefs/brevo-delta-import.md](briefs/brevo-delta-import.md): delta-dry-run, zelfde poorten als de baseline, suppressies eerst, hervatbaar register, volledige read-back, go/no-go-subcommando. Hergebruik `baseline-import.js`, `baseline-provider.js` (`brevoRequest`) en `migration.js`; geen echte providerwrites in tests.
2. Open een PR met de tests uit de brief en een korte uitlegsectie in het runbook (`docs/reference/ciiic-consent-preparation.md` § Baseline-import en rollback, nieuwe subparagraaf Delta). Merge niet zelf.
3. Haal je de review-deadline van zondag 25 oktober niet, meld dat direct aan Jaap met een voorstel.
4. Overschrijf deze handoff met de PR-link als review-en-merge-opdracht (tier `flagship-review`), behoud het doorgeefblok hieronder, en neem deze overschrijfplicht weer op als laatste genummerde stap.

## Doorgeefblok: bestaande opdrachten behouden

TODO #10: foutmeldingen-allowlist voor de import-CLI's (workhorse, klein).

TODO #6: Brevo-support is de aanbevolen route op basis van het RBL-rapport van 19 oktober. Alleen met expliciet mandaat een supportbericht of hertest; bewijs van herstel is `delivered` plus sender-IP voor mailbox.org. Clicktracking op de magic link vraagt een afzonderlijk besluit. Dit telt mee in de go/no-go van 26 oktober.

TODO #5 vraagt afzonderlijk activatiemandaat en concrete acceptatie: autoritatieve DOI-bevestiging, CIIIC-signing-/registerconfiguratie, getekende Form43-feed7, reconciliation vóór T0 en nieuwsbriefboekhouding; pas dan `CIIIC_CONSENT_ROUTE=enabled`. Het editiecontract gaat pas live met die activatie: `NEWSLETTER_EDITION_TOKEN` in Coolify en via 1Password naar ciiic-nieuwsbrief, Brevo-marketingwebhook ook voor `delivered`/`sent`, en dan een activatiebriefing naar ciiic-nieuwsbrief. De contractbriefings van 6 oktober naar forms en ciiic-nieuwsbrief en de hubbriefing over Form43/feed7 blijven voorbereidingsopdrachten zonder activatiemandaat.

Radar-nacontrole: kijk in monitor of `springer-vr` en `nature-heritage` items opleverden sinds 9 oktober. Springer met nul items die dag kan een bot-challenge zijn.

Kleine bevinding, geen item: de code-default van `NOTION_CONTACTEN_DS_IDS` in `src/services/jaarevent.js` noemt een tweede data source (`30411fb0…`) die niet meer bestaat; de query krijgt 404 en slaat hem over.

Brevo-huishouding, geen item: lijst 19 "Contacts involved in conversations" (map 18) is door Brevo Conversations aangemaakt; vier draftcampagnes van 6 oktober staan op testlijst 3. Laten staan tot na 29 oktober.

## Extra van Jaap

_(leeg)_
