import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { handle as buildHandle } from "../api/build.js";
import { _resetReported, handle as statusHandle } from "../api/build/[id].js";
import { _resetArtifactCache, _resetFailureCache } from "../lib/artifact.js";
import { _resetShimCache, runTitle } from "../lib/builds.js";
import { deviceOf } from "../lib/telemetry.js";
import { SHIM, UPSTREAM, ctxWith, fakeGitHub, makeRun, parse, req } from "./helpers.js";

/** Wraps the fake GitHub fetch: PostHog capture calls are recorded, everything else goes to the fake. */
function withPostHog(fake, { fail = false } = {}) {
  const events = [];
  const fetch = async (url, init) => {
    if (String(url).startsWith("https://ph.test/")) {
      if (fail) throw new Error("posthog down");
      events.push(JSON.parse(init.body));
      return new Response('{"status":"Ok"}', { status: 200 });
    }
    return fake.fetch(url, init);
  };
  return { events, ctx: (o = {}) => { const c = ctxWith({ ...fake, fetch }, o); c.config = { ...c.config, posthogKey: "phc_test", posthogHost: "https://ph.test" }; return c; } };
}

beforeEach(() => { _resetShimCache(); _resetArtifactCache(); _resetFailureCache(); _resetReported(); });

describe("proxy usage events (PostHog)", () => {
  test("a dispatched build sends build_dispatched with repo/env and the opted-in device id only", async () => {
    const fake = fakeGitHub({});
    const ph = withPostHog(fake);
    const post = (headers) => req({ method: "POST", path: "/api/build", body: { repo: UPSTREAM }, headers });
    assert.equal((await buildHandle(post({ "x-droidputter-device": "device-1d7a1634" }), ph.ctx())).status, 202);
    assert.equal(ph.events.length, 1);
    const e = ph.events[0];
    assert.equal(e.event, "build_dispatched");
    assert.equal(e.api_key, "phc_test");
    assert.equal(e.distinct_id, "device-1d7a1634");
    assert.equal(e.properties.repo, UPSTREAM);
    assert.equal(e.properties.device, "device-1d7a1634");
    assert.equal(e.properties.$process_person_profile, false);
    await buildHandle(post({ "x-droidputter-device": "not-a-device; drop table" }), ph.ctx());
    assert.equal(ph.events[1].distinct_id, "proxy");
    assert.equal(ph.events[1].properties.device, undefined);
  });

  test("PostHog down never breaks the build answer; no key = no call", async () => {
    const fake = fakeGitHub({});
    const down = withPostHog(fake, { fail: true });
    assert.equal((await buildHandle(req({ method: "POST", path: "/api/build", body: { repo: UPSTREAM } }), down.ctx())).status, 202);
    const off = withPostHog(fakeGitHub({}));
    const c = off.ctx(); c.config.posthogKey = "";
    await buildHandle(req({ method: "POST", path: "/api/build", body: { repo: UPSTREAM } }), c);
    assert.equal(off.events.length, 0);
  });

  test("a terminal status reports build_result once per run, not on every poll", async () => {
    const run = makeRun({ id: 701, title: runTitle({ repo: UPSTREAM, shim: SHIM, requestId: "req-701" }), conclusion: "failure" });
    const ph = withPostHog(fakeGitHub({ runs: [run] }));
    const poll = () => statusHandle(req({ path: "/api/build/req-701", params: { id: "req-701" } }), ph.ctx());
    assert.equal(parse(await poll()).status, "failed");
    await poll();
    assert.equal(ph.events.length, 1);
    assert.equal(ph.events[0].event, "build_result");
    assert.equal(ph.events[0].properties.repo, UPSTREAM);
    assert.equal(ph.events[0].properties.result, "failed");
  });

  test("deviceOf accepts only the app's anonymous id shape", () => {
    assert.equal(deviceOf({ headers: { "x-droidputter-device": "device-0a1b2c3d" } }), "device-0a1b2c3d");
    assert.equal(deviceOf({ headers: { "x-droidputter-device": "device-XYZ" } }), null);
    assert.equal(deviceOf({ headers: {} }), null);
  });
});
