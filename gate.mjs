import { appendFileSync } from "node:fs";
import { TEAM } from "./src/scoring.js";
import { SCHEDULE_SOURCE, parseSchedule } from "./src/schedule.js";
import { matchSlug } from "./src/matches.js";
import { FULL_EVERY, PAGES_URL, SLACK, timelineDue } from "./src/plan.js";
import { loadSnapshot } from "./src/snapshot.js";

// Quick check before the build (see src/plan.js): reads only the public GameStats schedule and
// the time of the last deploy, and decides whether the full build runs. Writes full=true|false
// to the step outputs. Pushes and forced runs always build; any error here means "build".

const now = new Date();
const decide = async () => {
  if (process.env.GITHUB_EVENT_NAME === "push") return "push";
  if (process.env.FORCE === "true" || process.env.REFRESH_ADMIN === "true") return "forced";
  const archive = loadSnapshot();
  if (!archive?.schedule) return "no snapshot";

  const res = await fetch(SCHEDULE_SOURCE);
  if (!res.ok) throw new Error(`schedule returned ${res.status}`);
  const fresh = parseSchedule(await res.text(), TEAM);
  if (!fresh) throw new Error("schedule not parsed");
  if (fresh.league !== archive.schedule.league) return "new season";

  const key = (m) => `${m.kickoff}|${m.home}|${m.away}`;
  const known = new Map(archive.schedule.matches.map((m) => [key(m), m]));
  const changed = fresh.matches.find((m) => m.score && JSON.stringify(m.score) !== JSON.stringify(known.get(key(m))?.score ?? null));
  if (changed) return `result ${changed.home} – ${changed.away} ${changed.score.join(":")}`;
  const timelines = archive.matchTimelines ?? {};
  const due = fresh.matches.find((m) => m.kickoff && m.score && timelineDue(m, timelines[matchSlug(m)], now));
  if (due) return `timeline due for ${matchSlug(due)}`;

  const stamp = await fetch(`${PAGES_URL}/build.json?t=${now.getTime()}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!stamp?.builtAt) return "last build unknown";
  const age = now - new Date(stamp.builtAt);
  if (age >= FULL_EVERY - SLACK) return `last full build ${Math.round(age / 60_000)} min ago`;
  console.log(`gate: nothing new, last full build ${Math.round(age / 60_000)} min ago, skipping`);
  return null;
};

const reason = await decide().catch((error) => `check failed (${error.message})`);
if (reason) console.log(`gate: full build (${reason})`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `full=${reason ? "true" : "false"}\n`);
