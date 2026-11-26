import { GAMESTATS, decode, stripTags } from "./page.js";

// Two things exist only in the GameStats admin, behind the HC Lány team manager login: game
// timelines (goal times, scorers, assists, running score) and the team roster with player ids.
// Everything else (stats, photos, games played) is read from the public pages. The credentials come from the repository secrets
// GAMESTATS_EMAIL and GAMESTATS_PASSWORD (passed to the build as environment variables); without
// them this step is skipped and everything else is built as before.
//
// Ground rules, because the account can edit data:
// - read only: the session is used for GET requests to the three allowed admin pages below and
//   nothing else (adminGet refuses any other path);
// - log out in `finally`, so the session never outlives the build, even when a page fails;
// - nothing secret is ever logged: no credentials, cookies or page contents.

const LEAGUE_ID = "1a18c37f49aff03a5cd4e"; // 2. liga 2026/27 in the BNB Cup
const ALLOWED = [
  /^\/i\/bnb-cup\/admin\/teams\/[0-9a-f]+$/, // the team page with its roster
  /^\/i\/bnb-cup\/admin\/matches\?league=[0-9a-f]+&part=&team=[0-9a-f]+&date=$/, // the team's games
  /^\/i\/bnb-cup\/admin\/matches\/[0-9a-f]+$/, // one game's detail with its timeline
];

// Minimal cookie jar: name -> value, updated from every response.
const jar = new Map();
const keepCookies = (res) => {
  for (const line of res.headers.getSetCookie?.() ?? []) {
    const [pair] = line.split(";");
    const at = pair.indexOf("=");
    if (at > 0) jar.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim());
  }
};
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

const request = async (url, init = {}) => {
  const res = await fetch(url, { ...init, redirect: "manual", headers: { ...init.headers, cookie: cookieHeader() } });
  keepCookies(res);
  return res;
};

const csrfOf = (html) => html.match(/name="_csrf" value="([^"]+)"/)?.[1] ?? null;

const adminGet = async (path) => {
  if (!ALLOWED.some((re) => re.test(path))) throw new Error(`admin path not allowed: ${path}`);
  const res = await request(new URL(path, GAMESTATS).href);
  if (res.status !== 200) throw new Error(`admin page returned ${res.status}`);
  return res.text();
};

const login = async (email, password) => {
  const page = await request(`${GAMESTATS}/login`);
  const csrf = csrfOf(await page.text());
  if (!csrf) throw new Error("login form not found");
  const res = await request(`${GAMESTATS}/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ _csrf: csrf, email, password }).toString(),
  });
  // A successful login redirects into the admin; a failed one re-renders the form (200).
  const target = res.headers.get("location") ?? "";
  if (res.status < 300 || res.status >= 400 || /login/.test(target)) throw new Error(`login rejected (${res.status})`);
};

// The logout form (and its token) is on every admin page; if the first page failed, read it again.
const logout = async (csrf, listPath) => {
  const token = csrf ?? csrfOf(await adminGet(listPath));
  if (!token) throw new Error("logout token not found");
  await request(`${GAMESTATS}/logout`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ _csrf: token }).toString(),
  });
};

const kickoffKey = (text) => {
  const m = text.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s+(\d{1,2}):(\d{2})/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")} ${m[4].padStart(2, "0")}:${m[5]}` : null;
};

// The team's games list: kick-off -> admin match id.
export const parseMatchList = (html) => {
  const ids = new Map();
  const parts = html.split(/(?=<a [^>]*href="\/i\/bnb-cup\/admin\/matches\/[0-9a-f]+")/).slice(1);
  for (const part of parts) {
    const id = part.match(/\/admin\/matches\/([0-9a-f]+)"/)[1];
    const key = kickoffKey(stripTags(part)); // the date follows the link, before the next game
    if (key && !ids.has(key)) ids.set(key, id);
  }
  return ids;
};

// The team roster: players with their ids (the ids also open the public player pages).
export const parseTeamRoster = (html) => {
  const seen = new Set();
  return [...html.matchAll(/href="\/i\/bnb-cup\/admin\/players\/([0-9a-f]+)"[^>]*>([\s\S]*?)<\/a>/g)].flatMap(([, id, label]) => {
    const name = stripTags(label).replace(/\s+/g, " ").trim();
    if (!name || seen.has(id)) return [];
    seen.add(id);
    return [{ name, id }];
  });
};

// One game's timeline. Rows look like: 07:16 | KRA | 🥅 Gól 0:1 | #48 Michal Slemenský (asistence #41 Pavel Vrána)
export const parseTimeline = (html) => [...html.matchAll(/<tr id="ev-[^"]+">([\s\S]*?)<\/tr>/g)].flatMap(([, row]) => {
  const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => decode(stripTags(m[1])).replace(/\s+/g, " ").trim());
  if (cells.length < 4) return [];
  const [time, team, typeText, text] = cells;
  const score = typeText.match(/(\d+)\s*:\s*(\d+)/);
  const goal = /gól/i.test(typeText);
  const who = text.match(/^(.*?)\s*(?:\(asistence (.*)\))?$/);
  return [{
    time,
    team,
    type: goal ? "goal" : typeText.replace(/[^\p{L}\d :]/gu, "").trim(),
    score: score ? [Number(score[1]), Number(score[2])] : null,
    scorer: goal ? who[1] : null,
    assists: goal && who[2] ? who[2].split(/\s*,\s*/) : [],
    text: goal ? null : text,
  }];
});

// Logs in, reads the team roster and the timelines of the given games (rounds with kickoff), and
// logs out. Returns { roster: [{ name, id }] | null, timelines: Map kickoff -> { id, events } };
// empty results when credentials are missing or anything fails.
export const fetchAdminData = async (rounds, teamId) => {
  const { GAMESTATS_EMAIL: email, GAMESTATS_PASSWORD: password } = process.env;
  const result = { roster: null, timelines: new Map() };
  if (!email || !password) {
    console.log("GameStats login not configured (GAMESTATS_EMAIL / GAMESTATS_PASSWORD), skipping admin data");
    return result;
  }
  const listPath = `/i/bnb-cup/admin/matches?league=${LEAGUE_ID}&part=&team=${teamId}&date=`;
  let csrf = null;
  let loggedIn = false;
  try {
    await login(email, password);
    loggedIn = true;
    const teamHtml = await adminGet(`/i/bnb-cup/admin/teams/${teamId}`);
    csrf = csrfOf(teamHtml);
    const roster = parseTeamRoster(teamHtml);
    if (roster.length) result.roster = roster;
    if (rounds.length) {
      const ids = parseMatchList(await adminGet(listPath));
      for (const round of rounds) {
        const id = ids.get(round.kickoff);
        if (!id) {
          console.warn(`timeline: no admin game found for ${round.kickoff}`);
          continue;
        }
        result.timelines.set(round.kickoff, { id, events: parseTimeline(await adminGet(`/i/bnb-cup/admin/matches/${id}`)) });
      }
    }
  } catch (error) {
    console.warn(`GameStats admin data unavailable (${error.message})`);
  } finally {
    if (loggedIn) {
      try {
        await logout(csrf, listPath);
        console.log("GameStats: logged out");
      } catch (error) {
        console.warn(`GameStats logout failed (${error.message})`);
      }
    }
    jar.clear();
  }
  return result;
};
