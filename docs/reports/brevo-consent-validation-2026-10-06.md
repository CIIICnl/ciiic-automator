# Brevo-consentvoorbereiding: verificatie 6 oktober 2026

Bron: meta-briefing `2026-10-06--from-jaap-work--to-ciiic-automator--brevo-consent-en-migratievoorbereiding.md`. Hubplan PR7 gemerged als `714665b`; vrijgave in `_meta` `2d04982d`. Dit rapport betreft codevoorbereiding en synthetische verificatie; geen productieacceptatie of migratiemandaat.

## Gecontroleerd

| Acceptatie | Bewijs |
|---|---|
| Eén taal, volgende editie bij wijziging | `tests/editions.test.js`: gezamenlijke snapshot, freeze na eerste poging, volgende editie andere taal, unknown-response blokkeert retry via andere provider |
| Afmelden blijft afmelden | `tests/consent.test.js` en `tests/migration.test.js`: oude suppressie blijft gelden, bevestiging heft geen suppressie op, actuele suppressie verwijdert uit editie |
| Geen verzonnen toestemming | Onbewezen bronrecords gaan in quarantaine; pending blijft pending; delivery/list-addition bevestigen niets; store vereist expliciete autoritatieve evidence |
| DOI, geen single opt-in voor CIIIC | Providerrequests getest op Mailchimp `pending` en Brevo DOI-endpoint; bestaande contacten blijven onaangeraakt; IX Labs afzonderlijk |
| Ontvangerlimiet, retries en herstart | Vijf gelijktijdige requests geven één DOI-poging; onzekere respons blijft na herstart gereserveerd; 24-uursreservering getest |
| Callbackauth en ordering | Echte lokale HTTP-tests op Bearer, configuratie, ongeldige lijst, gedeeltelijke batchfout en retry; same-source/same-time taalconflict in beide volgordes in quarantaine |
| Forms-auth | Echte lokale HTTP-tests voor geldige aanvraag, vervalste handtekening en ontbrekend geheim; HMAC bindt URL/query én raw body |
| Bronreconciliation | Volledige scans, voorkeurcheckpoint, gewijzigde naam zonder taalwijziging overschrijft Brevo niet; late afmelding zit in ontvangen delta; gedeeltelijke toepassing veilig hervat |
| Migratiepreflight/read-back | Synthetische statusmatrix, deterministische volgorde, suppressies eerst, dubbele identiteit, taalconflict en ontbreken van bewijs; read-back controleert lijst/taal/suppressies |
| Owner/listbinding | Live GETs op Coolify en Mailchimp: jaarevent `0e404ef800`, CIIIC `67fe159b9d`, beide company `CIIIC`; alleen niet-persoonlijke bindingsgegevens bewaard |

`npm test`: 42 tests geslaagd, nul mislukt. `git diff --check`: schoon. Gitleaks over staged wijzigingen: geen secrets. GitHub Actions voor Node20 en Node22 controleert iedere PR-head; eerdere runs zijn groen. Het actuele resultaat staat op PR2.

Mutatiecontrole: in een geïsoleerde tijdelijke kopie is alleen `jaarevent.verifySignature` vervangen door altijd-waar. `npm test` faalde precies op `existing Jaarevent status HMAC verifies the literal raw body` (toen 29 geslaagd, 1 gefaald). De tijdelijke kopie is verwijderd; de werkboom bleef ongewijzigd. Dit dekt tevens de minimale klaar-als van TODO3; sluiten pas na review/merge.

## Herstel van reviewbevindingen R1 en R2

De eerdere review op `f4e89d9` bleef terecht geblokkeerd ondanks 32 groene tests. De herstelronde voegt tien regressietests in `tests/reconciliation.test.js` toe, met echte tijdelijke SQLite-registers en AES-GCM-checkpoints. De bestaande test voor een naamswijziging blijft behouden; een concurrentieproef controleert nu dat bronbewijs wordt uitgegeven in plaats van stil overgeslagen.

| Bevinding / grens | Herstelbewijs |
|---|---|
| R1: scan 10:05 mag geen exacte taalwijziging worden | Mailchimp-keuze binnen 10:00–10:05 en Brevo-keuze 10:03 leveren quarantaine, in beide aankomstvolgordes en bij callback tussen plan en toepassing; bronmoment blijft apart bewaard |
| Lange gepagineerde scan | Ondergrens is begin vorige scan, niet eindtijd; een tussentijdse callback blijft conflicterend |
| Vertraagde callback / herstart | Broninterval blijft in versleutelde `preferenceEvidence`; callback na herstart heropent het conflict correct; meerdere ongewijzigde scans wissen niets |
| R2: beide interests | Duurzame blokkade bij nieuwe én bestaande editie; volgende eenduidige EN-correctie wordt verwerkt, ook na herstart en meerdere scans |
| Gedeeltelijke toepassing | Pending-batch bewaart oorspronkelijke IDs en intervallen; retry na herstart verwerkt die vóór de nieuwere scan, voor zowel taalwijzigingen als conflicten |
| Gecontroleerd herstel | Bewezen latere profielkeuze of bronwijziging heft alleen voorkeurconflict op; oudere vertraagde callback overschrijft niets; suppressie en consent blijven behouden |
| Editieboekhouding | Reeds begonnen editie houdt NL-toewijzing bij latere EN-correctie; onzekere claim blokkeert retry via andere provider |

Deze uitkomsten zijn uitvoeringsbewijs en vragen nog een onafhankelijke flagship-review. De oorspronkelijke review blijft als historisch rapport behouden. Geen productiegegevens of configuratie gelezen of gewijzigd in deze herstelronde.

## Herstel van reviewbevinding R3

Review R3 (`714d982`) blokkeerde merge: de route eiste direct het signinggeheim, en de live Form43-feed7 post ongetekend naar `list=ciiic`. Herstel: activatieschakelaar `CIIIC_CONSENT_ROUTE`, standaard uit. Zonder de exacte waarde `enabled` draaien newsletter-optin, SXSW en registration het gedrag van vóór deze PR; de getekende consentroute heeft geen unsigned fallback.

| Criterium R3 | Bewijs in `tests/route-activation.test.js` (echte `app` uit `src/index.js`, uitgaand HTTPS vervangen door recorder) |
|---|---|
| Live configuratievorm, veld5 aangevinkt | Ongetekende POST op het exacte feed7-pad → 200, één Mailchimp-PUT op `67fe159b9d` met `status_if_new: subscribed`, tag `ixlabs-opening-2026`, organisatie in `MMERGE6` |
| Live configuratievorm, veld5 leeg | 200 `no_optin`, geen uitgaand verkeer |
| Overige routes in default | SXSW form26 → PUT op CIIIC met bronlabel; registration met veld19 → PATCH, bij 404 POST op `0e404ef800`; zonder veld19 alleen PATCH |
| Nieuwe route expliciet aan | Zonder secret 503 (ook leeg veld), zonder of met foute handtekening 403, getekend leeg veld 200 zonder providercall, getekende opt-in zonder registersleutels 503 en geen legacy-PUT |
| Schakelaar strikt | `true`, `1`, `Enabled`, `on`, leeg → uit |

`npm test`: 46 geslaagd, 0 gefaald (42 bestaande plus 4 nieuwe; de bestaande consenttests geven nu expliciet `consentRoute: true` mee). Entrypoint-rooktest: `node src/index.js` start en beantwoordt `GET /` met 200; `app.listen` en de opstartjobs draaien alleen als `index.js` het entrypoint is, zodat tests de app zonder bijwerkingen laden. Geen productieconfiguratie gelezen of gewijzigd in deze ronde; de live feed-/env-hercontrole hoort bij de review vóór merge.

## Grenzen en productiepoorten

- Geen bulkimport, echte DOI-mail, campagneverzending, accountconfiguratie, cutover of deploy uitgevoerd. Geen persoonsgegevens/exportbestanden in git of testlogs.
- Authentieke DOI-bevestiging is nog niet automatisch aan het register gekoppeld. Lokale pending-toestemming blijft daarom niet-verzendbaar; de reviewer moet deze productiepoort expliciet overdragen.
- De consentroute activeert alleen met `CIIIC_CONSENT_ROUTE=enabled`. Daarvoor zijn register-/signingconfiguratie en een getekende Forms-feed nodig; zonder configuratie faalt de aangezette route gesloten. Merge triggert automatisch deploy en laat bij ongezette schakelaar het huidige gedrag staan.
- De reconciliation-runner is gebouwd maar niet ingepland. De nieuwsbriefapp gebruikt de editieboekhouding nog niet. Concrete consumercontracten worden via meta-briefings doorgegeven.
- Baseline-import is ontworpen en voorzien van read-backvergelijking; er is geen uitvoerbare providerimport. Dat vraagt afzonderlijk mandaat, gecontroleerd consentbewijs, uitgeschakelde automations en een nieuw gecontroleerd diff.

Uitvoering en interfaces: `docs/reference/ciiic-consent-preparation.md`. De oorspronkelijke meta-briefing blijft open tot de afzonderlijke review en bewijsregistratie; een PR is nog geen levering op main.
