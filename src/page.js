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
export const placeholderLogo = (name) => {
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

export const formatTime = (date) =>
  new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague",
  }).format(date);

export const renderShell = ({ title, body, legend, sourceUrl, updatedAt }) => `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { --fg: #1b2430; --muted: #6b7684; --line: #dfe4ea; --accent: #1f4fa3; --zebra: #f6f8fa; --mark: #fff4cc; --ex: #e3eefc; --win: #2e7d4f; --draw: #6b7684; --loss: #c8202f; }
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
  table.stats th.n.num, table.stats td.n.num { width: 1.9em; padding-left: 0; padding-right: 4px; color: var(--muted); font-size: .9em; }
  .pts { font-weight: bold; }
  tbody tr.alt td { background: var(--zebra); }
  tbody tr.mark td { background: var(--mark); font-weight: bold; }
  tbody tr.ex td { background: var(--ex); }
  tr.zero td { color: var(--muted); }
  .player { display: flex; align-items: center; gap: 8px; }
  .face { display: block; width: 21px; height: 28px; object-fit: cover; border-radius: 3px; flex: 0 0 21px; }
  table.players td { padding-top: 3px; padding-bottom: 3px; }
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
  .score { display: inline-grid; grid-template-columns: 1.35em .45em 1.35em; align-items: center; font-weight: bold; vertical-align: middle; }
  .score .h { text-align: right; } .score .colon { text-align: center; } .score .a { text-align: left; }
  .score .wide { grid-column: 1 / -1; text-align: center; font-weight: bold; }
  a.score { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
  .tag { display: inline-block; width: 2.9em; margin-left: 7px; text-align: left; vertical-align: middle; }
  tbody tr.half td { border-top: 3px solid var(--line); }
  .pill { display: inline-block; min-width: 18px; padding: 1px 5px; border-radius: 4px; color: #fff; font-size: 12px; font-weight: bold; text-align: center; }
  .pill.bye { padding: 2px 12px; text-transform: uppercase; letter-spacing: .08em; }
  .pill.w { background: var(--win); } .pill.d { background: var(--draw); } .pill.l { background: var(--loss); }
  .pill.next { background: var(--accent); font-size: 10px; padding: 1px 4px; text-transform: uppercase; letter-spacing: 0; }
  /* A friendly outside the league: one card-like line across the schedule. */
  td.exwhen { white-space: nowrap; line-height: 1.25; border-left: 4px solid var(--accent); padding-left: 8px; }
  td.exwhen small { display: block; color: var(--muted); font-size: 11px; }
  td.exwhen a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; font-weight: normal; }
  .pill.ex { background: var(--accent); white-space: normal; max-width: 6.5em; line-height: 1.15; padding: 2px 6px; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; }
  .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-block: 2px solid var(--accent); margin-bottom: 10px; }
  .summary div { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; }
  .summary div + div { border-left: 1px solid var(--line); }
  .summary span { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
  .summary b { font-size: 24px; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .summary .total b { color: var(--loss); }
  .search { position: relative; margin-bottom: 8px; }
  .search input { width: 100%; box-sizing: border-box; font: inherit; padding: 7px 32px 7px 10px; border: 1px solid var(--line); border-radius: 6px; color: var(--fg); background: #fff; }
  .search input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .search button { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); border: 0; background: none; color: var(--muted); font-size: 18px; line-height: 1; padding: 4px 8px; cursor: pointer; }
  .search input::-webkit-search-cancel-button { display: none; }
  .nomatch { padding: 14px 8px; color: var(--muted); }
  h2.sub { margin: 14px 0 2px; font-size: 12px; font-weight: bold; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
  .narrow-only { display: none; }
  /* Phones: the iframe keeps its fixed height, so narrow layouts drop detail instead of stacking rows. */
  @media (max-width: 600px) {
    .wide-only, .opt { display: none; }
    .narrow-only { display: table-cell; }
    table.stats { font-size: 13px; }
    table.schedule { font-size: 12px; }
    table.compact th, table.compact td { padding-left: 3px; padding-right: 3px; }
    table.schedule .club img, table.schedule .club svg { display: none; }
    table.schedule .club { display: block; max-width: 74px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    table.schedule .pill { min-width: 0; padding: 1px 4px; font-size: 10px; }
    table.schedule td.team:last-child { padding-left: 6px; }
    table.compact th, table.compact td { padding-left: 2px; padding-right: 2px; }
    table.schedule .pill.next { display: none; }
    td.exwhen { padding-left: 4px; }
    td.exwhen small { font-size: 10px; }
    table.schedule .pill.ex { max-width: 4.6em; font-size: 9px; letter-spacing: 0; }
    table.schedule .tag { width: 1.6em; margin-left: 4px; }
    table.stats td { padding-left: 3px; padding-right: 3px; }
    table.stats th { padding-left: 3px; padding-right: 3px; }
    th[data-sort] button { padding: 5px 3px; }
    .foot { font-size: 10px; }
    .summary div { padding: 6px; }
    .summary span { font-size: 9px; letter-spacing: .02em; }
    .summary b { font-size: 19px; }
  }
  @media (max-width: 370px) {
    table.schedule .club { max-width: 64px; }
    table.schedule { font-size: 11px; }
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .pts a { text-decoration: underline; text-underline-offset: 2px; }
  .foot { margin: 8px 0 0; font-size: 11px; color: var(--muted); }
  .msg { padding: 12px; }
</style></head><body>
${body}
<p class="foot">${escapeHtml(legend)} · Zdroj: <a href="${sourceUrl}" target="_blank" rel="noopener">GameStats</a>, aktualizováno ${formatTime(updatedAt)}</p>
<script>
// Zebra stripes follow the visible order, so they stay even after sorting or filtering.
const restripe = (tbody) => {
  [...tbody.rows].filter((row) => !row.hidden).forEach((row, i) => row.classList.toggle("alt", i % 2 === 1));
};
document.querySelectorAll("tbody").forEach(restripe);

// Player search: accent-insensitive, so "horejsi" finds "Hořejší".
const fold = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
document.querySelectorAll("[data-filter]").forEach((box) => {
  const input = box.querySelector("input");
  const clear = box.querySelector("button");
  // data-filter lists the tables to search (ids); the message for no match belongs to the first.
  const ids = box.dataset.filter.split(" ");
  const tables = ids.map((id) => document.getElementById(id)).filter(Boolean);
  const empty = document.getElementById(ids[0] + "-empty");
  const apply = () => {
    const q = fold(input.value.trim());
    let total = 0;
    tables.forEach((table) => {
      let shown = 0;
      [...table.tBodies[0].rows].forEach((row) => {
        row.hidden = q !== "" && !fold(row.dataset.name || row.textContent).includes(q);
        if (!row.hidden) shown += 1;
      });
      const wrap = table.closest("[data-hide-empty]");
      if (wrap) wrap.hidden = shown === 0;
      total += shown;
      restripe(table.tBodies[0]);
    });
    clear.hidden = q === "";
    empty.hidden = total > 0;
  };
  input.addEventListener("input", apply);
  clear.addEventListener("click", () => { input.value = ""; apply(); input.focus(); });
  apply();
});

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
      restripe(tbody);
      headers.forEach((h) => h.removeAttribute("aria-sort"));
      th.setAttribute("aria-sort", dir > 0 ? "ascending" : "descending");
    });
  });
});
</script>
</body></html>`;
