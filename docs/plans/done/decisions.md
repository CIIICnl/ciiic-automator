# Beslissingen

Eén regel per genomen beslissing: datum, wat, waarom, en waar het effect zit. Nieuwe regels onderaan.

- **2026-09-10 — planning-docs staan in-repo, ook al is de repo publiek.** `CIIICnl/ciiic-automator` is een public repo; de werkwijze biedt voor OSS-repo's de optie om `docs/plans/` naar een private planning-sibling te symlinken. Bij het aansluiten op de werkwijze is gekozen voor in-repo, omdat er niets in de planning staat wat niet al uit de code te lezen is. Terugdraaien betekent: `docs/plans/` naar een private sibling verplaatsen, symlinken en gitignoren (deckyard-model).
- **2026-10-08 - Radar `springer-vr` aan.** Vanuit de productiebox gaf de feed op 8 okt echte RSS (20 items); de bot-challenge uit juli is daar weg, elders nog wisselvallig. `RADAR_ENABLE_SPRINGER=1` in de Coolify-env van `relaybot`.
- **2026-10-08 - Radar `nature-heritage` aan.** Feed werkt server-side (8 items), keyword-filter houdt de LLM-kosten laag. `RADAR_ENABLE_NATURE=1` in de Coolify-env van `relaybot`.
- **2026-10-08 - Radar `eurekalert-xr` verwijderd.** De feed-URL geeft 404; er is geen werkende vervanger. Uit `src/services/radar/config.js`.
- **2026-10-08 - Radar `immersive-wire` verwijderd.** Fetch werkt, maar de nummers zijn digests en de single-item-extractor dateerde verkeerd; een multi-event-extractor staat niet gepland. Bron, scanner en `rss`-methode uit de code.
- **2026-10-08 - Radar `uploadvr` verwijderd.** 60+ items per keer, sterke overlap met Road to VR (staat aan); alleen extra LLM-kosten. Uit `src/services/radar/config.js`.
