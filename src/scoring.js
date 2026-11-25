import { GAMESTATS, TEAM, cellsOf, decode, escapeHtml, renderShell, rowsOf, stripTags } from "./page.js";

export { TEAM };
export const SOURCE = `${GAMESTATS}/stats`;

// Club roster. Players listed here show up even with zero points; scorers missing
// from this list are still added automatically from GameStats.
export const ROSTER = [
  "Braun Jan",
  "Brejník Petr",
  "Cepák Tomáš",
  "Černý Josef",
  "Hauf Ivan",
  "Hoffmann Marek",
  "Hořejší Milan",
  "Janský Martin",
  "Jeschke Lukáš",
  "Jirkovský Radek",
  "Kestner Jan",
  "Köhler Michael",
  "Laga Martin",
  "Lomberský Aleš",
  "Lomberský Tomáš",
  "Mairych Břetislav",
  "Náprstek Martin",
  "Nedvěd Martin",
  "Nedvěd Zdeněk",
  "Pokorný Radek",
  "Prokop Michal",
  "Prokop Miloslav",
  "Soukup Radek",
  "Štechmiler Jaroslav",
  "Švácha Jiří",
  "Taraba Martin",
  "Ungrman Petr",
];

export const parseTeamScoring = (html, team) => {
  const sections = html.split('<section class="mb-5">').slice(1);
  for (const section of sections) {
    const leagueMatch = section.match(/<p class="text-secondary mb-3">([^<]*)<\/p>/);
    const league = leagueMatch ? decode(leagueMatch[1]).split(" · ")[0].trim() : "";
    const canadian = section.split("Kanadské bodování")[1]?.split("</table>")[0] ?? "";
    const rows = rowsOf(canadian);
    const players = rows.flatMap((row) => {
      const cells = cellsOf(row);
      if (cells.length < 8) return [];
      const link = cells[1].match(/href="([^"]+)"[^>]*>([^<]+)<\/a>/);
      const teamName = cells[2].match(/<span class="text-secondary">([^<]+)<\/span>/);
      if (!link || !teamName || decode(teamName[1]).trim() !== team) return [];
      const num = (i) => Number.parseInt(stripTags(cells[i]), 10) || 0;
      return [{
        name: decode(link[2]).trim(),
        url: new URL(link[1], SOURCE).href,
        leagueRank: stripTags(cells[0]).replace(/\.$/, ""),
        gp: num(3),
        g: num(4),
        a: num(5),
        pts: num(6),
      }];
    });
    if (players.length > 0) return { league, players };
  }
  return null;
};

const byScoring = (x, y) => y.pts - x.pts || y.g - x.g || x.gp - y.gp || x.name.localeCompare(y.name, "cs");

// Dense ranking, as the club prefers: players tied on points, goals and games share a number
// (10., 10.) and the next group continues with the following one (11.); every roster player
// without a point forms one shared group at the bottom.
export const buildTable = (scoring, roster) => {
  const scorers = scoring ? scoring.players : [];
  const known = new Set(scorers.map((p) => p.name));
  const zeros = roster
    .filter((name) => !known.has(name))
    .sort((x, y) => x.localeCompare(y, "cs"))
    .map((name) => ({ name, url: null, leagueRank: null, gp: null, g: 0, a: 0, pts: 0 }));
  const rows = [...[...scorers].sort(byScoring), ...zeros];
  const groupOf = (p) => (p.gp === null ? "zero" : `${p.pts}|${p.g}|${p.gp}`);
  const groups = [...new Set(rows.map(groupOf))];
  return rows.map((p) => ({ ...p, rankLabel: `${groups.indexOf(groupOf(p)) + 1}.` }));
};

export const renderPage = ({ league, rows, updatedAt, error }) => {
  const body = error
    ? `<p class="msg">${escapeHtml(error)} <a href="${SOURCE}" target="_blank" rel="noopener">Statistiky na GameStats</a></p>`
    : `<div class="box"><table class="stats" data-sortable>
  <thead><tr><th class="n">#</th><th>Jméno</th><th class="n" data-sort>Z</th><th class="n" data-sort>G</th><th class="n" data-sort>A</th><th class="n" data-sort>B</th><th class="n" title="Pořadí v kanadském bodování celé ligy">Liga</th></tr></thead>
  <tbody>${rows.map((r) => `<tr${r.pts === 0 ? ' class="zero"' : ""}>
    <td class="n rank">${r.rankLabel}</td>
    <td>${r.url ? `<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.name)}</a>` : escapeHtml(r.name)}</td>
    <td class="n" data-v="${r.gp ?? -1}">${r.gp ?? ""}</td><td class="n">${r.g}</td><td class="n">${r.a}</td>
    <td class="n pts">${r.pts}</td><td class="n muted">${r.leagueRank ? `${escapeHtml(r.leagueRank)}.` : ""}</td></tr>`).join("")}
  </tbody></table></div>`;

  return renderShell({
    title: `Kanadské bodování ${TEAM}`,
    body,
    legend: `${league || "BNB Cup"} · Z = zápasy, G = góly, A = asistence, B = body, Liga = pořadí v celé lize`,
    sourceUrl: SOURCE,
    updatedAt,
  });
};
