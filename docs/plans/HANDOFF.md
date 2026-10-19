# Review-en-merge: PR #7, Brevo-besluit, definitieve dry-run en bouncebewijs

Rol: stuur. Tier: `flagship-review` (migratievoorbereiding); onafhankelijke review door het flagship.

## Stand bij vertrek

19 oktober 2026, Sol (uitvoer). Main `5ed2927`; branch `docs/brevo-meta-19oct`, inhoudscommit `ba2878f`; [PR #7](https://github.com/CIIICnl/ciiic-automator/pull/7) wacht op review. Geen runtimecode gewijzigd.

- Jaaps grondslagbesluit van 19 oktober is overgenomen: alle vier Mailchimp-bronnen tellen mee; `subscribed` is de grondslag. Eerste echte Brevo-send is 29 oktober. Voorgesteld go/no-go 26 oktober, delta 28 oktober; writers blijven tot na 29 oktober Mailchimp.
- Definitieve read-only dry-run voltooid: T0 `2026-10-19T17:36:35.815Z`, 2.161 kandidaten (2.090 NL, 71 EN), 464 suppressies, 24 pending, 0 quarantaine; 84 kandidaten zonder voornaam. Doellijst bestaat niet. Register en versleutelde export op `/data/consent/migration` in relaybot. [Rapport](../reports/brevo-migration-dryrun-2026-10-19.md).
- Het concrete diff is aan Jaap ter goedkeuring voorgelegd; bij schrijven van deze handoff nog geen antwoord. Dit is een ander akkoord dan het reeds genomen grondslagbesluit. Geen import, providerwrite, supportbericht of testmail uitgevoerd. De importtool bestaat nog niet; [uitvoerbrief](briefs/brevo-baseline-import.md) ligt klaar.
- RBL-briefing is inhoudelijk verwerkt in TODO #6 en [bewijsrapport](../reports/brevo-rbl-status-2026-10-19.md); sluit hem na merge met bewijs. Herstel is onbekend, Brevo-support aanbevolen, hertest en clicktrackingbesluit blijven apart open.
- `npm test` 58/58, `git diff --check` en prose-wrap-check groen. Bronsets tweemaal gelezen, checksums gelijk; rapporttotalen gecontroleerd. Het script ontbrak in de Docker-image; ongewijzigd tijdelijk uitgevoerd naast `/app/src`, tijdelijke map daarna verwijderd.
- Planningsbriefing naar ciiic-nieuwsbrief gepubliceerd: `2026-10-19--from-ciiic-automator--to-ciiic-nieuwsbrief--brevo-planning-29okt-dryrun.md`. Nog geen werkelijk lijst-ID of bevestigde delta-datum geleverd. Migratiebriefing van 19 oktober en geadopteerde opdracht van 8 oktober blijven ongeleverd; de afhankelijke importbriefing bij jaap-work blijft geblokkeerd.

## Opdracht

1. Review PR #7 tegen beide briefings van 19 oktober: controleer Jaaps besluit, de concrete dry-run en het voorgestelde vervolg. Lees zo nodig de geaggregeerde runrecord op productie; sleutel of persoonsdata hoeven niet naar git. Controleer dat er nergens importakkoord of levering wordt geclaimd.
2. Merge na akkoord, voer housekeeping uit en sluit alleen `2026-10-19--from-jaap-work--to-ciiic-automator--brevo-rbl-logmeting-en-providerroute.md` met evidence: TODO #6 en het rapport bevatten de volledige meting, eigenaar en Brevo-supportroute; herstel/clicktracking blijven open. Geen deployacceptatie nodig voor deze documentwijziging.
3. Behoud de migratiebriefings als open/ongeleverd. Verwerk een eventueel nieuw antwoord van Jaap op het concrete diff met datum. Zonder antwoord blijft import geblokkeerd. De volgende uitvoeropdracht is bouw van `briefs/brevo-baseline-import.md` op workhorse, met onafhankelijke flagship-review vóór een afzonderlijk geautoriseerde productie-uitvoering.
4. Overschrijf deze handoff met de volgende sessie, behoud het onderstaande onuitgevoerde werk en neem deze overschrijfplicht weer op.

## Doorgeefblok: bestaande opdrachten behouden

TODO #6: Brevo-support is de aanbevolen route op basis van het rapport van 19 oktober. Alleen met expliciet mandaat een supportbericht of hertest; bewijs van herstel is `delivered` plus sender-IP voor mailbox.org. Clicktracking op de magic link vraagt een afzonderlijk besluit. Geen herstel of actuele RBL-blokkade afleiden uit het oude bewijs.

TODO 5 vraagt afzonderlijk activatiemandaat en concrete acceptatie: autoritatieve DOI-bevestiging, CIIIC-signing-/registerconfiguratie, getekende Form43-feed7 (nu ongetekend, POST JSON naar `list=ciiic`), reconciliation vóór T0 en nieuwsbriefboekhouding; pas dan `CIIIC_CONSENT_ROUTE=enabled`. Geen productieconfiguratie, import, cutover of verzending afleiden uit de gemergde voorbereiding. Oude proefregisters blijven ongeschikt. Het editiecontract (#6) gaat pas live met die activatie: `NEWSLETTER_EDITION_TOKEN` in Coolify (en via 1Password naar ciiic-nieuwsbrief), Brevo-marketingwebhook ook voor `delivered`/`sent`, en dan een activatiebriefing naar ciiic-nieuwsbrief.

De contractbriefings `2026-10-06--from-ciiic-automator--to-forms--ciiic-optin-signature-contract.md` en `2026-10-06--from-ciiic-automator--to-ciiic-nieuwsbrief--editieboekhouding-consent-contract.md` blijven voorbereidingsopdrachten zonder activatiemandaat. De hubbriefing `2026-10-06--from-ciiic-automator--to-jaap-work--form43-actieve-ciiic-feed-blokkeert-consent-deploy.md` blijft staan: de feed moet bij activatie alsnog getekend worden.

Radar-nacontrole (uit PR #4): in monitor (scan-report) kijken of `springer-vr` en `nature-heritage` items opleverden sinds 9 okt. Springer met 0 items = bot-challenge die dag, geen bug. Kan als bijvangst in elke sessie.

Kleine bevinding, geen item: de code-default van `NOTION_CONTACTEN_DS_IDS` in `src/services/jaarevent.js` noemt een tweede data source (`30411fb0…`) die niet meer bestaat; de query geeft daar 404 en slaat hem over. Onschadelijk.

## Extra van Jaap

_(leeg)_
