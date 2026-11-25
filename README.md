# HC Lány – stats widgets from GameStats

Every 30 minutes a GitHub Action pulls the BNB Cup data from GameStats
(https://mini.gamestats.cz/i/bnb-cup), builds small HTML widgets for HC Lány and
publishes them on GitHub Pages. The club website (https://hclany.estranky.cz/) embeds
them with an `<iframe>`, so the pages there never need manual updates.

## Widgets

| Widget | URL | Iframe height |
| --- | --- | --- |
| Canadian scoring (HC Lány players) | https://jeschkelukas.github.io/hc-lany/bodovani/ | 1060 |
| League standings (HC Lány's league) | https://jeschkelukas.github.io/hc-lany/tabulka/ | 400 |
| HC Lány match schedule | https://jeschkelukas.github.io/hc-lany/rozpis/ | 720 |

Embed snippet (change `src` and `height` per widget):

```html
<iframe src="https://jeschkelukas.github.io/hc-lany/rozpis/" width="100%" height="720" scrolling="no" style="border:0;overflow:hidden" loading="lazy" title="Rozpis utkání HC Lány"></iframe>
```

The widget text is in Czech, because it is shown on the club's Czech website.

## What each widget shows

- **Canadian scoring** – every HC Lány scorer from GameStats with a photo thumbnail,
  plus the rest of the roster with zero points (silhouette instead of a photo).
  Tied players share a rank (dense ranking). Stat columns are sortable by click.
- **League standings** – the league table with team logos (a coloured shield with the
  initial when a team has no logo) and the HC Lány row highlighted. Sortable by click.
- **Match schedule** – all rounds including bye weeks (shown with their Monday–Sunday
  week), moved matches with the original date struck through, results with a
  win/draw/loss badge and the next match highlighted. Results link to the match report
  on the club website.

## Data sources

- GameStats `/stats`, the overview page and `/schedule` – scoring, standings, kick-off
  times and results. Logos and player photos are copied into the site and photos are
  shrunk to thumbnails with ImageMagick (installed in the workflow).
- Club website homepage and BNB Cup category – match reports. A report is matched to a
  match by the score in its title (`HC Lány - <opponent> x : y`, HC Lány goals first),
  the opponent name and a publish date within 30 days after the match.

If GameStats cannot be read or parsed, the build fails and GitHub Pages keeps serving
the previous version. If the club website is down, the schedule is published without
report links.

## Manual data

GameStats does not know everything, so two lists live in the code and need an update
when they change:

- `ROSTER` in `src/scoring.js` – players listed even with zero points.
- `FIXTURES` in `src/schedule.js` – round numbers, bye weeks and originally planned
  kick-offs for the season. Actual dates and results still come from GameStats.

## Development

- Build locally: `node build.mjs` writes the widgets to `dist/`.
- Run the update now: Actions → Update stats → Run workflow.
- Add a widget: render it into its own folder with `write("<name>", html)` in
  `build.mjs`, so existing iframe URLs stay unchanged.
