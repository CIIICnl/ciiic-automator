# Uitvoersessie — draft-resume in productie roken

Model: **Opus**

## Stand bij vertrek

2026-09-10, avond. `main` staat op de merge van `chore/workflow-init`: deze repo is aangesloten op de universele werkwijze (`docs/plans/`, werkwijze-blok in `CLAUDE.md`). Geen open PR's, claimbord leeg, geen open `_meta`-briefings voor deze repo. De laatste inhoudelijke commit is `b86cabf` (generieke newsletter-opt-in webhook).

## Opdracht

1. Claim TODO-item 1 in `docs/plans/TODO.md` (regel in _In progress_: item — @mbp — branch — klaar als).
2. Roek de draft-resume-keten in productie af, tegen de klaar-als van dat item: `https://bot.ciiic.nl/health` moet `drafts.success: true` geven, een testsave moet de count met één verhogen, en de resume-mail moet in de inbox landen bij Gmail, Outlook én een ciiic.nl-adres. Achtergrond en de oorspronkelijke briefing: `docs/plans/done/draft-resume-endpoints.md`.
3. Controleer daarbij dat het `/data`-volume op de Coolify-app `relaybot` echt gemount is (skill `ciiic-coolify`), want zonder mount loopt de SQLite bij elke redeploy leeg — dat is dezelfde bevinding, niet een tweede item.
4. Landt er een mail in spam of blijkt het volume te ontbreken: dat is een fix binnen scope, op een branch, met een PR. Blijkt alles goed, dan is er geen code-wijziging — vink het item af en zet de bevinding in één regel in `done/register.md`.
5. Vondsten buiten scope worden geen extra wijzigingen: noteer ze onderaan de PR-beschrijving, of als nieuw TODO-item met eigen klaar-als.
6. **Overschrijf dit bestand** met de opdracht voor de volgende sessie voordat je afsluit, en sluit je antwoord af met de sluitregel (`/handoff` + sessiesoort + model). Opende je een PR, dan is de volgende sessie de review-en-merge van díe PR, op Fable.

## Doorgeefblok

- TODO-item 2 (uitgezette Radar-bronnen beslissen) wacht op een beslisronde, niet op uitvoer — dat is Fable-werk zodra item 1 rond is.

## Terugkeer-check

_(leeg)_

## Extra van Jaap

_(leeg)_
