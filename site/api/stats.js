// GET /api/stats -> every number on the public stats page, as one JSON document (the page's Download buttons
// export exactly this). Sources: the hosted PostHog project (anonymous, opt-in app events + the build proxy's
// server-side events), public GitHub data (release downloads, apps/verdicts.json) and data/*.json (build history
// from before analytics existed). Aggregates only: no device ids, no IPs, no per-event rows ever leave here.
// Cached at the edge for 60 s, so the PostHog query budget (2,400/h) is never near.

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
    let cum = 0;
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

async function local(name) {
  try {
    return JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url), "utf8"));
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const [ph, gh, history, replay, traffic] = await Promise.all([posthog(), github(), local("history.json"), local("replay.json"), local("traffic.json")]);
  const body = { generated_at: new Date().toISOString(), posthog: ph, github: gh, history, replay, traffic };
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).send(JSON.stringify(body));
}
