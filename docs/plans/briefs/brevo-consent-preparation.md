# CIIIC-consent en Brevo-migratievoorbereiding

Tier: `flagship-review`. Bron: `_meta/briefings/open/2026-10-06--from-jaap-work--to-ciiic-automator--brevo-consent-en-migratievoorbereiding.md`.

## Wat is er aan de hand

Jaarevent, SXSW en de generieke nieuwsbriefroute gebruiken eigen subscriberlogica. Het gedeelde contract voor toestemming, taalkeuze en suppressies ontbreekt; daardoor kan een migratie oude afmeldingen of voorkeuren verliezen.

## Principe en contract

Eén actieve CIIIC-ontvanger krijgt één taal. Voorkeur wijzigen verandert geen toestemming. Afmelden blijft afmelden bij retry, import en rollback. Het [goedgekeurde hubplan](https://github.com/CIIICnl/jaap-work/blob/48e729a3ca5b4d9e68a3eba2c31509733bd1fd2d/docs/plans/briefs/brevo-migratie-taalvoorkeur-2026-10-06.md), secties 2–6, is het uitvoeringscontract. PR7 is gemerged als `714665b`; de oorspronkelijke meta-briefing is met bewijs geleverd op 6 oktober 2026.

## Levering

1. Eén CIIIC-provideradapter, standaard Mailchimp, met canoniek nl/en en double opt-in. IX Labs en eventstatus blijven afzonderlijk.
2. Duurzaam versleuteld consent-/suppressieregister, geauthenticeerde marketingcallbacks, idempotentie, voorkeurvolgorde en read-only bronreconciliation.
3. Deterministische migratiepreflight met statusmapping, quarantaine, geaggregeerd batchbewijs en beveiligde tijdelijke exports. Baseline-import ontwerpen met suppressies eerst, afzonderlijk mandaat, uitgeschakelde automations en volledige read-back; geen echte import uitvoeren.
4. Wijzigingsdelta vanaf T0, bevroren taalkeuze per editie en provideronafhankelijke verzendingboekhouding voor retry/rollback voorbereiden.
5. Tests voor de synthetische acceptatiematrix, authenticatie, herhaling, onzekere provideruitkomst en suppressiebehoud. PR opleveren voor afzonderlijke flagship-review.

## Live bindingscontrole

Op 6 oktober 2026 zijn uitsluitend GETs uitgevoerd op Coolify en Mailchimp. Coolify-app `relaybot` (`m7z1z547ie42j0d60fy0tvxx`, `https://bot.ciiic.nl`, branch `main`) heeft productievariabele `MAILCHIMP_JAAREVENT_LIST_ID=0e404ef800`; `MAILCHIMP_CIIIC_LIST_ID` ontbreekt, dus daarvoor geldt de CIIIC-code-default. Mailchimp `GET /lists/67fe159b9d` geeft naam `CIIIC`, eigenaar/company `CIIIC`; `GET /lists/0e404ef800` geeft `CIIIC jaarevent`, eigenaar/company `CIIIC`. De oude jaarevent-code-default `67fe159b9d` is dus fout; de live override is correct. Alleen deze niet-persoonlijke bindingsgegevens zijn bewaard.

## Buiten scope

Geen bulkimport, accountconfiguratie, productiecutover, echte verzending, nieuw abonnement of klantcommunicatie. De code wordt op een PR aangeboden; productievoorwaarden staan in het bijbehorende runbook.
