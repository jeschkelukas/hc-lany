import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

// The last good GameStats data is kept in the repository (the workflow commits it), so the git
// history doubles as a backup of every state, and a fresh download that came back thinner than
// what we already had cannot wipe the widgets. Within one season points, played matches and
// recorded scorers only ever grow; a new season (different league label) starts from scratch.
export const SNAPSHOT_PATH = "data/snapshot.json";

export const loadSnapshot = () => {
  if (!existsSync(SNAPSHOT_PATH)) return null;
  try {
    return JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
  } catch (error) {
    console.warn(`Snapshot unreadable (${error.message}), ignoring it`);
    return null;
  }
};

// Besides the current snapshot, keep one dated copy per day (the day's latest state) for the
// last ARCHIVE_DAYS days, so recent standings, player stats and schedules are easy to browse.
// Older days are deleted from the folder but stay in git history.
const ARCHIVE_DAYS = 30;
const DAY_MS = 86_400_000;
const pragueDate = (date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

export const saveSnapshot = (snapshot, date = new Date()) => {
  const json = `${JSON.stringify(snapshot, null, 2)}\n`;
  mkdirSync("data/archive", { recursive: true });
  writeFileSync(SNAPSHOT_PATH, json);
  writeFileSync(`data/archive/${pragueDate(date)}.json`, json);
  const oldest = pragueDate(new Date(date.getTime() - (ARCHIVE_DAYS - 1) * DAY_MS));
  for (const file of readdirSync("data/archive")) {
    if (/^\d{4}-\d{2}-\d{2}\.json$/.test(file) && file.slice(0, 10) < oldest) rmSync(`data/archive/${file}`);
  }
};

const sum = (items, pick) => items.reduce((total, item) => total + pick(item), 0);

// Keeps the archived value when the fresh one measures lower within the same season.
const keepRicher = (label, fresh, archived, measure, sameSeason) => {
  if (!archived || !sameSeason) return fresh;
  const now = measure(fresh);
  const before = measure(archived);
  if (now >= before) return fresh;
  console.warn(`${label}: fresh data looks incomplete (${now} < ${before}), keeping the archived version`);
  return archived;
};

export const guardScoring = (fresh, archived, sameSeason) =>
  keepRicher("scoring", fresh, archived, (s) => sum(s.players, (p) => p.pts), sameSeason);

export const guardStandings = (fresh, archived, sameSeason) =>
  keepRicher("standings", fresh, archived, (s) => sum(s.teams, (t) => t.gp), sameSeason);

export const guardSchedule = (fresh, archived, sameSeason) =>
  keepRicher("schedule", fresh, archived, (s) => s.matches.filter((m) => m.score).length, sameSeason);

// Per match, keep whichever list records more HC Lány goals (fresh wins a tie).
export const mergeMatchScorers = (fresh, archived, sameSeason) => {
  const merged = new Map(fresh);
  if (!archived || !sameSeason) return merged;
  for (const [kickoff, oldList] of Object.entries(archived)) {
    const newList = merged.get(kickoff);
    const goals = (list) => sum(list ?? [], (s) => s.g + s.a);
    if (!newList || goals(oldList) > goals(newList)) {
      if (newList) console.warn(`match ${kickoff}: fresh scorers look incomplete, keeping the archived list`);
      merged.set(kickoff, oldList);
    }
  }
  return merged;
};
