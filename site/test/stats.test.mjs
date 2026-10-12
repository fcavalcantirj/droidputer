// node --test (site/): the stats site's numbers against their sources. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import history from "../public/data/history.json" with { type: "json" };
import { buildsRunTotal, verdictStats } from "../lib/stats-server.js";

test("history.json holds every build-app run up to the PostHog window (2026-10-09 19:00 UTC): no gap", () => {
  // 2026-10-11 check: the bundled history ended 2026-10-08 and PostHog starts 2026-10-09 19:00, so the 140 runs of
  // 2026-10-09 00:00-19:00 UTC (64 built, 71 failed, 5 cancelled on GitHub) were counted nowhere.
  const day = history.runs.filter((r) => r.date === "2026-10-09");
  assert.equal(day.length, 140);
  assert.deepEqual(
    { built: day.filter((r) => r.result === "built").length, failed: day.filter((r) => r.result === "failed").length, cancelled: day.filter((r) => r.result === "cancelled").length },
    { built: 64, failed: 71, cancelled: 5 },
  );
  assert.equal(history.runs.length, 275 + 140);
  for (const r of day) assert.ok(r.repo && r.env && r.class, JSON.stringify(r));
});

test("app installs reporting = anonymous per-install ids only; a GitHub user's manual verdict is not a phone", () => {
  const v = [
    { name: "stellar-map", env: "m5cardputer", result: "works", note: "manual", date: "2026-09-03", reporter: "fcavalcantirj" },
    { name: "stellar-map", env: "m5cardputer-virtual", result: "works", note: "auto: linked, 700 frames in 20 s", date: "2026-10-10", reporter: "device-337a90f7" },
    { name: "pigtail", env: "m5cardputer-virtual", result: "broken", note: "auto: boots=8 hello=true frames=4", date: "2026-10-10", reporter: "device-337a90f7" },
    { name: "miniacid", env: "m5cardputer-virtual", result: "works", note: "auto: linked, 222 frames in 20 s", date: "2026-10-11", reporter: "device-4e0fced1" },
  ];
  const s = verdictStats(v);
  assert.equal(s.verdicts.total, 4);
  assert.equal(s.verdicts.reporters, 2);
  assert.equal(s.verdicts.timeline.at(-1).phones_cumulative, 2);
  assert.equal(s.behaviour.phones_that_flashed, 2);
  assert.equal(s.behaviour.mirror_up, 2);
});

test("builds run = GitHub's own total of build-app runs", () => {
  assert.equal(buildsRunTotal({ total_count: 455, workflow_runs: [] }), 455);
  assert.equal(buildsRunTotal({}), null);
  assert.equal(buildsRunTotal(null), null);
});
