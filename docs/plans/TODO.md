# TODO — ciiic-automator

Leeswijzer in het kort (volledig: skill `werkwijze`): _In progress_ is een claimbord, max 3 claims, leeg is de goede staat. _Open werk_ staat top-down op prioriteit; nummers zijn vaste adressen. Eén item is ≤ ~12 regels en draagt een toetsbaar "klaar als" — heb je meer nodig, schrijf dan een brief in `briefs/` en laat het item ernaar verwijzen. Budget: **< 300 regels** (kleine repo). Geshipt werk verdwijnt hier: één regel in _Recently done_, write-up naar `done/`, nummer naar `done/register.md`.

## In progress

_(leeg)_

## Open werk

### 2. De uitgezette Radar-bronnen beslissen

**[workhorse] [delegeerbaar]** Zes bronnen hangen achter een `RADAR_ENABLE_*`-vlag (`immersivewire`, `springer-vr`, `nature-heritage`, `eurekalert`, `uploadvr`) en staan daarmee de facto uit. De recon zegt waarom: Springer en Nature blokkeren server-side fetch (`reference/radar-fase2-recon-2026-07-09.md`). Dat is een besluit dat niemand genomen heeft, geen configuratie.

Klaar als: elke vlag is óf in de Coolify-env van `relaybot` gezet, óf de bron is uit `src/services/radar/config.js` verwijderd; het besluit per bron staat in één regel in `done/decisions.md`.

### 5. Brevo-productiegebruik mist nog geverifieerd bevestigingsbewijs en consumerkoppelingen

**[flagship-review]** (toestemming en migratie; apart uitvoeringsmandaat). De voorbereiding van #4 bevestigt geen DOI zonder autoritatief bewijs. Goed gedaan: werkende, bewezen koppeling van echte providerbevestiging naar het register, getekende Forms-feeds (ook de live Form43/feed7), daarna pas `CIIIC_CONSENT_ROUTE=enabled`, duurzame registerconfiguratie, reconciliation vóór T0 en nieuwsbriefboekhouding. [Runbook](../reference/ciiic-consent-preparation.md) beschrijft de poorten.

Klaar als: afzonderlijk geautoriseerde activatie bewijst de hele DOI-keten en geplande reconciliation; consumercontracten zijn geleverd. Een baseline-import, cutover of echte verzending blijft een apart besluit op een concreet gecontroleerd diff.

### 6. Brevo-mail uit de bot strandt bij ontvangers die SpamCop gebruiken

**[workhorse] [beslissing Jaap]** De smoke test van 6 oktober (#1) vond twee dingen in de Brevo-transactiemail, die álle botmail raken (draft-resume, eventbevestigingen). (a) Het gedeelde Brevo-IP `77.32.148.23` stond op SpamCop; mailbox.org weigerde de mail aan jaap@jaapstronks.nl met `554 5.7.1 ... blocked by RBL` (softBounce in de Brevo-eventlog), terwijl Gmail en M365 hem wel afleverden. `POST /draft/save` geeft dan gewoon `ok: true` terug: de gebruiker wacht op een mail die nooit komt. (b) Brevo-clicktracking herschrijft de magic link naar `sendibt3.com`, dus de geheime draft-token gaat via Brevo's tracker.

Goed gedaan: Jaap kiest per punt. (a) afwachten en hertesten (SpamCop-listings verlopen vanzelf), een dedicated IP bij Brevo, of de bot via een andere verzender; (b) clicktracking voor transactiemail uitzetten in het Brevo-account (raakt ook de statistiek van andere botmails) of per mail een opt-out als Brevo die ondersteunt.

Klaar als: per punt een besluit in `done/decisions.md`, en een hertest naar een mailbox.org-adres staat als `delivered` in de Brevo-eventlog.

## Recently done

- 2026-10-06, #1 draft-resume in productie gerookt: `/data`-mount bestaat, save → mail → link → `GET /draft/:token` werkt; deliverability-bevinding werd #6. Write-up `done/2026-10.md`.
- 2026-10-06, PR #2 — #4 consentvoorbereiding: provideradapter, versleuteld register, reconciliation/preflight en getekende Forms-ingress, alles achter `CIIIC_CONSENT_ROUTE` (default uit = oud gedrag). Activatie is #5. Write-up `done/2026-10.md`.
- 2026-10-06, PR #2 — #3 regressietests: `npm test` met 46 tests over signing, register, migratie en routewiring; CI Node 20/22.
- 2026-09 — Draft-resume endpoints voor publicvalues.ciiic.nl (brief afgerond, zie `done/register.md`)
- 2026-09 — HMAC-signature op `/webhook/registration-status` (`ca39d36`)
- 2026-09 — Generieke newsletter-opt-in webhook voor Gravity Forms (`b86cabf`)
