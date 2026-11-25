export const GAMESTATS = "https://mini.gamestats.cz/i/bnb-cup";
export const TEAM = "HC Lány";

export const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[ch]);

export const stripTags = (s) => decode(s.replace(/<[^>]+>/g, "").trim());

export const cellsOf = (row) => [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
export const rowsOf = (table) => [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);

const formatTime = (date) =>
  new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague",
  }).format(date);

export const renderShell = ({ title, body, legend, sourceUrl, updatedAt }) => `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { --fg: #1b2430; --muted: #6b7684; --line: #dfe4ea; --accent: #1f4fa3; --zebra: #f6f8fa; --mark: #fff4cc; }
  body { margin: 0; padding: 8px; font: 14px/1.4 Verdana, Arial, sans-serif; color: var(--fg); background: #fff; }
  .box { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  th, td { padding: 5px 8px; text-align: left; white-space: nowrap; border-bottom: 1px solid var(--line); }
  th { font-size: 12px; color: var(--muted); font-weight: normal; border-bottom: 2px solid var(--accent); }
  .n { text-align: right; }
  .rank, .muted { color: var(--muted); }
  .pts { font-weight: bold; }
  tbody tr:nth-child(even) td { background: var(--zebra); }
  tbody tr.mark td { background: var(--mark); font-weight: bold; }
  tr.zero td { color: var(--muted); }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .foot { margin: 8px 0 0; font-size: 11px; color: var(--muted); }
  .msg { padding: 12px; }
</style></head><body>
${body}
<p class="foot">${escapeHtml(legend)} · Zdroj: <a href="${sourceUrl}" target="_blank" rel="noopener">GameStats</a>, aktualizováno ${formatTime(updatedAt)}</p>
</body></html>`;
