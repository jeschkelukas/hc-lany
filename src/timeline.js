import { TEAM, escapeHtml, placeholderLogo } from "./page.js";

// Game timelines from the GameStats admin (see admin.js), stored in the snapshot as
// "matchTimelines" (slug -> { id, events }). GameStats has no periods: the clock in the timeline
// runs through the whole game (about 45 minutes of play in an hour on the ice). The period ends
// below were fitted on the first three games, where the club's reports gave the period scores
// (1st period ends between 15:41 and 18:44, 2nd between 28:52 and 30:21). Hand-entered periods
// (matchExtras) always win over this estimate.
const PERIOD_ENDS = ["17:00", "30:00"];

const seconds = (time) => {
  const [m, s] = time.split(":").map(Number);
  return m * 60 + (s || 0);
};
const ENDS = PERIOD_ENDS.map(seconds);
const periodByClock = (event) => ENDS.filter((end) => seconds(event.time) >= end).length;

// Goals with the side that scored, read from the running score (home:away).
export const goalsOf = (events) => {
  let before = [0, 0];
  return events.filter((e) => e.type === "goal" && e.score).map((e) => {
    const side = e.score[0] > before[0] ? "home" : "away";
    before = e.score;
    return { ...e, side };
  });
};

const tally = (goals, count = 3) =>
  Array.from({ length: count }, (_, p) => {
    const inPeriod = goals.filter((g) => g.period === p);
    return [inPeriod.filter((g) => g.side === "home").length, inPeriod.filter((g) => g.side === "away").length];
  });

// Puts every goal into a period. With hand-entered periods (home:away pairs) the goals are taken in
// order, as many per period as the club reported, provided both teams' counts match; otherwise
// (or without them) by the clock.
export const withPeriods = (events, handPeriods) => {
  const goals = goalsOf(events);
  if (handPeriods?.length === 3) {
    let next = 0;
    const ordered = goals.map((g) => ({ ...g }));
    handPeriods.forEach(([h, a], p) => {
      for (let i = 0; i < h + a && next < ordered.length; i += 1) ordered[next++].period = p;
    });
    const fits = next === ordered.length && JSON.stringify(tally(ordered)) === JSON.stringify(handPeriods);
    if (fits) return ordered;
  }
  return goals.map((g) => ({ ...g, period: periodByClock(g) }));
};

// Period scores (home:away) estimated from the timeline; null unless the timeline has every goal.
export const periodsFromTimeline = (events, score) => {
  const goals = goalsOf(events);
  if (goals.length !== score[0] + score[1]) return null;
  return tally(goals.map((g) => ({ ...g, period: periodByClock(g) })));
};

const PERIOD_NAMES = ["1. třetina", "2. třetina", "3. třetina"];

const smallLogo = (name, logos) => {
  const file = logos.get(name);
  return file ? `<img class="tl-logo" src="../../logos/${escapeHtml(file)}" alt="">` : `<span class="tl-logo">${placeholderLogo(name)}</span>`;
};

// "#18 Lukáš Jeschke" in the timeline vs "Jeschke Lukáš" in the roster: match on the set of words.
const nameKey = (name) => name.replace(/^#\d+\s*/, "").toLowerCase().split(/\s+/).sort().join(" ");

export const renderTimeline = ({ round, events, handPeriods, logos, playerUrls = new Map() }) => {
  const urlByKey = new Map([...playerUrls].map(([name, url]) => [nameKey(name), url]));
  // HC Lány players link to their public GameStats page (new tab, the detail sits in an iframe).
  const who = (name, team) => {
    const url = team === TEAM ? urlByKey.get(nameKey(name)) : null;
    return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(name)}</a>` : escapeHtml(name);
  };
  const goals = withPeriods(events, handPeriods);
  if (!goals.length) return "";
  const teamOf = (side) => (side === "home" ? round.home : round.away);
  const rows = PERIOD_NAMES.map((name, p) => {
    const inPeriod = goals.filter((g) => g.period === p);
    const body = inPeriod.length
      ? inPeriod.map((g) => {
        const team = teamOf(g.side);
        const assists = g.assists.length ? `<span class="tl-ast">(${g.assists.map((a) => who(a, team)).join(", ")})</span>` : "";
        return `<li class="${team === TEAM ? "us" : ""}"><span class="tl-time">${escapeHtml(g.time)}</span>${smallLogo(team, logos)}<b class="tl-score">${g.score[0]}:${g.score[1]}</b><span class="tl-who">${g.scorer ? who(g.scorer, team) : ""} ${assists}</span></li>`;
      }).join("")
      : '<li class="tl-none">bez gólu</li>';
    return `<h3>${name}</h3><ul class="tl">${body}</ul>`;
  }).join("");
  const missing = round.score[0] + round.score[1] - goals.length;
  const note = missing > 0 ? `<p class="note">V průběhu zatím ${missing === 1 ? "chybí 1 gól" : `chybí ${missing} ${missing < 5 ? "góly" : "gólů"}`}.</p>` : "";
  return `<h2>Průběh zápasu</h2>${rows}${note}`;
};
