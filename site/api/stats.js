// GET /api/stats -> every number on the public stats page, as one JSON document (the page's Download buttons
// export exactly this). Sources: the hosted PostHog project (anonymous, opt-in app events + the build proxy's
// server-side events), public GitHub data (release downloads, apps/verdicts.json), Google Play's own daily vitals
// (Play Developer Reporting API, service account) and data/*.json (build history from before analytics existed).
// Aggregates only: no device ids, no IPs, no per-event rows ever leave here.
// Cached at the edge for 120 s, so the PostHog query budget (2,400/h) is never near.

import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";

const REPO = "fcavalcantirj/droidputer";
const PH_HOST = (process.env.POSTHOG_API_HOST || "https://us.posthog.com").replace(/\/+$/, "");
const PH_PROJECT = process.env.POSTHOG_PROJECT_ID || "";
const PH_KEY = process.env.POSTHOG_PERSONAL_KEY || "";
const TIMEOUT_MS = 25000;

const BUILD_REQUEST_EVENTS = "('build_dispatched','build_cache_hit','build_joined','build_failed_cached')";
// A phone = one app install = PostHog's per-install distinct_id on events the Android SDK sent (the proxy and manual
// checks carry no $lib). Emulators are left out: they cannot host the USB link, and they were our own test runs.
// Live = since v0.0.7 shipped (2026-10-09 19:00 UTC). Everything earlier in the project was the author's own
// emulator runs and proxy tests, and the page's history cards already cover the time before. Also bounds every
// scan: an unbounded one hits PostHog's execution limit even on tiny data.
const SINCE = "timestamp > toDateTime('2026-10-09 19:00:00')";
const APP = "(properties.$lib = 'posthog-android' AND NOT (coalesce(properties.$device_model, '') LIKE 'sdk_gphone%'))";

// Every query is aggregate-only; `device` is the anonymous per-install id (opt-in), never returned.
export const QUERIES = {
  daily: `
    SELECT toDate(timestamp) AS day,
      uniqIf(distinct_id, ${APP}) AS devices,
      countIf(event IN ${BUILD_REQUEST_EVENTS}) AS build_requests,
      countIf(event = 'flash_finished' AND properties.result = 'ok' AND ${APP}) AS flashes,
      countIf(event = 'link_up' AND ${APP}) AS links,
      round(sumIf(toFloat(properties.seconds), event = 'mirror_session' AND ${APP}) / 60, 1) AS mirror_minutes
    FROM events WHERE timestamp > now() - INTERVAL 30 DAY AND ${SINCE}
    GROUP BY day ORDER BY day`,
  funnel: `
    SELECT event, uniq(distinct_id) AS devices, count() AS events
    FROM events
    WHERE timestamp > now() - INTERVAL 30 DAY AND ${SINCE} AND ${APP}
      AND event IN ('Application Opened','catalog_open','build_requested','usb_attached','flash_finished','link_up','verdict_sent')
    GROUP BY event`,
  apps: `
    SELECT properties.app AS app,
      uniq(distinct_id) AS devices,
      countIf(event = 'flash_finished' AND properties.result = 'ok') AS flashes,
      countIf(event = 'link_up') AS links,
      round(sumIf(toFloat(properties.seconds), event = 'mirror_session') / 60, 1) AS mirror_minutes
    FROM events
    WHERE timestamp > now() - INTERVAL 30 DAY AND ${SINCE} AND event IN ('flash_finished','link_up','mirror_session') AND notEmpty(coalesce(properties.app, '')) AND ${APP}
    GROUP BY app ORDER BY devices DESC, links DESC LIMIT 15`,
  builds: `
    SELECT 'result' AS kind, concat(toString(properties.result), '|', coalesce(toString(properties.failure_class), '')) AS k, uniq(properties.run_id) AS n
    FROM events WHERE event = 'build_result' AND ${SINCE} GROUP BY k
    UNION ALL
    SELECT 'repo' AS kind, toString(properties.repo) AS k, count() AS n
    FROM events WHERE event IN ${BUILD_REQUEST_EVENTS} AND ${SINCE} GROUP BY k ORDER BY n DESC LIMIT 40`,
  health: `
    SELECT event, coalesce(toString(properties.app), '') AS app, count() AS n
    FROM events WHERE timestamp > now() - INTERVAL 30 DAY AND ${SINCE} AND event IN ('$exception', 'esp_panic') AND ${APP}
    GROUP BY event, app ORDER BY n DESC LIMIT 20`,
  totals: `
    SELECT uniqIf(distinct_id, ${APP}) AS devices_all_time,
      uniqIf(distinct_id, ${APP} AND timestamp > now() - INTERVAL 7 DAY) AS devices_7d,
      uniqIf(distinct_id, ${APP} AND timestamp > now() - INTERVAL 1 DAY) AS devices_24h,
      countIf(event IN ${BUILD_REQUEST_EVENTS}) AS build_requests,
      countIf(event = 'flash_finished' AND properties.result = 'ok' AND ${APP}) AS flashes,
      round(sumIf(toFloat(properties.seconds), event = 'mirror_session' AND ${APP}) / 60, 1) AS mirror_minutes,
      min(timestamp) AS first_event
    FROM events WHERE ${SINCE}`,
};

async function fetchJson(url, init = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** One HogQL query -> array of row objects keyed by column name. */
async function hogql(sql) {
  const j = await fetchJson(`${PH_HOST}/api/projects/${PH_PROJECT}/query/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PH_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query: sql } }),
  });
  const cols = j.columns || [];
  return (j.results || []).map((row) => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
}

async function posthog() {
  if (!PH_KEY || !PH_PROJECT) return { ok: false, reason: "analytics not connected yet" };
  const out = { ok: true };
  // The project allows 3 concurrent queries: run them in two waves.
  const names = Object.keys(QUERIES);
  for (let i = 0; i < names.length; i += 3) {
    await Promise.all(names.slice(i, i + 3).map(async (n) => {
      try {
        out[n] = await hogql(QUERIES[n]);
      } catch (e) {
        out[n] = null;
        out.errors = { ...(out.errors || {}), [n]: String(e.message || e).slice(0, 200) };
      }
    }));
  }
  return out;
}

async function github() {
  const out = {};
  try {
    const rel = await fetchJson(`https://api.github.com/repos/${REPO}/releases?per_page=100`, { headers: { "User-Agent": "droidputer-stats", Accept: "application/vnd.github+json" } });
    out.releases = rel.map((r) => ({
      tag: r.tag_name,
      published: (r.published_at || "").slice(0, 10),
      apk_downloads: r.assets.filter((a) => a.name.endsWith(".apk")).reduce((s, a) => s + a.download_count, 0),
    }));
  } catch (e) {
    out.releases = null; out.releases_error = String(e.message || e).slice(0, 160);
  }
  try {
    const v = await fetchJson(`https://raw.githubusercontent.com/${REPO}/main/apps/verdicts.json`);
    const byApp = new Map();
    for (const x of v) {
      const a = byApp.get(x.name) || { app: x.name, works: 0, broken: 0 };
      if (x.result === "works") a.works++; else a.broken++;
      byApp.set(x.name, a);
    }
    // Day by day: verdicts filed and phones voting for the first time (reporter = anonymous per-install id).
    const seen = new Set(), days = new Map();
    for (const x of [...v].sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
      const d = days.get(x.date) || { day: x.date, verdicts: 0, new_phones: 0 };
      d.verdicts++;
      if (x.reporter && !seen.has(x.reporter)) { seen.add(x.reporter); d.new_phones++; }
      days.set(x.date, d);
    }
    // What phones did after flashing, from the app's AUTOMATIC verdicts: for 20 s after a flash from the phone it
    // counts boots, whether the ESP said HELLO and how many mirrored frames arrived ("auto: linked, 296 frames in 20 s",
    // "auto: boots=0 hello=false frames=0"). Real phones, anonymous per-install ids (the developer's own test
    // installs included).
    const auto = v.filter((x) => String(x.note || "").startsWith("auto:"));
    const frames = auto.map((x) => Number((/(\d+) frames/.exec(x.note) || [])[1] || 0));
    const perPhone = new Map();
    for (const x of v) if (x.reporter) perPhone.set(x.reporter, (perPhone.get(x.reporter) || new Set()).add(x.name));
    const bucket = (n) => (n >= 5 ? "5+" : n >= 3 ? "3-4" : String(n));
    const appsPerPhone = {};
    for (const s of perPhone.values()) appsPerPhone[bucket(s.size)] = (appsPerPhone[bucket(s.size)] || 0) + 1;
    const flashedBy = new Map();
    for (const x of auto) if (x.reporter) flashedBy.set(x.name, (flashedBy.get(x.name) || new Set()).add(x.reporter));
    const behaviour = {
      flashes_observed: auto.length,
      phones_that_flashed: new Set(auto.map((x) => x.reporter).filter(Boolean)).size,
      mirror_up: auto.filter((x) => /linked/.test(x.note)).length,
      no_hello: auto.filter((x) => /hello=false/.test(x.note)).length,
      hello_no_frames: auto.filter((x) => /hello=true/.test(x.note) && !/linked/.test(x.note)).length,
      frames_in_20s: frames.filter((n) => n > 0).sort((a, b) => a - b),
      apps_per_phone: appsPerPhone,
      most_flashed: [...flashedBy.entries()].map(([app, s]) => ({ app, phones: s.size })).sort((a, b) => b.phones - a.phones).slice(0, 10),
      envs: v.reduce((m, x) => ((m[x.env] = (m[x.env] || 0) + 1), m), {}),
    };
    let cum = 0;
    out.behaviour = behaviour;
    out.verdicts = {
      total: v.length,
      reporters: new Set(v.map((x) => x.reporter).filter(Boolean)).size,
      by_app: [...byApp.values()].sort((a, b) => b.works + b.broken - (a.works + a.broken)),
      timeline: [...days.values()].map((d) => ({ ...d, phones_cumulative: (cum += d.new_phones) })),
    };
  } catch (e) {
    out.verdicts = null; out.verdicts_error = String(e.message || e).slice(0, 160);
  }
  return out;
}

// Google Play: daily users and crash/ANR rates as Google computes them for Play installs (all versions). DAILY
// rows are Pacific-time days (the API supports no other zone for DAILY). Google publishes a day after it closes,
// so the window ends at the freshest day the metric set reports. Play changes daily: 30 min per warm instance.
const PLAY_PKG = "com.droidputter";
const PLAY_API = "https://playdeveloperreporting.googleapis.com/v1beta1";
const PLAY_SCOPE = "https://www.googleapis.com/auth/playdeveloperreporting";
const PLAY_TOKEN_URL = "https://oauth2.googleapis.com/token";
const PLAY_TZ = "America/Los_Angeles";
const PLAY_DAYS = 30;
const PLAY_CACHE_MS = 30 * 60 * 1000;
export const PLAY_SETS = {
  crashRateMetricSet: { distinctUsers: "users", crashRate: "crash_rate", userPerceivedCrashRate: "user_perceived_crash_rate" },
  anrRateMetricSet: { anrRate: "anr_rate", userPerceivedAnrRate: "user_perceived_anr_rate" },
};
let playToken = null; // { token, exp }
let playCache = null; // { at, body }

const noEmails = (s) => String(s).replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "<email>").slice(0, 200);

/** RS256 JWT for the service-account grant (RFC 7523), node:crypto only. */
export function signJwt(sa, now = Math.floor(Date.now() / 1000)) {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const body = `${enc({ alg: "RS256", typ: "JWT", kid: sa.private_key_id })}.${enc({ iss: sa.client_email, scope: PLAY_SCOPE, aud: PLAY_TOKEN_URL, iat: now, exp: now + 3600 })}`;
  return `${body}.${createSign("RSA-SHA256").update(body).sign(sa.private_key).toString("base64url")}`;
}

async function playAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  if (playToken && playToken.exp - 60 > now) return playToken.token;
  const j = await fetchJson(PLAY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: signJwt(sa, now) }).toString(),
  });
  playToken = { token: j.access_token, exp: now + (Number(j.expires_in) || 3600) };
  return playToken.token;
}

const ymd = (d) => `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;

/** Query rows -> { "YYYY-MM-DD": { field: number } } plus the metric names Google actually returned. */
export function playRows(rows, fieldOf) {
  const days = {}, seen = new Set();
  for (const r of rows || []) {
    if (!r.startTime) continue;
    const day = (days[ymd(r.startTime)] ||= {});
    for (const m of r.metrics || []) {
      seen.add(m.metric);
      const v = Number(m.decimalValue && m.decimalValue.value);
      if (fieldOf[m.metric] && Number.isFinite(v)) day[fieldOf[m.metric]] = v;
    }
  }
  return { days, seen: [...seen] };
}

/** One metric set: its freshest DAILY day, then the PLAY_DAYS days ending there (endTime is exclusive). */
async function playSet(token, set) {
  const auth = { Authorization: `Bearer ${token}` };
  const meta = await fetchJson(`${PLAY_API}/apps/${PLAY_PKG}/${set}`, { headers: auth });
  const fresh = ((meta.freshnessInfo || {}).freshnesses || []).find((f) => f.aggregationPeriod === "DAILY");
  if (!fresh || !fresh.latestEndTime) return { days: {}, seen: [], freshest: null };
  const e = fresh.latestEndTime, tz = { id: (e.timeZone && e.timeZone.id) || PLAY_TZ };
  const s = new Date(Date.UTC(e.year, e.month - 1, e.day) - PLAY_DAYS * 86400000);
  const q = await fetchJson(`${PLAY_API}/apps/${PLAY_PKG}/${set}:query`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      timelineSpec: {
        aggregationPeriod: "DAILY",
        startTime: { year: s.getUTCFullYear(), month: s.getUTCMonth() + 1, day: s.getUTCDate(), timeZone: tz },
        endTime: { year: e.year, month: e.month, day: e.day, timeZone: tz },
      },
      metrics: Object.keys(PLAY_SETS[set]),
      pageSize: 1000,
    }),
  });
  const last = new Date(Date.UTC(e.year, e.month - 1, e.day) - 86400000);   // the exclusive end's previous day
  return { ...playRows(q.rows, PLAY_SETS[set]), freshest: last.toISOString().slice(0, 10), first_start: (q.rows || [])[0]?.startTime || null };
}

async function play() {
  const raw = process.env.PLAY_SERVICE_ACCOUNT_JSON || "";
  if (!raw) return { ok: false, reason: "Google Play not connected yet" };
  if (playCache && Date.now() - playCache.at < PLAY_CACHE_MS) return playCache.body;
  let sa;
  try {
    sa = JSON.parse(raw);
    if (!sa.client_email || !sa.private_key) throw new Error();
  } catch {
    return { ok: false, reason: "PLAY_SERVICE_ACCOUNT_JSON is not a service-account key" };
  }
  try {
    const token = await playAccessToken(sa);
    const [crash, anr] = await Promise.allSettled([playSet(token, "crashRateMetricSet"), playSet(token, "anrRateMetricSet")]);
    if (crash.status === "rejected") throw crash.reason;
    const days = {};
    for (const part of [crash.value, anr.status === "fulfilled" ? anr.value : null]) {
      for (const [d, v] of Object.entries((part && part.days) || {})) days[d] = { ...(days[d] || {}), ...v };
    }
    const daily = Object.keys(days).sort().map((day) => ({ day, ...days[day] }));
    const body = {
      ok: true,
      source: "Google Play Developer Reporting API",
      package: PLAY_PKG,
      timezone: PLAY_TZ,
      freshest: crash.value.freshest,
      fields_seen: [...new Set([...crash.value.seen, ...(anr.status === "fulfilled" ? anr.value.seen : [])])],
      first_start: crash.value.first_start,
      anr: anr.status === "fulfilled" ? true : noEmails(anr.reason && anr.reason.message || anr.reason),
      daily,
      latest: daily.length ? daily[daily.length - 1] : null,
    };
    playCache = { at: Date.now(), body };
    return body;
  } catch (e) {
    const err = { ok: false, reason: noEmails(e.message || e) };
    return playCache ? { ...playCache.body, stale: true, refresh_error: err.reason } : err;
  }
}

async function local(name) {
  try {
    return JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url), "utf8"));
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const [ph, gh, gp, history, replay, traffic] = await Promise.all([posthog(), github(), play(), local("history.json"), local("replay.json"), local("traffic.json")]);
  const body = { generated_at: new Date().toISOString(), posthog: ph, github: gh, play: gp, history, replay, traffic };
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).send(JSON.stringify(body));
}
