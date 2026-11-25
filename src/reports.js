import { decode, slug, stripTags } from "./page.js";

// Match reports are articles on the club site (homepage and BNB Cup category), titled "HC Lány - <opponent> <x> : <y>".
export const REPORTS_SOURCE = "https://hclany.estranky.cz/clanky/bnb-cup/";
const SITE = "https://hclany.estranky.cz";
const MAX_PAGES = 5;
const DAY_MS = 86_400_000;
const PUBLISH_WINDOW_DAYS = 30;

const toDay = (d, m, y) => Date.UTC(Number(y), Number(m) - 1, Number(d));

export const parseReportsPage = (html) =>
  html.split('<div class="article">').slice(1).flatMap((block) => {
    const link = block.match(/<h2>\s*<a href="([^"]+)">([^<]+)<\/a>/);
    const date = block.match(/<p class="first">\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
    if (!link || !date) return [];
    return [{ url: new URL(decode(link[1]), SITE).href, title: stripTags(link[2]), published: toDay(date[1], date[2], date[3]) }];
  });

const fetchPage = async (url) => {
  const res = await fetch(url);
  return res.ok ? parseReportsPage(await res.text()) : [];
};

// The homepage lists the newest articles of every category, so it also catches a report published
// outside BNB Cup. Category pages are newest first; stop once a page reaches articles older than the season.
export const fetchReports = async (seasonStart) => {
  const reports = await fetchPage(`${SITE}/`).catch(() => []);
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const found = await fetchPage(page === 1 ? REPORTS_SOURCE : REPORTS_SOURCE.replace(/\/$/, `.${page}/`));
    reports.push(...found);
    if (found.length === 0 || found.some((r) => r.published < seasonStart)) break;
  }
  return [...new Map(reports.map((r) => [r.url, r])).values()];
};

const stems = (name) =>
  slug(name).split("-").filter((w) => w.length >= 4 && !/^\d+$/.test(w)).map((w) => w.slice(0, 5));

const isOurs = (side) => slug(side).includes("lany");

// Reads "HC Lány - Opponent  x : y" (or the reverse) as our goals, their goals and the opponent part.
const readTitle = (title) => {
  const m = title.match(/^(.*?)\s+-\s+(.*?)\s+(\d+)\s*:\s*(\d+)\s*$/);
  if (!m) return null;
  const [, left, right, x, y] = m;
  if (isOurs(left)) return { opponent: right, ours: Number(x), theirs: Number(y) };
  if (isOurs(right)) return { opponent: left, ours: Number(y), theirs: Number(x) };
  return null;
};

export const findReport = (reports, { opponent, ours, theirs, kickoff }) => {
  const matchDay = toDay(...kickoff.slice(0, 10).split("-").reverse());
  const wanted = stems(opponent);
  const candidates = reports.filter((r) => {
    const t = readTitle(r.title);
    if (!t || t.ours !== ours || t.theirs !== theirs) return false;
    if (r.published < matchDay - DAY_MS || r.published > matchDay + PUBLISH_WINDOW_DAYS * DAY_MS) return false;
    const have = stems(t.opponent);
    return wanted.some((w) => have.includes(w));
  });
  candidates.sort((a, b) => Math.abs(a.published - matchDay) - Math.abs(b.published - matchDay));
  return candidates[0]?.url ?? null;
};
