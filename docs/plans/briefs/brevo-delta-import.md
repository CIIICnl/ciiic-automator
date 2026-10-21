# Delta-import Brevo: alles sinds de baseline-T0 vóór de send van 29 oktober

Tier: `flagship-review` (mutaties op opgeslagen persoonsgegevens). Uitvoer: workhorse; onafhankelijke review en merge: flagship. Uitvoering op productie pas na review en een expliciet go van Jaap op het delta-diff; de datum (woensdag 28 oktober) is bevestigd, het diff nog niet.

## Wat is er aan de hand

De baseline staat sinds 21 oktober in Brevo-lijst 20 (plan T0 `2026-10-21T11:01:06.771Z`, [bewijs](../../reports/brevo-baseline-import-2026-10-21.md)). Form43/feed7, de SXSW-route en de automator schrijven tot na 29 oktober door op Mailchimp. Wie zich sinds T0 inschrijft, afmeldt, bounct of een naam of taal wijzigt, staat dus wel in Mailchimp en niet (of verkeerd) in Brevo. Zonder delta verstuurt ciiic-nieuwsbrief op 29 oktober naar een lijst die een week oud is, inclusief mensen die zich intussen hebben afgemeld. Dat laatste is het echte risico: een afmelding die niet overkomt.

De baseline-tool (`scripts/consent-baseline-import.mjs`, `src/services/consent/baseline-import.js`) kan dit niet: hij eist een ongewijzigde bron en een lege doellijst-binding voor een volledig plan. `scripts/consent-reconcile.mjs` is iets anders (consentregister op SQLite, geen Brevo-writes).

## Principe

Hetzelfde als de baseline: het goedgekeurde plan bepaalt de mutaties, suppressies winnen altijd en gaan eerst, elke provideruitkomst is teruglezbaar, een herstart veroorzaakt geen mail of dubbele mutatie. Nieuw: het plan is een verschil tussen twee bronstanden, geen volledige set.

## Als we dit goed doen

1. **Delta-dry-run.** Een CLI leest Mailchimp volledig (zelfde `mailchimpMembers`), leest de bronexport van de baseline (`<T0>-source-snapshot.enc.json`) en het baseline-register, en berekent per adres: nieuw subscribed sinds T0 (kandidaat), nieuw unsubscribed/cleaned/archived of pending-geworden (suppressie, ook als het adres in de baseline kandidaat was), gewijzigde taalgroep of naam (update). Alles wat al gelijk is, valt weg. Geaggregeerd diff zonder PII naar stdout; register `<T1>-delta-dryrun.json` plus versleutelde export op `/data/consent/migration`.
2. **Zelfde poorten als de baseline.** Akkoordbestand gebonden aan `runSha256` van het delta-record en aan het baseline-T0, actueel automation-attest, lijst 20 bij naam én ID, testlijsten geweigerd, providerflags ongezet, bron ongewijzigd tussen dry-run en `--apply` (met de churn-marge die Jaap voor de baseline gaf, alleen als hij die opnieuw geeft).
3. **Toepassen in deze volgorde:** suppressies (globale blacklist of `unlinkListIds`, nooit een bestaande blokkade resetten), dan updates van bestaande leden (`LANGUAGE`, `FIRSTNAME`, `LASTNAME`), dan nieuwe kandidaten met `updateEnabled: false`. Per record intentie en uitkomst in een versleuteld `<T1>-delta-register.enc.json`, hervatbaar met read-back vóór een nieuwe mutatie. Gebruik `brevoRequest` uit `baseline-provider.js` (heeft backoff op 429/timeout voor GETs).
4. **Read-back.** Na afloop volledige lijst 20 teruglezen en vergelijken met baseline-plan plus delta-plan: lidmaatschap, taal, namen, suppressies. Tien contacten uit de delta afzonderlijk. Eventlogbewijs (SMTP én marketing, volledig gepagineerd) dat de delta geen mail veroorzaakte. `releaseBlocked` tot dat bewijs er is; geen cutover of verzending door de tool.
5. **Go/no-go-check 26 oktober** als read-only subcommando: huidig delta-diff, lijststand, automations-attest ouder dan n dagen, openstaande TODO #6 (RBL) als waarschuwing. Uitvoer in het rapport `docs/reports/brevo-go-no-go-2026-10-26.md`.

## Validatie en klaar als

- Tests: afmelding na baseline wordt suppressie ook als de baseline het adres importeerde; herinschrijving van een eerder gesupprimeerd adres wordt níet opgeheven zonder expliciet beleid (quarantaine-teller); naam-/taalupdate; nieuwe kandidaat; bron- en doeldrift; herstart na crash; tweede identieke run geeft nul writes; geen providerwrites in tests.
- Onafhankelijke review, dan productie: delta-dry-run, Jaaps go op het diff, `--apply`, read-back, eventlog, idempotentie, terugmelding met nieuw T1 naar ciiic-nieuwsbrief via briefing.
- Planning: tool gereviewd uiterlijk zondag 25 oktober, go/no-go maandag 26 oktober, delta woensdag 28 oktober, send donderdag 29 oktober. Haalt de review 25 oktober niet, meld dat meteen aan Jaap met een voorstel (bijvoorbeeld de delta handmatig beperken tot suppressies).

## Buiten scope

Geen writer-cutover, geen `CIIIC_CONSENT_ROUTE`, geen verzending, geen wijziging aan Form43/feed7, geen supportcorrespondentie (TODO #6).
