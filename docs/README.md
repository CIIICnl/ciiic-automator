# docs/ — kaart

```
docs/
  plans/                       verandering: wat er nog moet gebeuren
    TODO.md                    hét nu-document: claimbord + open werk + recently done
    HANDOFF.md                 wegwerp-opdracht voor de eerstvolgende sessie
    briefs/<slug>.md           uitvoeringsklare briefs (te groot voor een TODO-item)
    done/                      afgeronde briefs + register.md + decisions.md
    _reconcile/drift-log.md    housekeeping-ledger: driftsignalen en audit-teller
  reference/                   hoe het werkt: recon, bronanalyses, vaste feiten
```

Verandering hoort in `plans/`, beschrijving van wat ís in `reference/`. Mengt een document beide, dan splits je het. De werkwijze zelf staat in de skill `werkwijze` (`~/.claude/skills/werkwijze`); hier staan alleen de repo-specifieke documenten.

Achtergrond over de applicatie zelf (routes, state machine, bekende sync-gaten) staat niet hier maar in de CIIIC-KB: `../../CIIIC-KB/applications/relaybot.md`.
