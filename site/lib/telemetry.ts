// Same-origin: the browser polls this deployment's own API (previews read their own data, not production).
import { track } from "@/lib/analytics";

export const STATS_URL = "/api/stats";
export const REPO_URL = "https://github.com/fcavalcantirj/droidputer";
export const PLAY_URL = "https://play.google.com/store/apps/details?id=com.droidputter";
export const PRIVACY_URL = "/privacy";

export type View =
  "overview" | "phones" | "apps" | "builds" | "play" | "data" | "about";
export type Period = "7" | "30" | "all";
export type DailyActivity = {
  day: string;
  devices: number;
  build_requests: number;
  flashes: number;
  links: number;
  mirror_minutes: number | null;
};
export type BuildRun = {
  date: string;
  repo: string | null;
  env: string;
  result: string;
  class: string;
  reason: string;
};
export type Stats = {
  generated_at: string;
  github: {
    releases?:
      { tag: string; published: string; apk_downloads: number }[] | null;
    behaviour?: {
      phones_that_flashed: number;
      flashes_observed: number;
      mirror_up: number;
      no_hello: number;
      hello_no_frames: number;
      frames_in_20s: number[];
      apps_per_phone: Record<string, number>;
      most_flashed: { app: string; phones: number }[];
      envs: Record<string, number>;
    } | null;
    verdicts?: {
      total: number;
      reporters: number;
      by_app: { app: string; works: number; broken: number }[];
      timeline: {
        day: string;
        verdicts: number;
        new_phones: number;
        phones_cumulative: number;
      }[];
    } | null;
  };
  posthog: {
    ok: boolean;
    reason?: string;
    errors?: Record<string, string>;
    daily?: DailyActivity[] | null;
    funnel?: { event: string; devices: number; events: number }[] | null;
    apps?:
      | {
          app: string;
          devices: number;
          flashes: number;
          links: number;
          mirror_minutes: number;
        }[]
      | null;
    builds?: { kind: string; k: string; n: number }[] | null;
    health?: { event: string; app: string; n: number }[] | null;
    totals?:
      | {
          devices_all_time: number;
          devices_7d: number;
          devices_24h: number;
          build_requests: number;
          flashes: number;
          mirror_minutes: number | null;
        }[]
      | null;
  };
  history?: { source: string; runs: BuildRun[] } | null;
  replay?: {
    date: string;
    note: string;
    pairs: {
      repo: string;
      env: string;
      before: string;
      after: string;
      outcome: string;
      reason: string | null;
    }[];
  } | null;
  play: {
    ok: boolean;
    reason?: string;
    stale?: boolean;
    timezone?: string;
    daily?: {
      day: string;
      users?: number;
      crash_rate?: number;
      user_perceived_crash_rate?: number;
      anr_rate?: number;
    }[];
    errors?: {
      freshest: string;
      start: string;
      daily: {
        day: string;
        crash_reports: number;
        crash_users: number;
        anr_reports: number;
        anr_users: number;
      }[];
    } | null;
    issues?:
      | {
          type: string;
          cause: string;
          exception: string;
          reports: number;
          users: number;
          last_seen: string;
          last_version: string;
        }[]
      | null;
  };
  traffic?: {
    source: string;
    taken: string;
    views: {
      count: number;
      uniques: number;
      daily: { day: string; count: number; uniques: number }[];
    };
    clones: { count: number; uniques: number; note: string };
    referrers: { referrer: string; count: number; uniques: number }[];
  } | null;
};

export async function fetchStats(url: string): Promise<Stats> {
  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!response.ok)
    throw new Error("The public telemetry feed is temporarily unavailable.");
  const data = await response.json();
  if (
    !data ||
    typeof data.generated_at !== "string" ||
    !data.github ||
    !data.posthog
  ) {
    throw new Error("The telemetry feed returned an unexpected response.");
  }
  return data;
}

export function formatNumber(value: number | null | undefined) {
  return value == null
    ? "—"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(
        value,
      );
}

export function formatDay(day: string) {
  return new Date(`${day.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function inPeriod(day: string, period: Period, end: string) {
  if (period === "all") return true;
  const cutoff =
    new Date(`${end.slice(0, 10)}T00:00:00Z`).getTime() -
    (Number(period) - 1) * 86400000;
  return new Date(`${day.slice(0, 10)}T00:00:00Z`).getTime() >= cutoff;
}

export function buildActivity(data: Stats, period: Period) {
  const counts = new Map<string, number>();
  for (const run of data.history?.runs ?? [])
    counts.set(run.date, (counts.get(run.date) ?? 0) + 1);
  // Historical runs end on October 8; the proxy's daily counter starts after that boundary.
  for (const day of data.posthog.daily ?? []) {
    if (day.day > "2026-10-08")
      counts.set(
        day.day,
        (counts.get(day.day) ?? 0) + Number(day.build_requests),
      );
  }
  if (!counts.size) return [];
  const end = data.generated_at.slice(0, 10);
  const first = [...counts.keys()].sort()[0];
  const start =
    period === "all"
      ? new Date(`${first}T00:00:00Z`)
      : new Date(
          new Date(`${end}T00:00:00Z`).getTime() -
            (Number(period) - 1) * 86400000,
        );
  const points: { day: string; requests: number }[] = [];
  for (
    let date = start;
    date.toISOString().slice(0, 10) <= end;
    date = new Date(date.getTime() + 86400000)
  ) {
    const day = date.toISOString().slice(0, 10);
    points.push({ day, requests: counts.get(day) ?? 0 });
  }
  return points;
}

export function requestedApps(data: Stats) {
  const apps = new Map<
    string,
    { name: string; requests: number; built: number }
  >();
  for (const run of data.history?.runs ?? []) {
    const name = run.repo || "Unknown repository";
    const entry = apps.get(name) ?? { name, requests: 0, built: 0 };
    entry.requests++;
    if (run.result === "built") entry.built++;
    apps.set(name, entry);
  }
  for (const run of data.posthog.builds ?? []) {
    if (run.kind !== "repo") continue;
    const entry = apps.get(run.k) ?? { name: run.k, requests: 0, built: 0 };
    entry.requests += Number(run.n);
    apps.set(run.k, entry);
  }
  return [...apps.values()].sort((a, b) => b.requests - a.requests);
}

export function downloadData(data: Stats, type: "json" | "csv") {
  let content: string;
  if (type === "json") content = JSON.stringify(data, null, 2);
  else {
    const rows: [string, string, string][] = [["dataset", "field", "value"]];
    function flatten(value: unknown, path: string) {
      if (Array.isArray(value))
        value.forEach((item, index) => flatten(item, `${path}[${index}]`));
      else if (value && typeof value === "object")
        Object.entries(value).forEach(([key, item]) =>
          flatten(item, path ? `${path}.${key}` : key),
        );
      else
        rows.push([
          path.split(".")[0],
          path,
          value == null ? "" : String(value),
        ]);
    }
    flatten(data, "");
    content = rows
      .map((row) =>
        row
          .map((cell) => {
            const safe = /^[=+@\-\t\r]/.test(cell) ? `'${cell}` : cell;
            return `"${safe.replaceAll('"', '""')}"`;
          })
          .join(","),
      )
      .join("\r\n");
  }
  const url = URL.createObjectURL(
    new Blob([content], {
      type: type === "json" ? "application/json" : "text/csv;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `droidputer-${data.generated_at.slice(0, 10)}.${type}`;
  track("file_download", { file_extension: type, file_name: link.download, link_text: `Download ${type.toUpperCase()}` });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
