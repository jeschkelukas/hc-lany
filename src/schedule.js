import { GAMESTATS, TEAM, cellsOf, decode, escapeHtml, renderShell, rowsOf, stripTags, teamBadge } from "./page.js";
import { findReport } from "./reports.js";

export const SCHEDULE_SOURCE = `${GAMESTATS}/schedule`;

// Season draw for HC Lány as published by the club: GameStats has no rounds or bye weeks.
// `planned` is the originally scheduled kick-off; when GameStats shows a different time,
// the widget prints the planned one struck through, the way the club marks a moved match.
// `bye` marks a free round, `halfBreak` draws a divider before the second half of the season.
const FIXTURES = [
  { round: 1, home: "Sýkořice", away: TEAM, planned: "2026-11-06 20:15" },
  { round: 2, home: TEAM, away: "Kralovice 1944", planned: "2026-11-13 20:15" },
  { round: 3, home: "Mladotice", away: TEAM, planned: "2026-11-20 21:50" },
  { round: 4, home: TEAM, away: "Old Stars", planned: "2026-11-26 22:05" },
  { round: 5, home: "Rynholec", away: TEAM, planned: "2026-12-04 21:50" },
  { round: 6, bye: true },
  { round: 7, home: TEAM, away: "Nové Strašecí", planned: "2026-12-18 20:15" },
  { round: 8, home: "Delfins Zátiší", away: TEAM, planned: "2027-01-07 20:30" },
  { round: 9, home: TEAM, away: "Lokomotiva", planned: "2027-01-14 22:05" },
  { round: 10, home: TEAM, away: "Sýkořice", planned: "2027-01-21 20:30", halfBreak: true },
  { round: 11, home: "Kralovice 1944", away: TEAM, planned: "2027-01-28 20:30" },
  { round: 12, home: TEAM, away: "Mladotice", planned: "2027-02-11 22:05" },
  { round: 13, home: "Old Stars", away: TEAM, planned: "2027-02-19 21:50" },
  { round: 14, home: TEAM, away: "Rynholec", planned: "2027-02-25 22:05" },
  { round: 15, bye: true },
  { round: 16, home: "Nové Strašecí", away: TEAM, planned: "2027-03-11 20:30" },
  { round: 17, home: TEAM, away: "Delfins Zátiší", planned: "2027-03-19 20:15" },
  { round: 18, home: "Lokomotiva", away: TEAM, planned: "2027-03-26 21:50" },
];

// Friendlies outside the league (not on GameStats), shown in the schedule in date order without a
// round. `date` alone means the kick-off time is not known yet; add " HH:MM" once it is, and the
// result as `score: [home, away]` after the game.
const EXHIBITIONS = [
  { label: "Winter Classic", venue: "zimní stadion Dobříš", place: "Dobříš", home: TEAM, away: "Nové Strašecí", date: "2027-01-09" },
];

// First planned kick-off minus two weeks: older club articles belong to previous seasons.
export const SEASON_START = Date.parse(`${FIXTURES.find((f) => f.planned).planned.slice(0, 10)}T00:00:00Z`) - 14 * 86_400_000;

const WEEKDAYS = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];

// Kick-offs are kept as "YYYY-MM-DD HH:MM" strings: sortable and free of time-zone shifts.
const toKey = (text) => {
  const m = text.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const [, d, mo, y, h, mi] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")} ${h.padStart(2, "0")}:${mi}`;
};

const DAY_MS = 86_400_000;
const dayOf = (key) => Date.parse(`${key.slice(0, 10)}T00:00:00Z`);

// A bye round has no date of its own: it is the Monday–Sunday week halfway between the
// planned kick-offs of the neighbouring rounds.
const byeWeek = (index) => {
  const before = FIXTURES.slice(0, index).findLast((f) => f.planned);
  const after = FIXTURES.slice(index + 1).find((f) => f.planned);
  if (!before || !after) return null;
  const mid = new Date((dayOf(before.planned) + dayOf(after.planned)) / 2);
  const monday = new Date(Date.UTC(mid.getUTCFullYear(), mid.getUTCMonth(), mid.getUTCDate()) - ((mid.getUTCDay() + 6) % 7) * DAY_MS);
  const sunday = new Date(monday.getTime() + 6 * DAY_MS);
  const short = (d) => `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
  const from = monday.getUTCFullYear() === sunday.getUTCFullYear() ? short(monday) : `${short(monday)}${monday.getUTCFullYear()}`;
  const sameMonth = monday.getUTCMonth() === sunday.getUTCMonth();
  return {
    full: `${from}–${short(sunday)}${sunday.getUTCFullYear()}`,
    compact: `${sameMonth ? `${monday.getUTCDate()}.` : short(monday)}–${short(sunday)}`,
  };
};

export const formatKickoff = (key) => {
  const [y, mo, d] = key.slice(0, 10).split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  return { day: `${weekday} ${d}.${mo}.${y}`, time: key.slice(11) || "čas upřesníme", tbd: !key.slice(11) };
};

const parseScore = (text) => {
  const m = text.match(/(\d+)\s*:\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
};

// GameStats does not publish match pages yet; if a row ever carries a link, the result links to it.
const linkIn = (cell) => {
  const m = cell?.match(/href="([^"]+)"/);
  if (!m) return null;
  const url = new URL(decode(m[1]), GAMESTATS);
  return url.protocol === "https:" ? url.href : null;
};

// Every match of the league HC Lány plays in (all teams), used for the teams' recent form.
export const parseLeagueMatches = (html, team) => {
  for (const section of html.split('<section class="mb-5"').slice(1)) {
    const table = section.split("</table>")[0];
    const matches = rowsOf(table).flatMap((row) => {
      const c = cellsOf(row);
      if (c.length < 4) return [];
      return [{ kickoff: toKey(stripTags(c[0])), home: stripTags(c[1]), away: stripTags(c[3]), score: parseScore(stripTags(c[2])) }];
    });
    if (matches.some((m) => m.home === team || m.away === team)) return matches;
  }
  return [];
};

// The schedule page has one section per league, each with a single table of all its matches.
export const parseSchedule = (html, team) => {
  const sections = html.split('<section class="mb-5"').slice(1);
  for (const section of sections) {
    const leagueMatch = section.match(/<p class="text-secondary mb-3">([^<]*)<\/p>/);
    const table = section.split("</table>")[0];
    const matches = rowsOf(table).flatMap((row) => {
      const c = cellsOf(row);
      if (c.length < 4) return [];
      const home = stripTags(c[1]);
      const away = stripTags(c[3]);
      if (home !== team && away !== team) return [];
      return [{
        kickoff: toKey(stripTags(c[0])),
        home,
        away,
        score: parseScore(stripTags(c[2])),
        note: c[4] ? stripTags(c[4]) : "",
        url: linkIn(c[2]) ?? linkIn(c[4]),
      }];
    });
    if (matches.length > 0) {
      return { league: leagueMatch ? decode(leagueMatch[1]).split(" · ")[0].trim() : "", matches };
    }
  }
  return null;
};

// Joins the static draw with live GameStats data by home/away pair (unique within a season).
// Matches GameStats has but the draw does not (e.g. a play-off) are appended without a round.
export const buildRounds = (matches, reports = []) => {
  const pairKey = (m) => `${m.home}|${m.away}`;
  const live = new Map(matches.map((m) => [pairKey(m), m]));
  const rounds = FIXTURES.map((f, index) => {
    if (f.bye) return { ...f, week: byeWeek(index) };
    const m = live.get(pairKey(f));
    live.delete(pairKey(f));
    return { ...f, kickoff: m?.kickoff ?? f.planned, score: m?.score ?? null, note: m?.note ?? "", url: m?.url ?? null };
  });
  const extra = [...live.values()]
    .sort((a, b) => (a.kickoff ?? "").localeCompare(b.kickoff ?? ""))
    .map((m) => ({ ...m, round: null, planned: m.kickoff }));
  const withReport = (r) => {
    if (r.bye || !r.score) return r;
    const ours = r.home === TEAM ? r.score[0] : r.score[1];
    const theirs = r.home === TEAM ? r.score[1] : r.score[0];
    const opponent = r.home === TEAM ? r.away : r.home;
    return { ...r, reportUrl: findReport(reports, { opponent, ours, theirs, kickoff: r.kickoff }) };
  };
  // Each friendly goes before the first dated game after it.
  const placed = [...rounds, ...extra];
  for (const e of EXHIBITIONS) {
    const at = placed.findIndex((r) => r.kickoff && r.kickoff > e.date);
    const row = { ...e, exhibition: true, round: null, kickoff: e.date, planned: e.date, score: e.score ?? null, note: "", url: null };
    placed.splice(at < 0 ? placed.length : at, 0, row);
  }
  return placed.map(withReport);
};

const outcome = (match) => {
  if (!match.score) return "";
  const [h, a] = match.score;
  const ours = match.home === TEAM ? h - a : a - h;
  if (ours > 0) return '<span class="pill w" title="Výhra">V</span>';
  if (ours < 0) return '<span class="pill l" title="Prohra">P</span>';
  return '<span class="pill d" title="Remíza">R</span>';
};

const shortDate = (key) => `${Number(key.slice(8, 10))}.${Number(key.slice(5, 7))}.`;

// Wide layout: date and time in their own columns. Narrow layout (phones): one compact
// "16.11. 21:45" column. A moved match shows the planned value struck through above the new one.
const kickoffCells = (r) => {
  if (!r.kickoff) return '<td class="wide-only"></td><td class="wide-only"></td><td class="narrow-only"></td>';
  const now = formatKickoff(r.kickoff);
  const nowShort = `${shortDate(r.kickoff)} <span class="muted">${escapeHtml(now.time)}</span>`;
  if (!r.planned || r.planned === r.kickoff) {
    return `<td class="wide-only">${escapeHtml(now.day)}</td><td class="wide-only muted">${escapeHtml(now.time)}</td><td class="narrow-only">${nowShort}</td>`;
  }
  const was = formatKickoff(r.planned);
  const stack = (old, current) => `<s class="muted">${old}</s><br><span class="moved">${current}</span>`;
  return `<td class="wide-only">${stack(escapeHtml(was.day), escapeHtml(now.day))}</td><td class="wide-only">${stack(escapeHtml(was.time), escapeHtml(now.time))}</td>`
    + `<td class="narrow-only">${stack(shortDate(r.planned), `${shortDate(r.kickoff)} ${escapeHtml(now.time)}`)}</td>`;
};

// Fixed slots (home goals | colon | away goals | outcome) keep every row aligned on the colon.
const resultCell = (r, isNext, detailUrl) => {
  if (!r.score) {
    const nextTag = isNext ? '<span class="pill next">další</span>' : "";
    return `<span class="score"><span class="wide">–</span></span><span class="tag">${nextTag}</span>`;
  }
  const tag = `<span class="tag">${outcome(r)}</span>`;
  const goals = `<span class="h">${r.score[0]}</span><span class="colon">:</span><span class="a">${r.score[1]}</span>`;
  const title = r.note ? ` title="${escapeHtml(r.note)}"` : "";
  // Club reports open in the club page itself (the widget sits in its iframe); GameStats in a new tab.
  // A generated match detail opens inside the same iframe; without one, fall back to the club report.
  if (detailUrl) return `<a class="score" href="${escapeHtml(detailUrl)}" title="Detail zápasu">${goals}</a>${tag}`;
  if (r.reportUrl) return `<a class="score" href="${escapeHtml(r.reportUrl)}" target="_top"${title || ' title="Článek o zápase"'}>${goals}</a>${tag}`;
  if (r.url) return `<a class="score" href="${escapeHtml(r.url)}" target="_blank" rel="noopener"${title}>${goals}</a>${tag}`;
  return `<span class="score"${title}>${goals}</span>${tag}`;
};

export const renderSchedule = ({ league, matches, reports, logos, detailUrlOf = () => null, updatedAt }) => {
  const rows = buildRounds(matches, reports);
  const next = rows
    .filter((r) => !r.bye && r.kickoff && !r.score)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];
  const side = (name) => (name === TEAM ? `<span class="me">${teamBadge(name, logos)}</span>` : teamBadge(name, logos));
  const rowClass = (r) => [r === next && "mark", r.exhibition && "ex", r.halfBreak && "half"].filter(Boolean).join(" ");
  // The schedule iframe is tall enough for a game detail (940 px); the rows stretch to fill it.
  const body = `<style>html, body { height: 100%; } body { box-sizing: border-box; display: flex; flex-direction: column; } .box.fill { flex: 1 1 auto; } .box.fill table { height: 100%; }</style>
<div class="box fill"><table class="compact schedule">
  <thead><tr><th class="n">Kolo</th><th class="wide-only">Termín</th><th class="wide-only">Čas</th><th class="narrow-only">Termín</th><th>Domácí</th><th class="c">Výsledek</th><th>Hosté</th></tr></thead>
  <tbody>${rows.map((r) => {
    const cls = rowClass(r);
    const open = `<tr${cls ? ` class="${cls}"` : ""}><td class="n rank">${r.round ? `${r.round}.` : ""}</td>`;
    // A friendly is one free-text line across the whole table: no round, and it never widens a column.
    if (r.exhibition) {
      const when = formatKickoff(r.kickoff);
      const score = r.score ? ` <b>${r.score[0]}:${r.score[1]}</b> ` : " – ";
      return `<tr class="${cls}"><td colspan="7" class="exrow"><span class="pill ex" title="${escapeHtml(`Mimosoutěžní utkání · ${r.venue}`)}">${escapeHtml(r.label)}</span> `
        + `<b>${escapeHtml(when.day)}</b> <span class="muted">${escapeHtml(when.time)}</span> · `
        + `${escapeHtml(r.home)}${score}${escapeHtml(r.away)} <span class="muted">· ${escapeHtml(r.place)}</span></td></tr>`;
    }
    if (r.bye) {
      return `${open}<td class="muted wide-only" colspan="2">${escapeHtml(r.week?.full ?? "")}</td><td class="muted narrow-only">${escapeHtml(r.week?.compact ?? "")}</td>`
        + `<td colspan="3" class="c"><span class="pill d bye">volno</span></td></tr>`;
    }
    return `${open}${kickoffCells(r)}<td class="team">${side(r.home)}</td>
    <td class="res">${resultCell(r, r === next, r.score ? detailUrlOf(r) : null)}</td>
    <td class="team">${side(r.away)}</td></tr>`;
  }).join("")}
  </tbody></table></div>`;
  return renderShell({
    title: `Rozpis utkání ${TEAM}`,
    body,
    legend: `${league || "BNB Cup"}${EXHIBITIONS.map((e) => ` · ${e.label} = mimosoutěžní utkání (${e.venue})`).join("")} · přeložený termín je přeškrtnutý · klik na výsledek otevře detail zápasu · V = výhra, R = remíza, P = prohra`,
    sourceUrl: SCHEDULE_SOURCE,
    updatedAt,
  });
};
