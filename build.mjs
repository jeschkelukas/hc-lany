import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { GOALIE, ROSTER, SOURCE, TEAM, TEAM_ID, buildGoalies, buildTable, parseTeamScoring, playerUrl, renderPage } from "./src/scoring.js";
import { STANDINGS_SOURCE, parseStandings, renderStandings } from "./src/standings.js";
import { SCHEDULE_SOURCE, SEASON_START, buildRounds, parseLeagueMatches, parseSchedule, renderSchedule } from "./src/schedule.js";
import { matchSlug, playerMatchesFromArchive, renderMatch, scorersByMatch } from "./src/matches.js";
import { fetchPlayerPages } from "./src/roster.js";
import { fetchAdminData } from "./src/admin.js";
import { goalsOf, periodsFromTimeline } from "./src/timeline.js";
import { timelineDue } from "./src/plan.js";
import { fetchReports } from "./src/reports.js";
import { extrasFor } from "./src/extras.js";
import { renderOverview } from "./src/overview.js";
import { slug } from "./src/page.js";
import { guardSchedule, guardScoring, guardStandings, loadSnapshot, mergeMatchScorers, pragueDate, saveSnapshot } from "./src/snapshot.js";

// Each widget gets its own folder so its iframe URL stays stable when more widgets are added.
const write = (path, html) => {
  mkdirSync(`dist/${path}`, { recursive: true });
  writeFileSync(`dist/${path}/index.html`, html);
};

const download = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
};

const updatedAt = new Date();
const [statsHtml, overviewHtml, scheduleHtml] = await Promise.all([SOURCE, STANDINGS_SOURCE, SCHEDULE_SOURCE].map(download));

// A failed parse throws, so the job fails and GitHub Pages keeps serving the previous version.
const freshScoring = parseTeamScoring(statsHtml, TEAM);
if (!freshScoring) throw new Error(`${TEAM} not found in GameStats scoring`);
const freshStandings = parseStandings(overviewHtml, TEAM);
if (!freshStandings) throw new Error(`${TEAM} not found in GameStats standings`);
const freshSchedule = parseSchedule(scheduleHtml, TEAM);
if (!freshSchedule) throw new Error(`${TEAM} not found in GameStats schedule`);

// Thinner data than the archived snapshot (same season) is treated as a GameStats glitch.
const archive = loadSnapshot();
const sameSeason = archive?.league === freshScoring.league;
const scoring = guardScoring(freshScoring, archive?.scoring, sameSeason);
const standings = guardStandings(freshStandings, archive?.standings, sameSeason);
const schedule = guardSchedule(freshSchedule, archive?.schedule, sameSeason);

// GameStats serves full-size uploads; shrink them to thumbnail size with ImageMagick (the
// workflow installs it). Returns false when ImageMagick is unavailable.
const shrink = (path, geometry) => {
  for (const cmd of ["magick", "convert"]) {
    try {
      execFileSync(cmd, [path, "-resize", geometry, "-strip", "-quality", "82", path], { stdio: "ignore" });
      return true;
    } catch {
      // try the next binary name
    }
  }
  console.warn(`ImageMagick unavailable, ${path} kept at full size`);
  return false;
};

// Upload file names on GameStats are content hashes, so a cached thumbnail in data/images is
// valid for as long as the URL stays the same: only new or changed images are downloaded.
// Only shrunk thumbnails are cached, so a local build without ImageMagick never commits full-size files.
let imageDownloads = 0;
const saveImage = (dir, geometry) => async ({ name, url }) => {
  if (!url) return [];
  const file = `${slug(name)}.${new URL(url).pathname.split(".").pop().toLowerCase()}`;
  const cached = `data/images/${dir}/${new URL(url).pathname.split("/").pop()}`;
  mkdirSync(`dist/${dir}`, { recursive: true });
  if (existsSync(cached)) {
    copyFileSync(cached, `dist/${dir}/${file}`);
    return [[name, file]];
  }
  try {
    const res = await fetch(url);
    imageDownloads += 1;
    if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) throw new Error(String(res.status));
    writeFileSync(`dist/${dir}/${file}`, Buffer.from(await res.arrayBuffer()));
    if (shrink(`dist/${dir}/${file}`, geometry)) {
      mkdirSync(`data/images/${dir}`, { recursive: true });
      copyFileSync(`dist/${dir}/${file}`, cached);
    }
    return [[name, file]];
  } catch (error) {
    console.warn(`${dir}: ${name} failed (${error.message}), using placeholder`);
    return [];
  }
};
// GameStats admin (login via repository secrets, read only, logged out right after): the team
// roster with player ids and the game timelines. It logs in only when a played game's timeline is
// due (timelineDue in src/plan.js: a new game right away, an incomplete timeline hourly on the
// game day, then daily for two weeks) or the roster has never been read. Timelines are kept in
// the snapshot for all seasons, with the time of their last admin read (checkedAt).
const timelines = { ...(archive?.matchTimelines ?? {}) };
// "Run workflow" with refresh_admin re-reads the roster and every played game's timeline.
const refreshAdmin = process.env.REFRESH_ADMIN === "true";
const needTimeline = schedule.matches.filter((m) => m.kickoff && m.score)
  .filter((m) => refreshAdmin || timelineDue(m, timelines[matchSlug(m)], updatedAt));
const admin = needTimeline.length || !archive?.rosterIds
  ? await fetchAdminData(needTimeline, TEAM_ID)
  : { roster: null, timelines: new Map() };
for (const m of needTimeline) {
  const fresh = admin.timelines.get(m.kickoff);
  if (!fresh) continue;
  const known = timelines[matchSlug(m)];
  const best = !known || goalsOf(fresh.events).length >= goalsOf(known.events).length ? fresh : known;
  timelines[matchSlug(m)] = { ...best, checkedAt: updatedAt.toISOString() };
}
// Roster: the admin team page when it was just read, else the last one read, else the list in code.
const roster = admin.roster ?? archive?.rosterIds ?? ROSTER;

// Public player pages (photo, number, games played, per-game points) are read for the whole roster
// plus any scorer missing from it, but only when something may have changed: a player's season
// line, a new result, a new season, or the first build of the day (catches late lineup edits).
// Otherwise everything comes from the snapshot.
const lineOf = (p) => `${p.gp}|${p.g}|${p.a}|${p.pts}`;
const archivedLine = new Map((sameSeason ? archive?.scoring?.players ?? [] : []).map((p) => [p.name, lineOf(p)]));
const scoredGames = (s) => s?.matches?.filter((m) => m.score).length ?? -1;
const refreshPlayers = !sameSeason || !archive?.roster || admin.roster
  || scoring.players.some((p) => archivedLine.get(p.name) !== lineOf(p))
  || scoredGames(schedule) !== scoredGames(archive?.schedule)
  || !existsSync(`data/archive/${pragueDate(updatedAt)}.json`)
  || Object.values(archive?.roster ?? {}).some((s) => s.position === GOALIE && !s.games);
const rosterNames = new Set(roster.map((r) => r.name));
const playerTargets = [
  ...roster.map((r) => ({ name: r.name, url: playerUrl(r.id) })),
  ...scoring.players.filter((p) => !rosterNames.has(p.name)).map((p) => ({ name: p.name, url: p.url })),
];
const pages = refreshPlayers ? await fetchPlayerPages(playerTargets) : new Map();
// Within a season games played never go down; a thinner page keeps the archived line.
const rosterStats = Object.fromEntries(roster.map(({ name, id }) => {
  const page = pages.get(name);
  const old = sameSeason ? archive?.roster?.[name] : null;
  const fresh = page && { id, number: page.number, position: page.position, gp: page.gp, g: page.g, a: page.a, pts: page.pts, pim: page.pim, photoUrl: page.photoUrl };
  // Goalies keep the games they were listed in, for their goals against (buildGoalies).
  if (fresh && page.position === GOALIE) fresh.games = page.matches.map((m) => m.kickoff).sort();
  if (fresh && old && old.gp > fresh.gp) console.warn(`roster: ${name} lost games (${fresh.gp} < ${old.gp}), keeping the archived line`);
  return [name, (fresh && !(old && old.gp > fresh.gp) ? fresh : old) ?? { id }];
}));

const saveAll = async (items, save) => new Map((await Promise.all(items.map(save))).flat());
const logos = await saveAll(standings.teams.map((t) => ({ name: t.name, url: t.logoUrl })), saveImage("logos", "112x112>"));
const photoUrls = new Map([
  ...roster.map((r) => [r.name, rosterStats[r.name]?.photoUrl ?? null]),
  ...scoring.players.map((p) => [p.name, p.photoUrl ?? rosterStats[p.name]?.photoUrl ?? null]),
]);
const photos = await saveAll([...photoUrls].map(([name, url]) => ({ name, url })), saveImage("photos", "60x80^"));

const scoringRows = buildTable(scoring, roster, rosterStats);
const goalies = buildGoalies(roster, rosterStats, schedule);
write("bodovani", renderPage({ league: scoring.league, rows: scoringRows, goalies, photos, updatedAt }));
write("tabulka", renderStandings({ ...standings, logos, updatedAt }));
// Club match reports are optional: if the club site is down, the schedule is published without links.
const reports = await fetchReports(SEASON_START).catch((error) => {
  console.warn(`Club reports unavailable (${error.message}), publishing schedule without links`);
  return [];
});
// Game details: per-game points of every HC Lány scorer from the player pages read above; players
// whose page was not read this time keep their per-game points from the snapshot.
const allNames = new Set([...rosterNames, ...scoring.players.map((p) => p.name)]);
const playerMatches = [
  ...playerMatchesFromArchive(sameSeason ? archive?.matchScorers : null, new Set([...allNames].filter((n) => !pages.has(n)))),
  ...[...pages].map(([name, page]) => ({ name, matches: page.matches })),
];
const scorers = mergeMatchScorers(scorersByMatch(playerMatches), archive?.matchScorers, sameSeason);
// Hand-entered periods and penalties are carried over from the previous snapshot unchanged (all seasons).
const extras = archive?.matchExtras ?? {};
// Friendlies have no GameStats data, so no game detail.
const played = buildRounds(schedule.matches, reports).filter((r) => !r.bye && !r.exhibition && r.kickoff && r.score);

saveSnapshot({
  league: scoring.league, scoring, standings, schedule, rosterIds: roster, roster: rosterStats,
  matchScorers: Object.fromEntries([...scorers].sort()), matchExtras: extras,
  matchTimelines: Object.fromEntries(Object.entries(timelines).sort()),
}, updatedAt);
// Public GameStats player pages, linked from the game details.
const playerUrls = new Map([...roster.map((r) => [r.name, playerUrl(r.id)]), ...scoring.players.map((p) => [p.name, p.url])]);
for (const round of played) {
  const slugName = matchSlug(round);
  const hand = extrasFor(round, extras[slugName], slugName);
  const events = timelines[slugName]?.events ?? null;
  // Without hand-entered periods, estimate them from the goal times (complete timelines only).
  const estimated = !hand?.periods?.length && events ? periodsFromTimeline(events, round.score) : null;
  write(`zapas/${slugName}`, renderMatch({
    round, scorers: scorers.get(round.kickoff) ?? [],
    extras: estimated ? { periods: estimated, penalties: hand?.penalties ?? null, estimated: true } : hand,
    timeline: events, logos, photos, playerUrls, league: schedule.league, scheduleUrl: "../../rozpis/", updatedAt,
  }));
}
const detailSlugs = new Set(played.map(matchSlug));
// Links are relative to a widget folder one level deep (rozpis/, prehled/). The build stamp in
// the query makes browsers load the fresh detail instead of a copy cached by GitHub Pages (10 min).
const buildStamp = updatedAt.getTime().toString(36);
const detailUrlOf = (r) => (detailSlugs.has(matchSlug(r)) ? `../zapas/${matchSlug(r)}/?v=${buildStamp}` : null);

write("rozpis", renderSchedule({ ...schedule, reports, logos, detailUrlOf, updatedAt }));
write("prehled", renderOverview({ schedule, leagueMatches: parseLeagueMatches(scheduleHtml, TEAM), reports, standings, scoringRows, logos, photos, detailUrlOf, updatedAt }));
// The committee page is hand-written (embeds/vybor.html); publish it too, so it can be iframed.
write("vybor", `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Výbor HC Lány</title></head>
<body style="margin:0;padding:8px;background:#fff">${readFileSync("embeds/vybor.html", "utf8").replace(/<!--[\s\S]*?-->\s*/, "")}</body></html>`);
// Committee photos the club sent (not on GameStats) are served next to the page: vybor/<file>.
for (const file of existsSync("embeds/photos") ? readdirSync("embeds/photos") : []) copyFileSync(`embeds/photos/${file}`, `dist/vybor/${file}`);
// Time of this full build, read by gate.mjs to run the next one an hour later.
writeFileSync("dist/build.json", `${JSON.stringify({ builtAt: updatedAt.toISOString() })}\n`);
write(".", `<!doctype html><meta charset="utf-8"><title>HC Lány – statistiky</title>
<ul><li><a href="bodovani/">Kanadské bodování</a></li><li><a href="tabulka/">Tabulka soutěže</a></li><li><a href="rozpis/">Rozpis utkání</a></li><li><a href="prehled/">Přehled (úvodní stránka)</a></li><li><a href="vybor/">Výbor HC Lány</a></li></ul>`);
console.log(`bodovani: ${scoring.players.length} scorers, tabulka: ${standings.teams.length} teams, photos: ${photos.size}, image downloads: ${imageDownloads}, player pages fetched: ${pages.size}, game details: ${played.length}, admin: ${admin.roster ? `roster ${admin.roster.length}, ` : ""}timelines fetched: ${admin.timelines.size}, rozpis: ${schedule.matches.length} matches, ${reports.length} club articles (${standings.league})`);
