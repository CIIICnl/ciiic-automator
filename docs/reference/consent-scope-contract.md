# Consentscopes: contract v2 (2026-10-29)

Antwoord op briefing `2026-10-21--from-ciiic-nieuwsbrief--to-ciiic-automator--consent-scope-en-eventlijst` (AUT-11). Het register kende tot v2 één globale toestemming en één globale suppressie per adres; een eventlijst liep daardoor leeg in de grootboekronde en elke editie-afmelding telde als CIIIC-afmelding. v2 geeft elk registerrecord een doel. Dit document is wat ciiic-nieuwsbrief mag aannemen; het editiecontract zelf (snapshot, verzendbewijs, route b, stand) staat in [ciiic-consent-preparation.md § Editiecontract](ciiic-consent-preparation.md#editiecontract-met-nieuwsbrief). Code: `src/services/consent/scopes.js`. Contract-double: `tests/consent-scope.test.js`.

## Scopes

| Scope | Betekenis | Waar in het record |
|---|---|---|
| `newsletter` | De nieuwsbrief (Brevo-lijst 20). Alles van vóór v2. | Bovenste velden `consent`, `suppressed`, `suppressionReason`: ongewijzigd, geen migratie. |
| `event:<slug>` | Eén event of eventreeks, bijvoorbeeld `event:ixlabs-opening-2026`, later `event:jaarevent`. Slug: `[a-z0-9][a-z0-9:._-]{0,99}`. | `scopes["event:<slug>"]` met `consent`, `suppressed`, `suppressionReason`, `suppressionAt`, `consentEvidence`, `consentAt`, `source`. |
| `*` | Geen doel maar het adres zelf: hard bounce, spamklacht, verwijderd contact. Alleen voor suppressies. | `addressSuppressed: true` plus de bovenste suppressievelden. |

Een adres kan in meerdere scopes staan. Taal en `preferenceConflict` horen bij het adres en gelden voor alle scopes; een `preference`-event met een eventscope wordt geweigerd. Toestemming voor een eventscope vraagt hetzelfde autoritatieve bewijs als de nieuwsbrief (`provider-confirmation` of `migration-approval` met referentie); een toekomstige eventimport (zoals de vervallen IX Labs-lijst) loopt dus via een goedgekeurde migratie, niet via een losse formulierregistratie.

**Zonder scope is `newsletter`.** Elke aanroep van vóór v2 (snapshot zonder `scope`, `applyEvent` zonder `scope`) gedraagt zich precies als voorheen.

## Grootboekronde: `scope` op de snapshot

`POST /consent/editions/{editionId}/snapshot` accepteert een optioneel veld:

```json
{ "documentId": "…", "scope": "event:ixlabs-opening-2026",
  "campaigns": { "nl": 301, "en": null }, "lists": { "nl": 401, "en": null },
  "recipients": [{ "email": "…", "language": "nl" }] }
```

- De ronde toetst alleen die scope. `unknown_contact` = geen record voor deze scope (ook: iemand die alleen een eventrecord heeft, bij een nieuwsbriefronde). `suppressed` = afgemeld voor deze scope, of adresniveau-suppressie. `consent_not_confirmed` en `preference_conflict` zoals in v1.
- Een afmelding voor de nieuwsbrief sluit niemand uit van een eventronde, en omgekeerd.
- Het antwoord en `GET /consent/editions/{editionId}` hebben een extra veld `scope`. Edities van vóór v2 melden `newsletter`.
- Een editie houdt haar scope: een verversing met een andere scope geeft `400 { error: "Invalid scope change" }`. Een ongeldige scope geeft `400 { error: "Invalid consent scope" }`.

## Brevo-afmeldcallback (`POST /webhook/marketing/brevo`)

| Event | Geboekt op |
|---|---|
| `unsubscribe` met een `camp_id` van een editie met eventscope | Die eventscope. Noemt `list_id` óók de hoofdlijst (`BREVO_CIIIC_LIST_ID`), dan daarnaast `newsletter`: de persoon heeft in het formulier ook de nieuwsbrief uitgevinkt. |
| `unsubscribe` met een `camp_id` van een nieuwsbriefeditie | `newsletter` (zoals v1, ook als `list_id` de editielijst noemt). |
| `unsubscribe` van een campagne buiten het grootboek met tag `event` | Niets, tenzij `list_id` de hoofdlijst noemt (dan `newsletter`). Zonder snapshot weet de automator niet welk event het is; een eventmail hoort dus altijd via de snapshot te lopen. |
| `unsubscribe` van een andere campagne | `newsletter` als `list_id` ontbreekt of de hoofdlijst noemt, anders niets (v1). |
| `hard_bounce`, `spam`, `contact_deleted` | `*`: blokkeert elke scope, ongeacht de campagne. Brevo zet zulke adressen zelf ook accountbreed op de blocklist. |

Route b (de automator haalt een onderdrukt contact uit editielijsten) volgt dezelfde scope: een eventafmelding haalt het contact alleen uit editielijsten van die eventscope, een nieuwsbriefafmelding alleen uit nieuwsbriefedities, `*` uit alle.

Wat de nieuwsbrief zelf moet regelen: de afmeldlink in een eventmail is Brevo's multi-list-formulier met alleen de eventlijst aangevinkt. De gewone `{{ unsubscribe }}` zet het contact in Brevo accountbreed op de blocklist; het register boekt dat dan als eventafmelding, maar Brevo mailt die persoon daarna ook geen nieuwsbrief meer.

## Records van vóór v2

Een v1-record heeft één suppressie zonder doel. v2 leest die zo: alleen `unsubscribe`/`unsubscribed` is een nieuwsbriefafmelding; elke andere reden (`cleaned`, `brevo_blocked`, bounce, onbekend) telt als adresniveau en sluit dus ook eventscopes uit. Dat kan alleen méér uitsluiten, nooit méér mailen. Bij de eerstvolgende schrijfactie op een record wordt die lezing vastgezet in `addressSuppressed`, zodat een latere afmelding met een andere reden haar niet overschrijft. Dezelfde regel geldt voor suppressies die zonder scope binnenkomen (Mailchimp-reconciliatie, subscriberroute). Het eventjournaal bewaart `scope` per event; `rollbackDelta` en `listEventsSince` geven events ongefilterd terug, dus een afnemer daarvan filtert zelf op scope.

## Versie

- v1 (10 en 15 oktober 2026): editiecontract zonder scope.
- v2 (29 oktober 2026): scopes in register, snapshot en afmeldcallback; v1-aanroepen ongewijzigd.
