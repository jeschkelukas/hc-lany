import { GAMESTATS, TEAM, cellsOf, decode, escapeHtml, renderShell, rowsOf, stripTags } from "./page.js";

const PLACEHOLDER_COLORS = ["#1f4fa3", "#c8202f", "#2e7d4f", "#7a4fb3", "#b5651d", "#0f7c8c"];

const hash = (s) => [...s].reduce((h, ch) => (h * 31 + ch.codePointAt(0)) >>> 0, 7);

// Shield with the team initial for teams that have no logo in GameStats.
export const placeholderLogo = (name) => {
  const initials = name.split(/\s+/).filter((w) => /^\p{L}/u.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  const color = PLACEHOLDER_COLORS[hash(name) % PLACEHOLDER_COLORS.length];
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1 22 4v7c0 6-4.5 10.5-10 12C6.5 21.5 2 17 2 11V4z" fill="${color}"/><text x="12" y="15.5" text-anchor="middle" font-family="Verdana, Arial, sans-serif" font-size="${initials.length > 1 ? 8 : 10}" font-weight="bold" fill="#fff">${escapeHtml(initials || "?")}</text></svg>`;
};

export const STANDINGS_SOURCE = GAMESTATS;

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

export const renderStandings = ({ league, teams, updatedAt }) => {
  const body = `<div class="box"><table>
  <thead><tr><th class="n">#</th><th>Tým</th><th class="n">Z</th><th class="n">V</th><th class="n">VP</th><th class="n">R</th><th class="n">PP</th><th class="n">P</th><th class="n">Skóre</th><th class="n">Body</th></tr></thead>
  <tbody>${teams.map((t) => `<tr${t.name === TEAM ? ' class="mark"' : ""}>
    <td class="n rank">${escapeHtml(t.rank)}.</td><td><span class="club">${t.logoFile ? `<img src="logos/${escapeHtml(t.logoFile)}" alt="">` : placeholderLogo(t.name)}${escapeHtml(t.name)}</span></td>
    <td class="n">${t.gp}</td><td class="n">${t.w}</td><td class="n">${t.otw}</td><td class="n">${t.d}</td>
    <td class="n">${t.otl}</td><td class="n">${t.l}</td><td class="n">${escapeHtml(t.score)}</td><td class="n pts">${t.pts}</td></tr>`).join("")}
  </tbody></table></div>`;
  return renderShell({
    title: `Tabulka – ${league || "BNB Cup"}`,
    body,
    legend: `${league || "BNB Cup"} · Z = zápasy, V = výhry, VP = výhry v prodloužení, R = remízy, PP = prohry v prodloužení, P = prohry`,
    sourceUrl: STANDINGS_SOURCE,
    updatedAt,
  });
};
