# Beslisronde + definitieve dry-run: grondslag Brevo-migratie (TODO 7)

Rol: stuur. Tier van het item: `flagship-review`; de sessie begint met een beslisvraag aan Jaap en brieft daarna het uitvoerwerk (importtool) voor de workhorse.

## Stand bij vertrek

11 oktober 2026, Fable (stuur, review-en-merge).

- **PR #5** (dry-run-tooling) en **PR #6** (editiecontract) gereviewd en gemerged: `84c30e7`, `fe9f3ea`; review-fix `429d32c` (gezette `BREVO_CIIIC_LIST_ID` moet op de bij naam gevonden lijst wijzen). Deploy `finished`, `/health` healthy, nieuwe routes antwoorden live 503 (inert: `CIIIC_CONSENT_ROUTE`, `NEWSLETTER_EDITION_TOKEN` en `BREVO_MARKETING_WEBHOOK_TOKEN` ontbreken in de Coolify-env, via GET gecontroleerd).
- **TODO 8 dicht**: briefing `editieboekhouding-contract` gesloten met bewijs; terugmeldbriefing `2026-10-11--from-ciiic-automator--to-ciiic-nieuwsbrief--editiecontract-definitief` gepubliceerd (tier workhorse). Daarin ook de beperking: het grootboek bevriest op het eerste Brevo-event, niet op de draft-statuswissel.
- **TODO 7 open**, wacht op Jaap. Dry-run van 10 okt (T0 `2026-10-10T17:23:23Z`, register `/data/consent/migration` op relaybot, exportsleutel in 1Password "CIIIC consent export key (migratie-dry-run)"): 2.148 subscribed, 457 suppressies, 16 pending; alle subscribed hebben opt-in-tijdstip en -IP. Bronnen: **Import 1.290, API - Generic 851, Hosted Signup Form 6, Admin Add 1.**
- Geen open briefings voor deze repo. Drift-log: 5 merges sinds nulpunt, 0 signalen, drempel niet gehaald.

## Opdracht

1. **Grondslagbesluit.** Staat er iets bij "Extra van Jaap", dan is dat het besluit. Zo niet: stel Jaap als eerste de vraag welke Mailchimp-bronnen als toestemmingsgrondslag tellen, met de tabel hierboven. De kern is `Import` (1.290, 60%): waar kwam die import vandaan en was de oorspronkelijke opt-in gedocumenteerd? `API - Generic` (851) zijn de website-/Forms-inschrijvingen, `Hosted Signup Form` en `Admin Add` zijn klein. Zonder besluit over `Import` haalt 19 okt geen go. Noteer het besluit in `done/decisions.md`.
2. **Definitieve dry-run** in de relaybot-container (alleen-lezend), zoals het runbook § Migratie-dry-run voorschrijft: `CONSENT_EXPORT_KEY=… node scripts/consent-preflight.mjs --register-dir /data/consent/migration --accept-sources "<bronnen>" --policy "Jaap akkoord <datum> op dry-run 2026-10-10T17:23:23Z"`. Controleer dat `targetList.exists` nog `false` is (de lijst "CIIIC nieuwsbrief" maakt de import aan) en dat de kandidaat-aantallen kloppen met het besluit. Leg T0 en aantallen vast in TODO 7.
3. **Importtool briefen** voor de workhorse (`briefs/brevo-baseline-import.md`, tier `flagship-review`): hubplan § 5 stap 3 en runbook § Baseline-import en rollback; lijst aanmaken, eerst suppressies dan kandidaten, geen automations, batch-ID + checksums + per-record uitkomst in het register, `compareBaselineReadback`, steekproef 10, Brevo-eventlog zonder verzonden mail. Idempotent en herstartbaar. Go/no-go **ma 19 okt**; liever no-go dan een halve import. Bij no-go: briefing naar ciiic-nieuwsbrief met reden en nieuwe richtdatum. Na de import: briefing met lijst-id en delta-datum (wo 21 okt) naar ciiic-nieuwsbrief, dan briefing `2026-10-08--from-jaap-work--to-ciiic-automator--brevo-dryrun-en-baseline-import` sluiten met bewijs.
4. Overschrijf deze handoff met de volgende sessie, neem deze overschrijfplicht weer op, en sluit af met de sluitregel.

## Doorgeefblok: bestaande opdrachten behouden

TODO 6, Brevo-deliverability: beslissing van Jaap over de SpamCop-listing van het gedeelde Brevo-IP en clicktracking op de magic link. Hertest naar jaap@jaapstronks.nl met de Brevo-eventlog (`/v3/smtp/statistics/events?email=…`) als bewijs.

TODO 5 vraagt afzonderlijk activatiemandaat en concrete acceptatie: autoritatieve DOI-bevestiging, CIIIC-signing-/registerconfiguratie, getekende Form43-feed7 (nu ongetekend, POST JSON naar `list=ciiic`), reconciliation vóór T0 en nieuwsbriefboekhouding; pas dan `CIIIC_CONSENT_ROUTE=enabled`. Geen productieconfiguratie, import, cutover of verzending afleiden uit de gemergde voorbereiding. Oude proefregisters blijven ongeschikt. Het editiecontract (#6) gaat pas live met die activatie: `NEWSLETTER_EDITION_TOKEN` in Coolify (en via 1Password naar ciiic-nieuwsbrief), Brevo-marketingwebhook ook voor `delivered`/`sent`, en dan een activatiebriefing naar ciiic-nieuwsbrief.

De contractbriefings `2026-10-06--from-ciiic-automator--to-forms--ciiic-optin-signature-contract.md` en `2026-10-06--from-ciiic-automator--to-ciiic-nieuwsbrief--editieboekhouding-consent-contract.md` blijven voorbereidingsopdrachten zonder activatiemandaat. De hubbriefing `2026-10-06--from-ciiic-automator--to-jaap-work--form43-actieve-ciiic-feed-blokkeert-consent-deploy.md` blijft staan: de feed moet bij activatie alsnog getekend worden.

Radar-nacontrole (uit PR #4): in monitor (scan-report) kijken of `springer-vr` en `nature-heritage` items opleverden sinds 9 okt. Springer met 0 items = bot-challenge die dag, geen bug. Kan als bijvangst in elke sessie.

Kleine bevinding, geen item: de code-default van `NOTION_CONTACTEN_DS_IDS` in `src/services/jaarevent.js` noemt een tweede data source (`30411fb0…`) die niet meer bestaat; de query geeft daar 404 en slaat hem over. Onschadelijk.

Voor `_meta`, niet voor deze repo: `ciiic-nieuwsbrief` staat niet in `_meta/REPOS.yaml` (grep op "nieuwsbrief" vindt alleen de jaapstronks-site), terwijl er briefings van en naar die repo lopen. Een _meta-sessie kan hem registreren.

## Extra van Jaap

_(leeg)_
