# Uitvoer: Brevo-baseline-importtool bouwen (TODO #7)

Rol: uitvoer. Tier: `flagship-review`; bouw op workhorse, daarna onafhankelijke flagship-review en merge.

## Stand bij vertrek

19 oktober 2026, onafhankelijke review van [PR #7](https://github.com/CIIICnl/ciiic-automator/pull/7) afgerond en gemerged als `e32df11`. Documenten getoetst aan beide briefings van 19 oktober en het RBL-bronrapport op jaap-work origin/main. CI Node 20/22 groen; geen runtimewijziging. De administratieve RBL-briefing is met bewijs geleverd; TODO #6 blijft open.

Het grondslagbesluit staat in `done/decisions.md`: alle vier Mailchimp-bronnen tellen mee. Definitieve dry-run T0 `2026-10-19T17:36:35.815Z`: 2.161 kandidaten (2.090 NL, 71 EN), 464 suppressies, 24 pending, 0 quarantaine; 84 kandidaten zonder voornaam. Doellijst bestaat niet. Register en versleutelde export staan op `/data/consent/migration` in relaybot. [Rapport](../reports/brevo-migration-dryrun-2026-10-19.md).

Akkoord op het concrete diff is nog niet ontvangen. Bouw van de tool kan doorgaan; productie-import blijft geblokkeerd tot dat afzonderlijke akkoord en onafhankelijke review. Geen providerwrite, supportbericht of testmail uitgevoerd. Eerste Brevo-send 29 oktober; go/no-go 26 oktober en delta 28 oktober zijn voorstellen. Writers blijven tot na 29 oktober Mailchimp.

De migratiebriefing van 19 oktober blijft open/ongeleverd, evenals de geadopteerde opdracht van 8 oktober. De afhankelijke importbriefing bij jaap-work blijft geblokkeerd. De gepubliceerde planningsbriefing naar ciiic-nieuwsbrief levert nog geen werkelijk lijst-ID of bevestigde delta-datum.

## Opdracht

1. Bouw één PR volgens [brevo-baseline-import.md](briefs/brevo-baseline-import.md). Claim TODO #7, lees het runbook en de bestaande preflight-, register- en read-back-code. Maak de CLI ook uitvoerbaar vanuit de productie-image; het preflight-script ontbreekt daar nu.
2. Implementeer en test de expliciete akkoordcontrole, bron-/doeldriftcontrole, veilige lijstbinding, suppressies vóór kandidaten, hervatbaarheid, idempotentie en volledige read-back met namen. Houd ontbrekend automation- of eventlogbewijs als blokkade vast. Gebruik synthetische providerresponses; productie-uitvoering hoort niet bij deze bouwopdracht.
3. Open een PR voor onafhankelijke flagship-review. Houd TODO #7 en beide migratiebriefings open: codelevering is nog geen baseline-import. Verwerk alleen een daadwerkelijk ontvangen diff-akkoord met datum; leid dit niet af uit de opdracht om de tool te bouwen.
4. Overschrijf deze handoff met review-en-merge voor de nieuwe PR, behoud het onderstaande onuitgevoerde werk en neem deze overschrijfplicht weer op.

## Doorgeefblok: bestaande opdrachten behouden

TODO #6: Brevo-support is de aanbevolen route op basis van het rapport van 19 oktober. Alleen met expliciet mandaat een supportbericht of hertest; bewijs van herstel is `delivered` plus sender-IP voor mailbox.org. Clicktracking op de magic link vraagt een afzonderlijk besluit. Geen herstel of actuele RBL-blokkade afleiden uit het oude bewijs.

TODO 5 vraagt afzonderlijk activatiemandaat en concrete acceptatie: autoritatieve DOI-bevestiging, CIIIC-signing-/registerconfiguratie, getekende Form43-feed7 (nu ongetekend, POST JSON naar `list=ciiic`), reconciliation vóór T0 en nieuwsbriefboekhouding; pas dan `CIIIC_CONSENT_ROUTE=enabled`. Geen productieconfiguratie, import, cutover of verzending afleiden uit de gemergde voorbereiding. Oude proefregisters blijven ongeschikt. Het editiecontract (#6) gaat pas live met die activatie: `NEWSLETTER_EDITION_TOKEN` in Coolify (en via 1Password naar ciiic-nieuwsbrief), Brevo-marketingwebhook ook voor `delivered`/`sent`, en dan een activatiebriefing naar ciiic-nieuwsbrief.

De contractbriefings `2026-10-06--from-ciiic-automator--to-forms--ciiic-optin-signature-contract.md` en `2026-10-06--from-ciiic-automator--to-ciiic-nieuwsbrief--editieboekhouding-consent-contract.md` blijven voorbereidingsopdrachten zonder activatiemandaat. De hubbriefing `2026-10-06--from-ciiic-automator--to-jaap-work--form43-actieve-ciiic-feed-blokkeert-consent-deploy.md` blijft staan: de feed moet bij activatie alsnog getekend worden.

Radar-nacontrole (uit PR #4): in monitor (scan-report) kijken of `springer-vr` en `nature-heritage` items opleverden sinds 9 okt. Springer met 0 items = bot-challenge die dag, geen bug. Kan als bijvangst in elke sessie.

Kleine bevinding, geen item: de code-default van `NOTION_CONTACTEN_DS_IDS` in `src/services/jaarevent.js` noemt een tweede data source (`30411fb0…`) die niet meer bestaat; de query geeft daar 404 en slaat hem over. Onschadelijk.

## Extra van Jaap

_(leeg)_
