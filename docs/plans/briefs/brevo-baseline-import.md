# Baseline-import Brevo: hervatbaar importeren met volledig read-back-bewijs

Tier: `flagship-review` (migratie van opgeslagen persoonsgegevens). Uitvoer: workhorse; onafhankelijke review en merge: flagship. Bouwvoorbereiding is toegestaan; een providerimport vraagt eerst Jaaps akkoord op het definitieve diff en een gereviewde importtool.

## Stand na codereview 19 oktober

PR #8 (`ce23937`) levert de gereviewde tool; [reviewbewijs](../../reports/brevo-baseline-review-2026-10-19.md). Deze brief blijft actief voor productie-uitvoering en de nog open acceptatiecriteria. Onderstaande aanleiding beschrijft de bouwopdracht.

## Wat is er aan de hand

De dry-run bestaat, maar de importtool nog niet. Zonder hervatbare import, suppressieboekhouding en read-back kan ciiic-nieuwsbrief de nieuwe hoofdlijst niet veilig gebruiken. Het grondslagbesluit van 19 oktober accepteert alle vier Mailchimp-bronnen; het is geen akkoord op een concreet import-diff. Zie `done/decisions.md`, TODO #7 en `docs/reports/brevo-migration-dryrun-2026-10-19.md`.

Bronopdracht: `2026-10-08--from-jaap-work--to-ciiic-automator--brevo-dryrun-en-baseline-import.md` (adopted, nog niet geleverd), aangevuld door `2026-10-19--from-_meta--to-ciiic-automator--brevo-grondslag-en-nieuwe-datum.md`. Hubplan: `jaap-work/docs/plans/briefs/brevo-migratie-taalvoorkeur-2026-10-06.md`, § 5 stap 2-3. Runbook: `docs/reference/ciiic-consent-preparation.md`, § Baseline-import en rollback.

## Principe

Het goedgekeurde plan bepaalt de mutaties. Suppressies winnen altijd; een herstart mag geen mail, dubbele mutatie of hernieuwde toestemming veroorzaken. Iedere provideruitkomst moet aantoonbaar zijn en een onzekere uitkomst blokkeert vervolg.

## Als we dit goed doen

1. Een CLI valideert het concrete goedgekeurde T0, de bronchecksums, het diff en de bronexport met expliciete goedkeuringsdatum. De versleutelde bronexport en het importregister staan uitsluitend op het duurzame volume buiten git, met beperkte rechten. Controleer actuele bron-/doeldrift vóór mutaties; een afwijkend plan vraagt opnieuw akkoord. Geen impliciete import als de CLI alleen wordt aangeroepen voor controle.
2. Bind de nieuwe lijst uitsluitend op de unieke naam `CIIIC nieuwsbrief`; wijs testlijsten 2/3 en een conflicterend ingesteld ID af. Controleer vóór aanmaken/toevoegen dat geen bevestigings-, welkoms- of marketingautomation kan starten. Ontbrekend bewijs blokkeert. Providerflags en writers blijven Mailchimp; verzending is geen CLI-functie.
3. Schrijf eerst alle suppressies naar de duurzame boekhouding; verwerk pas daarna kandidaten. Respecteer bestaande globale en lijstsuppressies; reset nooit een blokkade. Gebruik de bestaande `buildMigrationPlan`, live `LANGUAGE`-enumeratie en `compareBaselineReadback`. Schrijf `FIRSTNAME`/`LASTNAME` uit de bron waar aanwezig; verzin geen ontbrekende namen of consentdatums.
4. Registreer batch-ID, bron-/batchchecksum, per-record intentie en uitkomst, providerreferentie en foutstatus in het beveiligde register. Maak een onderbroken of onzekere batch hervatbaar door provider-read-back vóór een nieuwe mutatie. Een tweede uitvoering van hetzelfde goedgekeurde plan bewijst idempotentie. Fout- en console-uitvoer bevat geen adressen of credentials.
5. Lees na afloop de volledige doellijst en relevante contacten terug. Controleer lidmaatschap, taal, namen en suppressies; `compareBaselineReadback` controleert namen momenteel niet, dus voeg daarvoor een expliciete vergelijking toe. Elke afwijking of gedeeltelijke batch blokkeert vrijgave. Controleer tien contacten afzonderlijk, alleen geaggregeerde uitkomst in docs.
6. Bewijs met Brevo-eventlogs over het importvenster dat geen bevestigings-, welkomst- of marketingmail is veroorzaakt. SMTP- én marketingbewijs en paginering moeten het volledige venster dekken; alleen een lege recente steekproef is onvoldoende. Houd ontbrekend bewijs als blokkade vast. Bewaar wijzigingen sinds T0 voor de delta; rollback herstelt nooit blind de bronexport over nieuwe suppressies of voorkeuren heen.

## Validatie en klaar als

- Tests voor suppressies vóór kandidaten, bestaande Brevo-blokkades, bron-/doeldrift, ambigu lijst-ID, taaldrift, namen, crash na providerantwoord vóór registercommit, herstart en tweede identieke uitvoering; geen echte providerwrites in tests.
- CLI en documentatie zijn onafhankelijk gereviewd; uitvoering pas na het geregistreerde diff-akkoord.
- Baseline op productie teruggelezen: aantallen en attributen kloppen, verschillen verklaard, idempotentie en steekproef tien bewezen, geen mail door de import.
- Gepubliceerde briefing naar ciiic-nieuwsbrief bevat werkelijk lijst-ID en bevestigde delta-datum. Voorgestelde planning: go/no-go 26 oktober, delta 28 oktober, eerste send 29 oktober 2026. Writers blijven tot na 29 oktober Mailchimp.
- Sluit de twee migratiebriefings alleen met bewijs op alle criteria. Tot die tijd blijft ook de afhankelijke importbriefing bij jaap-work geblokkeerd.

## Buiten scope

Geen consent-routeactivatie, Form43/writer-cutover, verzending, supportcorrespondentie of betaalde providerwijziging. TODO #5 en #6 houden hun eigen mandaat en acceptatie.
