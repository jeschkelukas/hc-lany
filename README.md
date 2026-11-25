# HC Lány – stats widgets from GameStats

Every 30 minutes a GitHub Action pulls the BNB Cup data from GameStats
(https://mini.gamestats.cz/i/bnb-cup), builds small HTML widgets for HC Lány and
publishes them on GitHub Pages. The club website (https://hclany.estranky.cz/) embeds
them with an `<iframe>`, so the pages there never need manual updates.

## Widgets

| Widget | URL | Iframe height |
| --- | --- | --- |
| Canadian scoring (HC Lány players) | https://jeschkelukas.github.io/hc-lany/bodovani/ | 1180 |
| League standings (HC Lány's league) | https://jeschkelukas.github.io/hc-lany/tabulka/ | 400 |
| HC Lány match schedule | https://jeschkelukas.github.io/hc-lany/rozpis/ | 720 |
| Homepage overview | https://jeschkelukas.github.io/hc-lany/prehled/ | 540 |

Embed snippet (change `src` and `height` per widget):

```html
<iframe src="https://jeschkelukas.github.io/hc-lany/rozpis/" width="100%" height="720" scrolling="no" style="border:0;overflow:hidden" loading="lazy" title="Rozpis utkání HC Lány"></iframe>
```

The widget text is in Czech, because it is shown on the club's Czech website.

The exact HTML pasted into each page of the club website is kept in `embeds/`
(`uvod.html` for the homepage intro box, one file per article), as a backup.

## What each widget shows

- **Canadian scoring** – team totals strip (scorers, goals, assists, points), an
  accent-insensitive player search, and every HC Lány scorer from GameStats with a photo thumbnail,
  plus the rest of the roster with zero points (silhouette instead of a photo).
  Tied players share a rank (dense ranking). Stat columns are sortable by click.
- **League standings** – the league table with team logos (a coloured shield with the
  initial when a team has no logo) and the HC Lány row highlighted. Sortable by click.
- **Homepage overview** – next match card with a countdown, last result with the
  recent form, mini standings and the top scorers, styled to match the dark-blue intro
  box on the club homepage. Links lead to the full article pages.
- **Match schedule** – all rounds including bye weeks (shown with their Monday–Sunday
  week), moved matches with the original date struck through, results with a
  win/draw/loss badge and the next match highlighted. Clicking a result opens the match
  detail (score, logos, date and every HC Lány scorer's goals and assists) inside the same
  iframe; a match without a detail page falls back to the club's match report.

## Phones

The club website shows the widgets in fixed-height iframes, and the same height applies on
phones. So the phone layouts (iframe narrower than 600 px) drop detail instead of stacking
rows, and every widget fits its recommended iframe height from 340 px wide up:

- **Schedule** – date and time merge into one compact column (`16.11. 21:45`), team logos
  are hidden, long team names are shortened with an ellipsis, the win/draw/loss badges are
  smaller with a gap before the away team, and the "další" badge is left out (the
  highlighted row still marks the next match).
- **Standings** – the VP, R and PP columns are hidden.
- **Scoring and standings** – tighter cell and header padding.
- **Homepage overview** – keeps both columns; goals+assists, games played and the form
  strip are hidden.

## Data sources

- GameStats `/stats`, the overview page and `/schedule` – scoring, standings, kick-off
  times and results. Logos and player photos are copied into the site and photos are
  shrunk to thumbnails with ImageMagick (installed in the workflow).
- Club website homepage and BNB Cup category – match reports. A report is matched to a
  match by the score in its title (`HC Lány - <opponent> x : y`, HC Lány goals first),
  the opponent name and a publish date within 30 days after the match.

- GameStats player pages ("Přehled zápasů") – each HC Lány scorer's goals and assists
  per match, combined into the match detail pages (`zapas/<date>-<opponent>/`) that the
  schedule and the homepage overview link to.

## Network use

Visitors never contact GameStats: the widgets are static pages with the data built in. The
build itself keeps its downloads small:

- Logos and player photos are cached as thumbnails in `data/images/` (GameStats upload names
  are content hashes), so only new or changed images are downloaded.
- Player pages are fetched only for players whose season line (games, goals, assists,
  points) changed since the snapshot; the rest of the per-match points come from
  `data/snapshot.json`.
- Each run still reads the three small GameStats pages (stats, overview, schedule) and the
  club website's article lists, which are needed to notice any change at all.

## Backups and safeguards

- Every build saves the downloaded data (player stats, standings, schedule and per-match
  scorers) to `data/snapshot.json` plus a dated copy `data/archive/YYYY-MM-DD.json` (the
  day's latest state). The archive folder keeps the last 30 days; older days are deleted
  from it but stay in git history. The workflow commits the data whenever it changes, so
  the git history holds every state.
- Within one season, points, played matches and recorded scorers never go down. If a fresh
  download comes back thinner than the snapshot (a GameStats glitch, an empty page), the
  build keeps the archived data for that part and logs a warning. Per match, the list with
  more recorded goals and assists wins. A new season (different league label) starts fresh.
- If GameStats cannot be read or parsed at all, the build fails and GitHub Pages keeps
  serving the previous version. If the club website is down, the schedule is published
  without report links.

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
