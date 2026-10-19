# Beslis- en uitvoersessie: Brevo-baseline na diff-akkoord

Rol: stuur. Tier: `flagship-review` (migratie); eerst Jaaps concrete akkoord en uitvoeringsmandaat, daarna uitvoering met onafhankelijke bewijscontrole.

## Stand bij vertrek

PR [#8](https://github.com/CIIICnl/ciiic-automator/pull/8) is op 19 oktober onafhankelijk gereviewd en gemerged (`ce23937`). Reviewfix `9085dc4` beschermt de actuele lijstbinding, contactwijzigingen tijdens de import en de HMAC van daadwerkelijke batchregels. 70 tests en CI Node 20/22 groen; Docker-build en module-smoke zonder netwerk geslaagd. [Reviewrapport](../reports/brevo-baseline-review-2026-10-19.md). Vóór merge live gecontroleerd: consent-/providerflags ongezet, Form43/feed7 actief op het oude Mailchimp-pad.

TODO #7 is codegereed maar de productie-import is niet uitgevoerd. Jaaps akkoord op het concrete diff ontbreekt: T0 `2026-10-19T17:36:35.815Z`, 2.161 kandidaten (2.090 NL, 71 EN), 464 suppressies, 24 pending, nul quarantaine. Register en export staan op `/data/consent/migration`. De tool vereist een gedateerd akkoordbestand en actueel automation-attest op dat volume. SMTP- en marketingeventlogs over het volledige importvenster zijn nog niet bewezen; de tool geeft geen cutover-vrijgave. Writers blijven tot na 29 oktober Mailchimp.

Beide migratiebriefings van 8 en 19 oktober blijven ongeleverd; de afhankelijke importbriefing bij jaap-work blijft geblokkeerd. De planningsbriefing naar ciiic-nieuwsbrief bevat nog geen werkelijk lijst-ID of bevestigde delta-datum.

## Terugkeer-check

Jaap: akkoord op [dit concrete diff](../reports/brevo-migration-dryrun-2026-10-19.md) en uitvoering van de baseline na alle controles? Advies: dit diff goedkeuren; de importer stopt bij bronwijzigingen en vraagt dan een nieuw diff-akkoord. Go/no-go 26 oktober en delta 28 oktober zijn voorstellen; eerste send 29 oktober staat vast. Geen akkoord afleiden uit `/handoff` of de grondslagbeslissing.

## Opdracht

1. Controleer of Jaaps diff-akkoord en uitvoeringsmandaat inmiddels expliciet zijn gegeven. Ontbreken ze, leg het concrete diff voor en wacht met providerwrites. Bij akkoord: leg datum en scope vast in `done/decisions.md` en het afgeschermde attest op het volume.
2. Controleer de live bron-/doelstand, map-ID, unieke doellijst en actuele account-/lijstautomations volgens [uitvoerbrief](briefs/brevo-baseline-import.md) en [runbook](../reference/ciiic-consent-preparation.md). Bronwijziging vraagt een nieuwe dry-run en nieuw akkoord. Bewijs de benodigde reconciliation/delta-opslag sinds T0; oude proefregisters voldoen niet. Controleer vooraf de toegang tot SMTP- én marketingeventlogs over het volledige importvenster.
3. Alleen binnen het expliciete mandaat: voer de baseline uit, bewijs volledige read-back, idempotentie, tien individuele controles en geen importmail. Onzekere provideruitkomst of gedeeltelijke batch blijft geblokkeerd; verwijder een achtergebleven lock pas na procescontrole. Geen consent-routeactivatie, writer-cutover, supportbericht of testmail.
4. Na volledige levering: bevestig met Jaap de delta-datum, publiceer werkelijk lijst-ID en datum naar ciiic-nieuwsbrief; sluit beide migratiebriefings alleen met bewijs op al hun criteria. Werk TODO #7 en de planning bij. Bewaar het onderstaande onuitgevoerde werk.
5. Overschrijf deze handoff met feitelijke stand en vervolgopdracht; behoud onuitgevoerd werk en neem deze overschrijfplicht weer op als laatste genummerde stap.

## Doorgeefblok: bestaande opdrachten behouden

TODO #6: Brevo-support is de aanbevolen route op basis van het RBL-rapport van 19 oktober. Alleen met expliciet mandaat een supportbericht of hertest; bewijs van herstel is `delivered` plus sender-IP voor mailbox.org. Clicktracking op de magic link vraagt een afzonderlijk besluit. Geen herstel afleiden uit oud bewijs.

TODO #5 vraagt afzonderlijk activatiemandaat en concrete acceptatie: autoritatieve DOI-bevestiging, CIIIC-signing-/registerconfiguratie, getekende Form43-feed7, reconciliation vóór T0 en nieuwsbriefboekhouding; pas dan `CIIIC_CONSENT_ROUTE=enabled`. Geen productieconfiguratie of writer-cutover afleiden uit de importtool. Oude proefregisters blijven ongeschikt. Het editiecontract gaat pas live met die activatie: `NEWSLETTER_EDITION_TOKEN` in Coolify en via 1Password naar ciiic-nieuwsbrief, Brevo-marketingwebhook ook voor `delivered`/`sent`, en dan een activatiebriefing naar ciiic-nieuwsbrief.

De contractbriefings `2026-10-06--from-ciiic-automator--to-forms--ciiic-optin-signature-contract.md` en `2026-10-06--from-ciiic-automator--to-ciiic-nieuwsbrief--editieboekhouding-consent-contract.md` blijven voorbereidingsopdrachten zonder activatiemandaat. De hubbriefing `2026-10-06--from-ciiic-automator--to-jaap-work--form43-actieve-ciiic-feed-blokkeert-consent-deploy.md` blijft staan: de feed moet bij activatie alsnog getekend worden.

Radar-nacontrole: kijk in monitor of `springer-vr` en `nature-heritage` items opleverden sinds 9 oktober. Springer met nul items die dag kan een bot-challenge zijn.

Kleine bevinding, geen item: de code-default van `NOTION_CONTACTEN_DS_IDS` in `src/services/jaarevent.js` noemt een tweede data source (`30411fb0…`) die niet meer bestaat; de query krijgt 404 en slaat hem over.

## Extra van Jaap

_(leeg)_
