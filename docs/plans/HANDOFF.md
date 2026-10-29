# Go/no-go maandag 9 november (beslisronde, TODO #9, tier `flagship-review`)

Rol: stuur. Beslisronde met Jaap over de eerste Brevo-send van donderdag 12 november: go/no-go read-only draaien, rapport en besluit vastleggen. Model volgens `model-mode name-for beslisronde flagship-review`.

## Stand bij vertrek (29 oktober, avond)

- PR #11 (consentscopes, contract v2) gemerged als `94e7463` op de flagship-goedgekeurde SHA `ef05ec3`; Coolify-deploy finished, `/health` healthy. TODO #11 dicht, briefing AUT-11 met bewijs geleverd, terugmelding `2026-10-29--from-ciiic-automator--to-ciiic-nieuwsbrief--consent-scope-live.md` gepubliceerd (eventmails altijd via de snapshot).
- Go/no-go van 29 oktober: `go: false` alleen door het attest van 21 oktober; delta 9 adds, 9 suppressies, 1 update, 0 hold. Rapport `docs/reports/brevo-go-no-go-2026-10-29.md`.
- De permissieclassifier weigert productie-reads (ssh naar de relaybot-container) vanuit de agent: Jaap draait het commando uit het doorgeefblok zelf met `! bash <script>` of plakt het.
- Coolify-API werkt via `ciiic-env` met `$COOLIFY_URL/deployments/applications/m7z1z547ie42j0d60fy0tvxx?take=2` (`COOLIFY_URL` bevat al `/api/v1`).

## Opdracht

1. Vraag Jaap eerst naar de terugkeer-check (AUT-12: is 12 november de senddatum?). Andere datum: schuif go/no-go en delta mee, corrigeer `done/decisions.md` en brief ciiic-nieuwsbrief.
2. Laat Jaap de Automations-pagina in Brevo opnieuw bevestigen en zet een vers attest `<T>-automations.json` (0600, velden als in het doorgeefblok) in `/data/consent/migration`; via een script dat Jaap zelf draait.
3. Laat Jaap het go/no-go-commando uit het doorgeefblok draaien met `--automation-evidence` naar het nieuwe attest. Lees de uitkomst: `go`, `destination.verified`, delta-aantallen, holds, `unexpectedSuppression`. Bij een blacklist op een lid van lijst 20: adres eerst handmatig uit lijst 20, dan opnieuw.
4. Neem TODO #6 (bezorging mailbox.org) mee in het oordeel: is er mandaat voor supportbericht of hertest, en is herstel bewezen? Zo niet, zeg expliciet wat dat betekent voor mailbox.org-ontvangers op 12 november.
5. Schrijf `docs/reports/brevo-go-no-go-2026-11-09.md` en het besluit in `done/decisions.md`; werk TODO #9 bij. Op een branch, gemerged naar main (docs-only).
6. Overschrijf deze handoff met de delta-sessie van woensdag 11 november (rol stuur, tier `flagship-review`; procedure in het doorgeefblok), behoud doorgeefblok en terugkeer-check, en neem deze overschrijfplicht weer op als laatste genummerde stap.

## Terugkeer-check

- [ ] **AUT-12** Is donderdag 12 november de exacte datum van de eerste Brevo-send ("over twee weken" op 29 oktober)? Bij een andere dag: go/no-go en delta meeschuiven (maandag en woensdag ervoor) en ciiic-nieuwsbrief een correctie briefen.

## Doorgeefblok: bestaande opdrachten behouden

**Go/no-go maandag 9 november en delta woensdag 11 november (TODO #9, `flagship-review`, beslisronde met Jaap).** Jaap draait de productie-reads zelf. Go/no-go read-only:

```sh
op item get "CIIIC consent export key (migratie-dry-run)" --vault CIIIC --fields password --reveal | ssh root@51.15.131.87 'c=$(docker ps --filter name=m7z1z547ie42j0d60fy0tvxx --format "{{.Names}}" | head -1); docker exec -i "$c" sh -c "read K; export CONSENT_EXPORT_KEY=\$K; cd /app; node scripts/consent-delta-import.mjs go-no-go --base-run /data/consent/migration/2026-10-21T11-01-06-771Z-dryrun.json --automation-evidence /data/consent/migration/2026-10-21T11-01-06-771Z-automations.json"'
```

Het attest van 21 oktober blokkeert bij `--max-age-days 3`: Jaap bevestigt de Automations-pagina opnieuw, dan een nieuw `<T>-automations.json` (0600, zelfde velden: `checkedBy`, `checkedAt`, `listName`, `scope: account-and-list`, drie `*Disabled: true`) in `/data/consent/migration`. Rapport `docs/reports/brevo-go-no-go-2026-11-09.md`, besluit in `done/decisions.md`. Bekend gedrag: een Brevo-blacklist op een lid van lijst 20 telt als `unexpectedSuppression` en zet `destination.verified` op false; dan weigert `apply` de hele delta en moet dat adres eerst handmatig uit lijst 20. Delta woensdag 11 november (rol stuur, tier `flagship-review`): dry-run, akkoordbestand `<T1>-delta-approval.json` met `t0`, `baselineT0`, `snapshotPath`, `runSha256`, `approvedBy: "Jaap"`, `approvedAt`; nieuw attest ná het akkoord; `apply` zonder en mét `--apply`; `event-log`; rapport; terugmelding T1 naar ciiic-nieuwsbrief via briefing. Stand 29 oktober: delta 9/9/1, binnen de churn-marge van 21 oktober; de delta vraagt toch een eigen akkoord op het concrete diff.

TODO #10: foutmeldingen-allowlist voor de import-CLI's (workhorse, klein).

TODO #6: Brevo-support is de aanbevolen route op basis van het RBL-rapport van 19 oktober. De twee weken uitstel geven ruimte, maar alleen met expliciet mandaat een supportbericht of hertest; bewijs van herstel is `delivered` plus sender-IP voor mailbox.org. Clicktracking op de magic link vraagt een afzonderlijk besluit. Telt mee in de go/no-go van 9 november.

TODO #5 vraagt afzonderlijk activatiemandaat en concrete acceptatie: autoritatieve DOI-bevestiging, CIIIC-signing-/registerconfiguratie, getekende Form43-feed7, reconciliation vóór T0 en nieuwsbriefboekhouding; pas dan `CIIIC_CONSENT_ROUTE=enabled`. Het editiecontract gaat pas live met die activatie: `NEWSLETTER_EDITION_TOKEN` in Coolify en via 1Password naar ciiic-nieuwsbrief, Brevo-marketingwebhook ook voor `delivered`/`sent`, en dan een activatiebriefing naar ciiic-nieuwsbrief. De contractbriefings van 6 oktober naar forms en ciiic-nieuwsbrief en de hubbriefing over Form43/feed7 blijven voorbereidingsopdrachten zonder activatiemandaat.

Radar-nacontrole: kijk in monitor of `springer-vr` en `nature-heritage` items opleverden sinds 9 oktober. Springer met nul items die dag kan een bot-challenge zijn.

Kleine bevinding, geen item: de code-default van `NOTION_CONTACTEN_DS_IDS` in `src/services/jaarevent.js` noemt een tweede data source (`30411fb0…`) die niet meer bestaat; de query krijgt 404 en slaat hem over.

Brevo-huishouding, geen item: lijst 19 "Contacts involved in conversations" (map 18) is door Brevo Conversations aangemaakt; vier draftcampagnes van 6 oktober staan op testlijst 3. Laten staan tot na de eerste send.

## Extra van Jaap

_(leeg)_
