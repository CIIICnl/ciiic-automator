# Onafhankelijke review Brevo-baseline-importtool, PR #8

De importtool is gereviewd tegen `docs/plans/briefs/brevo-baseline-import.md`. Drie bevindingen zijn hersteld in `9085dc4`; de review autoriseert geen productie-import. TODO #7 en beide migratiebriefings blijven open tot diff-akkoord, uitvoering en volledig bewijs.

## Bevindingen en herstel

1. Bij hervatten kon een opgeslagen lijst-ID de actuele naamcontrole omzeilen. De importer vereist nu dat het register-ID overeenkomt met de actuele unieke doellijst; verdwenen, hernoemde en vervangen lijsten blokkeren vóór providerwrites.
2. Tussen de dubbele inventaris en een individuele mutatie kon een contact wijzigen. De importer vergelijkt nu vóór mutatie de relevante actuele contactstaat met de export. Alleen provider-metadata wordt genegeerd; taal, namen, lijstlidmaatschap en suppressies blijven beschermd. Een nieuwe afmelding op een andere lijst blokkeert ook `intent`- en `applied`-hervatting.
3. De goedkeuringspoort vergeleek batchmetadata zonder de bijbehorende regels opnieuw te hashen. De importer rekent nu de geordende HMAC per batch na en verifieert dat alle mutatieregels zijn gedekt.

## Acceptatiebewijs

| Criterium | Controle en uitkomst |
| --- | --- |
| Akkoord, bron en diff | Gedateerd Jaap-attest gebonden aan volledige dry-run-JSON, T0, exportpad, bronchecksums, aantallen en batchchecksums; gewijzigde regels falen vóór inventaris. |
| Lijst en automations | Unieke naam, geconfigureerd ID, register-ID en testlijsten bewaakt. Automation-attest verplicht voor account en lijst. Onderliggend actueel accountbewijs blijft een operationele uitvoeringsvoorwaarde. |
| Suppressies en attributen | Suppressies duurzaam verwerkt vóór kandidaten. Geen blacklist-reset in providerpayload; namen alleen uit de bron. Live LANGUAGE-enumeratie wordt gecontroleerd. |
| Hervatten en idempotentie | Crash na providerwrite laat intentie staan; read-back voorkomt tweede mutatie. Tests bewijzen tweede identieke run zonder writes en blokkade bij nieuwe opt-out. |
| Volledige read-back | Hele inventaris vergeleken op lidmaatschap, taal, namen en suppressies; maximaal tien kandidaten apart teruggelezen. Productiesteekproef van tien volgt pas bij import. |
| Geen importmail | Geen verzendendpoint in adapter; SMTP- en marketingeventlogs zijn expliciet ontbrekend bewijs en blokkeren vrijgave. Geen echte import of testmail in deze review. |

`npm test`: 70/70 geslaagd op de gereviewde code. `git diff --check`: schoon. Tests gebruiken synthetische contacten. De CLI vangt fouten af met vaste tekst zonder adressen, credentials of providerbody. De versleutelde export en het hervatregister blijven buiten git.

Providercontract gecontroleerd tegen de [officiële Brevo-update-API](https://developers.brevo.com/reference/update-contact): `listIds` voegt lidmaatschappen toe, `unlinkListIds` verwijdert ze. Bestaande contacten krijgen geen nieuw e-mailadres of blacklistwaarde mee. De [detail-API](https://developers.brevo.com/reference/get-contact-info) kan extra metadata bevatten; daarom vergelijkt de hervatlogica de relevante contactvelden.

## Live controle vóór merge

Op 19 oktober in de draaiende relaybot-container gecontroleerd: `CIIIC_CONSENT_ROUTE` en `CIIIC_MARKETING_PROVIDER` beide ongezet. Coolify-env bevestigt dat beide variabelen ontbreken. Via een alleen-lezen WP-query: Form43/feed7 actief, POST naar `/webhook/newsletter-optin?list=ciiic&tag=ixlabs-opening-2026&email=3&fname=1&lname=2&org=4&optin=5&language=7`, geen signingheaders. De bestaande Mailchimp-route blijft daarmee actief; geen Forms- of providerconfiguratie gewijzigd.

## Volgende poort

Het concrete diff blijft T0 `2026-10-19T17:36:35.815Z`: 2.161 kandidaten (2.090 NL, 71 EN), 464 suppressies, 24 pending en nul quarantaine. Jaaps akkoord daarop ontbreekt. Bij bronwijziging vereist de importer een nieuw dry-run-diff en nieuw akkoord. De feitelijke import vraagt actueel automationbewijs, volledige eventlogcontrole, read-back, idempotentiebewijs en bevestiging van de delta-datum. De writers blijven tot na 29 oktober Mailchimp.
