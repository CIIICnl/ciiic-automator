# Uitvoer: TODO 2, uitgezette Radar-bronnen beslissen

Rol: uitvoer. Tier: `workhorse`.

## Stand bij vertrek

6 oktober 2026, Opus (uitvoer): TODO 1 gesloten. Draft-resume werkt in productie: `/data`-mount op `relaybot` bestaat, testsaves verhoogden de count van 2 naar 5, de link uit de mail resumeert. Mail kwam aan bij jaap@ciiic.nl en Gmail; mailbox.org weigerde hem omdat het gedeelde Brevo-IP op SpamCop stond. Dat werd TODO 6 (beslissing Jaap). Geen PR, alleen docs. Write-up: `docs/plans/done/2026-10.md`. Open: TODO 2, 5 en 6.

8 oktober 2026, Opus (uitvoer): briefing `brevo-taalattribuut-language-category` geleverd en gesloten. PR #3 gemerged (`e57d7be`) en gedeployd: de consentcode schrijft en leest de Brevo-taal nu als category-attribuut `LANGUAGE` (1 English, 2 Nederlands) via `src/services/consent/brevo-language.js`; `TAAL` bestaat niet meer. De opdracht hieronder (TODO 2) is niet aangeraakt en staat nog.

## Opdracht

1. Lees `docs/plans/TODO.md` § 2, `src/services/radar/config.js` en `docs/reference/radar-fase2-recon-2026-07-09.md`.
2. Bepaal per `RADAR_ENABLE_*`-vlag wat hij aanzet en of de bron nu server-side werkt (één fetch per bron; Springer en Nature blokkeerden in juli). Lees de Coolify-env van `relaybot` (`m7z1z547ie42j0d60fy0tvxx`) met skill `ciiic-coolify`, alleen GETs.
3. Leg Jaap per bron een voorstel voor (aan in Coolify-env of uit `config.js` halen) en wacht op zijn besluit. Zet zelf geen Coolify-env.
4. Bronnen die eruit moeten: op een branch met eigen PR (elke push naar `main` deployt). Vlaggen die aan moeten: Jaap zet ze in Coolify, of jij na zijn expliciete akkoord. Besluit per bron één regel in `docs/plans/done/decisions.md`.
5. Niets aan `CIIIC_CONSENT_ROUTE` of andere consentconfiguratie doen; dat is TODO 5. Log de sessie en behoud het doorgeefblok.
6. Overschrijf deze handoff met de volgende opdracht (review-en-merge van je eigen PR, of TODO 6), neem deze overschrijf-plicht weer op en sluit af met de bijbehorende sluitregel.

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
