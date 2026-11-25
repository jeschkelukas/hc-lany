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

export const slug = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const stripTags = (s) => decode(s.replace(/<[^>]+>/g, "").trim());

const PLACEHOLDER_COLORS = ["#1f4fa3", "#c8202f", "#2e7d4f", "#7a4fb3", "#b5651d", "#0f7c8c"];

const hash = (s) => [...s].reduce((h, ch) => (h * 31 + ch.codePointAt(0)) >>> 0, 7);

// Shield with the team initial for teams that have no logo in GameStats.
const placeholderLogo = (name) => {
  const initials = name.split(/\s+/).filter((w) => /^\p{L}/u.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  const color = PLACEHOLDER_COLORS[hash(name) % PLACEHOLDER_COLORS.length];
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1 22 4v7c0 6-4.5 10.5-10 12C6.5 21.5 2 17 2 11V4z" fill="${color}"/><text x="12" y="15.5" text-anchor="middle" font-family="Verdana, Arial, sans-serif" font-size="${initials.length > 1 ? 8 : 10}" font-weight="bold" fill="#fff">${escapeHtml(initials || "?")}</text></svg>`;
};

// Logos live in one shared folder at the site root, so every widget links them as ../logos/.
export const teamBadge = (name, logos) => {
  const file = logos.get(name);
  const icon = file ? `<img src="../logos/${escapeHtml(file)}" alt="">` : placeholderLogo(name);
  return `<span class="club">${icon}${escapeHtml(name)}</span>`;
};

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
  :root { --fg: #1b2430; --muted: #6b7684; --line: #dfe4ea; --accent: #1f4fa3; --zebra: #f6f8fa; --mark: #fff4cc; --win: #2e7d4f; --draw: #6b7684; --loss: #c8202f; }
  body { margin: 0; padding: 8px; font: 14px/1.4 Verdana, Arial, sans-serif; color: var(--fg); background: #fff; }
  .box { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  th, td { padding: 5px 8px; text-align: left; white-space: nowrap; border-bottom: 1px solid var(--line); }
  th { font-size: 12px; color: var(--muted); font-weight: normal; border-bottom: 2px solid var(--accent); }
  .n { text-align: right; }
  /* Stat tables: rank hugs its content, every number column gets the same width, the name takes the rest. */
  table.stats th:first-child, table.stats td.rank { width: 1%; }
  table.stats th.n:not(:first-child), table.stats td.n:not(.rank) { width: 2.6em; }
  .rank, .muted { color: var(--muted); }
  .pts { font-weight: bold; }
  tbody tr:nth-child(even) td { background: var(--zebra); }
  tbody tr.mark td { background: var(--mark); font-weight: bold; }
  tr.zero td { color: var(--muted); }
  .club { display: flex; align-items: center; gap: 8px; }
  .club img, .club svg { display: block; width: 20px; height: 20px; object-fit: contain; flex: 0 0 20px; }
  th[data-sort] { padding: 0; }
  th[data-sort] button { all: unset; box-sizing: border-box; display: block; width: 100%; padding: 5px 8px; cursor: pointer; }
  th[data-sort] button:hover { color: var(--accent); }
  th[data-sort] button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  th[aria-sort="ascending"] button::after { content: " ▲"; color: var(--accent); }
  th[aria-sort="descending"] button::after { content: " ▼"; color: var(--accent); }
  .c { text-align: center; }
  table.compact th, table.compact td { padding-left: 4px; padding-right: 4px; }
  .me { font-weight: bold; }
  .moved { color: var(--loss); }
  table.schedule td.res { white-space: nowrap; text-align: center; }
  .score { display: inline-grid; grid-template-columns: 1.5em .45em 1.5em; align-items: center; font-weight: bold; vertical-align: middle; }
  .score .h { text-align: right; } .score .colon { text-align: center; } .score .a { text-align: left; }
  .score .wide { grid-column: 1 / -1; text-align: center; font-weight: bold; }
  a.score { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
  .tag { display: inline-block; width: 3.2em; margin-left: 8px; text-align: left; vertical-align: middle; }
  tbody tr.half td { border-top: 3px solid var(--line); }
  .pill { display: inline-block; min-width: 18px; padding: 1px 5px; border-radius: 4px; color: #fff; font-size: 12px; font-weight: bold; text-align: center; }
  .pill.bye { padding: 2px 12px; text-transform: uppercase; letter-spacing: .08em; }
  .pill.w { background: var(--win); } .pill.d { background: var(--draw); } .pill.l { background: var(--loss); }
  .pill.next { background: var(--accent); font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .pts a { text-decoration: underline; text-underline-offset: 2px; }
  .foot { margin: 8px 0 0; font-size: 11px; color: var(--muted); }
  .msg { padding: 12px; }
</style></head><body>
${body}
<p class="foot">${escapeHtml(legend)} · Zdroj: <a href="${sourceUrl}" target="_blank" rel="noopener">GameStats</a>, aktualizováno ${formatTime(updatedAt)}</p>
<script>
document.querySelectorAll("table[data-sortable]").forEach((table) => {
  const tbody = table.tBodies[0];
  const original = [...tbody.rows];
  const headers = [...table.tHead.rows[0].cells];
  let active = { index: -1, dir: 0 };
  const valueOf = (row, index) => {
    const cell = row.cells[index];
    return Number.parseFloat(cell.dataset.v ?? cell.textContent) || 0;
  };
  headers.forEach((th, index) => {
    if (!th.hasAttribute("data-sort")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = th.textContent;
    th.textContent = "";
    th.append(button);
    button.addEventListener("click", () => {
      const dir = active.index === index ? -active.dir : -1;
      active = { index, dir };
      const rows = [...original].sort((a, b) => {
        const diff = valueOf(a, index) - valueOf(b, index);
        return diff * dir || original.indexOf(a) - original.indexOf(b);
      });
      tbody.append(...rows);
      headers.forEach((h) => h.removeAttribute("aria-sort"));
      th.setAttribute("aria-sort", dir > 0 ? "ascending" : "descending");
    });
  });
});
</script>
</body></html>`;
