# Kanadské bodování HC Lány

Každou hodinu stáhne statistiky BNB Cupu z GameStats
(https://mini.gamestats.cz/i/bnb-cup/stats), vybere hráče HC Lány a zveřejní
tabulku na GitHub Pages. Na webu klubu je vložená přes `<iframe>`.

- Soupiska (hráči, kteří se ukazují i s nulou): `ROSTER` v `src/scoring.js`.
- Ruční aktualizace: Actions → Update scoring → Run workflow.
- Lokálně: `node build.mjs` → `dist/index.html`.
