import { TEAM, escapeHtml, formatTime, placeholderLogo } from "./page.js";
import { buildRounds, formatKickoff } from "./schedule.js";

// Compact homepage widget: next match, last result with form, mini standings and top scorers.
// It sits in the club homepage's dark-blue intro box, so it uses the box colour as its background.
const CLUB = "https://hclany.estranky.cz/clanky";
export const CLUB_PAGES = {
  schedule: `${CLUB}/rozpis-utkani-2026-2027.html`,
  standings: `${CLUB}/tabulka-souteze-2026-2027.html`,
  scoring: `${CLUB}/kanadske-bodovani-2026-2027.html`,
};
const TOP_SCORERS = 9;
const FORM_MATCHES = 5;
const DAY_MS = 86_400_000;

const pragueDay = (date) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return Date.parse(`${parts}T00:00:00Z`);
};

const countdown = (kickoff, now) => {
  const days = Math.round((Date.parse(`${kickoff.slice(0, 10)}T00:00:00Z`) - pragueDay(now)) / DAY_MS);
  if (days <= 0) return "dnes";
  if (days === 1) return "zítra";
  if (days < 5) return `za ${days} dny`;
  return `za ${days} dní`;
};

const resultOf = (r) => {
  const ours = r.home === TEAM ? r.score[0] - r.score[1] : r.score[1] - r.score[0];
  if (ours > 0) return { cls: "w", letter: "V", title: "Výhra" };
  if (ours < 0) return { cls: "l", letter: "P", title: "Prohra" };
  return { cls: "d", letter: "R", title: "Remíza" };
};

const logo = (name, logos, cls) => {
  const file = logos.get(name);
  return file
    ? `<img class="${cls}" src="../logos/${escapeHtml(file)}" alt="">`
    : `<span class="${cls}">${placeholderLogo(name)}</span>`;
};

const PHOTO_PLACEHOLDER = '<svg class="face" viewBox="0 0 24 32" aria-hidden="true"><rect width="24" height="32" rx="3" fill="#36556a"/><circle cx="12" cy="12" r="5" fill="#6f8ba0"/><path d="M3 32c0-6 4-10 9-10s9 4 9 10z" fill="#6f8ba0"/></svg>';

// A team's last results across the whole league, newest first (the way hockey tables show form).
const formOf = (team, leagueMatches) => leagueMatches
  .filter((m) => m.score && m.kickoff && (m.home === team || m.away === team))
  .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
  .slice(0, FORM_MATCHES)
  .map((m) => {
    const diff = m.home === team ? m.score[0] - m.score[1] : m.score[1] - m.score[0];
    const [cls, letter] = diff > 0 ? ["w", "V"] : diff < 0 ? ["l", "P"] : ["d", "R"];
    const title = `${m.score[0]}:${m.score[1]} (${m.home} – ${m.away}) ${formatKickoff(m.kickoff).day.slice(3)}`;
    return `<span class="pill ${cls}" title="${escapeHtml(title)}">${letter}</span>`;
  })
  .join("");

const nextMatchCard = (next, logos, now, leagueMatches) => {
  if (!next) return `<section class="card next"><div class="label">Sezóna</div><p class="empty">Všechny zápasy sezóny jsou odehrané.</p></section>`;
  const when = formatKickoff(next.kickoff);
  const side = (name) => {
    const form = formOf(name, leagueMatches);
    return `<div class="side${name === TEAM ? " us" : ""}">${logo(name, logos, "big")}<span>${escapeHtml(name)}</span>${form ? `<div class="mform" title="Forma, nejnovější vlevo">${form}</div>` : ""}</div>`;
  };
  return `<section class="card next">
  <div class="label"><span>Další zápas${next.round ? ` · ${next.round}. kolo` : ""}${next.exhibition ? ` · ${escapeHtml(next.label)}` : ""}</span><span class="soon">${countdown(next.kickoff, now)}</span></div>
  <div class="match">${side(next.home)}<div class="when"><b${when.tbd ? ' class="tbd" title="Čas výkopu upřesníme"' : ""}>${escapeHtml(when.tbd ? "čas upřesníme" : when.time)}</b><span>${escapeHtml(when.day)}</span></div>${side(next.away)}</div>${next.exhibition ? `<div class="venue">Mimosoutěžní utkání · ${escapeHtml(next.venue)}</div>` : ""}
</section>`;
};

const lastResultRow = (played, detailUrlOf) => {
  const last = played.at(-1);
  if (!last) return "";
  const res = resultOf(last);
  const score = `${last.score[0]}:${last.score[1]}`;
  const detail = detailUrlOf(last);
  const scoreHtml = detail
    ? `<a href="${escapeHtml(`${detail}${detail.includes("?") ? "&" : "?"}dark`)}" title="Detail zápasu">${score}</a>`
    : last.reportUrl ? `<a href="${escapeHtml(last.reportUrl)}" target="_top" title="Článek o zápase">${score}</a>` : score;
  return `<section class="card last">
  <div class="label">Poslední výsledek</div>
  <div class="lastrow"><span class="teams">${escapeHtml(last.home)} <b class="score">${scoreHtml}</b> ${escapeHtml(last.away)}</span><span class="pill ${res.cls}" title="${res.title}">${res.letter}</span></div>
</section>`;
};

// The games after the next one: date, home or away and the opponent.
const UPCOMING = 3;
const upcomingCard = (upcoming, logos) => {
  if (!upcoming.length) return "";
  const rows = upcoming.map((r) => {
    const home = r.home === TEAM;
    const opponent = home ? r.away : r.home;
    const when = formatKickoff(r.kickoff);
    return `<tr><td class="dim">${escapeHtml(when.day)}</td><td class="dim">${when.tbd ? '<span title="Čas upřesníme">?</span>' : escapeHtml(when.time)}</td><td class="dim">${r.exhibition ? `<span class="opt" title="${escapeHtml(`Mimosoutěžní utkání · ${r.venue}`)}">${escapeHtml(r.label)}</span><span class="short">${escapeHtml(r.short)}</span>` : home ? "doma" : "venku"}</td><td class="wide"><span class="team">${logo(opponent, logos, "mini")}<span>${escapeHtml(opponent)}</span></span></td></tr>`;
  }).join("");
  return `<section class="card upcoming"><div class="label">Další zápasy</div><table><tbody>${rows}</tbody></table></section>`;
};

const standingsCard = (standings, logos) => `<section class="card">
  <div class="label">Tabulka · ${escapeHtml(standings.league)}</div>
  <table><tbody>${standings.teams.map((t) => `<tr${t.name === TEAM ? ' class="us"' : ""}>
    <td class="n dim">${escapeHtml(t.rank)}.</td><td><span class="team">${logo(t.name, logos, "mini")}<span>${escapeHtml(t.name)}</span></span></td>
    <td class="n dim opt">${t.gp}</td><td class="n pts">${t.pts}</td></tr>`).join("")}
  </tbody></table>
  <a class="more" href="${CLUB_PAGES.standings}" target="_top">Celá tabulka →</a>
</section>`;

const scorersCard = (rows, photos) => {
  const top = rows.filter((r) => r.pts > 0).slice(0, TOP_SCORERS);
  return `<section class="card">
  <div class="label">Kanadské bodování</div>
  <table><tbody>${top.map((r) => {
    const file = photos.get(r.name);
    const face = file ? `<img class="face" src="../photos/${escapeHtml(file)}" alt="">` : PHOTO_PLACEHOLDER;
    return `<tr><td class="n dim">${escapeHtml(r.rankLabel)}</td><td><span class="team">${face}<span>${escapeHtml(r.name)}</span></span></td>
    <td class="n dim opt" title="góly + asistence">${r.g}+${r.a}</td><td class="n pts">${r.pts}</td></tr>`;
  }).join("")}
  </tbody></table>
  <a class="more" href="${CLUB_PAGES.scoring}" target="_top">Celé bodování →</a>
</section>`;
};

export const renderOverview = ({ schedule, leagueMatches = [], reports, standings, scoringRows, logos, photos, detailUrlOf = () => null, updatedAt }) => {
  const rounds = buildRounds(schedule.matches, reports).filter((r) => !r.bye && r.kickoff);
  const byKickoff = (a, b) => a.kickoff.localeCompare(b.kickoff);
  const played = rounds.filter((r) => r.score).sort(byKickoff);
  const next = rounds.filter((r) => !r.score).sort(byKickoff)[0];

  return `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(TEAM)} – přehled</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&display=swap">
<style>
  :root {
    --bg: #1e3645; --card: #254252; --line: rgba(255,255,255,.09); --fg: #eef3f7; --dim: #9db2c1;
    --gold: #f5c518; --win: #3fb37f; --draw: #8a9aa8; --loss: #e5534b;
    --display: "Oswald", "Arial Narrow", Impact, sans-serif;
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 4px; background: var(--bg); color: var(--fg); font: 13px/1.35 Verdana, Arial, sans-serif; }
  .upcoming { margin-bottom: 10px; padding-top: 8px; padding-bottom: 6px; }
  .upcoming .label { margin-bottom: 4px; }
  .upcoming td { height: 24px; }
  .upcoming td.wide { width: 100%; }
  a { color: inherit; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; min-width: 0; }
  .label { display: flex; justify-content: space-between; align-items: center; font: 600 12px/1 var(--display); letter-spacing: .1em; text-transform: uppercase; color: var(--gold); margin-bottom: 8px; }
  .next { margin-bottom: 10px; border-top: 3px solid var(--gold); padding-bottom: 12px; }
  .soon { color: var(--bg); background: var(--gold); border-radius: 99px; padding: 3px 9px; letter-spacing: .06em; }
  .match { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; }
  .side { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; font: 600 16px/1.1 var(--display); letter-spacing: .02em; text-transform: uppercase; }
  .side.us > span { color: var(--gold); }
  .big { width: 52px; height: 52px; object-fit: contain; display: block; }
  .big svg { width: 52px; height: 52px; display: block; }
  .when { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .when b { font: 700 30px/1 var(--display); letter-spacing: .02em; }
  .when span { color: var(--dim); font-size: 12px; white-space: nowrap; }
  .when b.tbd { font-size: 16px; color: var(--dim); text-transform: uppercase; }
  .venue { margin-top: 8px; text-align: center; color: var(--dim); font-size: 12px; }
  .last { margin-bottom: 10px; display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 12px; }
  .last .label { margin: 0; }
  .lastrow { display: flex; align-items: center; gap: 8px; justify-content: center; min-width: 0; }
  .teams { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .score { font: 700 17px/1 var(--display); margin: 0 4px; letter-spacing: .03em; }
  .score a { text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--gold); }
  .mform { display: flex; gap: 3px; justify-content: center; }
  .mform .pill { min-width: 16px; padding: 1px 3px; font-size: 10px; }
  .foot a.src { font: inherit; letter-spacing: 0; text-transform: none; text-decoration: underline; text-underline-offset: 2px; }
  .pill { display: inline-block; min-width: 19px; padding: 2px 4px; border-radius: 4px; color: #fff; font: 700 11px/1.2 var(--display); text-align: center; }
  .pill.w { background: var(--win); } .pill.d { background: var(--draw); } .pill.l { background: var(--loss); }
  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; table-layout: auto; }
  td { height: 26px; }
  td { padding: 3px 4px; border-top: 1px solid var(--line); white-space: nowrap; }
  tr:first-child td { border-top: 0; }
  .n { text-align: right; width: 1%; }
  .dim { color: var(--dim); }
  .pts { font: 700 14px/1 var(--display); color: var(--gold); padding-left: 8px; }
  .team { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .team span { overflow: hidden; text-overflow: ellipsis; }
  tr.us td { background: rgba(245,197,24,.14); color: var(--gold); font-weight: bold; }
  .mini, .mini svg { width: 16px; height: 16px; object-fit: contain; display: block; flex: 0 0 16px; }
  .face { width: 14px; height: 18px; object-fit: cover; border-radius: 3px; display: block; flex: 0 0 14px; }
  .more { display: inline-block; margin-top: 8px; font: 600 11px/1 var(--display); letter-spacing: .08em; text-transform: uppercase; color: var(--gold); text-decoration: none; }
  .more:hover { text-decoration: underline; }
  .foot { display: flex; justify-content: space-between; gap: 8px; margin-top: 8px; padding: 0 2px; color: var(--dim); font-size: 10px; }
  .foot a { color: var(--gold); text-decoration: none; font: 600 11px/1 var(--display); letter-spacing: .08em; text-transform: uppercase; }
  .empty { margin: 0; color: var(--dim); }
  .short { display: none; }
  /* Phones: keep the two columns (the iframe height is fixed) and drop secondary details. */
  @media (max-width: 480px) {
    body { font-size: 12px; }
    .opt { display: none; }
    .short { display: inline; }
    .last { grid-template-columns: auto 1fr; gap: 8px; }
    .side { font-size: 14px; }
    .big, .big svg { width: 44px; height: 44px; }
    .when b { font-size: 26px; }
    .card { padding: 8px; }
    .team { max-width: 104px; }
    .team span { white-space: nowrap; }
    .foot .upd { display: none; }
  }
</style></head><body>
${nextMatchCard(next, logos, updatedAt, leagueMatches)}
${lastResultRow(played, detailUrlOf)}
${upcomingCard(rounds.filter((r) => !r.score).sort(byKickoff).slice(1, 1 + UPCOMING), logos)}
<div class="grid">
${standingsCard(standings, logos)}
${scorersCard(scoringRows, photos)}
</div>
<div class="foot"><span><span class="upd">Zdroj: </span><a class="src" href="https://mini.gamestats.cz/i/bnb-cup" target="_blank" rel="noopener">GameStats</a><span class="upd"> · aktualizováno ${formatTime(updatedAt)}</span></span><a href="${CLUB_PAGES.schedule}" target="_top">Celý rozpis →</a></div>
</body></html>`;
};
