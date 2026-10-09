import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { handle as buildHandle } from "../api/build.js";
import { handle as statusHandle } from "../api/build/[id].js";
import { _resetArtifactCache, _resetFailureCache, selectArtifact } from "../lib/artifact.js";
import { _resetShimCache, runTitle } from "../lib/builds.js";
import { SHIM, UPSTREAM, ctxWith, fakeGitHub, makeArtifact, makeRun, parse, req } from "./helpers.js";

const failureZip = (rec) => zipSync({ "failure.json": strToU8(JSON.stringify(rec)) }, { level: 1 });
const failedRun = (id, ageMs = 3600e3) => makeRun({ id, title: runTitle({ repo: UPSTREAM, shim: SHIM, requestId: `req-${id}` }), conclusion: "failure", ageMs });
const withFailure = (id, rec, runs = [failedRun(id)]) =>
  fakeGitHub({ runs, artifacts: { [id]: [makeArtifact(id * 10, { name: "stellar-map-m5cardputer-failure", size: 200 })] }, zips: { [id * 10]: failureZip(rec) } });
const post = () => req({ method: "POST", path: "/api/build", body: { repo: UPSTREAM } });

beforeEach(() => { _resetShimCache(); _resetArtifactCache(); _resetFailureCache(); });

describe("failure reasons (build-app.yml failure.json)", () => {
  test("a deterministic failure of the same build in the last 24 h answers at once: 200 cached with class + reason, no dispatch", async () => {
    const fake = withFailure(601, { class: "dram-overflow", reason: "the app plus the shim need 21400 bytes more static RAM than the ESP32-S3 has" });
    const res = await buildHandle(post(), ctxWith(fake));
    assert.equal(res.status, 200);
    const body = parse(res);
    assert.equal(body.cached, true);
    assert.equal(body.request_id, "req-601");
    assert.equal(body.failure_class, "dram-overflow");
    assert.match(body.reason, /21400 bytes/);
    assert.equal(fake.dispatches.length, 0);
  });

  test("infra failures, failures without a failure.json and failures older than 24 h are rebuilt", async () => {
    for (const fake of [
      withFailure(602, { class: "infra", reason: "runner" }),
      withFailure(603, { class: "build-error", reason: "registry timeout" }),
      fakeGitHub({ runs: [failedRun(604)] }),
      withFailure(605, { class: "compile-error", reason: "x" }, [failedRun(605, 25 * 3600e3)]),
    ]) {
      _resetFailureCache();
      const res = await buildHandle(post(), ctxWith(fake));
      assert.equal(res.status, 202);
      assert.equal(fake.dispatches.length, 1);
    }
  });

  test("GET status of a failed run carries failure_class + reason; without the artifact it is the old failed shape", async () => {
    const fake = withFailure(606, { class: "unsupported-graphics", reason: "draws with TFT_eSPI" });
    const st = (f) => statusHandle(req({ path: "/api/build/req-606", params: { id: "req-606" } }), ctxWith(f));
    const body = parse(await st(fake));
    assert.equal(body.status, "failed");
    assert.equal(body.failure_class, "unsupported-graphics");
    assert.equal(body.reason, "draws with TFT_eSPI");
    _resetFailureCache();
    const old = parse(await st(fakeGitHub({ runs: [failedRun(606)] })));
    assert.equal(old.status, "failed");
    assert.equal(old.failure_class, undefined);
  });

  test("the -failure artifact is never selected as the flashable one", () => {
    const arts = [{ id: 1, name: "stellar-map-m5cardputer-failure" }, { id: 2, name: "stellar-map-m5cardputer-elf" }];
    assert.equal(selectArtifact(arts, { env: "m5cardputer" }), undefined);
    assert.equal(selectArtifact(arts, {}), undefined);
  });
});
