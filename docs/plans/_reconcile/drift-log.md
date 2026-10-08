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

## Laatste diepe audit

Nog geen. Repo aangesloten op de werkwijze op 2026-09-10 via `/workflow-init`; dat telt als nulpunt, niet als audit.

## Nudges-teller

Merges sinds laatste audit: 3
