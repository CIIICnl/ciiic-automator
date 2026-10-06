# Consentvoorbereiding PR #2: herstel nodig

Review door Astra op 6 oktober 2026, code-head `f4e89d9cd53012873fa0f7b738a0cca2d5fec991`. Contract: hubplan secties 2–6 en de oorspronkelijke automator-meta-briefing. Uitkomst: **niet mergen**. Twee reproduceerbare fouten in voorkeurreconciliation verhinderen acceptatie. Geen productieconfiguratie, import, verzending of deploy uitgevoerd.

## R1. P1: scantijd verdringt een nieuwere echte taalkeuze

Adres: `src/services/consent/reconciliation.js:82`, in combinatie met de tijdvergelijking in `src/services/consent/store.js`. De runner gebruikt `snapshotAt` als `occurredAt` én onderdeel van de eventidentiteit. Dat is het waarnemingsmoment, niet het wijzigingsmoment. Een later binnenkomende Brevo-callback kan daardoor als ouder worden genegeerd terwijl de gebruiker die keuze juist later maakte. Het contract verbiedt een oudere Mailchimp-keuze over een nieuwere Brevo-keuze te schrijven.

Reproductie met echte tijdelijke SQLite en versleutelde checkpoints, uitsluitend synthetisch adres `review@example.test`; alle tijden op 6 oktober 2026 UTC:

1. Bevestigd contact met NL; broncheckpoint op 10:00 met alleen het Nederlandse interest.
2. Mailchimp verandert naar EN op 10:01 (`last_changed=10:01`); reconciliation leest dat op 10:05 en schrijft een preference-event op **10:05**.
3. Een Brevo-keuze voor NL op **10:03** arriveert daarna als `brevo-profile`-event.
4. Geobserveerd: register blijft `language=en`, `languageAt=10:05`, `preferenceConflict=false`. De nieuwere echte keuze is verloren. Verwacht: NL als de volgorde bewezen is, anders duurzame quarantaine.

Herstel: bewaar bronmoment/bewijs en waarnemingsmoment afzonderlijk. Een volledige scan bewijst slechts dat iets tussen twee waarnemingen veranderde; `last_changed` kan ook een ander profielveld betreffen. Gebruik dus geen van beide blind als bewezen taalwijzigingstijd. Maak de keuze bij overlappende of onvoldoende bewezen volgorde conservatief en duurzaam; vertraagde callbacks en het moment tussen berekenen en toepassen mogen het conflict niet omzeilen. Eventidentiteit moet stabiel blijven bij een retry van dezelfde bronwijziging.

Klaar als: regressietests bewijzen dit scenario in beide aankomstvolgordes, inclusief herstart en gedeeltelijk mislukte toepassing. Een nieuwere keuze wordt verwerkt of het contact wordt aantoonbaar geblokkeerd tot het conflict is opgelost. De test voor een naamswijziging zonder taalwijziging blijft groen.

## R2. P1: een taalconflict blijft verzendbaar en de correctie verdwijnt

Adressen: `src/services/consent/reconciliation.js:64` en `:75`, `scripts/consent-reconcile.mjs:77`. Bij beide taalinterests telt de runner alleen een reden en slaat het contact over. Het lokale register krijgt geen conflict. Toch wordt het broncheckpoint vervangen. Wanneer het bronconflict later wordt opgelost, slaat `oldPreference.reason` ook die correctie over, waarna opnieuw een checkpoint wordt opgeslagen. Daardoor blijft de oude taal onbeperkt staan. Hetzelfde verlies van onopgelost bewijs dreigt bij `concurrent_preference_conflict`.

Reproductie met `applyReconciliation`, echte SQLite en `prepareEdition`/`claimEditionRecipient`:

1. Bevestigd contact met NL en een NL-broncheckpoint op 10:00.
2. Scan op 10:05 ziet beide interests actief. Samenvatting: `both_language_interests: 1`.
3. Maak een editie uit het lokale record en claim NL. Geobserveerd: **`allowed: true`**, zonder `preferenceConflict`.
4. Bron wordt eenduidig EN op 10:06. Scans op 10:10 en 10:15 verwerken beide nul events. Register blijft NL, nog steeds zonder conflict.

Herstel: conflicten moeten duurzaam per identiteit worden vastgelegd en door de editiecontrole worden gerespecteerd. Bewaar voldoende bronbewijs om een correctie na een conflict gecontroleerd te verwerken; een checkpoint mag een onopgeloste wijziging niet stil afhandelen. Een nieuwe eenduidige, voldoende bewezen keuze kan alleen het voorkeurconflict opheffen, nooit suppressie of toestemming veranderen.

Klaar als: tests bewijzen blokkering van een nieuwe én bestaande editie tijdens conflict, behoud na herstart en een gecontroleerde overgang naar EN na correctie. Test ook een concurrerend Mailchimp/Brevo-conflict over meerdere scans, zodat het niet na één logregel verdwijnt. Suppressies blijven monotonic en een al begonnen editie behoudt haar taaltoewijzing.

## Overige review en deploygrens

- `npm test` zelfstandig uitgevoerd: **32/32 groen**. Bestaande CI voor Node20/22 op de gereviewde code-head is groen. De aanvullende probes hierboven reproduceren fouten die de bestaande suite niet afdekt; de oorspronkelijke validatietabel is daarmee onvoldoende voor acceptatie van bronordering en conflictbehandeling.
- Auth op raw body plus URL/query, sleutelcontrole, sticky suppressies, DOI-only providerrequests, provideroverschrijdende unknown-sendclaims, scheiding van IX Labs en eventstatus, read-only providerinventaris en versleutelde opslag zijn gelezen. De actuele [Brevo marketingpayloads](https://developers.brevo.com/docs/marketing-webhooks) zijn gecontroleerd voor de gebruikte eventvormen; geen aanvullende payloadbevinding.
- Owner/listbinding is onderbouwd in het uitvoeringsrapport; geen nieuwe live bindingsmeting in deze review. Productieconfiguratie en de actuele feedstatus zijn niet opnieuw gelezen omdat de reproduceerbare codefouten merge al blokkeren. Vóór een latere merge blijft een expliciete deploy-impactcontrole nodig: main deployt automatisch, CIIIC-feeds hebben de nieuwe signing-/registerconfiguratie nodig, DOI-bevestiging en consumers zijn nog productiepoorten onder TODO5.
- TODO3 en TODO4 blijven open. De oorspronkelijke briefing is niet geleverd en blijft open. De contractbriefings naar Forms en nieuwsbrief blijven voorbereidingsopdrachten; deze review verleent geen activatiemandaat.

Herstel op de bestaande PR-branch, voeg echte regressietests toe en actualiseer het validatierapport. Daarna een nieuwe flagship-review met schone context. Productieacties blijven buiten het voorbereidingsmandaat.
