import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { ROSTER, SOURCE, TEAM, buildTable, parseTeamScoring, renderPage } from "./src/scoring.js";
import { STANDINGS_SOURCE, parseStandings, renderStandings } from "./src/standings.js";
import { SCHEDULE_SOURCE, SEASON_START, parseSchedule, renderSchedule } from "./src/schedule.js";
import { fetchReports } from "./src/reports.js";
import { renderOverview } from "./src/overview.js";
import { slug } from "./src/page.js";

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
const scoring = parseTeamScoring(statsHtml, TEAM);
if (!scoring) throw new Error(`${TEAM} not found in GameStats scoring`);
const standings = parseStandings(overviewHtml, TEAM);
if (!standings) throw new Error(`${TEAM} not found in GameStats standings`);
const schedule = parseSchedule(scheduleHtml, TEAM);
if (!schedule) throw new Error(`${TEAM} not found in GameStats schedule`);

// GameStats serves full-size uploads; shrink them to thumbnail size when ImageMagick is available
// (the workflow installs it), otherwise keep the original file.
const shrink = (path, geometry) => {
  for (const cmd of ["magick", "convert"]) {
    try {
      execFileSync(cmd, [path, "-resize", geometry, "-strip", "-quality", "82", path], { stdio: "ignore" });
      return;
    } catch {
      // try the next binary name
    }
  }
  console.warn(`ImageMagick unavailable, ${path} kept at full size`);
};

// Images are copied into dist/<dir>; a missing or broken one falls back to the widget's placeholder.
const saveImage = (dir, geometry) => async ({ name, url }) => {
  if (!url) return [];
  try {
    const res = await fetch(url);
    if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) throw new Error(String(res.status));
    const file = `${slug(name)}.${new URL(url).pathname.split(".").pop().toLowerCase()}`;
    mkdirSync(`dist/${dir}`, { recursive: true });
    writeFileSync(`dist/${dir}/${file}`, Buffer.from(await res.arrayBuffer()));
    if (geometry) shrink(`dist/${dir}/${file}`, geometry);
    return [[name, file]];
  } catch (error) {
    console.warn(`${dir}: ${name} failed (${error.message}), using placeholder`);
    return [];
  }
};
const saveAll = async (items, save) => new Map((await Promise.all(items.map(save))).flat());
const logos = await saveAll(standings.teams.map((t) => ({ name: t.name, url: t.logoUrl })), saveImage("logos"));
const photos = await saveAll(scoring.players.map((p) => ({ name: p.name, url: p.photoUrl })), saveImage("photos", "60x80^"));

const scoringRows = buildTable(scoring, ROSTER);
write("bodovani", renderPage({ league: scoring.league, rows: scoringRows, photos, updatedAt }));
write("tabulka", renderStandings({ ...standings, logos, updatedAt }));
// Club match reports are optional: if the club site is down, the schedule is published without links.
const reports = await fetchReports(SEASON_START).catch((error) => {
  console.warn(`Club reports unavailable (${error.message}), publishing schedule without links`);
  return [];
});
write("rozpis", renderSchedule({ ...schedule, reports, logos, updatedAt }));
write("prehled", renderOverview({ schedule, reports, standings, scoringRows, logos, photos, updatedAt }));
write(".", `<!doctype html><meta charset="utf-8"><title>HC Lány – statistiky</title>
<ul><li><a href="bodovani/">Kanadské bodování</a></li><li><a href="tabulka/">Tabulka soutěže</a></li><li><a href="rozpis/">Rozpis utkání</a></li><li><a href="prehled/">Přehled (úvodní stránka)</a></li></ul>`);
console.log(`bodovani: ${scoring.players.length} scorers, tabulka: ${standings.teams.length} teams, photos: ${photos.size}, rozpis: ${schedule.matches.length} matches, ${reports.length} club articles (${standings.league})`);
