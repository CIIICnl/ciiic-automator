# Brevo-bezorgstatus: meting van 19 oktober 2026

Herstel bij mailbox.org is onbekend. De meting bewijst eerdere afwijzingen, geen actuele blokkade op 19 oktober. Technisch eigenaar blijft ciiic-automator TODO #6.

| Selectie | Bewijs |
| --- | --- |
| Betrokken mailbox.org-adres, 30 september t/m 19 oktober | Vier events: twee requests en twee softBounces; geen nieuwere poging na 6 oktober en geen delivered. |
| 30 september 12:46:14 CEST | `77.32.148.23`, `554 5.7.1 ... blocked by RBL`; message-ID `<202609301046.89369113175@smtp-relay.mailin.fr>`. |
| 6 oktober 20:26:48 CEST | Zelfde IP en RBL-afwijzing; message-ID `<202610061826.46945727382@smtp-relay.mailin.fr>`. |
| Globale softBounce-selectie 7 t/m 19 oktober | Eén event op 7 oktober 14:55:05 CEST bij hr.nl, hetzelfde IP geweigerd door `hostkarma.junkemailfilter.com`. |
| Recente afleveringen via `77.32.148.24` | Bewijzen geen mailbox.org-herstel of delisting van `.23`. |

De adresselectie en softBounce-selectie bleven onder hun paginagrens van 100. De recente afleveringen zijn een steekproef van 100 events, geen volledige periode-audit. De bronmeting gebruikte alleen Brevo-GETs via dev-server-1; geen mail verstuurd. Ruwe responsen met adressen staan buiten git.

Bron: `jaap-work/docs/reports/brevo-rbl-status-2026-10-19.md`, gelezen uit `origin/main`, en briefing `2026-10-19--from-jaap-work--to-ciiic-automator--brevo-rbl-logmeting-en-providerroute.md` (voor deze administratieve terugmelding tier `workhorse`: bewijs verwerken, geen providerwijziging).

mailbox.org-ticket 8785440, antwoord 12 oktober: verzendprovider moet reputatie onderzoeken en zo nodig delisting aanvragen; geen concrete allowlist-oplossing. Aanbevolen route: Jaap autoriseert Brevo-support met bovenstaande bounce/message-ID's, daarna afzonderlijk een hertest met `delivered` en sender-IP als bewijs. Clicktracking op de magic link blijft een apart besluit in TODO #6. In deze sessie geen supportcorrespondentie, testmail of betaalde wijziging.
