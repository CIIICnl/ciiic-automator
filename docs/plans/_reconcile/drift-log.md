# Drift-log — ciiic-automator

Housekeeping-ledger. `merge-housekeeping` schrijft hier signalen bij; `reorg-audit` verwerkt ze en reset de teller. Drempel voor een audit: ≥ 5 open signalen, of één `[CONFLICT]`, of ≥ 10 merges sinds de laatste audit.

## Open signalen

- **[STALE-PLAN]** TODO 1 verwijst naar `done/draft-resume-endpoints.md` als brief, maar de smoke test uit die brief is nooit gedaan: de brief leest als afgerond terwijl het item open staat. Lost op zodra TODO 1 geleverd is. (2026-10-06, PR #2)

## Log

### 2026-10-06 — PR #2 (merge `5350d42`)

Gesloten: TODO 3 en 4. Brief `brevo-consent-preparation.md` naar `done/`. TODO 1 en 2 waren ongelabeld en kregen `[workhorse]`. Signalen: één `[STALE-PLAN]` (hierboven). Geen `[CONFLICT]`, geen `[DONE?]`, claimbord leeg, `repo-hygiene check` schoon, TODO.md 3 items / ~4 KB, ruim onder budget. Drempel: 1 open signaal, 1 merge sinds nulpunt, niet gehaald.

## Laatste diepe audit

Nog geen. Repo aangesloten op de werkwijze op 2026-09-10 via `/workflow-init`; dat telt als nulpunt, niet als audit.

## Nudges-teller

Merges sinds laatste audit: 1
