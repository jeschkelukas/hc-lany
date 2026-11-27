# HC Lány – stats widgets from GameStats

Every 15 minutes (started by cron-job.org, see [Schedule](#schedule)) a GitHub Action checks the BNB Cup data from GameStats
(https://mini.gamestats.cz/i/bnb-cup), builds small HTML widgets for HC Lány and
publishes them on GitHub Pages. The club website (https://hclany.estranky.cz/) embeds
them with an `<iframe>`, so the pages there never need manual updates.

The repository also keeps the HTML pasted into the club website (`embeds/`), including the
hand-written committee page with photos (see [Committee page](#committee-page)).

## Widgets

| Widget | URL | Iframe height |
| --- | --- | --- |
| Player scoring (HC Lány points leaders) | https://jeschkelukas.github.io/hc-lany/bodovani/ | 1320 |
| League standings (HC Lány's league) | https://jeschkelukas.github.io/hc-lany/tabulka/ | 400 |
| HC Lány schedule | https://jeschkelukas.github.io/hc-lany/rozpis/ | 940 |
| Homepage overview | https://jeschkelukas.github.io/hc-lany/prehled/ | 670 |

Embed snippet (change `src` and `height` per widget):

```html
<iframe src="https://jeschkelukas.github.io/hc-lany/rozpis/" width="100%" height="940" scrolling="no" style="border:0;overflow:hidden" loading="lazy" title="Rozpis utkání HC Lány"></iframe>
```

The widget text is in Czech, because it is shown on the club's Czech website.

The exact HTML pasted into each page of the club website is kept in `embeds/` as a backup:

| File | Club website page |
| --- | --- |
| `uvod.html` | Homepage intro box (welcome text + overview iframe) |
| `bodovani.html` | Kanadské bodování 2026/2027 |
| `tabulka.html` | Tabulka soutěže 2026/2027 |
| `rozpis.html` | Rozpis utkání 2026/2027 |
| `vybor.html` | Výbor HC Lány (pasted directly, no iframe) |

## What each widget shows

- **Player scoring** (Czech *kanadské bodování*: points = goals + assists, as in the NHL
  scoring leaders) – team totals strip (scorers, goals, assists, points), an
  accent-insensitive player search, and the whole roster with jersey numbers and photo thumbnails: scorers first,
  then players without a point, most games played first. A player who has not played yet
  shows dashes instead of zeros and no rank. Tied players share a rank (dense ranking). Stat columns are
  sortable by click. Goalies (position "Brankář" on their GameStats page) are not ranked
  with the skaters but get their own table below it, with the usual goalie line as far as
  GameStats allows: games (Z), wins/ties/losses (V/R/P, hidden on phones), goals against
  (OG), goals-against average (Ø) and shutouts (ČK). A goalie is credited with every game his
  player page lists and with the team's result and goals against in it. GameStats records
  neither shots nor ice time, so there is no save percentage, and the average is per game
  (GA / GP) instead of the official GA × 60 / minutes, which is the same for whole games.
- **League standings** – the league table with team logos (a coloured shield with the
  initial when a team has no logo) and the HC Lány row highlighted. Sortable by click.
- **Homepage overview** – next game card with a countdown and both teams' recent form
  across the whole league (newest game on the left), the last result, the three games after
  the next one, mini standings and the top scorers (about 660 px, so the iframe is 670 px; a longer game detail
  opened from here scrolls inside the iframe), styled to match the dark-blue intro
  box on the club homepage. Links lead to the full article pages.
- **Schedule** – all rounds including bye weeks (shown with their Monday–Sunday
  week), moved games with the original date struck through, results with a
  win/tie/loss badge and the next game highlighted. Clicking a result opens the game
  detail (score, logos, date and every HC Lány scorer's goals and assists) inside the same
  iframe; a game without a detail page falls back to the club's game recap.
- **Game detail** (box score) – the scoring summary by period (time, team logo, running
  score, scorer and assists, HC Lány goals highlighted) from the GameStats admin, goals by
  period under the score and penalties when known (see
  [Hand-entered game extras](#hand-entered-game-extras)). HC Lány players (in the points
  table and in the timeline) link to their public GameStats page in a new tab. Opened from the homepage overview
  it uses the overview's dark colours (`?dark`). HC Lány players in the timeline (scorer and
  assists) have small photos, the points table has photos the size of the scoring table's;
  names are shown without jersey numbers. The timeline and the points table are always stacked. An
  11-goal game with 9 HC Lány scorers is about 910 px high, which is why the schedule
  iframe is 940 px (the schedule stretches its rows to fill it); in the overview iframe (670 px),
  on phones or for anything taller the detail scrolls inside its own page.

## Schedule

GitHub's own `schedule` trigger is best effort: in the first day and a half this repository
got 3 scheduled runs instead of about 60. The builds are therefore started from outside: a
cron-job.org job calls the GitHub API every 15 minutes (at :02, :17, :32 and :47,
Europe/Prague) to run the workflow, like *Run workflow* in the Actions tab.

Most of those runs stop after a quick check (`gate.mjs`, rules in `src/plan.js`): it reads only
the public GameStats schedule and the time of the last deploy (`build.json` on GitHub Pages),
without installing anything, building or deploying. The full build runs when

- a result is new or changed (so a finished game shows up within 15 minutes of being entered),
- a played game's timeline is due from the admin (see [GameStats login](#gamestats-login)),
- the last full build is an hour old (stats, standings, club articles and other changes), or
- the run was started by a push, or by *Run workflow* with *force* or *refresh_admin* ticked.

The log's `gate:` line says which one applied, or that the run was skipped.

- Request: `POST https://api.github.com/repos/jeschkelukas/hc-lany/actions/workflows/update.yml/dispatches`
  with the body `{"ref":"main"}` and the headers `Accept: application/vnd.github+json`,
  `X-GitHub-Api-Version: 2022-11-28` and `Authorization: Bearer <token>`; GitHub answers
  `204 No Content`.
- Token: a fine-grained personal access token limited to this repository with the single
  permission *Actions: Read and write*. It can only start workflows and read their runs, no
  code or secrets. It lives only in the cron-job.org job (failure e-mails after two failed
  calls); it expires on 25 Nov 2027, then generate a new one and paste it there. GitHub
  retires API version 2022-11-28 on 10 Mar 2028 (`Sunset` header), so when renewing the
  token also set `X-GitHub-Api-Version` to the current version.
- The workflow's own cron stays as a backup, hourly at :40, clear of the external runs. Runs
  queue instead of cancelling each other (`concurrency`), so a quick check never stops a build.

## Phones

The club website shows the widgets in fixed-height iframes, and the same height applies on
phones. So the phone layouts (iframe narrower than 600 px) drop detail instead of stacking
rows, and every widget fits its recommended iframe height from 340 px wide up:

- **Schedule** – date and time merge into one compact column (`16.11. 21:45`), team logos
  are hidden, long team names are shortened with an ellipsis, the win/tie/loss badges are
  smaller with a gap before the away team, and the "další" badge is left out (the
  highlighted row still marks the next game).
- **Standings** – the VP, R and PP columns (overtime/shootout wins, ties, overtime/shootout
  losses; OTW, T, OTL in NHL terms) are hidden.
- **Scoring and standings** – tighter cell and header padding.
- **Homepage overview** – keeps both columns; goals+assists, games played and the form
  strip are hidden.

## Data sources

- GameStats `/stats`, the overview page and `/schedule` – scoring, standings, start
  times and results. Logos and player photos are copied into the site and photos are
  shrunk to thumbnails with ImageMagick (installed in the workflow).
- Club website homepage and BNB Cup category – game recaps. A recap is paired with a
  game by the score in its title (`HC Lány - <opponent> x : y`, HC Lány goals first),
  the opponent name and a publish date within 30 days after the game.
- Public GameStats player pages (`/players/<id>`, no login) – for the whole roster: photo,
  jersey number, position, games played (also for players without a point) and each
  player's goals and assists per game ("Přehled zápasů"), combined into the game detail
  pages (`zapas/<date>-<opponent>/`) that the schedule and the homepage overview link to.
- GameStats admin (login, see [GameStats login](#gamestats-login)) – only the HC Lány
  roster with player ids and the game timelines.

## Network use

Visitors never contact GameStats: the widgets are static pages with the data built in. The
build itself keeps its downloads small:

- Logos and player photos are cached as thumbnails in `data/images/` (GameStats upload names
  are content hashes), so only new or changed images are downloaded.
- Player pages (about 30) are read only when something may have changed: a player's season
  line, a new result, a new roster from the admin, or the first build of the day (catches
  late lineup edits). Otherwise everything comes from `data/snapshot.json`.
- The admin login happens only after a game (once its result is in, then at most hourly on
  the game day and daily for two weeks while its timeline is incomplete), not on every run.
- A run without news reads just the GameStats schedule page and stops (see
  [Schedule](#schedule)). The full build, at most hourly unless a result changes, reads the
  three small GameStats pages (stats, overview, schedule) and the club website's article lists.

## Backups and safeguards

### What is backed up and where

Everything lives in the repository under `data/`, committed by the workflow itself
(commits named `data: snapshot <time>`), and only when something actually changed:

| Path | Content | Kept |
| --- | --- | --- |
| `data/snapshot.json` | Current state: HC Lány player stats (`scoring`), league table (`standings`), schedule with results (`schedule`), the roster from the admin (`rosterIds`), each roster player's public season line and photo (`roster`; goalies also the games they were listed in, `games`), every HC Lány scorer's goals and assists per game (`matchScorers`, keyed by start time), the game timelines from the admin (`matchTimelines`, keyed by the game detail slug, with `checkedAt` = last admin read) and the hand-entered goals by period and penalties (`matchExtras`, carried over by every build) | Always the latest |
| `data/archive/YYYY-MM-DD.json` | The same content as the day's last snapshot (Prague time) | Last 30 days in the folder |
| `data/images/logos/`, `data/images/photos/` | Team logos and player photos as small thumbnails, named after the GameStats upload | As long as GameStats uses them |

Days older than 30 are deleted from `data/archive/` but nothing is ever lost: the git
history of `data/snapshot.json` holds every state since the first build.

### Browsing and restoring

- Latest state: https://github.com/jeschkelukas/hc-lany/blob/main/data/snapshot.json
- A given day: https://github.com/jeschkelukas/hc-lany/tree/main/data/archive
- Anything older: the history of `data/snapshot.json`
  (https://github.com/jeschkelukas/hc-lany/commits/main/data/snapshot.json), or locally
  `git log -p -- data/snapshot.json`.
- To publish an older state again (for example after GameStats lost data mid-season), copy
  that version over `data/snapshot.json`, commit and push: the guards below then keep it
  until GameStats catches up.

### Safeguards

- Within one season, points, played games and recorded scorers never go down. If a fresh
  download comes back thinner than the snapshot (a GameStats glitch, an empty page), the
  build keeps the archived data for that part and logs a warning. Per game, the list with
  more recorded goals and assists wins. A new season (different league label) starts fresh.
- If GameStats cannot be read or parsed at all, the build fails and GitHub Pages keeps
  serving the previous version. If the club website is down, the schedule is published
  without recap links.
- The snapshot commit runs before the deploy and never blocks it; the keepalive job (which
  stops GitHub from disabling the schedule after 60 quiet days) runs after the deploy and
  may fail without affecting the widgets.
- Game detail links carry a build stamp (`?v=…`), so browsers always open the current
  detail instead of a copy GitHub Pages let them cache for 10 minutes.

## Committee page

`embeds/vybor.html` is the Výbor HC Lány article
(https://hclany.estranky.cz/clanky/vybor-hc-lany.html): one card per committee member with
a round photo, name and role. Unlike the widgets it is not built from GameStats and is
**pasted directly into the article** (editor → Source/HTML mode, replacing the whole
content), so it takes its natural height and wraps on phones.

- **Look** – the dark blue of the site's menu (`#1e3645`, `#315d7a`) with the jersey yellow
  (`#f5c518`) for the chairman and treasurer, light blue (`#4685bd`) for the members.
- **Markup** – inline styles only, because the estranky editor removes `<style>` blocks,
  and inline-block cards instead of flexbox, so they wrap even if the editor drops styles
  it does not know.
- **Photos** – members on the HC Lány roster use their GameStats photo (Aleš Lomberský,
  Radek Jirkovský). A photo for anyone else goes to `embeds/photos/` (cropped to the face
  only) and the build publishes it at `https://jeschkelukas.github.io/hc-lany/vybor/<file>`.
  Members without a photo show their initials.
- **Adding a photo** – crop it to a square around the face (no phone numbers or names from
  messenger screenshots), save it as `embeds/photos/<surname>-<name>.jpg`, replace that
  person's initials `<div>` in `vybor.html` with an `<img>` like the existing ones, push,
  and paste the updated HTML into the article again.
- The build also publishes the page itself at https://jeschkelukas.github.io/hc-lany/vybor/
  (useful as a preview, or as an iframe of about 470 px on desktop if ever needed).

## GameStats login

The game timelines and the team roster (player ids) are only in the GameStats admin, so the
build logs in with the HC Lány team manager account. Everything else is read from public
pages.

- **Credentials** – repository secrets `GAMESTATS_EMAIL` and `GAMESTATS_PASSWORD`
  (Settings → Secrets and variables → Actions). GitHub masks them in the logs and does not
  pass them to workflows started from forks. Without them the build skips the admin step and
  uses the last roster and timelines in the snapshot.
- **Read only** – the session is used only for GET requests to three admin pages: the team
  page (`/admin/teams/<team id>`), the team's games list and a game detail
  (`/admin/matches/<id>`). `adminGet` in `src/admin.js` refuses any other path, and nothing is
  ever submitted except the login and logout forms.
- **Logged out every time** – the logout runs in `finally`, so the session ends even when a
  page fails. Credentials, cookies and page contents are never logged; the log only says
  whether the login, the pages and the logout worked.
- **When** – right after a game's result appears (the quick check notices it within 15 minutes
  and starts the build). If the timeline is not complete yet (fewer goals than the score), it
  is read again at most once an hour on the game day, then once a day, and given up two weeks
  after the game; `checkedAt` in the snapshot is the time of the last read. Also once if the
  roster has never been read. After Old Stars (26 Nov 2026) the timeline was complete in the
  admin as soon as the result was public.
- **Forced refresh** – Actions → Update stats → Run workflow with *refresh_admin* ticked logs
  in even when nothing is missing and re-reads the roster and every played game's timeline
  (for example after a correction in GameStats).
- **Ids** – HC Lány team `1a15d2bb2b08bc10a5e78`, league 2. liga 2026/27
  `1a18c37f49aff03a5cd4e` (`TEAM_ID` in `src/scoring.js`, `LEAGUE_ID` in `src/admin.js`; the
  league id changes with a new season).

Goals by period: GameStats has no periods, its timeline clock runs through the whole game.
Without hand-entered periods the build estimates them from the goal times: the 1st period
ends at 17:00 and the 2nd at 30:00 (`PERIOD_ENDS` in `src/timeline.js`, fitted on the first
three games, where the club's reports gave the period scores and all three matched). The
estimate is used only when the timeline has every goal, and it is marked in the tooltip.

## Manual data

GameStats does not know everything, so a few things live in the code:

- `FIXTURES` in `src/schedule.js` – round numbers, bye weeks and originally planned
  start times for the season. Actual dates and results still come from GameStats.
- `EXHIBITIONS` in `src/schedule.js` – friendlies outside the league (e.g. Winter Classic
  in Dobříš), which GameStats does not have. They sit in the schedule by date on a light-blue
  row without a round: the date (with a map link to the venue) takes the round, date and
  time columns, the teams stay in their columns and the label sits in the result column
  until there is a score (linked to the club's article when `article` is set); a date
  without a time shows the booked ice time (`ice`) or "čas upřesníme". Add the time and,
  after the game, `score` by hand. They get no game detail and count in no statistics.
- `ROSTER` in `src/scoring.js` – names and GameStats ids of the roster, used only until the
  build has read the roster from the admin (then `rosterIds` in the snapshot is used).

## Hand-entered game extras

GameStats has no goals by period or penalties, so they are typed into the `matchExtras`
section of `data/snapshot.json` (whenever they are known, also later for older games).
Every build carries that section over into the new snapshot unchanged, so it is kept in the
daily archive and git history like the rest of the data. The values are shown on the game
detail under the score, e.g. `(1:1, 1:0, 3:1)` and `Vyloučení 2:4`.

The key is the game detail slug (`<date>-<opponent>`, see the `zapas/` URLs) and the values
use the club's own notation, **HC Lány first**, at home or away; the build turns them into
home:away. It warns in the log when the periods do not add up to the final score.

```json
"matchExtras": {
  "2026-11-16-sykorice": { "periods": ["1:1", "0:1", "1:3"], "penalties": "4:2" }
}
```

Either field may be left out when it is not known. Hand-entered periods win over the
estimate from the timeline (see [GameStats login](#gamestats-login)); with them, the timeline
on the game detail is also split into periods by the club's numbers. Pull first (`git pull --rebase`): the
workflow commits the snapshot regularly.

## Development

- Build locally: `node build.mjs` writes the widgets to `dist/`.
- Run the update now: Actions → Update stats → Run workflow.
- Add a widget: render it into its own folder with `write("<name>", html)` in
  `build.mjs`, so existing iframe URLs stay unchanged.
