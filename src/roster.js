import { GAMESTATS, decode, stripTags } from "./page.js";
import { parsePlayerMatches } from "./matches.js";

// Public GameStats player pages (no login): photo, jersey number, position, the season line
// (games, goals, assists, points, penalty minutes) and the per-game overview. They are the only
// public source of games played and photos for players without a point.

const CONCURRENCY = 4;

export const parsePlayerPage = (html) => {
  const photo = html.match(/<img src="(\/uploads\/players\/[^"]+)"/);
  const number = html.match(/<span class="badge[^"]*">#(\d+)<\/span>/);
  const position = html.match(/<h1[^>]*>[^<]*<\/h1>\s*<p class="mb-0 text-secondary">([^<·]+)/);
  const season = html.split("Sezónní statistiky")[1]?.split("</table>")[0] ?? "";
  const line = [...season.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => Number.parseInt(stripTags(m[1]), 10) || 0);
  const [gp = 0, g = 0, a = 0, pts = 0, pim = 0] = line;
  return {
    photoUrl: photo ? new URL(decode(photo[1]), GAMESTATS).href : null,
    number: number ? Number(number[1]) : null,
    position: position ? decode(position[1]).trim() : null,
    gp, g, a, pts, pim,
    matches: parsePlayerMatches(html),
  };
};

// Fetches the pages a few at a time; a failed page leaves that player out (the caller then
// keeps the archived values for them).
export const fetchPlayerPages = async (players) => {
  const pages = new Map();
  for (let i = 0; i < players.length; i += CONCURRENCY) {
    await Promise.all(players.slice(i, i + CONCURRENCY).map(async (p) => {
      try {
        const res = await fetch(p.url);
        if (!res.ok) throw new Error(String(res.status));
        pages.set(p.name, parsePlayerPage(await res.text()));
      } catch (error) {
        console.warn(`Player page for ${p.name} failed (${error.message})`);
      }
    }));
  }
  return pages;
};
