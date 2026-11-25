import { GAMESTATS, TEAM, cellsOf, decode, escapeHtml, renderShell, rowsOf, stripTags, teamBadge } from "./page.js";

export const STANDINGS_SOURCE = GAMESTATS;

const scoreDiff = (score) => {
  const [scored, conceded] = score.split(":").map((n) => Number.parseInt(n, 10) || 0);
  return scored - conceded;
};

// The overview page holds one card per league; the first table in each card is its standings.
export const parseStandings = (html, team) => {
  const cards = html.split('<div class="card mb-4">').slice(1);
  for (const card of cards) {
    const leagueMatch = card.match(/<span class="fw-semibold">([^<]*)<\/span>/);
    const table = card.split("</table>")[0];
    if (!table.includes("Skóre")) continue;
    const teams = rowsOf(table).flatMap((row) => {
      const c = cellsOf(row);
      if (c.length < 10) return [];
      const num = (i) => Number.parseInt(stripTags(c[i]), 10) || 0;
      const logo = c[1].match(/<img src="([^"]+)"/);
      return [{
        logoUrl: logo ? new URL(decode(logo[1]), GAMESTATS).href : null,
        rank: stripTags(c[0]).replace(/\.$/, ""),
        name: stripTags(c[1]),
        gp: num(2), w: num(3), otw: num(4), d: num(5), otl: num(6), l: num(7),
        score: stripTags(c[8]),
        pts: num(9),
      }];
    });
    if (teams.some((t) => t.name === team)) {
      return { league: leagueMatch ? decode(leagueMatch[1]).trim() : "", teams };
    }
  }
  return null;
};

export const renderStandings = ({ league, teams, logos, updatedAt }) => {
  const body = `<div class="box"><table class="stats" data-sortable>
  <thead><tr><th class="n">#</th><th>Tým</th><th class="n" data-sort>Z</th><th class="n" data-sort>V</th><th class="n" data-sort>VP</th><th class="n" data-sort>R</th><th class="n" data-sort>PP</th><th class="n" data-sort>P</th><th class="n" data-sort title="Řadí se podle rozdílu skóre">Skóre</th><th class="n" data-sort>Body</th></tr></thead>
  <tbody>${teams.map((t) => `<tr${t.name === TEAM ? ' class="mark"' : ""}>
    <td class="n rank">${escapeHtml(t.rank)}.</td><td>${teamBadge(t.name, logos)}</td>
    <td class="n">${t.gp}</td><td class="n">${t.w}</td><td class="n">${t.otw}</td><td class="n">${t.d}</td>
    <td class="n">${t.otl}</td><td class="n">${t.l}</td><td class="n" data-v="${scoreDiff(t.score)}">${escapeHtml(t.score)}</td><td class="n pts">${t.pts}</td></tr>`).join("")}
  </tbody></table></div>`;
  return renderShell({
    title: `Tabulka – ${league || "BNB Cup"}`,
    body,
    legend: `${league || "BNB Cup"} · Z = zápasy, V = výhry, VP = výhry v prodloužení, R = remízy, PP = prohry v prodloužení, P = prohry`,
    sourceUrl: STANDINGS_SOURCE,
    updatedAt,
  });
};
