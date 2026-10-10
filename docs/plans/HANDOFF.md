# Review-en-merge: PR #5 (Brevo-dry-run) en PR #6 (editiecontract)

Rol: stuur (review-en-merge). Tier van beide PR's: `flagship-review`, dus deze sessie draait op het flagship.

## Stand bij vertrek

10 oktober 2026, Opus (uitvoer). Drie open _meta-briefings afgehandeld:

- **Trackvelden** (`workhorse`): geleverd en gesloten. Codecomment weg (`b1d772e`, gedeployd), `track1`/`track2` weg uit Notion Contacten, ticket op Done. `toegewezen track` en `track-informeren` bewust laten staan (buiten de vraag), gemeld in het ticket.
- **Brevo-dry-run** (`flagship-review`): PR #5 open, briefing geadopteerd als TODO 7. Dry-run alleen-lezend gedraaid in de relaybot-container, T0 `2026-10-10T17:23:23Z`, register `/data/consent/migration` (exportsleutel in 1Password "CIIIC consent export key (migratie-dry-run)"). 2.148 subscribed, 457 suppressies, 16 pending; nl 2.077 / en 71; 83 zonder voornaam; 2.147 nieuw in Brevo. Bronnen: Import 1.290, API - Generic 851, Hosted Signup Form 6, Admin Add 1. **Wacht op Jaaps grondslagbesluit**: welke bronnen tellen.
- **Editiecontract** (`flagship-review`): PR #6 open, briefing geadopteerd als TODO 8.

PR #5 en #6 mergen zonder conflict met elkaar (`git merge-tree` gecontroleerd).

## Opdracht

1. Review PR #5 https://github.com/CIIICnl/ciiic-automator/pull/5 en PR #6 https://github.com/CIIICnl/ciiic-automator/pull/6 tegen hun briefings (`~/.claude/bin/meta briefings.sh` in `_meta/briefings/done/2026-10/`). Merge = auto-deploy op `relaybot`; controleer vóór merge live dat `CIIIC_CONSENT_ROUTE` in Coolify ontbreekt (beide PR's zijn dan inert). Na merge: deploy finished, `/health` healthy, `merge-housekeeping`.
2. Na merge van #6: briefing naar ciiic-nieuwsbrief met het definitieve contract (paden, velden, `NEWSLETTER_EDITION_TOKEN`, route b), zodat de aansluiting daar `[workhorse]` wordt. Daarna briefing `2026-10-07--from-ciiic-nieuwsbrief--to-ciiic-automator--editieboekhouding-contract` sluiten met bewijs (`close … --outcome delivered`) en TODO 8 naar Recently done.
3. TODO 7 gaat verder zodra Jaap de bronnen gekozen heeft (staat het besluit hieronder bij "Extra van Jaap", dan is het er): definitieve dry-run met `--accept-sources … --policy "Jaap akkoord <datum> op dry-run 2026-10-10T17:23:23Z"`, dan een uitvoersessie die de importtool bouwt (bestaat nog niet; runbook § Baseline-import en rollback) en de import draait. Go/no-go **ma 19 okt**; liever no-go dan een halve import. Bij no-go: briefing naar ciiic-nieuwsbrief met reden en nieuwe richtdatum.
4. Overschrijf deze handoff met de volgende sessie, neem deze overschrijfplicht weer op, en sluit af met de sluitregel.

## Doorgeefblok: bestaande opdrachten behouden

TODO 6, Brevo-deliverability: beslissing van Jaap over de SpamCop-listing van het gedeelde Brevo-IP en clicktracking op de magic link. Hertest naar jaap@jaapstronks.nl met de Brevo-eventlog (`/v3/smtp/statistics/events?email=…`) als bewijs.

TODO 5 vraagt afzonderlijk activatiemandaat en concrete acceptatie: autoritatieve DOI-bevestiging, CIIIC-signing-/registerconfiguratie, getekende Form43-feed7 (nu ongetekend, POST JSON naar `list=ciiic`), reconciliation vóór T0 en nieuwsbriefboekhouding; pas dan `CIIIC_CONSENT_ROUTE=enabled`. Geen productieconfiguratie, import, cutover of verzending afleiden uit de gemergde voorbereiding. Oude proefregisters blijven ongeschikt. Het editiecontract (#6) gaat pas live met die activatie: token in Coolify, Brevo-webhook ook voor `delivered`.

De contractbriefings `2026-10-06--from-ciiic-automator--to-forms--ciiic-optin-signature-contract.md` en `2026-10-06--from-ciiic-automator--to-ciiic-nieuwsbrief--editieboekhouding-consent-contract.md` blijven voorbereidingsopdrachten zonder activatiemandaat. De hubbriefing `2026-10-06--from-ciiic-automator--to-jaap-work--form43-actieve-ciiic-feed-blokkeert-consent-deploy.md` blijft staan: de feed moet bij activatie alsnog getekend worden.

Radar-nacontrole (uit PR #4): in monitor (scan-report) kijken of `springer-vr` en `nature-heritage` items opleverden sinds 9 okt. Springer met 0 items = bot-challenge die dag, geen bug. Kan als bijvangst in elke sessie.

Kleine bevinding, geen item: de code-default van `NOTION_CONTACTEN_DS_IDS` in `src/services/jaarevent.js` noemt een tweede data source (`30411fb0…`) die niet meer bestaat; de query geeft daar 404 en slaat hem over. Onschadelijk.

## Extra van Jaap

_(leeg)_
