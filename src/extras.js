import { TEAM } from "./page.js";

// Hand-entered match details GameStats does not have (period scores, penalties). They live only
// in the snapshot (data/snapshot.json -> "matchExtras"), keyed by the match detail slug
// ("2026-11-16-sykorice"), and every build carries them over into the new snapshot. Values use
// the club's own notation: HC Lány first, whether at home or away.

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
    console.warn(`matchExtras: ${slugName} has a value that is not "x:y", ignoring it`);
    return null;
  }
  const result = { periods: periods.map(orient), penalties: penalties ? orient(penalties) : null };
  if (periods.length) {
    const total = result.periods.reduce(([h, a], [ph, pa]) => [h + ph, a + pa], [0, 0]);
    if (total[0] !== round.score[0] || total[1] !== round.score[1]) {
      console.warn(`matchExtras: ${slugName} periods add up to ${total.join(":")}, score is ${round.score.join(":")}`);
    }
  }
  return result;
};
