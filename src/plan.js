import { TEAM } from "./page.js";
import { goalsOf, nameKey } from "./timeline.js";

// How often the expensive parts run. Every trigger (cron-job.org) first does a quick check
// (gate.mjs: the public schedule plus the time of the last deploy); the full build runs only
// when a result is new or changed, a game timeline is due, or the last full build is older
// than FULL_EVERY. The admin login (timelines) is throttled separately by timelineDue.

export const PAGES_URL = "https://jeschkelukas.github.io/hc-lany";
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
export const FULL_EVERY = HOUR;
// Runs start a few minutes late; without the slack an hourly step would slip to every other run.
export const SLACK = 5 * MINUTE;

// Kick-off times are Prague local time (the season is in winter, CET).
export const kickoffDate = (m) => new Date(`${m.kickoff.replace(" ", "T")}:00+01:00`);

// HC Lány goals and assists per player in a timeline and in the public per-game points
// (matchScorers), as comparable strings ("jeschke lukáš 0/3|…").
const pointsKey = (entries) => entries.map(([name, g, a]) => `${nameKey(name)} ${g}/${a}`).sort().join("|");
const timelinePoints = (m, events) => {
  const side = m.home === TEAM ? "home" : "away";
  const points = new Map();
  const add = (name, i) => {
    const key = nameKey(name);
    const p = points.get(key) ?? [key, 0, 0];
    p[i] += 1;
    points.set(key, p);
  };
  for (const goal of goalsOf(events).filter((g) => g.side === side)) {
    if (goal.scorer) add(goal.scorer, 1);
    for (const a of goal.assists ?? []) add(a, 2);
  }
  return pointsKey([...points.values()]);
};
export const pointsDiffer = (m, events, scorers) =>
  Boolean(scorers) && timelinePoints(m, events) !== pointsKey(scorers.map((s) => [s.name, s.g, s.a]));

// A played game needs its timeline from the admin when there is none yet. An incomplete one
// (GameStats still filling it in) or one whose HC Lány goals and assists differ from the public
// per-game points (`scorers`, e.g. assists corrected afterwards) is retried at most hourly on the
// game day, then daily, and given up two weeks after the game. entry.checkedAt is the last admin
// read of that game.
export const timelineDue = (m, entry, now, scorers = null) => {
  if (!entry) return true;
  const complete = goalsOf(entry.events).length >= m.score[0] + m.score[1];
  if (complete && !pointsDiffer(m, entry.events, scorers)) return false;
  const age = now - kickoffDate(m);
  if (age > 14 * DAY) return false;
  const since = now - new Date(entry.checkedAt ?? 0);
  return since >= (age < DAY ? HOUR : DAY) - SLACK;
};
