# TODO — ciiic-automator

Leeswijzer in het kort (volledig: skill `werkwijze`): _In progress_ is een claimbord, max 3 claims, leeg is de goede staat. _Open werk_ staat top-down op prioriteit; nummers zijn vaste adressen. Eén item is ≤ ~12 regels en draagt een toetsbaar "klaar als" — heb je meer nodig, schrijf dan een brief in `briefs/` en laat het item ernaar verwijzen. Budget: **< 300 regels** (kleine repo). Geshipt werk verdwijnt hier: één regel in _Recently done_, write-up naar `done/`, nummer naar `done/register.md`.

## In progress

_(leeg)_

## Open werk

### 9. Brevo-delta op 28 oktober en go/no-go op 26 oktober

**[flagship-review] [beslissing Jaap]** Baseline staat (21 oktober, lijst 20, 2.163 leden, 464 suppressies; [bewijs](../reports/brevo-baseline-import-2026-10-21.md)). Sindsdien schrijven Form43/feed7 en de automator nog op Mailchimp; alles wat na T0 `2026-10-21T11:01:06.771Z` binnenkomt of afmeldt moet vóór de send op 29 oktober naar lijst 20, met suppressies voorop. Jaap bevestigde delta woensdag 28 oktober en go/no-go maandag 26 oktober.

Goed gedaan: een delta-run leest Mailchimp sinds T0 (nieuwe subscribed, nieuwe unsubscribed/cleaned, gewijzigde taal of naam), past alleen die mutaties toe via dezelfde registerlogica (suppressies eerst, read-back, geen mail) en legt een nieuw T0 vast. Buiten mandaat: writer-cutover, consent-route, verzending.

Stand 21 oktober: delta-tooling gereviewd en gemerged (PR #10, `122842a`); go/no-go-smoketest op productie zie `HANDOFF.md`. Klaar als: go/no-go-check 26 oktober gedocumenteerd, delta 28 oktober uitgevoerd en teruggelezen met eventlogbewijs, nieuw T0 in het register, terugmelding naar ciiic-nieuwsbrief.

### 10. Import-CLI's drukken geen oorzaak af

**[workhorse]** Bij een fout melden `consent-baseline-import.mjs` en `consent-reconcile.mjs` alleen "inspect protected register"; op 21 oktober was voor elke diagnose een aangepaste kopie nodig. Goed gedaan: een allowlist van veilige meldingen (timeout, 429, drift, attest, lock) zoals `consent-preflight.mjs` die al heeft; nooit bodies, paden met adressen of credentials. Klaar als: allowlist met test, stderr blijft adresvrij; de delta-CLI heeft er sinds PR #10 al een (`SAFE` in `consent-delta-import.mjs`), hergebruik die. (Backoff op Brevo 429/timeout voor GETs zit sinds PR #9 in `baseline-provider.js`.)

### 5. Brevo-productiegebruik mist nog geverifieerd bevestigingsbewijs en consumerkoppelingen

**[flagship-review]** (toestemming en migratie; apart uitvoeringsmandaat). De voorbereiding van #4 bevestigt geen DOI zonder autoritatief bewijs. Goed gedaan: werkende, bewezen koppeling van echte providerbevestiging naar het register, getekende Forms-feeds (ook de live Form43/feed7), daarna pas `CIIIC_CONSENT_ROUTE=enabled`, duurzame registerconfiguratie, reconciliation vóór T0 en nieuwsbriefboekhouding. [Runbook](../reference/ciiic-consent-preparation.md) beschrijft de poorten.

Klaar als: afzonderlijk geautoriseerde activatie bewijst de hele DOI-keten en geplande reconciliation; consumercontracten zijn geleverd. Een baseline-import, cutover of echte verzending blijft een apart besluit op een concreet gecontroleerd diff.

### 6. Herstel van Brevo-bezorging bij mailbox.org is nog niet bewezen

**[workhorse] [beslissing Jaap]** Logmeting 19 oktober: vier adres-events (twee requests/twee softBounces), laatste poging 6 oktober, geen delivered. IP `77.32.148.23` kreeg RBL-afwijzingen en op 7 oktober ook hostkarma bij hr.nl. Aflevering via `.24` bewijst geen herstel. Eigenaar: ciiic-automator TODO #6. [Volledig bewijs en providerroute](../reports/brevo-rbl-status-2026-10-19.md).

Goed gedaan: met Jaaps mandaat Brevo-support inschakelen (mailbox.org-ticket 8785440 verwijst naar verzendprovider), daarna afzonderlijk afgesproken hertest. Apart besluit: clicktracking op de magic link uitschakelen. Geen supportbericht, testmail of betaalde wijziging zonder mandaat.

Klaar als: providerroute en clicktrackingbesluit in `done/decisions.md`, geautoriseerde hertest als `delivered` met sender-IP in Brevo-eventlog.

## Recently done

- 2026-10-21, PR #10 (`122842a`): Brevo-delta-tool (`consent-delta-import.mjs`: dry-run, go-no-go, apply, event-log) onafhankelijk gereviewd en gemerged; één allowlist-fix. 84 tests groen. #9 blijft open tot go/no-go 26 oktober en delta 28 oktober.
- 2026-10-21, PR #9: Brevo-baseline op productie geleverd (lijst 20, 2.163 writes, read-back schoon, 0 mail in venster; idempotentie zie rapport); diff-akkoord en churn-marge in `done/decisions.md`; migratiebriefings van 8 en 19 oktober met bewijs gesloten; lijst-ID en delta 28 oktober naar ciiic-nieuwsbrief. #7 naar `done/register.md`. Timeout-fix in `consent-preflight.mjs`.
- 2026-10-19, PR #8 (`ce23937`): importtool onafhankelijk gereviewd, drie guards hersteld; 70 tests groen. Codegereed, TODO #7 blijft open voor akkoord en productie-import.
- 2026-10-19, PR #7 (`e32df11`): Brevo-grondslagbesluit, definitieve dry-run en RBL-logmeting gereviewd; RBL-briefing geleverd. TODO #7/#6 blijven open; importtool gebrieft.
- 2026-10-15 — suppressieboekhouding editiecontract: `byLanguage`-tellers, `removedByAutomator`, suppressies overleven een snapshotverversing; afspraak in runbook § Editiecontract punt 5. Briefing beantwoord en gesloten.
