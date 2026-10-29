# Brevo go/no-go van 29 oktober 2026

De go/no-go-check die voor maandag 26 oktober gepland stond is pas op donderdag 29 oktober gedraaid, de dag die als eerste senddatum was voorzien. De delta van 28 oktober is niet uitgevoerd. Jaap besloot in deze sessie dat de eerste verzending via Brevo pas over twee weken plaatsvindt (werkdatum donderdag 12 november, exacte datum in de terugkeer-check van `HANDOFF.md`). Daarmee is de uitkomst hieronder een tussenmeting, geen vrijgave: de delta volgt in de week van de send, na een vers Automations-attest.

## Hoe gedraaid

`scripts/consent-delta-import.mjs go-no-go` read-only in de productiecontainer `relaybot` (`m7z1z547ie42j0d60fy0tvxx-201417758739`) om 20:34Z, tegen de baseline-run `2026-10-21T11-01-06-771Z-dryrun.json` en het attest `2026-10-21T11-01-06-771Z-automations.json`, sleutel via stdin (1Password, nooit in env of git). Jaap draaide het commando zelf vanuit de sessie, omdat de permissieclassifier de productie-read vanuit de agent weigerde. Een tweede run met `--max-age-days 10` strandde op de ssh-timeout van vijf minuten; die zou alleen de attestblokkade hebben weggenomen en voegt niets toe aan de cijfers.

## Uitkomst

| Controle | Uitkomst |
| --- | --- |
| `go` | **false**, één blokkade: "Automation evidence missing or older than 3 days" (attest van 21 oktober, 8 dagen oud) |
| Waarschuwing | TODO #6 open: bezorging bij mailbox.org via Brevo niet bewezen |
| Lijst 20 `CIIIC nieuwsbrief` | 2.163 subscribers, gelijk aan de baseline |
| Delta sinds T0 `2026-10-21T11:01:06.771Z` | add 9 (allemaal nl), suppress 9 (6 unsubscribed, 3 cleaned), update 1 (firstName), hold 0, unchanged 2.617 |
| Suppressies op lijstleden | 9; alle 9 suppressies betreffen bestaande leden van lijst 20 |
| Effect na toepassing | leden 2.163 → 2.163 (9 erbij, 9 eraf), suppressies 464 → 473 |
| Bestaand Brevo-contact onder de adds | 0 |
| `destination.verified` | **true**; missingMembership 0, extraMembership 0, languageMismatch 0, firstNameMismatch 0, lastNameMismatch 0, missingSuppression 0, duplicateProviderIdentity 0, unexpectedSuppression 0, lostExistingBlock 0 |

Lezing: zonder de attestblokkade was dit een `go`. Er is geen bestemmingsdrift en geen Brevo-blacklist op een lijstlid (het bekende gedrag uit punt 4 van de handoff van 21 oktober deed zich niet voor). De mutaties liggen binnen de churn-marge van 21 oktober (hoogstens 10 kandidaten en 10 suppressies), maar de delta vraagt sowieso een eigen akkoordbestand op het concrete dry-run-diff.

## Wat dit betekent voor de planning

- **Send vandaag: nee.** Jaaps besluit van 29 oktober: eerste Brevo-verzending over twee weken. Vastgelegd in `../plans/done/decisions.md`.
- **Delta niet vandaag.** Zonder vers attest weigert `apply`; en een delta op 29 oktober zou op 11 november opnieuw moeten omdat Form43/feed7 en de automator tot de cutover op Mailchimp blijven schrijven. De delta draait dus één keer, op de dag vóór de send.
- **Werkplanning** (afgeleid uit "over twee weken", alleen de send is Jaaps datum): go/no-go maandag 9 november, delta woensdag 11 november, send donderdag 12 november. Procedure voor de delta staat in `HANDOFF.md` § Doorgeefblok.
- **TODO #6** blijft een open waarschuwing. De twee weken geven ruimte voor een supportbericht aan Brevo, maar alleen met expliciet mandaat.
- **Lijst 20 blijft tot de delta onvolledig**; ciiic-nieuwsbrief is gebrieft dat er vóór 12 november niets naar lijst 20 gaat (`2026-10-29--from-ciiic-automator--to-ciiic-nieuwsbrief--brevo-send-verschoven.md`).

## Bewijs

Volledige JSON-uitvoer in de sessie van 29 oktober (geen adressen; alleen tellers). Het register op het volume `/data/consent/migration` in de container is niet gewijzigd: `go-no-go` schrijft niets.
