# HC Lány – statistiky z GameStats

Každou hodinu stáhne data BNB Cupu z GameStats (https://mini.gamestats.cz/i/bnb-cup)
a zveřejní widgety pro web klubu na GitHub Pages. Na webu jsou vložené přes `<iframe>`.

| Widget | Adresa |
| --- | --- |
| Kanadské bodování | https://jeschkelukas.github.io/lany-bodovani/bodovani/ |
| Tabulka soutěže (liga HC Lány) | https://jeschkelukas.github.io/lany-bodovani/tabulka/ |
| Rozpis utkání HC Lány | https://jeschkelukas.github.io/lany-bodovani/rozpis/ |

- Soupiska (hráči, kteří se ukazují i s nulou): `ROSTER` v `src/scoring.js`.
- Rozlosování (kola, volná kola, původní termíny): `FIXTURES` v `src/schedule.js`; termíny a výsledky se berou živě z GameStats.
- Výsledky v rozpisu odkazují na články o zápasech z rubriky BNB Cup na webu klubu (`src/reports.js`): párují se podle skóre, soupeře a data vydání (do 30 dnů po zápase).
- Nový widget: vlastní složka v `dist/` přes `write("<nazev>", html)` v `build.mjs`.
- Ruční aktualizace: Actions → Update stats → Run workflow.
- Lokálně: `node build.mjs` → `dist/`.
