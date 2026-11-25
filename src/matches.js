import { TEAM, cellsOf, escapeHtml, formatTime, placeholderLogo, rowsOf, slug, stripTags } from "./page.js";
import { formatKickoff } from "./schedule.js";

// GameStats has no public match pages, but every player page lists the matches the player
// scored in ("Přehled zápasů"). Collecting those rows for all HC Lány scorers rebuilds who
// scored what in each match, which the match detail widget shows.

const CONCURRENCY = 4;

const toKey = (text) => {
  const m = text.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const [, d, mo, y, h, mi] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")} ${h.padStart(2, "0")}:${mi}`;
};

export const parsePlayerMatches = (html) => {
  const section = html.split("Přehled zápasů")[1]?.split("</table>")[0] ?? "";
  return rowsOf(section).flatMap((row) => {
    const c = cellsOf(row);
    if (c.length < 6) return [];
    const kickoff = toKey(stripTags(c[0]));
    if (!kickoff) return [];
    const num = (i) => Number.parseInt(stripTags(c[i]), 10) || 0;
    return [{ kickoff, opponent: stripTags(c[1]).replace(/^@\s*/, ""), g: num(3), a: num(4), pts: num(5) }];
  });
};

// Fetches player pages a few at a time; a failed page only drops that player's match rows.
export const fetchPlayerMatches = async (players) => {
  const results = [];
  for (let i = 0; i < players.length; i += CONCURRENCY) {
    const batch = players.slice(i, i + CONCURRENCY);
    results.push(...await Promise.all(batch.map(async (p) => {
      try {
        const res = await fetch(p.url);
        if (!res.ok) throw new Error(String(res.status));
        return { name: p.name, matches: parsePlayerMatches(await res.text()) };
      } catch (error) {
        console.warn(`Player page for ${p.name} failed (${error.message})`);
        return { name: p.name, matches: [] };
      }
    })));
  }
  return results;
};

export const matchSlug = (r) => `${r.kickoff.slice(0, 10)}-${slug(r.home === TEAM ? r.away : r.home)}`;

// Map of kick-off -> HC Lány scorers in that match, best first.
export const scorersByMatch = (playerMatches) => {
  const byKickoff = new Map();
  for (const { name, matches } of playerMatches) {
    for (const m of matches) {
      if (m.pts === 0) continue;
      byKickoff.set(m.kickoff, [...(byKickoff.get(m.kickoff) ?? []), { name, g: m.g, a: m.a, pts: m.pts }]);
    }
  }
  for (const list of byKickoff.values()) {
    list.sort((x, y) => y.pts - x.pts || y.g - x.g || x.name.localeCompare(y.name, "cs"));
  }
  return byKickoff;
};

const resultOf = (r) => {
  const ours = r.home === TEAM ? r.score[0] - r.score[1] : r.score[1] - r.score[0];
  if (ours > 0) return { cls: "w", text: "Výhra" };
  if (ours < 0) return { cls: "l", text: "Prohra" };
  return { cls: "d", text: "Remíza" };
};

const logo = (name, logos) => {
  const file = logos.get(name);
  return file ? `<img class="logo" src="../../logos/${escapeHtml(file)}" alt="">` : `<span class="logo">${placeholderLogo(name)}</span>`;
};

const PHOTO_PLACEHOLDER = '<svg class="face" viewBox="0 0 24 32" aria-hidden="true"><rect width="24" height="32" rx="3" fill="var(--ph-bg)"/><circle cx="12" cy="12" r="5" fill="var(--ph-fg)"/><path d="M3 32c0-6 4-10 9-10s9 4 9 10z" fill="var(--ph-fg)"/></svg>';

export const renderMatch = ({ round, scorers, logos, photos, league, scheduleUrl, updatedAt }) => {
  const when = formatKickoff(round.kickoff);
  const res = resultOf(round);
  const ourGoals = round.home === TEAM ? round.score[0] : round.score[1];
  const listedGoals = scorers.reduce((sum, s) => sum + s.g, 0);
  const side = (name) => `<div class="side${name === TEAM ? " us" : ""}">${logo(name, logos)}<span>${escapeHtml(name)}</span></div>`;
  const rows = scorers.map((s) => {
    const file = photos.get(s.name);
    const face = file ? `<img class="face" src="../../photos/${escapeHtml(file)}" alt="">` : PHOTO_PLACEHOLDER;
    return `<tr><td><span class="player">${face}${escapeHtml(s.name)}</span></td><td class="n">${s.g}</td><td class="n">${s.a}</td><td class="n pts">${s.pts}</td></tr>`;
  }).join("");
  const missing = listedGoals < ourGoals
    ? `<p class="note">GameStats zatím nemá u ${ourGoals - listedGoals === 1 ? "1 gólu" : `${ourGoals - listedGoals} gólů`} HC Lány zapsaného střelce.</p>`
    : "";

  return `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(`${round.home} ${round.score[0]}:${round.score[1]} ${round.away}`)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&display=swap">
<script>if (/(^|[?&])dark\\b/.test(location.search)) document.documentElement.classList.add("dark");</script>
<style>
  :root {
    --bg: #fff; --card: #f6f8fa; --line: #dfe4ea; --fg: #1b2430; --dim: #6b7684; --accent: #1f4fa3;
    --hl: #1f4fa3; --win: #2e7d4f; --draw: #6b7684; --loss: #c8202f; --ph-bg: #dfe4ea; --ph-fg: #a9b4c0;
    --display: "Oswald", "Arial Narrow", Impact, sans-serif;
  }
  /* Opened from the dark homepage overview (?dark): match its dark-blue box. */
  html.dark { --bg: #1e3645; --card: #254252; --line: rgba(255,255,255,.09); --fg: #eef3f7; --dim: #9db2c1; --accent: #f5c518; --hl: #f5c518; --ph-bg: #36556a; --ph-fg: #6f8ba0; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 8px; background: var(--bg); color: var(--fg); font: 14px/1.4 Verdana, Arial, sans-serif; }
  a { color: var(--accent); }
  .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 12px; }
  .back { font: 600 12px/1 var(--display); letter-spacing: .08em; text-transform: uppercase; text-decoration: none; }
  .back:hover { text-decoration: underline; }
  .meta { color: var(--dim); }
  .hero { background: var(--card); border: 1px solid var(--line); border-top: 3px solid var(--hl); border-radius: 8px; padding: 12px; }
  .label { display: flex; justify-content: space-between; align-items: center; font: 600 12px/1 var(--display); letter-spacing: .1em; text-transform: uppercase; color: var(--hl); margin-bottom: 10px; }
  .match { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; }
  .side { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; font: 600 16px/1.1 var(--display); letter-spacing: .02em; text-transform: uppercase; }
  .side.us span { color: var(--hl); }
  .logo, .logo svg { width: 56px; height: 56px; object-fit: contain; display: block; }
  .score { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .score b { font: 700 44px/1 var(--display); letter-spacing: .02em; font-variant-numeric: tabular-nums; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 4px; color: #fff; font: 700 12px/1.3 var(--display); letter-spacing: .06em; text-transform: uppercase; }
  .pill.w { background: var(--win); } .pill.d { background: var(--draw); } .pill.l { background: var(--loss); }
  h2 { font: 600 13px/1 var(--display); letter-spacing: .1em; text-transform: uppercase; color: var(--hl); margin: 14px 0 6px; }
  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  th { font-size: 11px; color: var(--dim); font-weight: normal; text-align: left; padding: 4px 6px; border-bottom: 2px solid var(--hl); }
  td { padding: 2px 6px; border-bottom: 1px solid var(--line); white-space: nowrap; }
  .n { text-align: right; width: 3em; }
  .pts { font: 700 15px/1 var(--display); color: var(--hl); }
  .player { display: flex; align-items: center; gap: 8px; }
  .face { width: 18px; height: 24px; object-fit: cover; border-radius: 3px; display: block; flex: 0 0 18px; }
  .empty, .note { color: var(--dim); margin: 6px 0; font-size: 12px; }
  .foot { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-top: 10px; font-size: 11px; color: var(--dim); }
  .foot a { font: 600 12px/1 var(--display); letter-spacing: .08em; text-transform: uppercase; text-decoration: none; }
  @media (max-width: 480px) {
    .side { font-size: 13px; }
    .logo, .logo svg { width: 44px; height: 44px; }
    .score b { font-size: 36px; }
    .meta { display: none; }
  }
</style></head><body>
<div class="top"><a class="back" href="${escapeHtml(scheduleUrl)}" onclick="if (history.length > 1) { history.back(); return false; }">← Zpět</a><span class="meta">${escapeHtml(league)}</span></div>
<section class="hero">
  <div class="label"><span>${round.round ? `${round.round}. kolo · ` : ""}${escapeHtml(when.day)} · ${escapeHtml(when.time)}</span><span class="pill ${res.cls}">${res.text}</span></div>
  <div class="match">${side(round.home)}<div class="score"><b>${round.score[0]}:${round.score[1]}</b></div>${side(round.away)}</div>
</section>
<h2>Body ${escapeHtml(TEAM)}</h2>
${scorers.length ? `<table><thead><tr><th>Hráč</th><th class="n">G</th><th class="n">A</th><th class="n">B</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="empty">V tomto zápase nemá žádný hráč HC Lány zapsaný bod.</p>'}
${missing}
<div class="foot"><span>Zdroj: GameStats · aktualizováno ${formatTime(updatedAt)}</span>${round.reportUrl ? `<a href="${escapeHtml(round.reportUrl)}" target="_top">Článek o zápase →</a>` : ""}</div>
</body></html>`;
};
