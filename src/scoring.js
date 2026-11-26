import { GAMESTATS, TEAM, cellsOf, decode, escapeHtml, renderShell, rowsOf, stripTags } from "./page.js";

export { TEAM };
export const SOURCE = `${GAMESTATS}/stats`;

// Club roster as listed on the HC Lány team page in GameStats admin (TEAM_ID). The ids open
// the public player pages (playerUrl, no login needed), which show the photo,
// jersey number and games played even for players without a point. Scorers missing from
// this list are still added automatically from GameStats.
export const TEAM_ID = "1a15d2bb2b08bc10a5e78";
export const ROSTER = [
  { name: "Laga Martin", id: "1a18e26955ed4b8f9c044" },
  { name: "Cepák Tomáš", id: "1a18e23bc27c545dc010a" },
  { name: "Taraba Martin", id: "1a18e45b6d5a63e6f0d1b" },
  { name: "Hauf Ivan", id: "1a18e2da1cda414b97eac" },
  { name: "Braun Jan", id: "1a18e27fa238ac460294d" },
  { name: "Ungrman Petr", id: "1a18e463366064b8b9938" },
  { name: "Soukup Radek", id: "1a18e4317457acf8cc849" },
  { name: "Lomberský Aleš", id: "1a18af6b0fa380219ae8e" },
  { name: "Hořejší Milan", id: "1a18e308224bf7a2f7da3" },
  { name: "Pokorný Radek", id: "1a18e3e611103f3e7de14" },
  { name: "Náprstek Martin", id: "1a18e3cbd21c9a6750517" },
  { name: "Jirkovský Radek", id: "1a18e370cf4335cbc3da5" },
  { name: "Lomberský Tomáš", id: "1a18e3aadddaabce56f7d" },
  { name: "Mairych Břetislav", id: "1a18e3b81e3488a88fa24" },
  { name: "Jirásek Jan", id: "1a18e33a4eb844dd285f0" },
  { name: "Švácha Jiří", id: "1a18e4530856333f3b87b" },
  { name: "Černý Josef", id: "1a18e296839c16e07188b" },
  { name: "Jeschke Lukáš", id: "1a18e329c0a2202977231" },
  { name: "Hoffmann Marek", id: "1a18e2fbe066719930788" },
  { name: "Brejník Petr", id: "1a18e28c22278ef5bbc58" },
  { name: "Nedvěd Zdeněk", id: "1a18e3d9ec9c02947da1e" },
  { name: "Prokop Miloslav", id: "1a18e41d61b4e12922d2b" },
  { name: "Kestner Jan", id: "1a18e380430706c511dd4" },
  { name: "Štechmiler Jaroslav", id: "1a18e44a97742ece74c5a" },
  { name: "Köhler Michael", id: "1a18e38acc0caa306e056" },
  { name: "Prokop Michal", id: "1a18e4152a89fe811e95f" },
  { name: "Janský Martin", id: "1a18e3188f21645d1c48f" },
  { name: "Nedvěd Martin", id: "1a18e3d1fefba62eb4fb0" },
].sort((x, y) => x.name.localeCompare(y.name, "cs"));
export const playerUrl = (id) => `${GAMESTATS}/players/${id}`;

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
      const photo = cells[1].match(/<img src="([^"]+)"/);
      return [{
        name: decode(link[2]).trim(),
        photoUrl: photo ? new URL(decode(photo[1]), SOURCE).href : null,
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
// without a point forms one shared group at the bottom, most games played first. Their games
// come from the public player pages (rosterStats: name -> { gp, ... }).
export const buildTable = (scoring, roster, rosterStats = {}) => {
  const scorers = scoring ? scoring.players : [];
  const known = new Set(scorers.map((p) => p.name));
  const zeros = roster
    .filter(({ name }) => !known.has(name))
    .map(({ name, id }) => ({ name, url: playerUrl(id), leagueRank: null, gp: rosterStats[name]?.gp ?? null, g: 0, a: 0, pts: 0, zero: true }))
    .sort((x, y) => (y.gp ?? -1) - (x.gp ?? -1) || x.name.localeCompare(y.name, "cs"));
  const rows = [...[...scorers].sort(byScoring), ...zeros].map((p) => ({ ...p, number: rosterStats[p.name]?.number ?? null }));
  const groupOf = (p) => (p.zero ? "zero" : `${p.pts}|${p.g}|${p.gp}`);
  const groups = [...new Set(rows.map(groupOf))];
  return rows.map((p) => ({ ...p, rankLabel: `${groups.indexOf(groupOf(p)) + 1}.` }));
};

// Grey head-and-shoulders silhouette for players without a GameStats photo.
const PHOTO_PLACEHOLDER = '<svg class="face" viewBox="0 0 24 32" aria-hidden="true"><rect width="24" height="32" rx="3" fill="#dfe4ea"/><circle cx="12" cy="12" r="5" fill="#a9b4c0"/><path d="M3 32c0-6 4-10 9-10s9 4 9 10z" fill="#a9b4c0"/></svg>';

const playerCell = (r, photos) => {
  const file = photos.get(r.name);
  const face = file ? `<img class="face" src="../photos/${escapeHtml(file)}" alt="" loading="lazy">` : PHOTO_PLACEHOLDER;
  const name = r.url ? `<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.name)}</a>` : escapeHtml(r.name);
  return `<span class="player">${face}${name}</span>`;
};

// A player who has not played yet shows dashes instead of zeros.
const DASH = "–";
const statCells = (r) => {
  if (!r.gp) return `<td class="n" data-v="${r.gp ?? -1}">${DASH}</td><td class="n" data-v="0">${DASH}</td><td class="n" data-v="0">${DASH}</td><td class="n pts" data-v="0">${DASH}</td>`;
  return `<td class="n" data-v="${r.gp}">${r.gp}</td><td class="n">${r.g}</td><td class="n">${r.a}</td><td class="n pts">${r.pts}</td>`;
};

// Team totals strip above the table: how many players scored and the team's goals, assists and points.
const summary = (rows) => {
  const sum = (key) => rows.reduce((total, r) => total + r[key], 0);
  const tile = (label, value, cls = "") => `<div${cls ? ` class="${cls}"` : ""}><span>${label}</span><b>${value}</b></div>`;
  return `<div class="summary">${tile("Hráčů s body", rows.filter((r) => r.pts > 0).length)}${tile("Góly", sum("g"))}${tile("Asistence", sum("a"))}${tile("Body", sum("pts"), "total")}</div>`;
};

export const renderPage = ({ league, rows, photos = new Map(), updatedAt, error }) => {
  const body = error
    ? `<p class="msg">${escapeHtml(error)} <a href="${SOURCE}" target="_blank" rel="noopener">Statistiky na GameStats</a></p>`
    : `${summary(rows)}<div class="search" data-filter="players"><input id="q" type="search" placeholder="Hledat hráče" aria-label="Hledat hráče" autocomplete="off"><button type="button" aria-label="Vymazat hledání" hidden>×</button></div>
  <div class="box"><table id="players" class="stats players" data-sortable>
  <thead><tr><th class="n">#</th><th class="n num" title="Číslo dresu">Č.</th><th>Jméno</th><th class="n" data-sort>Z</th><th class="n" data-sort>G</th><th class="n" data-sort>A</th><th class="n" data-sort>B</th><th class="n" title="Pořadí v kanadském bodování celé ligy">Liga</th></tr></thead>
  <tbody>${rows.map((r) => `<tr data-name="${escapeHtml(r.name)}"${r.pts === 0 ? ' class="zero"' : ""}>
    <td class="n rank">${r.rankLabel}</td><td class="n num">${r.number ?? ""}</td>
    <td>${playerCell(r, photos)}</td>
    ${statCells(r)}<td class="n muted">${r.leagueRank ? `${escapeHtml(r.leagueRank)}.` : DASH}</td></tr>`).join("")}
  </tbody></table><div id="players-empty" class="nomatch" hidden>Žádný hráč neodpovídá hledání.</div></div>`;

  return renderShell({
    title: `Kanadské bodování ${TEAM}`,
    body,
    legend: `${league || "BNB Cup"} · Z = zápasy, G = góly, A = asistence, B = body, Liga = pořadí v celé lize`,
    sourceUrl: SOURCE,
    updatedAt,
  });
};
