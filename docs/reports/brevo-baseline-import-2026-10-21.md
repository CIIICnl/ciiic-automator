# Brevo-baseline-import van 21 oktober 2026

De baseline-import van de CIIIC-nieuwsbrief van Mailchimp naar Brevo is op 21 oktober uitgevoerd op productie. Doellijst `CIIIC nieuwsbrief` heeft Brevo-ID **20** (map 1). Het goedgekeurde plan is T0 `2026-10-21T11:01:06.771Z`: 2.163 kandidaten (2.092 NL, 71 EN), 464 suppressies (321 unsubscribed, 143 cleaned), 25 pending uitgesloten, 0 quarantaine. Alle 2.163 writes zijn geslaagd, de volledige read-back is schoon en in het importvenster is geen enkele mail verstuurd.

## Akkoord en mandaat

Jaap keurde in de sessie van 21 oktober eerst het diff van 19 oktober goed na een uitlegpagina (artifact), en daarna het hernieuwde diff van 21 oktober plus een churn-marge voor de uitvoeringsketting (hoogstens 10 kandidaten en 10 suppressies afwijking van 2.163/464, 0 quarantaine, zelfde doellijstnaam). Hij bevestigde zelf dat de Automations-pagina van het CIIIC-Brevo-account leeg is; dat staat als `checkedBy: Jaap` in het automation-attest. Vastgelegd in `../plans/done/decisions.md` (2026-10-21).

Waarom een nieuwe dry-run nodig was: tussen 19 en 21 oktober kwamen er 2 abonnees bij en 1 pending; na de dry-run van 09:13Z werd om 10:26Z nog een bestaand lid bijgewerkt (herinschrijving). De importer weigert terecht elk plan waarvan de bron veranderd is. Daarom draaide de uiteindelijke dry-run en de `--apply` in één ketting direct achter elkaar.

## Uitkomst

| Controle | Uitkomst |
| --- | --- |
| Writes | 2.163 (eerst 464 suppressies, daarna 22 kandidaatbatches) |
| Read-back doellijst | `verified: true`; missingMembership 0, extraMembership 0, languageMismatch 0, firstNameMismatch 0, lastNameMismatch 0, missingSuppression 0, duplicateProviderIdentity 0, unexpectedSuppression 0, lostExistingBlock 0; verwacht 2.163 leden en 464 suppressies |
| Steekproef | 10 contacten afzonderlijk teruggelezen, alle gelijk aan het plan |
| Lijststand Brevo na afloop | lijst 20: 2.163 subscribers, 0 blacklisted op de lijst; 2.163 via `/contacts?listIds=20`; account 2.166 contacten (3 bestaande + 2.163) |
| Idempotentie | tweede `--apply` met hetzelfde plan (T0 11:01:06Z) na deploy van PR #9: `writes: 0`, read-back opnieuw `verified: true`, steekproef 10 |
| SMTP-eventlog venster 11:01Z tot afsluiting | 3 pagina's volledig gepagineerd, 214 events gelezen, 0 in het venster; 0 requests/delivered/sent |
| Marketing | 4 campagnes, alle `draft` (testconcepten van 6 oktober op testlijst 3), 0 verzonden in het venster; 0 webhooks; 0 sms-campagnes |
| SMTP-events eerder op de dag | 4 transactionele mails (IX Labs-registratie, ander systeem) om 08:53Z, 09:25Z en 10:26Z, alle vóór het venster |

Idempotentie: een tweede `--apply` met hetzelfde goedgekeurde plan strandde eerst op een Brevo 429 (rate limit) tijdens het teruglezen, zonder writes. De herhaling met wachttijd staat in de sectie "Idempotentie" hieronder.

## Register en bewijs

- Volume `/data/consent/migration` (0700) in de Coolify-container `relaybot` (`m7z1z547ie42j0d60fy0tvxx-202038163493`), alle bestanden 0600, geen adressen in deze repo.
- `2026-10-21T11-01-06-771Z-dryrun.json`, `-source-snapshot.enc.json` (versleutelde rollback-export), `-approval.json` (runSha256, approvedBy Jaap, targetFolderId 1), `-automations.json` (checkedBy Jaap), `-baseline-register.enc.json` (batches, intenties, provideruitkomsten, read-back).
- Eerdere dry-runs van dezelfde dag (09:13Z en 10:51Z) staan er met hun attesten als audit bij; ze zijn nooit toegepast omdat de bron intussen wijzigde.
- Sleutel: 1Password "CIIIC consent export key (migratie-dry-run)", vault CIIIC; nooit in env of git. Tijdens de run via stdin in het proces, tijdelijk bestand verwijderd.

## Wat er onderweg misging en wat ervan geleerd is

1. **Mailchimp-timeouts.** Pagina's van 1.000 volledige leden halen de 60s-timeout van `getJson` regelmatig niet; drie dry-runs en één `--apply` strandden erop vóór enige write. Tijdelijk is de timeout in de containerkopie van `scripts/consent-preflight.mjs` op 180s gezet (na afloop teruggezet). Structurele fix in deze PR: 180s plus twee herhalingen op `TimeoutError` voor read-only GETs.
2. **Brevo 429.** De idempotentierun leest elk contact afzonderlijk terug; twee volledige runs kort na elkaar triggeren de rate limit. Deze PR voegt backoff op 429 en timeouts toe voor GETs in `baseline-provider.js` (writes worden nooit blind herhaald).
3. **Brevo maakt zelf lijsten.** Tijdens de dag verscheen lijst 19 "Contacts involved in conversations" (map 18) met één contact, aangemaakt door Brevo Conversations. Dat is bestemmingsdrift voor de tool; de ketting ving het op met een nieuwe dry-run.
4. **Foutmeldingen.** De productie-CLI's drukken bewust geen oorzaak af; voor diagnose is een kopie met leesbare `error.message` nodig. Overweeg een allowlist van veilige meldingen zoals de preflight al heeft (TODO).

## Vervolg

- Go/no-go maandag 26 oktober; delta woensdag 28 oktober (door Jaap bevestigd op 21 oktober); eerste Brevo-send donderdag 29 oktober. Writers blijven tot na 29 oktober Mailchimp.
- Briefing naar ciiic-nieuwsbrief met lijst-ID 20 en delta-datum: gepubliceerd op 21 oktober.
- Rollback: lijst 20 verwijderen en contacten die alleen daar lidmaatschap hebben opruimen; nieuwe suppressies en voorkeuren blijven altijd gelden (runbook § Baseline-import en rollback, punt 5).

## Idempotentie

Na de merge van PR #9 (backoff op 429 en timeouts voor GETs) is `scripts/consent-baseline-import.mjs --apply` met exact hetzelfde goedgekeurde plan opnieuw gedraaid in de nieuwe container (`…-115557291206`), om 11:58Z tot 12:08Z. Uitkomst: `writes: 0`, `readback.verified: true` met alle negen tellers 0, `sampleCount: 10`, zelfde `releaseBlocked`-tekst (de tool geeft nooit zelf vrij). De eerdere pogingen vóór de merge strandden op Mailchimp-timeouts (60s-versie in de container) en een Brevo 429 bij het per-contact teruglezen, telkens zonder writes.

Eindcontrole eventlog om 12:09Z over het venster vanaf 11:01Z, dus inclusief baseline en idempotentierun: SMTP 0 events in het venster (3 pagina's, 214 events gelezen), 0 verzonden campagnes, 0 webhooks. Daarmee is de baseline-levering compleet; wat overblijft is de delta van 28 oktober (TODO #9).
