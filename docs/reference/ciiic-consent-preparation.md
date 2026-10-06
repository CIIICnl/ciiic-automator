# CIIIC-consent: voorbereiding, interfaces en vrijgave

Status: implementatievoorstel voor afzonderlijke flagship-review. Geen productieconfiguratie, import, verzending of cutover uitgevoerd. Contract: [goedgekeurd hubplan](https://github.com/CIIICnl/jaap-work/blob/48e729a3ca5b4d9e68a3eba2c31509733bd1fd2d/docs/plans/briefs/brevo-migratie-taalvoorkeur-2026-10-06.md), secties 2–6. Testen: `npm test`; CI gebruikt Node 20 (Docker-runtime) en 22.

## Activatieschakelaar en defaultgedrag

De consentroute staat **standaard uit**. Alleen `CIIIC_CONSENT_ROUTE=enabled` (exact deze waarde; `true`, `1`, `on` of hoofdletters tellen niet) zet hem aan; de check staat in `src/services/consent/activation.js`. Merge en deploy van deze code veranderen daardoor niets aan de live aanmeldroutes.

| Route | Zonder `CIIIC_CONSENT_ROUTE=enabled` (default, = huidige productie) | Met `CIIIC_CONSENT_ROUTE=enabled` |
|---|---|---|
| `/webhook/newsletter-optin?list=ciiic` (live: Form43/feed7) | Ongetekend toegestaan; aangevinkt opt-in-veld → Mailchimp-PUT op `67fe159b9d`, `status_if_new: subscribed`, tag uit `tag=`; leeg veld → 200 `no_optin`, geen providercall | Handtekening verplicht, ook bij leeg veld; zonder `CIIIC_OPTIN_WEBHOOK_SECRET` 503, foute handtekening 403; getekende opt-in vereist register- en providerconfiguratie, anders 503 |
| `/webhook/sxsw-newsletter` (form26/27, inactief) | Ongetekend; aangevinkt → Mailchimp-PUT op CIIIC met bronlabel | Handtekening bij aangevinkte opt-in; DOI-adapter |
| `/webhook/registration` (form13, inactief) | Ongetekend; eventstatus-PATCH, bij 404 én aangevinkt veld19 eventlid toevoegen op `0e404ef800` (gedrag van vóór deze PR) | Handtekening bij aangevinkt veld19; eventstatus alleen PATCH; nieuwsbrief via DOI-adapter |
| `/webhook/marketing/brevo` | Gemount, faalt gesloten zonder `BREVO_MARKETING_WEBHOOK_TOKEN`; geen bestaand verkeer | Idem |

Er is geen unsigned fallback binnen de aangezette route: met de schakelaar aan gaat een CIIIC-gebonden call nooit terug naar het oude Mailchimp-pad. De schakelaar omzetten is TODO5-activatiewerk met eigen mandaat (getekende Forms-feed, duurzaam register, DOI-bevestiging, reconciliation vóór T0); niet vanuit een deploy. Bewijs: `tests/route-activation.test.js` draait de echte `app` uit `src/index.js` met de live Form43-feedvorm, aangevinkt en leeg veld5, beide standen van de schakelaar, en een recorder in plaats van uitgaand HTTPS.

## Gedrag en bindingsbewijs

Met de schakelaar aan loopt de CIIIC-opt-in uit Jaarevent (form13), SXSW (26/27) en de generieke `list=ciiic`-route door `src/services/consent/subscriber.js`. Ook het ruwe CIIIC-list-ID gaat door die adapter. Default provider blijft Mailchimp. De adapter maakt nieuwe contacten uitsluitend via DOI aan; bestaande providercontacten en lokale confirmed/pending-records worden niet door een nieuwe signup gewijzigd. Suppressies blijven geldig bij herhaling en terugschakelen. Onzekere DOI-uitkomsten blijven gereserveerd, zodat retries niet opnieuw mailen. Het nieuwe register staat los van transactionele mail.

Jaarevent-statuswijzigingen patchen uitsluitend bestaande leden van de eventlijst; een ontbrekend eventlid wordt niet automatisch als abonnee aangemaakt. Nieuwsbriefopt-in gaat afzonderlijk naar CIIIC. IX Labs blijft buiten deze migratie en behoudt zijn bestaande route. Afmelden voor een event is geen nieuwsbriefafmelding.

Live GET-controle, 6 oktober 2026: Coolify `relaybot` (`m7z1z547ie42j0d60fy0tvxx`) gebruikt `MAILCHIMP_JAAREVENT_LIST_ID=0e404ef800`; `MAILCHIMP_CIIIC_LIST_ID` ontbreekt. Mailchimp bevestigt `0e404ef800` als `CIIIC jaarevent`, company `CIIIC`, en `67fe159b9d` als `CIIIC`, company `CIIIC`. De foutieve event-code-default is gecorrigeerd. De volledige controle staat in `docs/plans/done/brevo-consent-preparation.md`.

## Configuratie vóór productiegebruik

| Variabele | Contract |
|---|---|
| `CIIIC_CONSENT_ROUTE` | Ongezet = oud gedrag; `enabled` activeert de consentroute. Pas zetten na de overige rijen én een getekende Forms-feed |
| `CIIIC_MARKETING_PROVIDER` | `mailchimp` (default) of `brevo`; geen automatische fallback bij providerfout |
| `CONSENT_DB_PATH` | Default `/data/consent/registry.sqlite`; duurzame opslag buiten git |
| `CONSENT_KEY` | 32 bytes als 64 hextekens; AES-256-GCM voor registerinhoud |
| `CONSENT_HMAC_KEY` | Minimaal 32 bytes; stabiele afgeschermde contactidentiteiten en eventkeys |
| `CIIIC_OPTIN_WEBHOOK_SECRET` | Apart geheim voor de ondertekende GF-opt-in-feeds |
| `MAILCHIMP_API_KEY`, `MAILCHIMP_DC` | Bestaande marketingtoegang; CIIIC-binding `67fe159b9d` |
| `BREVO_API_KEY2` | Bestaande Brevo-API-toegang; afzonderlijk van de providervlag |
| `BREVO_CIIIC_LIST_ID` | Apart ingerichte productielijst; testlijst 3 en standaardlijst 2 worden geweigerd |
| `BREVO_DOI_TEMPLATE_ID`, `BREVO_DOI_REDIRECT_URL` | Geldige DOI-template en HTTPS-terugkeerpagina; accountcontrole vereist |
| `BREVO_MARKETING_WEBHOOK_TOKEN` | Bearer-token voor de marketingcallback, buiten git beheren |
| `CONSENT_EXPORT_KEY` | Apart 32-byte hexgeheim voor tijdelijke preflight-export |

Het register versleutelt contactgegevens, bewijs en events. Bestanden krijgen beperkte rechten; een sleutelcontrole voorkomt dat gewijzigde sleutels een bestaand register stil onzichtbaar maken. Back-up en sleutelbewaring moeten samen worden geregeld vóór activatie. Sleutelrotatie is geen env-wijziging zonder datamigratie.

**Merge is hier automatisch deploy.** Live hercontrole op 6 oktober 2026 vond forms13/26/27 inactief, maar de actieve Form43-feed7 wijst naar `list=ciiic`, zonder signingheader; signing-/registersleutels ontbreken in productie ([review R3](../reports/brevo-consent-rereview-2026-10-06.md)). Sinds de activatieschakelaar blijft die feed bij merge op het oude pad, zolang `CIIIC_CONSENT_ROUTE` in Coolify niet op `enabled` staat. Vóór merge controleert de reviewer live dat die variabele ontbreekt en dat de feedbestemming nog klopt met de tabel hierboven. Hercontroleer de feitelijke feedbestemming bij iedere vrijgave. Accountconfiguratie en het wijzigen van Forms-feeds horen bij apart geautoriseerde uitvoering.

## Forms-ingress

Header: `X-Ciiic-Optin-Signature`, lowercase hex HMAC-SHA256 met `CIIIC_OPTIN_WEBHOOK_SECRET`. Onderteken exact de UTF-8-prefix `POST\n<pad inclusief exacte querystring>\n`, gevolgd door de letterlijke JSON-bodybytes. Queryvolgorde, encoding, spaties en bodyvolgorde mogen na ondertekening niet veranderen. Zo kan een ondertekende inzending niet met een andere opt-in-veldtoewijzing worden herhaald. Dit vervangt niet de bestaande handtekening voor `/webhook/registration-status`.

CIIIC-aanmeldroutes: `/webhook/registration` met veld19, `/webhook/sxsw-newsletter` met veld9 voor form26 of veld11 voor form27, en `/webhook/newsletter-optin?list=ciiic&email=…&optin=…`. Checkbox-subvelden zoals `19.1` worden herkend. Taal komt uit `newsletter_language`; de generieke feed mag via `language=<veld-id>` een ander veld mappen. Ontbrekende taal wordt `nl`, expliciete waarden zijn `nl` of `en` (hoofdletters worden genormaliseerd). De generieke CIIIC-route vereist een expliciet opt-in-veld.

Forms blijft verantwoordelijk voor honeypot, invultijd, ALTCHA en IP-begrenzing vóór een getekende feed. Automator bewaakt de ontvangerlimiet duurzaam. Met de schakelaar aan: ontbrekende signingconfiguratie geeft 503, een ongeldige handtekening 403. Een provider-/registerfout mag geen geslaagde aanmelding rapporteren. Registreer retries zonder de requestbody of adressen te loggen.

## Marketingevents en bevestigingsbewijs

`POST /webhook/marketing/brevo` verwacht `Authorization: Bearer <BREVO_MARKETING_WEBHOOK_TOKEN>`. Het verwerkt de gedocumenteerde marketingpayloads; Brevo-webhook-ID `id` is geen unieke contactgebeurtenis. Afmeldingen, hard bounces, spam en verwijderingen kunnen onderdrukken; taalupdates wijzigen geen toestemming. Een dubbele callback is idempotent. Een oudere afmelding blijft geldig, ook na een nieuwere voorkeurwijziging.

**Een afgeleverde DOI-mail of `list_addition` bewijst geen bevestigde inschrijving.** Het register accepteert bevestigde toestemming alleen via een interne autoritatieve evidence-route. De automatische verificatie van daadwerkelijke provider-DOI-bevestiging is nog niet aangesloten. Totdat die account-/logkoppeling bewezen is, blijft nieuwe toestemming lokaal `pending` en niet verzendbaar via de editieboekhouding. Dit is een expliciete productiepoort, geen toestemming om contacten handmatig zonder bronbewijs te promoveren.

Bronnen: [Brevo DOI](https://developers.brevo.com/reference/create-doi-contact), [marketingpayloads](https://developers.brevo.com/docs/marketing-webhooks), [webhookauthenticatie](https://developers.brevo.com/docs/secured-webhooks), [Mailchimp member creation](https://mailchimp.com/developer/marketing/api/lists/create-member).

## Preflight en tijdelijke export

`scripts/consent-preflight.mjs` leest uitsluitend provider-GETs. Het leest alle relevante Mailchimp-statussen van CIIIC, vergelijkt Brevo-suppressies en maakt een deterministisch batchplan. Afzonderlijke herkomstbewijzen zijn verplicht voor actieve kandidaten; timestamps alleen zijn onvoldoende. Zonder bewijsbestand blijven zulke records in quarantaine. Dubbele identiteiten, taalconflicten en onbekende statussen worden niet stil geïmporteerd.

```sh
node scripts/consent-preflight.mjs --evidence /beveiligd/pad/consent-evidence.json
node scripts/consent-preflight.mjs --cleanup-only
```

Deze commando's verwachten de genoemde secrets al in de procesomgeving. Het evidencebestand is een afgeschermde mapping per genormaliseerd adres met `granted`, `source`, `notice` en `recordedAt`, gebaseerd op gecontroleerde bronbewijzen. Bewaar dit buiten git. De uitvoer bevat aggregaten, batchchecksums en een tijdelijk exportpad, geen adressen. De AES-GCM-export bevat de brongegevens en het diff, staat in een afgeschermde tijdelijke map en heeft een bewaartermijn van zeven dagen. Draai de cleanup dagelijks en verwijder na acceptatie eerder indien mogelijk. Een providerinventaris is geen transactionele snapshot; veranderingen tijdens paginering of onbekende writers blokkeren cutover.

## Oude Mailchimp-afmeldingen en voorkeuren

`scripts/consent-reconcile.mjs` leest Mailchimp uitsluitend met GET en schrijft lokaal in het versleutelde register. Het bewaart een versleuteld volledig broncheckpoint op `CONSENT_CHECKPOINT_PATH`, buiten git; daarnaast zijn `CONSENT_DB_PATH`, `CONSENT_KEY` en `CONSENT_HMAC_KEY` vereist. Vóór de eerste registermutatie wordt de volledige batch versleuteld naar `<CONSENT_CHECKPOINT_PATH>.pending` geschreven. Pas nadat alle idempotente registerevents zijn verwerkt, wordt het checkpoint atomair vervangen en het pending-bestand verwijderd. Bij herstel wordt eerst de oorspronkelijke batch met dezelfde event-ID’s en tijdgrenzen hervat; daarna pas wordt een nieuwere scan verwerkt. Bewaar checkpoint, pending-bestand en register samen bij back-up/herstel; verwijder nooit een pending-bestand om een fout te omzeilen. Een exclusief lockbestand beschermt scan en checkpoint tegen gelijktijdige runs; na een crash eerst vaststellen dat geen proces meer draait voordat het achtergebleven lock wordt verwijderd. De runner vergelijkt twee volledige bronlezingen voordat hij toepast. Plan deze taak onder afzonderlijk operationeel mandaat zolang oude footerlinks nog werken.

```sh
node scripts/consent-reconcile.mjs
```

Initialiseer de runner vóór T0. De eerste volledige scan neemt suppressies over en legt een voorkeurcheckpoint vast. Begint deze pas na T0, dan kunnen tussentijdse taalwijzigingen niet betrouwbaar worden afgeleid en is handmatige bronvergelijking nodig. Alleen een werkelijk gewijzigde bronvoorkeur tussen twee scans kan daarna een voorkeur-event opleveren. Mailchimp `last_changed` kan ook door een naamswijziging veranderen en is daarom geen zelfstandig taalbewijs. Iedere gewijzigde bronvoorkeur krijgt een `preference-observation` met `previousObservedAt`, `observedAt` en het afzonderlijke, niet-autoritatieve `sourceChangedAt`. Het interval loopt vanaf het begin van de vorige scan tot het einde van de huidige scan, zodat paginering geen schijnzekerheid geeft. `languageAt` is uitsluitend een exact bewezen eventmoment; bij een broninterval is het null en staat het interval in `languageWindow`. De volledige nog niet achterhaalde bewijzen staan versleuteld in `preferenceEvidence`.

Het register vergelijkt die bewijzen binnen dezelfde SQLite-transactie als de eventtoepassing. Alleen bewezen latere keuzes vervangen ouder bewijs. Overlappende, tegenstrijdige keuzes en beide actieve taalinterests zetten duurzaam `preferenceConflict=true` en `language=null`, ook wanneer een Brevo-callback vertraagd aankomt. Nieuwe edities sluiten dit contact uit; bestaande edities controleren de blokkade opnieuw bij de claim. Ongewijzigde scans en naamswijzigingen wissen het conflict niet. Een aantoonbaar latere eenduidige broncorrectie of profielkeuze kan het voorkeurconflict opheffen, maar verandert nooit toestemming of suppressie. Een al begonnen editie behoudt haar taaltoewijzing; een tijdens conflict geblokkeerde claim blijft voor die editie uitgesloten.

Initialiseer productie met deze versie vóór T0. Oud bewijs uit de afgewezen voorbereiding gebruikte scantijd als exact wijzigingsmoment en is daarmee niet achteraf betrouwbaar te reconstrueren; eventuele proefregisters/checkpoints van die versie mogen niet als productiebron dienen. Reconciliation bevestigt nooit zelf toestemming en activeert geen providercontacten. De delta vanaf T0 gebruikt lokale ontvangsttijd, zodat een vertraagde oude afmelding niet verdwijnt.

## Baseline-import en rollback

Er is bewust geen uitvoerbare providerimport in deze voorbereiding. Een volgend mandaat moet een concrete dry-run en doelconfiguratie autoriseren. Volg daarna deze volgorde:

1. Leg T0, bronchecksum, goedgekeurd diff, doel-lijstbinding en consentbewijs vast. Controleer dat bevestigings-, welkom- en marketingautomations uitstaan; providerflags blijven Mailchimp en Brevo-verzending blijft geblokkeerd.
2. Leg eerst alle suppressies vast. Importeer daarna uitsluitend bewezen CIIIC-kandidaten, zonder suppressie-reset of nieuwe consentdatum. Registreer per batch en record uitkomst plus providerreferentie in het beveiligde register.
3. Lees ieder contact volledig terug: lidmaatschap, canonieke TAAL en suppressies. Vergelijk tegen het goedgekeurde diff. Elke afwijking of gedeeltelijke batch blokkeert cutover; herhaling mag geen extra mail of toestemmingswijziging veroorzaken.
4. Bewaar alle wijzigingen sinds T0, inclusief later ontvangen gebeurtenissen met een oude brondatum. Verwerk vóór cutover de finale delta en controleer de volledige bron-/doelset opnieuw.
5. Bij rollback blijven alle nieuwe suppressies en voorkeuren gelden. Herstel nooit blind een oude export. Een gedeeltelijk verzonden editie vraagt eerst provideroverschrijdende send-reconciliation en een afzonderlijk besluit over resterende ontvangers.

## Editiecontract met nieuwsbrief

`src/services/consent/editions.js` bereidt één taaltoewijzing voor de volledige editie voor. Voor de eerste providerpoging mag de volledige snapshot vernieuwen. De eerste claim bevriest de snapshot; een taalwijziging geldt daarna voor de volgende editie. Iedere claim controleert actuele lokale suppressies. De persistente sleutel is editie + genormaliseerde contactidentiteit, onafhankelijk van taal of provider. Een onzekere provideruitkomst blijft gereserveerd en kan niet blind opnieuw worden verzonden.

Deze module verstuurt niets en is nog niet op de nieuwsbriefapp aangesloten. Vóór echt verzenden moet die consumer de snapshot en boekhouding gebruiken én bewijzen dat Brevo de vastgelegde selectie respecteert. Dynamische segmenten alleen zijn onvoldoende. De productiepoort omvat actuele suppressies vlak vóór iedere taal-send, bewezen disjuncte NL/EN-selectie, ontbrekende/verouderde EN blokkeren en herstart-/rollbackcontrole.
