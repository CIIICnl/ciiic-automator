# TODO — ciiic-automator

Leeswijzer in het kort (volledig: skill `werkwijze`): _In progress_ is een claimbord, max 3 claims, leeg is de goede staat. _Open werk_ staat top-down op prioriteit; nummers zijn vaste adressen. Eén item is ≤ ~12 regels en draagt een toetsbaar "klaar als" — heb je meer nodig, schrijf dan een brief in `briefs/` en laat het item ernaar verwijzen. Budget: **< 300 regels** (kleine repo). Geshipt werk verdwijnt hier: één regel in _Recently done_, write-up naar `done/`, nummer naar `done/register.md`.

## In progress

- #7 Brevo-baseline-importtool, op branch `feat/brevo-baseline-import` (mbp); productie-import blijft wachten op apart diff-akkoord en onafhankelijke review.

## Open werk

### 7. Brevo-baseline wacht op diff-akkoord en importtool

**[flagship-review] [beslissing Jaap]** Grondslagbesluit 19 oktober vastgelegd; dry-run T0 `2026-10-19T17:36:35.815Z`: 2.161 kandidaten (2.090 NL, 71 EN), 464 suppressies, 24 pending, 0 quarantaine. Doellijst ontbreekt. [Diff en bewijs](../reports/brevo-migration-dryrun-2026-10-19.md); [uitvoerbrief](briefs/brevo-baseline-import.md) bevat bronopdrachten en alle acceptatiecriteria.

Goed gedaan: hervatbare importtool bouwen; na onafhankelijke review en Jaaps diff-akkoord importeren. Eerste send 29 oktober; voorstel go/no-go 26 oktober, delta 28 oktober. Writers blijven tot na 29 oktober Mailchimp.

Klaar als: diff-akkoord, volledige read-back met taal/namen/suppressies, idempotentie, steekproef tien en geen importmail bewezen; lijst-ID en bevestigde delta-datum gepubliceerd; migratiebriefings van 8 en 19 oktober met bewijs geleverd.

### 5. Brevo-productiegebruik mist nog geverifieerd bevestigingsbewijs en consumerkoppelingen

**[flagship-review]** (toestemming en migratie; apart uitvoeringsmandaat). De voorbereiding van #4 bevestigt geen DOI zonder autoritatief bewijs. Goed gedaan: werkende, bewezen koppeling van echte providerbevestiging naar het register, getekende Forms-feeds (ook de live Form43/feed7), daarna pas `CIIIC_CONSENT_ROUTE=enabled`, duurzame registerconfiguratie, reconciliation vóór T0 en nieuwsbriefboekhouding. [Runbook](../reference/ciiic-consent-preparation.md) beschrijft de poorten.

Klaar als: afzonderlijk geautoriseerde activatie bewijst de hele DOI-keten en geplande reconciliation; consumercontracten zijn geleverd. Een baseline-import, cutover of echte verzending blijft een apart besluit op een concreet gecontroleerd diff.

### 6. Herstel van Brevo-bezorging bij mailbox.org is nog niet bewezen

**[workhorse] [beslissing Jaap]** Logmeting 19 oktober: vier adres-events (twee requests/twee softBounces), laatste poging 6 oktober, geen delivered. IP `77.32.148.23` kreeg RBL-afwijzingen en op 7 oktober ook hostkarma bij hr.nl. Aflevering via `.24` bewijst geen herstel. Eigenaar: ciiic-automator TODO #6. [Volledig bewijs en providerroute](../reports/brevo-rbl-status-2026-10-19.md).

Goed gedaan: met Jaaps mandaat Brevo-support inschakelen (mailbox.org-ticket 8785440 verwijst naar verzendprovider), daarna afzonderlijk afgesproken hertest. Apart besluit: clicktracking op de magic link uitschakelen. Geen supportbericht, testmail of betaalde wijziging zonder mandaat.

Klaar als: providerroute en clicktrackingbesluit in `done/decisions.md`, geautoriseerde hertest als `delivered` met sender-IP in Brevo-eventlog.

## Recently done

- 2026-10-19, PR #7 (`e32df11`): Brevo-grondslagbesluit, definitieve dry-run en RBL-logmeting gereviewd; RBL-briefing geleverd. TODO #7/#6 blijven open; importtool gebrieft.
- 2026-10-15 — suppressieboekhouding editiecontract: `byLanguage`-tellers, `removedByAutomator`, suppressies overleven een snapshotverversing; afspraak in runbook § Editiecontract punt 5. Briefing beantwoord en gesloten.
- 2026-10-11, PR #6 — #8 editiecontract met ciiic-nieuwsbrief: snapshot-endpoint, Brevo-receipts, suppressieroute (b), `GET`-stand; inert tot activatie (#5). Terugmeldbriefing gepubliceerd, briefing gesloten (merge `fe9f3ea`). Write-up `done/2026-10.md`.
- 2026-10-11, PR #5 — dry-run-tooling voor de Brevo-migratie (diff, grondslag per bron, doellijst, T0-register); het item zelf (#7) blijft open tot Jaaps grondslagbesluit (merge `84c30e7`).
- 2026-10-08, PR #4 — #2 Radar-bronnen beslist: Springer en Nature aan in Coolify-env, EurekAlert/Immersive Wire/UploadVR uit de code (merge `d098761`, zie `done/decisions.md`).
