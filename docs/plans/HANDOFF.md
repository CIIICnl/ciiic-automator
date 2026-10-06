# Review en merge: CIIIC-consentvoorbereiding (PR #2)

Rol: stuur. Modelkeuze: flagship vereist wegens tier `flagship-review` (consent, auth en migratie).

## Stand bij vertrek

[PR #2](https://github.com/CIIICnl/ciiic-automator/pull/2) levert TODO4: gedeelde CIIIC-provideradapter, versleuteld suppressieregister, callback-/Forms-auth, GET-only preflight en bronreconciliation, rollbackdelta en editieboekhouding. Hubplan PR7 is gemerged (`714665b`) en de planbriefing is geleverd (`_meta` `2d04982d`). Automatorcode is uitsluitend op de PR-branch gepusht; niets gedeployd, geïmporteerd of verzonden.

31 tests slagen lokaal en CI op Node20/22 is groen. Een geïsoleerde mutatie van de bestaande Jaarevent-signaturecheck laat de suite falen. Gitleaks en diff-check schoon. Bewijs: `docs/reports/brevo-consent-validation-2026-10-06.md`. De live bindingscontrole bevestigde jaarevent `0e404ef800` tegenover CIIIC `67fe159b9d`; beide owner/company `CIIIC`.

Productiepoorten staan in TODO5 en `docs/reference/ciiic-consent-preparation.md`: autoritatieve DOI-bevestiging is nog niet automatisch aangesloten; pending blijft niet-verzendbaar. CIIIC-signing-/registerconfiguratie ontbreekt nog, reconciliation moet vóór T0 starten en worden ingepland, en nieuwsbrief moet de ledger gebruiken. Main deployt automatisch: review de impact vóór merge, niet pas erna. De voorbereiding autoriseert geen productieconfiguratie/import/cutover/verzending.

Twee aanvullende contractbriefings zijn gepubliceerd: `2026-10-06--from-ciiic-automator--to-forms--ciiic-optin-signature-contract.md` en `2026-10-06--from-ciiic-automator--to-ciiic-nieuwsbrief--editieboekhouding-consent-contract.md`. Ze kunnen parallel voorbereiding uitvoeren, maar geven geen activatiemandaat.

## Opdracht

1. Review PR2 in schone context tegen het hubplan secties 2–6 en de oorspronkelijke automator-meta-briefing. Draai `npm test`; controleer vooral consent-evidence, raw-body/URL-auth, suppressiemonotoniciteit, key-mismatch, bronordering en provideroverschrijdende onbekende sendstatus. Beoordeel de genoemde productiepoorten en eventuele contractfeedback.
2. Bij akkoord en verantwoorde deploy-impact: merge volgens gitregels. Bij een niet-fast-forward merge eerst toestemming vragen, tenzij Jaap die in deze nieuwe sessie al expliciet gaf. Merge geen code die ongemerkt actieve feeds breekt. Volg `merge-housekeeping`; sluit TODO4 en de nu aangetoonde minimale testbasis TODO3, behoud TODO5. PR-auteur merget deze eigen PR niet.
3. Controleer `briefings.sh open ciiic-automator`. De oorspronkelijke briefing `2026-10-06--from-jaap-work--to-ciiic-automator--brevo-consent-en-migratievoorbereiding.md` is nog open. Registreer per criterium bewijs en sluit alleen als de gevraagde voorbereiding werkelijk is geleverd; claim geen productieacceptatie.
4. Log de afronding in JAAP-KB journal. Behoud de onuitgevoerde opdracht hieronder, tenzij de review nieuwe prioriteit oplevert.
5. Overschrijf deze handoff met de volgende begrensde opdracht; behoud onuitgevoerd werk en deze overschrijf-plicht, en eindig met de bijbehorende sluitregel.

## Doorgeefblok: bestaande opdracht behouden

TODO1, draft-resume in productie roken, is nog niet uitgevoerd. Controleer na deze review `https://bot.ciiic.nl/health` op `drafts.success: true`, één testsave met count +1, resume-mail in inbox bij Gmail/Outlook/ciiic.nl en de persistente `/data`-mount op Coolify `relaybot`. Lees `docs/plans/done/draft-resume-endpoints.md`; gebruik skill `ciiic-coolify`. Eventuele fix op branch met eigen PR; bij succes bevinding in `done/register.md`. Stem eventuele echte testverzending af op het mandaat van die sessie.

TODO2, uitgezette Radar-bronnen beslissen, wacht daarna op een beslisronde. TODO5 krijgt een afzonderlijk activatiemandaat en concrete acceptatie; geen nieuwe productieactie afleiden uit deze codevoorbereiding.

## Extra van Jaap

_(leeg)_
