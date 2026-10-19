# Definitieve Brevo-dry-run van 19 oktober 2026

De dry-run met alle vier door Jaap geaccepteerde bronnen levert 2.161 kandidaten, 464 suppressies en 24 uitgesloten pending op; geen quarantaine. De grondslag is besloten, maar akkoord op dit concrete diff is nog niet ontvangen. Er is geen baseline-import uitgevoerd en geen doellijst aangemaakt.

## Diff ter goedkeuring

| Status / actie | 10 oktober | 19 oktober | Verschil |
| --- | ---: | ---: | ---: |
| Subscribed / kandidaten met alle bronnen aanvaard | 2.148 | 2.161 | +13 |
| Suppressies | 457 | 464 | +7 |
| Pending / uitgesloten | 16 | 24 | +8 |
| Totaal Mailchimp | 2.621 | 2.649 | +28 |

De statusverschillen zijn netto aantallen tussen twee snapshots, geen reconstructie van individuele statusovergangen. De oude 2.148 is de subscribed-inventaris, geen bewering dat die oorspronkelijke run al een goedgekeurd importplan had.

| Importdiff 19 oktober | Aantal |
| --- | ---: |
| Kandidaten Nederlands | 2.090 |
| Kandidaten Engels | 71 |
| Nederlands als default (geen expliciete taalgroep) | 2.075 |
| Expliciete Mailchimp-taalgroep | 86 |
| Kandidaten zonder voornaam | 84 |
| Nieuwe Brevo-contacten | 2.160 |
| Bestaand Brevo-contact | 1 |
| Afwijkende bestaande voornaam | 0 |
| Suppressie: unsubscribed | 321 |
| Suppressie: cleaned | 143 |
| Quarantaine | 0 |

84 kandidaten hebben geen `FNAME`; daarvoor blijft de algemene aanhef gelden. De aanwezige namen moeten bij de import naar `FIRSTNAME` en `LASTNAME` worden overgenomen. `LANGUAGE` wordt via de live Brevo-enumeratie vertaald.

## Grondslag en herkomst

Jaaps besluit van 19 oktober is dat de Mailchimp-status `subscribed` de grondslag is voor alle vier bronnen. De 1.291 Import/Admin Add uit de inventaris van 10 oktober zijn expliciet aanvaard zonder providerbevestiging. Zie `../plans/done/decisions.md`; de onderstaande actuele aantallen houden de herkomst zichtbaar.

| Mailchimp-bron | Subscribed 19 oktober | Met opt-in-tijdstip | Met opt-in-IP |
| --- | ---: | ---: | ---: |
| Import | 1.288 | 1.288 | 1.288 |
| API - Generic | 866 | 866 | 866 |
| Hosted Signup Form | 6 | 6 | 6 |
| Admin Add | 1 | 1 | 1 |

Alleen provider-GETs zijn gebruikt. Beide bronsets zijn tweemaal gelezen en de checksums kwamen overeen tijdens de scan. Er zijn 2.649 Mailchimp-records en drie bestaande Brevo-contacten gelezen. `CIIIC nieuwsbrief` bestaat nog niet (`targetList.exists: false`, ID `null`). Het plan bevat vijf suppressiebatches, gevolgd door 22 kandidaatbatches; alle staan op `planned_only`.

## Bewijs en beveiligde opslag

- T0: `2026-10-19T17:36:35.815Z`.
- Productiecontainer: Coolify `relaybot`, `m7z1z547ie42j0d60fy0tvxx-184417731523` op `51.15.131.87`.
- Register: `/data/consent/migration/2026-10-19T17-36-35-815Z-dryrun.json`.
- Versleutelde rollback-export: `/data/consent/migration/2026-10-19T17-36-35-815Z-source-snapshot.enc.json`; sleutel in bestaande 1Password-entry, niet in env of git.
- Volledige bron- en batchchecksums staan in het beveiligde register. Geen adressen, persoonsnamen of opt-in-IP's in dit rapport.

De eerste aanroep kon het script niet vinden: de Dockerfile kopieert alleen `src`. Daarna is de ongewijzigde `scripts/consent-preflight.mjs` van main `5ed2927` tijdelijk in `/tmp/ciiic-preflight-20261019/scripts/` geplaatst, met een verwijzing naar de bestaande `/app/src`, en uitgevoerd met `--register-dir /data/consent/migration --accept-sources "Import,API - Generic,Hosted Signup Form,Admin Add"`. De policy noemt Jaaps besluit van 19 oktober en de broninventaris van 10 oktober. Alleen het register is duurzaam geschreven; providergegevens en appconfiguratie zijn niet gemuteerd. De tijdelijke scriptmap is na de run verwijderd.

## Vervolg

Akkoord op dit concrete diff is op 19 oktober in de sessie aan Jaap gevraagd en nog niet ontvangen. De baseline-import mag pas na dat akkoord en onafhankelijke review van de nog te bouwen importtool (`../plans/briefs/brevo-baseline-import.md`). Daarna volgen volledige read-back, idempotentiebewijs, steekproef tien en eventlogcontrole op ongewenste mail. De migratiebriefings blijven tot die levering open.

Eerste echte Brevo-send: donderdag 29 oktober. Voorgesteld: go/no-go 26 oktober, delta 28 oktober; de delta-datum is nog niet bevestigd. Writers blijven tot na 29 oktober Mailchimp. Een gepubliceerde planningsbriefing naar ciiic-nieuwsbrief draagt dit over; werkelijk lijst-ID volgt pas na de import.

Validatie: `npm test` 58/58 geslaagd; geaggregeerde aantallen op volledigheid en taalverdeling gecontroleerd. Dit is bewijs voor de dry-run, geen read-back- of herstelbewijs voor een import of mailbezorging.
