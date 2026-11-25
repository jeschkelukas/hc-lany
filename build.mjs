import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { ROSTER, SOURCE, TEAM, buildTable, parseTeamScoring, renderPage } from "./src/scoring.js";
import { STANDINGS_SOURCE, parseStandings, renderStandings } from "./src/standings.js";
import { SCHEDULE_SOURCE, SEASON_START, buildRounds, parseSchedule, renderSchedule } from "./src/schedule.js";
import { fetchPlayerMatches, matchSlug, playerMatchesFromArchive, renderMatch, scorersByMatch } from "./src/matches.js";
import { fetchReports } from "./src/reports.js";
import { extrasFor } from "./src/extras.js";
import { renderOverview } from "./src/overview.js";
import { slug } from "./src/page.js";
import { guardSchedule, guardScoring, guardStandings, loadSnapshot, mergeMatchScorers, saveSnapshot } from "./src/snapshot.js";

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
const saveAll = async (items, save) => new Map((await Promise.all(items.map(save))).flat());
const logos = await saveAll(standings.teams.map((t) => ({ name: t.name, url: t.logoUrl })), saveImage("logos", "112x112>"));
const photos = await saveAll(scoring.players.map((p) => ({ name: p.name, url: p.photoUrl })), saveImage("photos", "60x80^"));

const scoringRows = buildTable(scoring, ROSTER);
write("bodovani", renderPage({ league: scoring.league, rows: scoringRows, photos, updatedAt }));
write("tabulka", renderStandings({ ...standings, logos, updatedAt }));
// Club match reports are optional: if the club site is down, the schedule is published without links.
const reports = await fetchReports(SEASON_START).catch((error) => {
  console.warn(`Club reports unavailable (${error.message}), publishing schedule without links`);
  return [];
});
// Match details: per-match points of every HC Lány scorer, read from their GameStats player pages.
// Player pages are only fetched for players whose season line changed since the snapshot;
// everyone else's per-match points come from the archive.
const archivedLine = new Map((sameSeason ? archive?.scoring?.players ?? [] : []).map((p) => [p.name, `${p.gp}|${p.g}|${p.a}|${p.pts}`]));
const changed = scoring.players.filter((p) => archivedLine.get(p.name) !== `${p.gp}|${p.g}|${p.a}|${p.pts}`);
const unchangedNames = new Set(scoring.players.filter((p) => !changed.includes(p)).map((p) => p.name));
const playerMatches = [
  ...playerMatchesFromArchive(sameSeason ? archive?.matchScorers : null, unchangedNames),
  ...await fetchPlayerMatches(changed),
];
const scorers = mergeMatchScorers(scorersByMatch(playerMatches), archive?.matchScorers, sameSeason);
// Hand-entered periods and penalties are carried over from the previous snapshot unchanged (all seasons).
const extras = archive?.matchExtras ?? {};
saveSnapshot({ league: scoring.league, scoring, standings, schedule, matchScorers: Object.fromEntries([...scorers].sort()), matchExtras: extras }, updatedAt);
const played = buildRounds(schedule.matches, reports).filter((r) => !r.bye && r.kickoff && r.score);
for (const round of played) {
  write(`zapas/${matchSlug(round)}`, renderMatch({
    round, scorers: scorers.get(round.kickoff) ?? [], extras: extrasFor(round, extras[matchSlug(round)], matchSlug(round)),
    logos, photos, league: schedule.league, scheduleUrl: "../../rozpis/", updatedAt,
  }));
}
const detailSlugs = new Set(played.map(matchSlug));
// Links are relative to a widget folder one level deep (rozpis/, prehled/). The build stamp in
// the query makes browsers load the fresh detail instead of a copy cached by GitHub Pages (10 min).
const buildStamp = updatedAt.getTime().toString(36);
const detailUrlOf = (r) => (detailSlugs.has(matchSlug(r)) ? `../zapas/${matchSlug(r)}/?v=${buildStamp}` : null);

write("rozpis", renderSchedule({ ...schedule, reports, logos, detailUrlOf, updatedAt }));
write("prehled", renderOverview({ schedule, reports, standings, scoringRows, logos, photos, detailUrlOf, updatedAt }));
write(".", `<!doctype html><meta charset="utf-8"><title>HC Lány – statistiky</title>
<ul><li><a href="bodovani/">Kanadské bodování</a></li><li><a href="tabulka/">Tabulka soutěže</a></li><li><a href="rozpis/">Rozpis utkání</a></li><li><a href="prehled/">Přehled (úvodní stránka)</a></li></ul>`);
console.log(`bodovani: ${scoring.players.length} scorers, tabulka: ${standings.teams.length} teams, photos: ${photos.size}, image downloads: ${imageDownloads}, player pages fetched: ${changed.length}, match details: ${played.length}, rozpis: ${schedule.matches.length} matches, ${reports.length} club articles (${standings.league})`);
