import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { GitHubError, createGitHub } from "../lib/github.js";

// GitHub answered 502 on the run list three times on 2026-10-12 (each retry by hand seconds later worked); the
// phone got the error. GETs now retry twice on 5xx; 4xx and non-GETs (a dispatch must never run twice) do not.

/** A fetch that answers the scripted statuses in order and records every call. */
function scripted(statuses) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method || "GET" });
    const status = statuses[Math.min(calls.length, statuses.length) - 1];
    const body = status < 300 ? { workflow_runs: [{ id: 7 }] } : { message: "Server Error" };
    return new Response(status === 204 ? null : JSON.stringify(body), { status });
  };
  return { fetch, calls };
}

function client(statuses) {
  const s = scripted(statuses);
  const pauses = [];
  const logs = [];
  const gh = createGitHub({
    token: "t", repo: "o/r", workflow: "build-app.yml", apiBase: "https://gh.test", fetch: s.fetch,
    sleep: async (ms) => { pauses.push(ms); }, log: (line) => logs.push(line),
  });
  return { gh, calls: s.calls, pauses, logs };
}

describe("GitHub GETs survive a 5xx", () => {
  test("502 then 200: the run list arrives, one retry logged", async () => {
    const c = client([502, 200]);
    assert.deepEqual(await c.gh.listRuns(), [{ id: 7 }]);
    assert.equal(c.calls.length, 2);
    assert.equal(c.pauses.length, 1);
    assert.equal(c.logs.length, 1);
    assert.match(c.logs[0], /github 502 on \/repos\/o\/r\/actions\/workflows\/build-app\.yml\/runs.* retry 1/);
  });

  test("502 three times: the error still reaches the phone", async () => {
    const c = client([502, 502, 502]);
    await assert.rejects(c.gh.listRuns(), (e) => e instanceof GitHubError && e.status === 502 && e.upstream === 502);
    assert.equal(c.calls.length, 3);
    assert.equal(c.logs.length, 2);
  });

  test("503 then 504 then 200 succeeds on the last try", async () => {
    const c = client([503, 504, 200]);
    assert.deepEqual(await c.gh.listRuns(), [{ id: 7 }]);
    assert.equal(c.calls.length, 3);
  });

  for (const status of [404, 403, 422]) {
    test(`${status} is not retried`, async () => {
      const c = client([status, 200]);
      await assert.rejects(c.gh.listRuns(), (e) => e instanceof GitHubError && e.upstream === status);
      assert.equal(c.calls.length, 1);
      assert.equal(c.logs.length, 0);
    });
  }

  test("a dispatch (POST) is never retried, even on 502", async () => {
    const c = client([502, 204]);
    await assert.rejects(c.gh.dispatch({ repo: "a/b" }), (e) => e instanceof GitHubError && e.upstream === 502);
    assert.equal(c.calls.length, 1);
    assert.equal(c.calls[0].method, "POST");
  });
});
