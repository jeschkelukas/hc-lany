import { mkdirSync, writeFileSync } from "node:fs";
import { ROSTER, SOURCE, TEAM, buildTable, parseTeamScoring, renderPage } from "./src/scoring.js";

// Each widget gets its own folder so its iframe URL stays stable when more widgets are added.
const write = (path, html) => {
  mkdirSync(`dist/${path}`, { recursive: true });
  writeFileSync(`dist/${path}/index.html`, html);
};

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`GameStats returned ${res.status}`);
const scoring = parseTeamScoring(await res.text(), TEAM);
if (!scoring) throw new Error(`${TEAM} not found in GameStats scoring, keeping the previous deployment`);

write("bodovani", renderPage({ league: scoring.league, rows: buildTable(scoring, ROSTER), updatedAt: new Date() }));
write(".", `<!doctype html><meta charset="utf-8"><title>HC Lány – statistiky</title>
<ul><li><a href="bodovani/">Kanadské bodování</a></li></ul>`);
console.log(`Wrote dist/bodovani/index.html with ${scoring.players.length} scorers (${scoring.league})`);
