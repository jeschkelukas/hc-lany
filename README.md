# HC Lány – statistiky z GameStats

Každou hodinu stáhne data BNB Cupu z GameStats (https://mini.gamestats.cz/i/bnb-cup)
a zveřejní widgety pro web klubu na GitHub Pages. Na webu jsou vložené přes `<iframe>`.

| Widget | Adresa |
| --- | --- |
| Kanadské bodování | https://jeschkelukas.github.io/lany-bodovani/bodovani/ |

- Soupiska (hráči, kteří se ukazují i s nulou): `ROSTER` v `src/scoring.js`.
- Nový widget: vlastní složka v `dist/` přes `write("<nazev>", html)` v `build.mjs`.
- Ruční aktualizace: Actions → Update stats → Run workflow.
- Lokálně: `node build.mjs` → `dist/`.
