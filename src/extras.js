import { existsSync, readFileSync } from "node:fs";
import { TEAM } from "./page.js";

// Hand-entered match details GameStats does not have (period scores, penalties), keyed by the
// match detail slug ("2026-11-16-sykorice"). Written the way the club writes its reports:
// HC Lány first, whether at home or away. The build never overwrites this file.
export const EXTRAS_PATH = "data/match-extras.json";

export const loadExtras = () => {
  if (!existsSync(EXTRAS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(EXTRAS_PATH, "utf8"));
  } catch (error) {
    console.warn(`${EXTRAS_PATH} unreadable (${error.message}), ignoring it`);
    return {};
  }
};

const pair = (text) => {
  const m = String(text).match(/^\s*(\d+)\s*:\s*(\d+)\s*$/);
  return m ? [Number(m[1]), Number(m[2])] : null;
};

// Converts the HC Lány-first notation to home:away so it lines up with the score shown above it.
export const extrasFor = (round, extra, slugName) => {
  if (!extra) return null;
  const weAreHome = round.home === TEAM;
  const orient = ([ours, theirs]) => (weAreHome ? [ours, theirs] : [theirs, ours]);
  const periods = (extra.periods ?? []).map(pair);
  const penalties = extra.penalties == null ? null : pair(extra.penalties);
  if (periods.some((p) => !p) || (extra.penalties != null && !penalties)) {
    console.warn(`${EXTRAS_PATH}: ${slugName} has a value that is not "x:y", ignoring it`);
    return null;
  }
  const result = { periods: periods.map(orient), penalties: penalties ? orient(penalties) : null };
  if (periods.length) {
    const total = result.periods.reduce(([h, a], [ph, pa]) => [h + ph, a + pa], [0, 0]);
    if (total[0] !== round.score[0] || total[1] !== round.score[1]) {
      console.warn(`${EXTRAS_PATH}: ${slugName} periods add up to ${total.join(":")}, score is ${round.score.join(":")}`);
    }
  }
  return result;
};
