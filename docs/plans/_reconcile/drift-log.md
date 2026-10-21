# Drift-log — ciiic-automator

Housekeeping-ledger. `merge-housekeeping` schrijft hier signalen bij; `reorg-audit` verwerkt ze en reset de teller. Drempel voor een audit: ≥ 5 open signalen, of één `[CONFLICT]`, of ≥ 10 merges sinds de laatste audit.

## Open signalen

_(geen)_

## Log

### 2026-10-06 — PR #2 (merge `5350d42`)

Gesloten: TODO 3 en 4. Brief `brevo-consent-preparation.md` naar `done/`. TODO 1 en 2 waren ongelabeld en kregen `[workhorse]`. Signalen: één `[STALE-PLAN]` (hierboven). Geen `[CONFLICT]`, geen `[DONE?]`, claimbord leeg, `repo-hygiene check` schoon, TODO.md 3 items / ~4 KB, ruim onder budget. Drempel: 1 open signaal, 1 merge sinds nulpunt, niet gehaald.

### 2026-10-06 — TODO 1 (docs, geen PR)

Gesloten: TODO 1. De `[STALE-PLAN]` over TODO 1 is daarmee opgelost en weg. Nieuw: TODO 6 (deliverability, beslissing Jaap). Geen nieuwe signalen.

### 2026-10-08 — PR #4 (merge `d098761`)

Gesloten: TODO 2 (register + write-up). Recently done teruggebracht naar vijf regels. Geen restwerk zonder adres: de scan-controle van 9 okt staat in de handoff. PR #3 (`e57d7be`, briefing LANGUAGE, geen TODO-item) kreeg geen eigen log-entry; nu meegeteld. Claimbord leeg, `repo-hygiene check` schoon, TODO.md 2 items, ruim onder budget. Geen `[CONFLICT]`. Drempel: 0 open signalen, 3 merges sinds nulpunt, niet gehaald.

### 2026-10-11 — PR #5 (merge `84c30e7`) en PR #6 (merge `fe9f3ea`)

Gesloten: TODO 8 (register + write-up; briefing editieboekhouding-contract gesloten met bewijs, terugmeldbriefing naar ciiic-nieuwsbrief gepubliceerd). PR #5 sluit geen item: TODO 7 blijft open tot Jaaps grondslagbesluit, tekst bijgewerkt; de review-fix `429d32c` is meegeleverd. Recently done op vijf regels. Restwerk met adres: baseline-import in TODO 7, activatie in TODO 5. Radar-nacontrole en de stale `NOTION_CONTACTEN_DS_IDS`-default blijven in het doorgeefblok van de handoff, zoals bij PR #4; geen eigen item (bijvangst). Claimbord leeg, `repo-hygiene check` schoon, TODO.md 3 items / ~4,9 KB. Geen `[CONFLICT]`, geen `[DONE?]`, `briefs/` leeg. Drempel: 0 open signalen, 5 merges sinds nulpunt (#2, #3, #4, #5, #6), niet gehaald.

### 2026-10-19 - PR #7 (merge `e32df11`)

Documentlevering voor TODO #7 en #6; beide blijven open, dus geen gesloten TODO-adres. RBL-briefing met bewijs geleverd, migratiebriefings ongeleverd. Brief `brevo-baseline-import.md` blijft actief bij #7. Recently done op vijf regels; nieuwe lange TODO-teksten ingekort met verwijzingen naar rapport en brief. Claimbord leeg, repo-hygiene 0 artefacten, geen nieuwe signalen. Drempel: 0 open signalen, geen conflict, 6 merges sinds nulpunt; niet gehaald.

### 2026-10-19 - PR #8 (merge `ce23937`)

Codegedeelte van TODO #7 geleverd; item blijft open voor diff-akkoord en productie-import. Claimbord leeg, uitvoerbrief bewust actief, write-up in `done/2026-10.md`; geen gesloten TODO-adres. Recently done vijf regels. Repo-hygiene schoon (0 artefacten), geen nieuwe signalen. Drempel: 0 open signalen, geen conflict, 7 merges sinds nulpunt; niet gehaald.

### 2026-10-21 - PR #9 (merge `e064f46`) en PR #10 (merge `122842a`)

PR #9 kreeg op 21 oktober geen eigen log-entry; nu meegeteld (TODO #7 gesloten met register + write-up, #9 en #10 geopend). PR #10 levert het codedeel van TODO #9; item blijft open tot go/no-go en delta, dus geen gesloten TODO-adres. Brief `brevo-delta-import.md` bewust actief. TODO #10 bijgewerkt (delta-CLI heeft de allowlist al). Claimbord leeg, Recently done vijf regels, repo-hygiene schoon, TODO.md 4 items / 5,4 KB. Briefing consent-scope-en-eventlijst (ciiic-nieuwsbrief, 21 okt) open en niet geraakt door deze merge. Geen `[CONFLICT]`, geen `[DONE?]`. Drempel: 0 open signalen, 9 merges sinds nulpunt; niet gehaald.

## Laatste diepe audit

Nog geen. Repo aangesloten op de werkwijze op 2026-09-10 via `/workflow-init`; dat telt als nulpunt, niet als audit.

## Nudges-teller

Merges sinds laatste audit: 9
