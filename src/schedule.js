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
  return `${from}–${short(sunday)}${sunday.getUTCFullYear()}`;
};

const formatKickoff = (key) => {
  const [y, mo, d] = key.slice(0, 10).split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  return { day: `${weekday} ${d}.${mo}.${y}`, time: key.slice(11) };
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
  return [...rounds, ...extra].map(withReport);
};

const outcome = (match) => {
  if (!match.score) return "";
  const [h, a] = match.score;
  const ours = match.home === TEAM ? h - a : a - h;
  if (ours > 0) return '<span class="pill w" title="Výhra">V</span>';
  if (ours < 0) return '<span class="pill l" title="Prohra">P</span>';
  return '<span class="pill d" title="Remíza">R</span>';
};

const kickoffCell = (r) => {
  if (!r.kickoff) return "–";
  const now = formatKickoff(r.kickoff);
  if (!r.planned || r.planned === r.kickoff) {
    return `${escapeHtml(now.day)} <span class="muted">${escapeHtml(now.time)}</span>`;
  }
  const was = formatKickoff(r.planned);
  return `<s class="muted">${escapeHtml(was.day)} ${escapeHtml(was.time)}</s><br><span class="moved">${escapeHtml(now.day)} ${escapeHtml(now.time)}</span>`;
};

const resultCell = (r, isNext) => {
  if (!r.score) return isNext ? '<span class="next">další</span>' : "–";
  const text = `${r.score[0]}:${r.score[1]}`;
  // Club reports open in the club page itself (the widget sits in its iframe); GameStats in a new tab.
  if (r.reportUrl) return `<a href="${escapeHtml(r.reportUrl)}" target="_top" title="Článek o zápase">${text}</a>`;
  return r.url ? `<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${text}</a>` : text;
};

export const renderSchedule = ({ league, matches, reports, logos, updatedAt }) => {
  const rows = buildRounds(matches, reports);
  const next = rows
    .filter((r) => !r.bye && r.kickoff && !r.score)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];
  const side = (name) => (name === TEAM ? `<span class="me">${teamBadge(name, logos)}</span>` : teamBadge(name, logos));
  const rowClass = (r) => [r === next && "mark", r.halfBreak && "half"].filter(Boolean).join(" ");
  const body = `<div class="box"><table class="compact">
  <thead><tr><th class="n">Kolo</th><th>Termín</th><th>Domácí</th><th class="c">Výsledek</th><th>Hosté</th></tr></thead>
  <tbody>${rows.map((r) => {
    const cls = rowClass(r);
    const open = `<tr${cls ? ` class="${cls}"` : ""}><td class="n rank">${r.round ? `${r.round}.` : ""}</td>`;
    if (r.bye) return `${open}<td class="muted">${escapeHtml(r.week ?? "")}</td><td colspan="3" class="muted">volno</td></tr>`;
    return `${open}<td>${kickoffCell(r)}</td><td>${side(r.home)}</td>
    <td class="c"><span class="pts">${resultCell(r, r === next)}</span>${r.note ? ` <span class="muted">${escapeHtml(r.note)}</span>` : ""} ${outcome(r)}</td>
    <td>${side(r.away)}</td></tr>`;
  }).join("")}
  </tbody></table></div>`;
  return renderShell({
    title: `Rozpis utkání ${TEAM}`,
    body,
    legend: `${league || "BNB Cup"} · přeložený termín je přeškrtnutý · výsledek vede na článek o zápase · V = výhra, R = remíza, P = prohra`,
    sourceUrl: SCHEDULE_SOURCE,
    updatedAt,
  });
};
