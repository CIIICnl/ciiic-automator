# Go/no-go-sessie 26 oktober: Brevo-delta van 28 oktober

Rol: stuur. Tier van het item: `flagship-review` (TODO #9). Dit is een beslisronde met Jaap, dus het flagship.

## Stand bij vertrek (21 oktober, avond)

PR [#10](https://github.com/CIIICnl/ciiic-automator/pull/10) is onafhankelijk gereviewd en gemerged (`122842a`, één allowlist-fix `08a105c`), gedeployed en healthy. Smoketest `go-no-go` read-only op productie om 16:12Z: `go: true`, `destination.verified: true` (alle negen tellers 0), lijst 20 met 2.163 leden, delta op dat moment 1 add (nl), 0 suppress, 0 update, 0 hold, enige waarschuwing TODO #6. Het baseline-record heeft `consentPolicy` met vier bronnen; `resolveBase` accepteert hem. Housekeeping gedaan (`e906349`), drift-log 9 merges, geen open signalen.

Hoe de smoketest draaide (herbruikbaar, de sleutel via stdin, nooit in env of git):

```sh
op item get "CIIIC consent export key (migratie-dry-run)" --vault CIIIC --fields password --reveal | ssh root@51.15.131.87 'c=$(docker ps --filter name=m7z1z547ie42j0d60fy0tvxx --format "{{.Names}}" | head -1); docker exec -i "$c" sh -c "read K; export CONSENT_EXPORT_KEY=\$K; cd /app; node scripts/consent-delta-import.mjs go-no-go --base-run /data/consent/migration/2026-10-21T11-01-06-771Z-dryrun.json --automation-evidence /data/consent/migration/2026-10-21T11-01-06-771Z-automations.json"'
```

Planning (door Jaap bevestigd): go/no-go maandag 26 oktober, delta woensdag 28 oktober, eerste send donderdag 29 oktober.

## Opdracht (maandag 26 oktober)

1. Draai `go-no-go` opnieuw op productie (commando hierboven). Het attest van 21 oktober is dan 5 dagen oud en wordt een blokkade bij `--max-age-days 3`; vraag Jaap of hij de Automations-pagina opnieuw bevestigt en schrijf dan een nieuw `<T>-automations.json` (0600, zelfde velden als het attest van 21 oktober: `checkedBy`, `checkedAt`, `listName`, `scope: account-and-list`, drie `*Disabled: true`) in `/data/consent/migration`.
2. Schrijf het rapport `docs/reports/brevo-go-no-go-2026-10-26.md`: uitkomst, delta-diff, lijststand, waarschuwingen, en de stand van TODO #6 (RBL): Jaap weegt of de send van 29 oktober doorgaat zonder bewezen mailbox.org-bezorging.
3. Leg Jaaps go/no-go vast in `done/decisions.md`. Bij go: de volgende handoff is de uitvoersessie van woensdag 28 oktober (rol stuur, flagship: dry-run, akkoordbestand `<T1>-delta-approval.json` met `t0`, `baselineT0`, `snapshotPath`, `runSha256`, `approvedBy: "Jaap"`, `approvedAt`; nieuw attest ná het akkoord; `apply` zonder en mét `--apply`; `event-log`; rapport; terugmelding T1 naar ciiic-nieuwsbrief via briefing). Bij no-go: voorstel delta beperken tot suppressies of datum schuiven, met Jaap.
4. Bekend gedrag om te melden als het zich voordoet: een Brevo-blacklist op een adres in lijst 20 (bijvoorbeeld een IX Labs-bounce op hetzelfde account) telt als `unexpectedSuppression` en maakt `destination.verified` false; dan weigert `apply` de hele delta. Zie je dat op 26 oktober, bespreek met Jaap of dat adres eerst handmatig uit lijst 20 gaat.
5. Overschrijf deze handoff met de opdracht voor 28 oktober (of de no-go-route), behoud het doorgeefblok hieronder, en neem deze overschrijfplicht weer op als laatste genummerde stap.

## Doorgeefblok: bestaande opdrachten behouden

**Nieuw 29 oktober: PR [#11](https://github.com/CIIICnl/ciiic-automator/pull/11), consentscopes (contract v2), wacht op flagship-review** (TODO #11, `tier: flagship-review`). Gebouwd door Opus op briefing AUT-11 (`2026-10-21--from-ciiic-nieuwsbrief--to-ciiic-automator--consent-scope-en-eventlijst.md`). Volgorde: flagship-reviewsessie keurt (reviewpunten staan in de PR-body, geen merge) → workhorse-sessie merget de goedgekeurde SHA, bevestigt `/health` op bot.ciiic.nl met de nieuwe commit, sluit de briefing met bewijs (`briefings.sh evidence` + `close --outcome delivered`) en meldt contract v2 terug aan ciiic-nieuwsbrief voor brief 49 stap 4. Deploy pas na afronding van de delta/send uit #9 als die nog loopt. Punt 2 van de briefing (IX Labs-eventlijst) is vervallen door Jaaps keuze van 21 oktober.


Nieuwe briefing van ciiic-nieuwsbrief (21 oktober, `tier: flagship-review`): `2026-10-21--from-ciiic-nieuwsbrief--to-ciiic-automator--consent-scope-en-eventlijst.md`. Scope per registerrecord (`newsletter`, `event:<slug>`), scope op de grootboekronde en de afmeldcallback, plus eventlijst IX Labs 18 november (alleen na Jaaps keuze). Nog niet geadopteerd; triëren als TODO-item na de delta, niet vóór 29 oktober laten concurreren met #9.

TODO #10: foutmeldingen-allowlist voor de import-CLI's (workhorse, klein).

TODO #6: Brevo-support is de aanbevolen route op basis van het RBL-rapport van 19 oktober. Alleen met expliciet mandaat een supportbericht of hertest; bewijs van herstel is `delivered` plus sender-IP voor mailbox.org. Clicktracking op de magic link vraagt een afzonderlijk besluit. Dit telt mee in de go/no-go van 26 oktober.

TODO #5 vraagt afzonderlijk activatiemandaat en concrete acceptatie: autoritatieve DOI-bevestiging, CIIIC-signing-/registerconfiguratie, getekende Form43-feed7, reconciliation vóór T0 en nieuwsbriefboekhouding; pas dan `CIIIC_CONSENT_ROUTE=enabled`. Het editiecontract gaat pas live met die activatie: `NEWSLETTER_EDITION_TOKEN` in Coolify en via 1Password naar ciiic-nieuwsbrief, Brevo-marketingwebhook ook voor `delivered`/`sent`, en dan een activatiebriefing naar ciiic-nieuwsbrief. De contractbriefings van 6 oktober naar forms en ciiic-nieuwsbrief en de hubbriefing over Form43/feed7 blijven voorbereidingsopdrachten zonder activatiemandaat.

Radar-nacontrole: kijk in monitor of `springer-vr` en `nature-heritage` items opleverden sinds 9 oktober. Springer met nul items die dag kan een bot-challenge zijn.

Kleine bevinding, geen item: de code-default van `NOTION_CONTACTEN_DS_IDS` in `src/services/jaarevent.js` noemt een tweede data source (`30411fb0…`) die niet meer bestaat; de query krijgt 404 en slaat hem over.

Brevo-huishouding, geen item: lijst 19 "Contacts involved in conversations" (map 18) is door Brevo Conversations aangemaakt; vier draftcampagnes van 6 oktober staan op testlijst 3. Laten staan tot na 29 oktober.

## Extra van Jaap

_(leeg)_
