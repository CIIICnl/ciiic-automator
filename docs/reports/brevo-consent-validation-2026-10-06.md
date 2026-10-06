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

`npm test`: 31 tests geslaagd, nul mislukt. `git diff --check`: schoon. Gitleaks over staged wijzigingen: geen secrets. GitHub Actions is toegevoegd voor Node20 en Node22; CI-resultaat staat op de PR.

Mutatiecontrole: in een geïsoleerde tijdelijke kopie is alleen `jaarevent.verifySignature` vervangen door altijd-waar. `npm test` faalde precies op `existing Jaarevent status HMAC verifies the literal raw body` (toen 29 geslaagd, 1 gefaald). De tijdelijke kopie is verwijderd; de werkboom bleef ongewijzigd. Dit dekt tevens de minimale klaar-als van TODO3; sluiten pas na review/merge.

## Grenzen en productiepoorten

- Geen bulkimport, echte DOI-mail, campagneverzending, accountconfiguratie, cutover of deploy uitgevoerd. Geen persoonsgegevens/exportbestanden in git of testlogs.
- Authentieke DOI-bevestiging is nog niet automatisch aan het register gekoppeld. Lokale pending-toestemming blijft daarom niet-verzendbaar; de reviewer moet deze productiepoort expliciet overdragen.
- Nieuwe register-/signingconfiguratie is nodig voor CIIIC-opt-ins. Zonder configuratie faalt de route gesloten; merge triggert hier automatisch deploy. De reviewer beoordeelt activering en consumers vóór merge.
- De reconciliation-runner is gebouwd maar niet ingepland. De nieuwsbriefapp gebruikt de editieboekhouding nog niet. Concrete consumercontracten worden via meta-briefings doorgegeven.
- Baseline-import is ontworpen en voorzien van read-backvergelijking; er is geen uitvoerbare providerimport. Dat vraagt afzonderlijk mandaat, gecontroleerd consentbewijs, uitgeschakelde automations en een nieuw gecontroleerd diff.

Uitvoering en interfaces: `docs/reference/ciiic-consent-preparation.md`. De oorspronkelijke meta-briefing blijft open tot de afzonderlijke review en bewijsregistratie; een PR is nog geen levering op main.
