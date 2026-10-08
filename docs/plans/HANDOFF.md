# Review-en-merge: PR #4, Radar-bronnen opgeruimd

Rol: stuur. Review-en-merge, tier `workhorse`.

## Stand bij vertrek

8 oktober 2026, Opus (uitvoer): TODO 2 beslist met Jaap. Springer en Nature gaven vanuit de productiebox echte RSS; Jaap koos "aan". `RADAR_ENABLE_SPRINGER=1` en `RADAR_ENABLE_NATURE=1` staan in de Coolify-env van `relaybot` (productie + preview), `relaybot` is herdeployd (`sj2ghr340tgdodfbrejmnhnv`, finished) en de container toont beide als enabled. EurekAlert (404), Immersive Wire (digest-feed) en UploadVR (overlap met Road to VR) gaan eruit in PR #4. Besluiten in `docs/plans/done/decisions.md`, TODO 2 al naar Recently done in de PR. Open daarna: TODO 5 en 6.

## Opdracht

1. Review https://github.com/CIIICnl/ciiic-automator/pull/4: `config.js` heeft geen verwijzing meer naar de drie bronnen, `index.js` mist de `rss`-scanner en `sources/immersivewire.js` is weg, `npm test` groen (50 pass). Check dat geen andere bron `method: 'rss'` gebruikt.
2. Merge naar `main` (deployt automatisch), check `https://bot.ciiic.nl/health`, draai `merge-housekeeping`.
3. Optioneel na de scan van 9 okt 07:00: in monitor (scan-report) kijken of `springer-vr` en `nature-heritage` items opleverden. Springer met 0 items = bot-challenge die dag, geen bug.
4. Overschrijf deze handoff met de volgende opdracht (TODO 6 of een van de open briefings hieronder), neem deze overschrijf-plicht weer op en sluit af met de bijbehorende sluitregel.

## Doorgeefblok: bestaande opdrachten behouden

TODO 6, Brevo-deliverability: beslissing van Jaap over de SpamCop-listing van het gedeelde Brevo-IP en clicktracking op de magic link. Kan in dezelfde beslisronde als TODO 2 mee als Jaap wil; hertest naar jaap@jaapstronks.nl met de Brevo-eventlog (`/v3/smtp/statistics/events?email=…`) als bewijs.

TODO 5 vraagt afzonderlijk activatiemandaat en concrete acceptatie: autoritatieve DOI-bevestiging, CIIIC-signing-/registerconfiguratie, getekende Form43-feed7 (nu ongetekend, POST JSON naar `list=ciiic`), reconciliation vóór T0 en nieuwsbriefboekhouding; pas dan `CIIIC_CONSENT_ROUTE=enabled`. Geen productieconfiguratie, import, cutover of verzending afleiden uit de gemergde voorbereiding. Oude proefregisters blijven ongeschikt.

De contractbriefings `2026-10-06--from-ciiic-automator--to-forms--ciiic-optin-signature-contract.md` en `2026-10-06--from-ciiic-automator--to-ciiic-nieuwsbrief--editieboekhouding-consent-contract.md` blijven voorbereidingsopdrachten zonder activatiemandaat. De hubbriefing `2026-10-06--from-ciiic-automator--to-jaap-work--form43-actieve-ciiic-feed-blokkeert-consent-deploy.md` blijft staan: de deploy is niet meer geblokkeerd, maar de feed moet bij activatie alsnog getekend worden.

Nog drie open _meta-briefings voor deze repo (8 okt), elk een eigen sessie:
- `2026-10-08--from-ciiic-website--to-ciiic-automator--notion-trackvelden-contactpersonen-weg` (S, `workhorse`): trackkeuze-code uit de Jaarevent-sync, deployen, dan pas de Notion-properties weg, ticket op Done.
- `2026-10-08--from-jaap-work--to-ciiic-automator--brevo-dryrun-en-baseline-import` (L, `flagship-review`, deadline go/no-go ma 19 okt): dry-run + geaggregeerd diff aan Jaap; import pas na akkoord. `LANGUAGE`-codec staat klaar; preflight leest de enumeratie al live. `FIRSTNAME` uit `FNAME` zit nog niet in het plan.
- `2026-10-07--from-ciiic-nieuwsbrief--to-ciiic-automator--editieboekhouding-contract` (M, `flagship-review`): editiecontract met de nieuwsbrief (snapshot-endpoint, webhook-mapping, suppressieroute).

## Extra van Jaap

_(leeg)_
