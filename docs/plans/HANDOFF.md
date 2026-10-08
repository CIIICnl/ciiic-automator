# Uitvoer: Brevo-dry-run voor de CIIIC-nieuwsbrief (briefing brevo-dryrun-en-baseline-import)

Rol: uitvoer. Tier: `flagship-review` (workhorse bouwt, review door het flagship).

## Stand bij vertrek

8 oktober 2026, Opus (review-en-merge): PR #4 gemerged (`d098761`), auto-deploy op `relaybot` finished, `/health` healthy. TODO 2 gesloten (register + `done/2026-10.md`). Merge-housekeeping: geen open signalen, 3 merges sinds nulpunt, drempel niet gehaald. Open in TODO: 5 en 6.

## Opdracht

1. Lees de briefing `2026-10-08--from-jaap-work--to-ciiic-automator--brevo-dryrun-en-baseline-import` (`~/.claude/bin/meta briefings.sh open ciiic-automator`), hubplan `jaap-work/docs/plans/briefs/brevo-migratie-taalvoorkeur-2026-10-06.md` § 2 en § 5 stap 2-3, en `docs/reference/ciiic-consent-preparation.md`. Deadline: go/no-go **maandag 19 oktober**, eerste Brevo-verzending do 22 okt.
2. Adopteer de briefing als TODO-item met tier `flagship-review` (`briefings.sh adopt … --to ciiic-automator:docs/plans/TODO.md#<nr>`).
3. Bouw op een branch wat de dry-run (§ 5 stap 2) nog mist in de bestaande migratiepreflight: `FIRSTNAME` uit Mailchimp-`FNAME`, doellijst = nieuwe Brevo-lijst "CIIIC nieuwsbrief" (niet testlijst 3), T0 + geaggregeerd diff (per status/taal/suppressie, geen PII) in het beveiligde register buiten git. `LANGUAGE`-codec staat klaar en de preflight leest de enumeratie al live. Tests groen, PR open.
4. Draai de dry-run alleen-lezend tegen Mailchimp en Brevo en leg Jaap het geaggregeerde diff voor (in de sessie of via `ciiic-mail`-concept). **Geen import**: stap 3 is pas na Jaaps akkoord, en `CIIIC_CONSENT_ROUTE` blijft uit.
5. Overschrijf deze handoff met de review-en-merge-sessie voor je PR (tier `flagship-review` → flagship), neem deze overschrijf-plicht weer op en sluit af met de bijbehorende sluitregel.

## Doorgeefblok: bestaande opdrachten behouden

TODO 6, Brevo-deliverability: beslissing van Jaap over de SpamCop-listing van het gedeelde Brevo-IP en clicktracking op de magic link. Kan mee in de diff-voorlegging van de dry-run als Jaap wil; hertest naar jaap@jaapstronks.nl met de Brevo-eventlog (`/v3/smtp/statistics/events?email=…`) als bewijs.

TODO 5 vraagt afzonderlijk activatiemandaat en concrete acceptatie: autoritatieve DOI-bevestiging, CIIIC-signing-/registerconfiguratie, getekende Form43-feed7 (nu ongetekend, POST JSON naar `list=ciiic`), reconciliation vóór T0 en nieuwsbriefboekhouding; pas dan `CIIIC_CONSENT_ROUTE=enabled`. Geen productieconfiguratie, import, cutover of verzending afleiden uit de gemergde voorbereiding. Oude proefregisters blijven ongeschikt.

De contractbriefings `2026-10-06--from-ciiic-automator--to-forms--ciiic-optin-signature-contract.md` en `2026-10-06--from-ciiic-automator--to-ciiic-nieuwsbrief--editieboekhouding-consent-contract.md` blijven voorbereidingsopdrachten zonder activatiemandaat. De hubbriefing `2026-10-06--from-ciiic-automator--to-jaap-work--form43-actieve-ciiic-feed-blokkeert-consent-deploy.md` blijft staan: de deploy is niet meer geblokkeerd, maar de feed moet bij activatie alsnog getekend worden.

Nog twee open _meta-briefings voor deze repo naast de opdracht hierboven, elk een eigen sessie:
- `2026-10-08--from-ciiic-website--to-ciiic-automator--notion-trackvelden-contactpersonen-weg` (S, `workhorse`): trackkeuze-code uit de Jaarevent-sync, deployen, dan pas de Notion-properties weg, ticket op Done.
- `2026-10-07--from-ciiic-nieuwsbrief--to-ciiic-automator--editieboekhouding-contract` (M, `flagship-review`): editiecontract met de nieuwsbrief (snapshot-endpoint, webhook-mapping, suppressieroute).

Radar-nacontrole (uit PR #4): na de scan van 9 okt 07:00 in monitor (scan-report) kijken of `springer-vr` en `nature-heritage` items opleverden. Springer met 0 items = bot-challenge die dag, geen bug. Kan als bijvangst in elke sessie.

## Extra van Jaap

_(leeg)_
