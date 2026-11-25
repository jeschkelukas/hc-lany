import { mkdirSync, writeFileSync } from "node:fs";
import { ROSTER, SOURCE, TEAM, buildTable, parseTeamScoring, renderPage } from "./src/scoring.js";
import { STANDINGS_SOURCE, parseStandings, renderStandings } from "./src/standings.js";
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
const [statsHtml, overviewHtml] = await Promise.all([download(SOURCE), download(STANDINGS_SOURCE)]);

// A failed parse throws, so the job fails and GitHub Pages keeps serving the previous version.
const scoring = parseTeamScoring(statsHtml, TEAM);
if (!scoring) throw new Error(`${TEAM} not found in GameStats scoring`);
const standings = parseStandings(overviewHtml, TEAM);
if (!standings) throw new Error(`${TEAM} not found in GameStats standings`);

write("bodovani", renderPage({ league: scoring.league, rows: buildTable(scoring, ROSTER), updatedAt }));
// Logos are copied next to the widget; a missing or broken one falls back to the placeholder shield.
const saveLogo = async (team) => {
  if (!team.logoUrl) return { ...team, logoFile: null };
  try {
    const res = await fetch(team.logoUrl);
    if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) throw new Error(String(res.status));
    const ext = new URL(team.logoUrl).pathname.split(".").pop().toLowerCase();
    const logoFile = `${slug(team.name)}.${ext}`;
    mkdirSync("dist/tabulka/logos", { recursive: true });
    writeFileSync(`dist/tabulka/logos/${logoFile}`, Buffer.from(await res.arrayBuffer()));
    return { ...team, logoFile };
  } catch (error) {
    console.warn(`Logo for ${team.name} failed (${error.message}), using placeholder`);
    return { ...team, logoFile: null };
  }
};
const teams = await Promise.all(standings.teams.map(saveLogo));

write("tabulka", renderStandings({ ...standings, teams, updatedAt }));
write(".", `<!doctype html><meta charset="utf-8"><title>HC Lány – statistiky</title>
<ul><li><a href="bodovani/">Kanadské bodování</a></li><li><a href="tabulka/">Tabulka soutěže</a></li></ul>`);
console.log(`bodovani: ${scoring.players.length} scorers, tabulka: ${standings.teams.length} teams (${standings.league})`);
