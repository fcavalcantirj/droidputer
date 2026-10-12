// GET /api/flash-failures (Vercel cron, daily): failed phone flashes from PostHog become flash-failed GitHub issues.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { handle } from "../api/flash-failures.js";
import { errorKind } from "../lib/flashfailures.js";
import { API, REPO, TOKEN, parse, req } from "./helpers.js";

const PH = "https://ph.test";
const SECRET = "cron-secret-never-leaks";
const ev = (ts, o = {}) => ({ ts, app: "stellar-map", env: "m5cardputer-virtual", source: "proxy", error: "FLASH_DEFL_BEGIN timed out", model: "2412DPC0AG", version: "0.0.7", device: "device-1a2b3c4d", ...o });

/** Fake PostHog query API + GitHub issues API; records every write. */
function fakes({ events = [], issues = [] } = {}) {
  const calls = [];
  const writes = [];
  const jsonRes = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  let nextNumber = 500;
  /** @type {typeof fetch} */
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = (init.method || "GET").toUpperCase();
    const auth = (init.headers && (init.headers.Authorization || init.headers.authorization)) || "";
    calls.push({ method, url: String(input), auth });
    if (url.origin === PH) {
      if (auth !== "Bearer phx_read") return jsonRes(401, { detail: "bad key" });
      const cols = ["ts", "app", "env", "source", "error", "model", "version"];
      return jsonRes(200, { columns: cols, results: events.map((e) => cols.map((c) => e[c])) });
    }
    if (url.origin !== API || auth !== `Bearer ${TOKEN}`) return jsonRes(401, { message: "Bad credentials" });
    const base = `/repos/${REPO}`;
    if (url.pathname === `${base}/issues` && method === "GET") return jsonRes(200, issues);
    if (url.pathname === `${base}/issues` && method === "POST") {
      const b = JSON.parse(init.body);
      writes.push({ kind: "create", ...b });
      const number = nextNumber++;
      return jsonRes(201, { number, html_url: `https://github.com/${REPO}/issues/${number}` });
    }
    let m = new RegExp(`^${base}/issues/(\\d+)/comments$`).exec(url.pathname);
    if (m && method === "POST") { writes.push({ kind: "comment", number: Number(m[1]), ...JSON.parse(init.body) }); return jsonRes(201, { id: 1 }); }
    m = new RegExp(`^${base}/issues/(\\d+)$`).exec(url.pathname);
    if (m && method === "PATCH") { writes.push({ kind: "update", number: Number(m[1]), ...JSON.parse(init.body) }); return jsonRes(200, { number: Number(m[1]) }); }
    return jsonRes(404, { message: "Not Found" });
  };
  return { fetch: fetchImpl, calls, writes };
}

const ctxOf = (f, { cronSecret = SECRET } = {}) => ({
  config: { token: TOKEN, repo: REPO, workflow: "build-app.yml", baseUrl: "", apiBase: API, cronSecret, posthogApiHost: PH, posthogProjectId: "42", posthogPersonalKey: "phx_read" },
  fetch: f.fetch,
  now: () => Date.parse("2026-10-12T09:00:00Z"),
});
const cron = (secret = SECRET) => req({ path: "/api/flash-failures", headers: secret ? { authorization: `Bearer ${secret}` } : {} });

describe("GET /api/flash-failures", () => {
  test("only Vercel cron may run it: no secret configured -> 500, wrong or missing bearer -> 401, no upstream call", async () => {
    const f = fakes();
    await assert.rejects(handle(cron(), ctxOf(f, { cronSecret: "" })), (e) => e.status === 500 && /CRON_SECRET/.test(e.message));
    assert.equal((await handle(cron("nope"), ctxOf(f))).status, 401);
    assert.equal((await handle(cron(""), ctxOf(f))).status, 401);
    assert.equal(f.calls.length, 0);
  });

  test("error kinds ignore the numbers that change per run", () => {
    assert.equal(errorKind("Error writing 64 bytes at offset 768 of total 1058 after 9msec, rc=-1"), errorKind("Error writing 128 bytes at offset 0 of total 2048 after 12msec, rc=-1"));
    assert.equal(errorKind("FLASH_DEFL_BEGIN timed out"), "FLASH_DEFL_BEGIN timed out");
    assert.notEqual(errorKind("FLASH_DEFL_BEGIN timed out"), errorKind("SYNC timed out"));
  });

  test("one flash-failed issue per error KIND (apps listed inside), aggregates only, no ids", async () => {
    const f = fakes({ events: [
      ev("2026-10-10T14:25:56Z"),
      ev("2026-10-10T14:52:20Z", { app: "cardputer" }),
      ev("2026-10-10T14:54:01Z", { app: "cardputer", error: "Error writing 64 bytes at offset 768 of total 1058 after 9msec, rc=-1" }),
      ev("2026-10-11T10:00:00Z", { app: "cardputer", error: "Error writing 128 bytes at offset 0 of total 2048 after 12msec, rc=-1", model: "OnePlus8Pro", version: "0.0.8" }),
    ] });
    const res = await handle(cron(), ctxOf(f));
    assert.equal(res.status, 200);
    const body = parse(res);
    assert.equal(body.created, 2);   // FLASH_DEFL_BEGIN (stellar-map + cardputer) and the write error (2 runs)
    const creates = f.writes.filter((w) => w.kind === "create");
    assert.equal(creates.length, 2);
    for (const c of creates) {
      assert.deepEqual(c.labels, ["flash-failed"]);
      assert.match(c.title, /^\[flash-failed\] /);
      assert.ok(!c.body.includes("device-1a2b3c4d"), "no install ids in a public issue");
      assert.match(c.body, /<!-- flash-failed key=/);
    }
    const write = creates.find((c) => /Error writing/.test(c.title));
    assert.match(write.title, /^\[flash-failed\] Error writing N bytes/);
    const defl = creates.find((c) => /FLASH_DEFL_BEGIN/.test(c.title));
    assert.match(defl.body, /stellar-map \[m5cardputer-virtual\] \(1\)/);
    assert.match(defl.body, /, cardputer \[m5cardputer-virtual\] \(1\)|^cardputer \[m5cardputer-virtual\] \(1\)| cardputer \[m5cardputer-virtual\] \(1\)/m);
    assert.match(write.body, /\| 2 \|/);   // two failures of that kind
    assert.match(write.body, /0\.0\.7.*0\.0\.8|0\.0\.8.*0\.0\.7/);
    assert.match(write.body, /OnePlus8Pro/);
  });

  test("an existing issue gets a comment with only the NEW failures, its marker moves, a closed one reopens; nothing new -> no write", async () => {
    const key = "FLASH_DEFL_BEGIN timed out";
    const marker = `<!-- flash-failed key=${Buffer.from(key).toString("base64url")} last=2026-10-10T14:25:56Z count=1 -->`;
    const issue = { number: 120, state: "closed", title: "[flash-failed] FLASH_DEFL_BEGIN timed out", body: `old body\n${marker}`, labels: [{ name: "flash-failed" }] };
    const f = fakes({ issues: [issue], events: [ev("2026-10-10T14:25:56Z"), ev("2026-10-11T08:00:00Z", { version: "0.0.8" })] });
    const body = parse(await handle(cron(), ctxOf(f)));
    assert.equal(body.updated, 1);
    const comment = f.writes.find((w) => w.kind === "comment");
    assert.equal(comment.number, 120);
    assert.match(comment.body, /1 more failed flash/);
    const update = f.writes.find((w) => w.kind === "update");
    assert.equal(update.state, "open");
    assert.match(update.body, /last=2026-10-11T08:00:00Z count=2 -->/);

    const quiet = fakes({ issues: [{ ...issue, state: "open", body: `x\n<!-- flash-failed key=${Buffer.from(key).toString("base64url")} last=2026-10-11T08:00:00Z count=2 -->` }], events: [ev("2026-10-10T14:25:56Z"), ev("2026-10-11T08:00:00Z")] });
    const q = parse(await handle(cron(), ctxOf(quiet)));
    assert.equal(q.updated, 0);
    assert.equal(quiet.writes.length, 0);
  });
});
