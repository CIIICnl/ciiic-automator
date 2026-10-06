# Consentvoorbereiding PR #2: herstel akkoord, deploy geblokkeerd

Onafhankelijke review door Astra op 6 oktober 2026, code-head `714d9824c22db8350c6cc5ed617279dd237889c9`. Contract: uitvoeringsbrief, hubplan secties 2–6 en oorspronkelijke review R1/R2. Uitkomst: **niet mergen**. R1/R2 zijn hersteld; live controle bewijst dat automatisch deployen een actieve inschrijfroute zou breken. Alleen GETs uitgevoerd op productie; geen configuratie, testinzending, import, verzending of deploy.

## R1/R2: geaccepteerd

- De voorkeurvergelijking draait binnen de SQLite-eventtransactie. Bronwaarnemingen krijgen een interval vanaf het begin van de vorige scan tot het einde van de huidige scan; `last_changed` blijft apart, niet-autoritatief bewijs. Overlappende tegenstrijdige keuzes blijven als bewijsfrontier in het versleutelde register. Een later ontvangen callback kan daardoor geen schijnbaar exact scanmoment verliezen.
- Beide aankomstvolgordes en de callback tussen planning en toepassing zijn getest met echte SQLite. Herstart en ongewijzigde vervolgsnapshots bewaren het conflict; een bewezen latere keuze kan het opheffen. Naamswijzigingen veranderen de taal niet.
- Dubbele taalinterests zetten duurzaam `preferenceConflict`. Nieuwe en bestaande edities blokkeren; correctie verandert geen suppressie of toestemming. Begonnen edities houden hun taaltoewijzing, unknown-claims blokkeren provideroverschrijdende retries.
- De versleutelde pending-batch wordt vóór toepassing geschreven en hervat vóór een nieuwe batch. Gedeeltelijke toepassing bewaart event-ID’s en vensters; checkpointvervanging volgt pas na toepassing van alle events. Locking voorkomt parallelle checkpointwriters.

## R3. P1: merge breekt de actieve Form43-feed

Adres: `src/index.js:923`–`926`, `src/services/consent/ingress.js:20`. De generieke CIIIC-route eist direct het nieuwe signinggeheim; zonder configuratie volgt HTTP 503 vóór verwerking, ook als het opt-in-veld leeg is. Een latere getekende opt-in vereist bovendien de registersleutels.

Live bewijs op 6 oktober 2026, uitsluitend geauthenticeerde GETs:

| Controle | Waarneming |
| --- | --- |
| Coolify-app `relaybot`, UUID `m7z1z547ie42j0d60fy0tvxx` | Branch `main`, status `running:unknown`; main deployt automatisch volgens repo-contract. |
| Productieconfiguratie | `CONSENT_KEY`, `CONSENT_HMAC_KEY`, `CIIIC_OPTIN_WEBHOOK_SECRET`, `BREVO_MARKETING_WEBHOOK_TOKEN` en expliciete `CONSENT_DB_PATH` ontbreken. Provider blijft default Mailchimp. Geen sleutelwaarden bewaard. |
| Formulieren 1/12/13/26/27 | `is_active=0`; bestaande feeds staan wel aan. |
| Formulier 43 | `is_active=1`; titel `IX Labs opening 18 November 2026 - save the date registration`. |
| Feed 7 bij formulier 43 | `is_active=1`, POST JSON naar `https://bot.ciiic.nl/webhook/newsletter-optin?list=ciiic&tag=ixlabs-opening-2026&email=3&fname=1&lname=2&org=4&optin=5`; geen ingestelde requestheaders. |
| Toestemmingsveld 5 | Label `Stay informed`; keuze noemt expliciet CIIIC én IX Labs, nieuws, programma en evenementen. |
| Owner/listbinding | Mailchimp GET bevestigt `67fe159b9d` = `CIIIC`, company `CIIIC`; `0e404ef800` = `CIIIC jaarevent`, company `CIIIC`. Live event-override klopt. |
| Publieke health | `status=healthy`. Dit bewijst de huidige service, niet de deploybaarheid van PR #2. |

De aanname “Form43 is IX Labs en valt buiten deze CIIIC-route” is feitelijk onjuist voor de huidige feed. De tag verandert de audience niet: `list=ciiic` resolveert naar `67fe159b9d`. Alleen een aliaswijziging naar `ixlabs` is geen toegestane reparatie; daarmee verandert de bestemming van echte inschrijvingen zonder onderzocht mandaat.

**Herstelcriteria:** maak de voorbereiding veilig te deployen zonder stilzwijgende activatie of wijziging van deze actieve feed. Scheid zo nodig de live routeomschakeling van de voorbereidende modules; introduceer geen unsigned fallback in de nieuwe consentroute. Leg expliciet vast welke code bij standaardconfiguratie actief wordt. Een alternatieve gezamenlijke productieactivatie vereist afzonderlijk mandaat, getekende Forms-feed, duurzaam register en de overige TODO5-poorten. Test de daadwerkelijke routewiring met de live configuratievorm en zowel een aangevinkt als leeg veld 5. Na herstel volgt opnieuw onafhankelijke flagship-review en een actuele live feed-/env-controle vóór merge.

## Verificatie en afbakening

Zelfstandig `npm test`: **42/42 groen**. GitHub CI `test (20)` en `test (22)` op `714d982` beide SUCCESS, run `37462140624`. Alle gewijzigde consentmodules, scripts en route-integratie gelezen tegen de brief. De bestaande ingress-test bevestigt 503 zonder signingconfiguratie; dat veilige gesloten gedrag veroorzaakt hier juist de ongeautoriseerde productieonderbreking.

De statusmatrix, DOI-only adapters, authenticatie, idempotentie, preflight/read-back en editieboekhouding zijn voorbereid en synthetisch getest. Automatische autoritatieve DOI-bevestiging, operationele reconciliation, providerselectie bij verzending en consumerkoppelingen blijven expliciete activatiepoorten. Er is geen productiegeschiktheid van die keten geclaimd. De productievolume-mount is in deze ronde niet bewezen en hoort bij die vrijgave.

TODO3/4 en de oorspronkelijke automatorbriefing blijven open. De hub krijgt een briefing om de live Form43-binding in het plan en de Forms-opdracht te verwerken. Dit reviewrapport geeft geen toestemming voor productieconfiguratie, import, cutover of verzending.
