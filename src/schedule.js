import { GAMESTATS, TEAM, cellsOf, decode, escapeHtml, renderShell, rowsOf, stripTags, teamBadge } from "./page.js";

export const SCHEDULE_SOURCE = `${GAMESTATS}/schedule`;

const WEEKDAYS = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];

const parseDate = (text) => {
  const m = text.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s+(\d{1,2}:\d{2})/);
  if (!m) return { day: text, time: "", sortKey: text };
  const [, d, mo, y, time] = m;
  const weekday = WEEKDAYS[new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))).getUTCDay()];
  return {
    day: `${weekday} ${Number(d)}. ${Number(mo)}.`,
    time,
    sortKey: `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")} ${time.padStart(5, "0")}`,
  };
};

const parseScore = (text) => {
  const m = text.match(/(\d+)\s*:\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
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
      return [{ ...parseDate(stripTags(c[0])), home, away, score: parseScore(stripTags(c[2])), note: c[4] ? stripTags(c[4]) : "" }];
    });
    if (matches.length > 0) {
      matches.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
      return { league: leagueMatch ? decode(leagueMatch[1]).split(" · ")[0].trim() : "", matches };
    }
  }
  return null;
};

const outcome = (match) => {
  if (!match.score) return "";
  const [h, a] = match.score;
  const ours = match.home === TEAM ? h - a : a - h;
  if (ours > 0) return '<span class="pill w" title="Výhra">V</span>';
  if (ours < 0) return '<span class="pill l" title="Prohra">P</span>';
  return '<span class="pill d" title="Remíza">R</span>';
};

export const renderSchedule = ({ league, matches, logos, updatedAt }) => {
  const nextIndex = matches.findIndex((m) => !m.score);
  const side = (name) => (name === TEAM ? `<span class="me">${teamBadge(name, logos)}</span>` : teamBadge(name, logos));
  const body = `<div class="box"><table class="compact">
  <thead><tr><th class="n">#</th><th>Termín</th><th>Domácí</th><th class="c">Výsledek</th><th>Hosté</th></tr></thead>
  <tbody>${matches.map((m, i) => `<tr${i === nextIndex ? ' class="mark"' : ""}>
    <td class="n rank">${i + 1}.</td><td>${escapeHtml(m.day)} <span class="muted">${escapeHtml(m.time)}</span></td>
    <td>${side(m.home)}</td>
    <td class="c"><span class="pts">${m.score ? `${m.score[0]}:${m.score[1]}` : i === nextIndex ? '<span class="next">další</span>' : "–"}</span>${m.note ? ` <span class="muted">${escapeHtml(m.note)}</span>` : ""} ${outcome(m)}</td>
    <td>${side(m.away)}</td></tr>`).join("")}
  </tbody></table></div>`;
  return renderShell({
    title: `Rozpis utkání ${TEAM}`,
    body,
    legend: `${league || "BNB Cup"} · zápasy ${TEAM} podle data, volná kola nejsou uvedena · V = výhra, R = remíza, P = prohra`,
    sourceUrl: SCHEDULE_SOURCE,
    updatedAt,
  });
};
