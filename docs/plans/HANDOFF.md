# Merge-sessie PR #11 (consentscopes, contract v2), tier `flagship-review`, goedgekeurd door het flagship

Rol: stuur. Het flagship heeft PR [#11](https://github.com/CIIICnl/ciiic-automator/pull/11) op 29 oktober goedgekeurd; deze sessie merget de goedgekeurde SHA en levert de briefing. Model volgens `model-mode name-for merge`.

## Stand bij vertrek (29 oktober, avond)

- Go/no-go van 29 oktober gedraaid: `go: false` alleen door het Automations-attest van 21 oktober (8 dagen oud), `destination.verified: true`, lijst 20 op 2.163, delta 9 adds (nl), 9 suppressies (6 unsubscribed, 3 cleaned), 1 update, 0 hold. Rapport: `docs/reports/brevo-go-no-go-2026-10-29.md`. Geen delta uitgevoerd.
- Jaap: eerste Brevo-verzending pas over twee weken. Werkdatum donderdag 12 november, go/no-go maandag 9, delta woensdag 11 november (besluit in `done/decisions.md`). ciiic-nieuwsbrief gebrieft: `2026-10-29--from-ciiic-automator--to-ciiic-nieuwsbrief--brevo-send-verschoven.md`.
- PR #11 flagship-review: goedgekeurd op SHA `ef05ec30f7a5b1e7df586f3f7dc91e495ef82da2`, 93/93 tests, CI groen op node 20 en 22. De review staat als PR-review met state COMMENTED (GitHub weigert approve op een PR van het eigen account); ga op de reviewtekst af. Niets blokkerend; drie niet-blokkerende opmerkingen in de review. Briefing AUT-11 is geadopteerd op TODO #11.
- De permissieclassifier weigert productie-reads (ssh naar de relaybot-container) vanuit de agent. Jaap draait zulke commando's zelf met `! bash <script>`; het script van vandaag staat in de sessie-scratchpad, het commando zelf in het doorgeefblok hieronder.

## Opdracht

1. Controleer dat `ef05ec30f7a5b1e7df586f3f7dc91e495ef82da2` nog de head van `feat/consent-scope` is (`gh pr view 11 --json headRefOid`). Nieuwe commits erbovenop: niet mergen, terug naar een flagship-review.
2. Merge PR #11 (squash of merge volgens de repogewoonte, zie `git log --merges`), wacht op de Coolify-deploy en bevestig `https://bot.ciiic.nl/health` met de nieuwe commit. Deploy vóór de delta van 11 november is in orde: de migratietools lezen geen registerrecords en scopes raken geen checksum (reviewbevinding).
3. `merge-housekeeping`: branch opruimen, TODO #11 naar Recently done en `done/register.md`, drift-log bijwerken.
4. Sluit briefing `2026-10-21--from-ciiic-nieuwsbrief--to-ciiic-automator--consent-scope-en-eventlijst.md` met bewijs (`briefings.sh evidence` + `close --outcome delivered`), getoetst aan de "Done when" in de briefing; punt 2 (IX Labs-eventlijst) is op 21 oktober vervallen door Jaaps keuze, zeg dat in het bewijs. Neem in het bewijs op dat eventmails altijd via de snapshot moeten lopen (reviewopmerking 2), zodat ciiic-nieuwsbrief dat meeneemt in brief 49 stap 4.
5. Overschrijf deze handoff met de go/no-go-sessie van maandag 9 november (rol stuur, tier `flagship-review`, beslisronde met Jaap; procedure in het doorgeefblok), behoud het doorgeefblok en de terugkeer-check, en neem deze overschrijfplicht weer op als laatste genummerde stap.

## Terugkeer-check

- [ ] **AUT-12** Is donderdag 12 november de exacte datum van de eerste Brevo-send ("over twee weken" op 29 oktober)? Bij een andere dag: go/no-go en delta meeschuiven (maandag en woensdag ervoor) en ciiic-nieuwsbrief een correctie briefen.

## Doorgeefblok: bestaande opdrachten behouden

**Go/no-go maandag 9 november en delta woensdag 11 november (TODO #9, `flagship-review`, beslisronde met Jaap).** Jaap draait de productie-reads zelf. Go/no-go read-only:

```sh
op item get "CIIIC consent export key (migratie-dry-run)" --vault CIIIC --fields password --reveal | ssh root@51.15.131.87 'c=$(docker ps --filter name=m7z1z547ie42j0d60fy0tvxx --format "{{.Names}}" | head -1); docker exec -i "$c" sh -c "read K; export CONSENT_EXPORT_KEY=\$K; cd /app; node scripts/consent-delta-import.mjs go-no-go --base-run /data/consent/migration/2026-10-21T11-01-06-771Z-dryrun.json --automation-evidence /data/consent/migration/2026-10-21T11-01-06-771Z-automations.json"'
```

Het attest van 21 oktober blokkeert bij `--max-age-days 3`: Jaap bevestigt de Automations-pagina opnieuw, dan een nieuw `<T>-automations.json` (0600, zelfde velden: `checkedBy`, `checkedAt`, `listName`, `scope: account-and-list`, drie `*Disabled: true`) in `/data/consent/migration`. Rapport `docs/reports/brevo-go-no-go-2026-11-09.md`, besluit in `done/decisions.md`. Bekend gedrag: een Brevo-blacklist op een lid van lijst 20 telt als `unexpectedSuppression` en zet `destination.verified` op false; dan weigert `apply` de hele delta en moet dat adres eerst handmatig uit lijst 20. Delta woensdag 11 november (rol stuur, flagship): dry-run, akkoordbestand `<T1>-delta-approval.json` met `t0`, `baselineT0`, `snapshotPath`, `runSha256`, `approvedBy: "Jaap"`, `approvedAt`; nieuw attest ná het akkoord; `apply` zonder en mét `--apply`; `event-log`; rapport; terugmelding T1 naar ciiic-nieuwsbrief via briefing. Stand 29 oktober: delta 9/9/1, binnen de churn-marge van 21 oktober; de delta vraagt toch een eigen akkoord op het concrete diff.

TODO #10: foutmeldingen-allowlist voor de import-CLI's (workhorse, klein).

TODO #6: Brevo-support is de aanbevolen route op basis van het RBL-rapport van 19 oktober. De twee weken uitstel geven ruimte, maar alleen met expliciet mandaat een supportbericht of hertest; bewijs van herstel is `delivered` plus sender-IP voor mailbox.org. Clicktracking op de magic link vraagt een afzonderlijk besluit. Telt mee in de go/no-go van 9 november.

TODO #5 vraagt afzonderlijk activatiemandaat en concrete acceptatie: autoritatieve DOI-bevestiging, CIIIC-signing-/registerconfiguratie, getekende Form43-feed7, reconciliation vóór T0 en nieuwsbriefboekhouding; pas dan `CIIIC_CONSENT_ROUTE=enabled`. Het editiecontract gaat pas live met die activatie: `NEWSLETTER_EDITION_TOKEN` in Coolify en via 1Password naar ciiic-nieuwsbrief, Brevo-marketingwebhook ook voor `delivered`/`sent`, en dan een activatiebriefing naar ciiic-nieuwsbrief. De contractbriefings van 6 oktober naar forms en ciiic-nieuwsbrief en de hubbriefing over Form43/feed7 blijven voorbereidingsopdrachten zonder activatiemandaat.

Radar-nacontrole: kijk in monitor of `springer-vr` en `nature-heritage` items opleverden sinds 9 oktober. Springer met nul items die dag kan een bot-challenge zijn.

Kleine bevinding, geen item: de code-default van `NOTION_CONTACTEN_DS_IDS` in `src/services/jaarevent.js` noemt een tweede data source (`30411fb0…`) die niet meer bestaat; de query krijgt 404 en slaat hem over.

Brevo-huishouding, geen item: lijst 19 "Contacts involved in conversations" (map 18) is door Brevo Conversations aangemaakt; vier draftcampagnes van 6 oktober staan op testlijst 3. Laten staan tot na de eerste send.

## Extra van Jaap

_(leeg)_
