import { mkdirSync, writeFileSync } from "node:fs";
import { ROSTER, SOURCE, TEAM, buildTable, parseTeamScoring, renderPage } from "./src/scoring.js";

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`GameStats returned ${res.status}`);
const scoring = parseTeamScoring(await res.text(), TEAM);
if (!scoring) throw new Error(`${TEAM} not found in GameStats scoring, keeping the previous deployment`);

mkdirSync("dist", { recursive: true });
writeFileSync("dist/index.html", renderPage({ league: scoring.league, rows: buildTable(scoring, ROSTER), updatedAt: new Date() }));
console.log(`Wrote dist/index.html with ${scoring.players.length} scorers (${scoring.league})`);
