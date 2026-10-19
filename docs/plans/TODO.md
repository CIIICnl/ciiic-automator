# TODO — ciiic-automator

Leeswijzer in het kort (volledig: skill `werkwijze`): _In progress_ is een claimbord, max 3 claims, leeg is de goede staat. _Open werk_ staat top-down op prioriteit; nummers zijn vaste adressen. Eén item is ≤ ~12 regels en draagt een toetsbaar "klaar als" — heb je meer nodig, schrijf dan een brief in `briefs/` en laat het item ernaar verwijzen. Budget: **< 300 regels** (kleine repo). Geshipt werk verdwijnt hier: één regel in _Recently done_, write-up naar `done/`, nummer naar `done/register.md`.

## In progress

_(leeg)_

## Open werk

### 7. Brevo-baseline wacht op akkoord op het definitieve diff en de importtool

**[flagship-review]** (migratie van persoonsgegevens). Grondslagbesluit 19 oktober: alle vier bronnen tellen mee; die beslissingsblokkade is weg. Definitieve dry-run, T0 `2026-10-19T17:36:35.815Z`: **2.161 kandidaten (2.090 NL, 71 EN), 464 suppressies, 24 pending, 0 quarantaine**; 84 kandidaten zonder voornaam. Doellijst bestaat nog niet. [Diff en bewijs](../reports/brevo-migration-dryrun-2026-10-19.md); beveiligd register `/data/consent/migration` op relaybot.

Goed gedaan: na Jaaps akkoord op dit concrete diff een gereviewde, hervatbare importtool uitvoeren, suppressies eerst, volledige read-back en bewijs zonder mail. [Uitvoerbrief](briefs/brevo-baseline-import.md). Eerste Brevo-send **29 oktober**; voorgesteld go/no-go **26 oktober**, delta **28 oktober**. Writers blijven tot na 29 oktober Mailchimp. Opdrachten: `2026-10-08--from-jaap-work--to-ciiic-automator--brevo-dryrun-en-baseline-import.md` en `2026-10-19--from-_meta--to-ciiic-automator--brevo-grondslag-en-nieuwe-datum.md`.

Klaar als: diff-akkoord geregistreerd, baseline volledig teruggelezen, idempotentie en steekproef tien bewezen, `LANGUAGE`/namen gevuld, geen importmail, werkelijk lijst-ID en bevestigde delta-datum gepubliceerd aan ciiic-nieuwsbrief; beide briefings met bewijs geleverd.

### 5. Brevo-productiegebruik mist nog geverifieerd bevestigingsbewijs en consumerkoppelingen

**[flagship-review]** (toestemming en migratie; apart uitvoeringsmandaat). De voorbereiding van #4 bevestigt geen DOI zonder autoritatief bewijs. Goed gedaan: werkende, bewezen koppeling van echte providerbevestiging naar het register, getekende Forms-feeds (ook de live Form43/feed7), daarna pas `CIIIC_CONSENT_ROUTE=enabled`, duurzame registerconfiguratie, reconciliation vóór T0 en nieuwsbriefboekhouding. [Runbook](../reference/ciiic-consent-preparation.md) beschrijft de poorten.

Klaar als: afzonderlijk geautoriseerde activatie bewijst de hele DOI-keten en geplande reconciliation; consumercontracten zijn geleverd. Een baseline-import, cutover of echte verzending blijft een apart besluit op een concreet gecontroleerd diff.

### 6. Herstel van Brevo-bezorging bij mailbox.org is nog niet bewezen

**[workhorse] [beslissing Jaap]** Botmail kan mislukken terwijl `/draft/save` `ok: true` teruggeeft. Logmeting 19 oktober: adresselectie 30 september t/m 19 oktober bevat vier events (twee requests/twee softBounces), laatste poging 6 oktober; geen nieuwere poging of `delivered`. IP `77.32.148.23` kreeg op 30 september en 6 oktober `554 5.7.1 ... blocked by RBL`; op 7 oktober ook een hostkarma-afwijzing bij hr.nl. Afleveringen via `.24` bewijzen geen herstel. Technisch eigenaar blijft deze repo, TODO #6; [bewijs en providerroute](../reports/brevo-rbl-status-2026-10-19.md).

Goed gedaan: na Jaaps mandaat Brevo-support de bounce/message-ID's laten onderzoeken (gedeelde pool/reputatie/delisting), daarna een afzonderlijk afgesproken mailbox.org-hertest. mailbox.org-ticket 8785440 verwijst naar de verzendprovider en biedt geen allowlist-oplossing. Apart besluit nodig: clicktracking op de magic link uitschakelen (de geheime token gaat nu via `sendibt3.com`). Geen supportbericht, testmail of betaalde wijziging zonder expliciet mandaat.

Klaar als: providerroute en clicktrackingbesluit in `done/decisions.md`, en de geautoriseerde hertest staat als `delivered` met sender-IP in Brevo's eventlog.

## Recently done

- 2026-10-15 — suppressieboekhouding editiecontract: `byLanguage`-tellers, `removedByAutomator`, suppressies overleven een snapshotverversing; afspraak in runbook § Editiecontract punt 5. Briefing beantwoord en gesloten.
- 2026-10-11, PR #6 — #8 editiecontract met ciiic-nieuwsbrief: snapshot-endpoint, Brevo-receipts, suppressieroute (b), `GET`-stand; inert tot activatie (#5). Terugmeldbriefing gepubliceerd, briefing gesloten (merge `fe9f3ea`). Write-up `done/2026-10.md`.
- 2026-10-11, PR #5 — dry-run-tooling voor de Brevo-migratie (diff, grondslag per bron, doellijst, T0-register); het item zelf (#7) blijft open tot Jaaps grondslagbesluit (merge `84c30e7`).
- 2026-10-08, PR #4 — #2 Radar-bronnen beslist: Springer en Nature aan in Coolify-env, EurekAlert/Immersive Wire/UploadVR uit de code (merge `d098761`, zie `done/decisions.md`).
- 2026-10-06, #1 draft-resume in productie gerookt: `/data`-mount bestaat, save → mail → link → `GET /draft/:token` werkt; deliverability-bevinding werd #6. Write-up `done/2026-10.md`.
- 2026-10-06, PR #2 — #4 consentvoorbereiding: provideradapter, versleuteld register, reconciliation/preflight en getekende Forms-ingress, alles achter `CIIIC_CONSENT_ROUTE` (default uit = oud gedrag). Activatie is #5. Write-up `done/2026-10.md`.
