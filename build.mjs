import { mkdirSync, writeFileSync } from "node:fs";
import { ROSTER, SOURCE, TEAM, buildTable, parseTeamScoring, renderPage } from "./src/scoring.js";
import { STANDINGS_SOURCE, parseStandings, renderStandings } from "./src/standings.js";
import { SCHEDULE_SOURCE, parseSchedule, renderSchedule } from "./src/schedule.js";
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

// Logos of the league's teams are copied to dist/logos; a missing or broken one falls back to the placeholder shield.
const saveLogo = async ({ name, logoUrl }) => {
  if (!logoUrl) return [];
  try {
    const res = await fetch(logoUrl);
    if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) throw new Error(String(res.status));
    const file = `${slug(name)}.${new URL(logoUrl).pathname.split(".").pop().toLowerCase()}`;
    mkdirSync("dist/logos", { recursive: true });
    writeFileSync(`dist/logos/${file}`, Buffer.from(await res.arrayBuffer()));
    return [[name, file]];
  } catch (error) {
    console.warn(`Logo for ${name} failed (${error.message}), using placeholder`);
    return [];
  }
};
const logos = new Map((await Promise.all(standings.teams.map(saveLogo))).flat());

write("bodovani", renderPage({ league: scoring.league, rows: buildTable(scoring, ROSTER), updatedAt }));
write("tabulka", renderStandings({ ...standings, logos, updatedAt }));
write("rozpis", renderSchedule({ ...schedule, logos, updatedAt }));
write(".", `<!doctype html><meta charset="utf-8"><title>HC Lány – statistiky</title>
<ul><li><a href="bodovani/">Kanadské bodování</a></li><li><a href="tabulka/">Tabulka soutěže</a></li><li><a href="rozpis/">Rozpis utkání</a></li></ul>`);
console.log(`bodovani: ${scoring.players.length} scorers, tabulka: ${standings.teams.length} teams, rozpis: ${schedule.matches.length} matches (${standings.league})`);
