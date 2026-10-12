// Failed phone flashes -> GitHub issues, so every flash that fails on a real phone reaches the repo (Felipe, 2026-10-12:
// "when flash error, create an issue automatically so we know"). Source: the app's opt-in analytics event
// flash_finished {result: "failed", error, app, env, source} (v0.0.7+); one flash-failed issue per ERROR KIND (a flash
// error is the phone/USB/ROM path, rarely the app: 2026-10-10 one race failed 4 apps), apps listed inside; aggregates
// only -- counts, days, apps, app versions, phone models -- never an install id. A hidden marker in the
// issue body records the newest failure already counted, so a re-run only adds what is new; a closed issue reopens when
// its failure comes back.

export const LABEL = "flash-failed";
const WINDOW = "INTERVAL 7 DAY";   // the daily cron reads a week, so a missed run loses nothing; the marker dedupes
const MARKER = /<!-- flash-failed key=(\S+) last=(\S+) count=(\d+) -->/;

/** The failure kind of an error message: the numbers that change per run (offsets, sizes, ms) become N. */
export function errorKind(message) {
  return String(message || "unknown error").replace(/\d+/g, "N").replace(/\s+/g, " ").trim().slice(0, 120);
}

const iso = (ts) => {
  const s = String(ts || "");
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s.replace(" ", "T") : `${s.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().replace(/\.\d{3}Z$/, "Z");
};

/**
 * Failed flashes of the last week from PostHog (Android app installs, emulators excluded like the stats site).
 * @param {{posthogApiHost: string, posthogProjectId: string, posthogPersonalKey: string}} config
 * @param {typeof fetch} fetchImpl
 */
export async function queryFailures(config, fetchImpl) {
  const sql = `
    SELECT toString(timestamp) AS ts, toString(properties.app) AS app, toString(properties.env) AS env,
      toString(properties.source) AS source, toString(properties.error) AS error,
      coalesce(properties.$device_model, '?') AS model, toString(properties.$app_version) AS version
    FROM events
    WHERE event = 'flash_finished' AND properties.result != 'ok' AND properties.$lib = 'posthog-android'
      AND NOT (coalesce(properties.$device_model, '') LIKE 'sdk_gphone%') AND timestamp > now() - ${WINDOW}
    ORDER BY timestamp LIMIT 2000`;
  const res = await fetchImpl(`${config.posthogApiHost}/api/projects/${config.posthogProjectId}/query/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.posthogPersonalKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query: sql } }),
  });
  if (!res.ok) {
    const e = new Error(`posthog ${res.status} on the flash-failure query`);
    /** @type {any} */ (e).status = 502;
    throw e;
  }
  const j = await res.json();
  const cols = j.columns || [];
  return (j.results || []).map((row) => {
    const r = Object.fromEntries(cols.map((c, i) => [c, row[i]]));
    return { ts: iso(r.ts), app: String(r.app || "unknown"), env: String(r.env || "?"), source: String(r.source || "?"), error: String(r.error || "unknown error"), model: String(r.model || "?"), version: String(r.version || "?") };
  }).filter((e) => e.ts);
}

const keyOf = (e) => errorKind(e.error);
const day = (ts) => ts.slice(0, 10);
const uniq = (xs) => [...new Set(xs)].sort();
const counts = (xs) => [...xs.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map())].map(([k, n]) => `${k} (${n})`).join(", ");
const marker = (key, last, count) => `<!-- flash-failed key=${Buffer.from(key).toString("base64url")} last=${last} count=${count} -->`;

function summary(events) {
  return {
    first: day(events[0].ts),
    last: day(events.at(-1).ts),
    versions: uniq(events.map((e) => e.version)).join(", "),
    phones: counts(events.map((e) => e.model)),
    sources: uniq(events.map((e) => e.source)).join(", "),
    apps: counts(events.map((e) => `${e.app} [${e.env}]`)),
  };
}

function issueBody(kind, events) {
  const s = summary(events);
  return [
    `Phone flashes that failed with \`${kind}\`, from the app's opt-in analytics: aggregates only, no install ids.`,
    "",
    "| Failures | First | Last | Apps [target] | App versions | Phones | Sources |",
    "|---|---|---|---|---|---|---|",
    `| ${events.length} | ${s.first} | ${s.last} | ${s.apps} | ${s.versions} | ${s.phones} | ${s.sources} |`,
    "",
    `Latest message: \`${events.at(-1).error.slice(0, 200)}\``,
    "",
    "Filed by the build proxy's daily check (`/api/flash-failures`). New failures of this kind arrive as comments; close the",
    "issue once fixed -- it reopens if the failure comes back.",
    marker(kind, events.at(-1).ts, events.length),
  ].join("\n");
}

/**
 * Open or update one flash-failed issue per failure kind with the failures it has not counted yet.
 * @param {import("./github.js").GitHub} gh
 * @param {{ts: string, app: string, env: string, source: string, error: string, model: string, version: string}[]} events
 */
export async function syncFlashFailures(gh, events) {
  const groups = new Map();
  for (const e of [...events].sort((a, b) => a.ts.localeCompare(b.ts))) {
    const k = keyOf(e);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  const known = new Map();
  for (const issue of groups.size ? await gh.listIssuesByLabel(LABEL) : []) {
    const m = MARKER.exec(String(issue.body || ""));
    if (!m) continue;
    const key = Buffer.from(m[1], "base64url").toString();
    if (!known.has(key)) known.set(key, { issue, last: m[2], count: Number(m[3]) });
  }
  let created = 0, updated = 0, skipped = 0;
  for (const [key, all] of groups) {
    const k = known.get(key);
    if (!k) {
      await gh.createIssue({ title: `[${LABEL}] ${key}`.slice(0, 200), body: issueBody(key, all), labels: [LABEL] });
      created++;
      continue;
    }
    const fresh = all.filter((e) => e.ts > k.last);
    if (!fresh.length) { skipped++; continue; }
    const s = summary(fresh);
    const n = fresh.length;
    await gh.commentIssue(k.issue.number, [
      `${n} more failed flash${n > 1 ? "es" : ""} (${s.first}${s.last !== s.first ? ` .. ${s.last}` : ""}): apps ${s.apps}; app versions ${s.versions}; phones ${s.phones}.`,
      `Latest message: \`${fresh.at(-1).error.slice(0, 200)}\``,
    ].join("\n"));
    const body = String(k.issue.body || "").replace(MARKER, marker(key, fresh.at(-1).ts, k.count + n));
    await gh.updateIssue(k.issue.number, { body, state: "open" });
    updated++;
  }
  return { events: events.length, groups: groups.size, created, updated, skipped };
}
