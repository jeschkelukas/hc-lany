export const SOURCE = "https://mini.gamestats.cz/i/bnb-cup/stats";
export const TEAM = "HC Lány";

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

const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[ch]);

const stripTags = (s) => decode(s.replace(/<[^>]+>/g, "").trim());

export const parseTeamScoring = (html, team) => {
  const sections = html.split('<section class="mb-5">').slice(1);
  for (const section of sections) {
    const leagueMatch = section.match(/<p class="text-secondary mb-3">([^<]*)<\/p>/);
    const league = leagueMatch ? decode(leagueMatch[1]).split(" · ")[0].trim() : "";
    const canadian = section.split("Kanadské bodování")[1]?.split("</table>")[0] ?? "";
    const rows = [...canadian.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
    const players = rows.flatMap((row) => {
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
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

export const buildTable = (scoring, roster) => {
  const scorers = scoring ? scoring.players : [];
  const known = new Set(scorers.map((p) => p.name));
  const zeros = roster
    .filter((name) => !known.has(name))
    .map((name) => ({ name, url: null, leagueRank: null, gp: null, g: 0, a: 0, pts: 0 }));
  const sorted = [...scorers].sort(byScoring);
  const ranked = sorted.map((p, i) => {
    const prev = sorted[i - 1];
    const tie = prev && prev.pts === p.pts && prev.g === p.g && prev.gp === p.gp;
    return { ...p, rank: tie ? null : i + 1 };
  });
  const zerosSorted = zeros.sort((x, y) => x.name.localeCompare(y.name, "cs"));
  return [...ranked, ...zerosSorted.map((p, i) => ({ ...p, rank: i === 0 ? sorted.length + 1 : null }))];
};

const fillRanks = (rows) => {
  let last = null;
  return rows.map((r) => {
    last = r.rank ?? last;
    return { ...r, rank: last };
  });
};

const formatTime = (date) =>
  new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" }).format(date);

export const renderPage = ({ league, rows, updatedAt, error }) => {
  const body = error
    ? `<p class="msg">${escapeHtml(error)} <a href="${SOURCE}" target="_blank" rel="noopener">Statistiky na GameStats</a></p>`
    : `<div class="box"><table>
  <thead><tr><th class="n">#</th><th>Jméno</th><th class="n">Z</th><th class="n">G</th><th class="n">A</th><th class="n">B</th><th class="n" title="Pořadí v kanadském bodování celé ligy">Liga</th></tr></thead>
  <tbody>${fillRanks(rows).map((r) => `<tr${r.pts === 0 ? ' class="zero"' : ""}>
    <td class="n rank">${r.rank}.</td>
    <td>${r.url ? `<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.name)}</a>` : escapeHtml(r.name)}</td>
    <td class="n">${r.gp ?? "–"}</td><td class="n">${r.g}</td><td class="n">${r.a}</td>
    <td class="n pts">${r.pts}</td><td class="n muted">${r.leagueRank ? `${escapeHtml(r.leagueRank)}.` : "–"}</td></tr>`).join("")}
  </tbody></table></div>`;

  return `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kanadské bodování ${escapeHtml(TEAM)}</title>
<style>
  :root { --fg: #1b2430; --muted: #6b7684; --line: #dfe4ea; --accent: #1f4fa3; --zebra: #f6f8fa; }
  body { margin: 0; padding: 8px; font: 14px/1.4 Verdana, Arial, sans-serif; color: var(--fg); background: #fff; }
  .box { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  th, td { padding: 5px 8px; text-align: left; white-space: nowrap; border-bottom: 1px solid var(--line); }
  th { font-size: 12px; color: var(--muted); font-weight: normal; border-bottom: 2px solid var(--accent); }
  .n { text-align: right; }
  .rank, .muted { color: var(--muted); }
  .pts { font-weight: bold; }
  tbody tr:nth-child(even) td { background: var(--zebra); }
  tr.zero td { color: var(--muted); }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .foot { margin: 8px 0 0; font-size: 11px; color: var(--muted); }
  .msg { padding: 12px; }
</style></head><body>
${body}
<p class="foot">${escapeHtml(league || "BNB Cup")} · Z = zápasy, G = góly, A = asistence, B = body, Liga = pořadí v celé lize · Zdroj: <a href="${SOURCE}" target="_blank" rel="noopener">GameStats</a>, aktualizováno ${formatTime(updatedAt)}</p>
</body></html>`;
};
