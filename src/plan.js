import { goalsOf } from "./timeline.js";

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

// A played game needs its timeline from the admin when there is none yet. An incomplete one
// (GameStats still filling it in) is retried at most hourly on the game day, then daily, and
// given up two weeks after the game. entry.checkedAt is the last admin read of that game.
export const timelineDue = (m, entry, now) => {
  if (!entry) return true;
  if (goalsOf(entry.events).length >= m.score[0] + m.score[1]) return false;
  const age = now - kickoffDate(m);
  if (age > 14 * DAY) return false;
  const since = now - new Date(entry.checkedAt ?? 0);
  return since >= (age < DAY ? HOUR : DAY) - SLACK;
};
