// GET /api/build/{request_id} -> {status: queued|building|failed|ready, env, ...} (see lib/builds.js buildStatus)
// env is parsed from the run name (m5cardputer when absent); once ready the parts come from the run's
// <name>-<env> artifact, never from the <name>-<env>-elf one.

import { buildStatus } from "../../lib/builds.js";
import { baseUrlOf, error, githubOf, json, param, vercel } from "../../lib/http.js";
import { validateRequestId } from "../../lib/validate.js";
import { deviceOf, track } from "../../lib/telemetry.js";

/** Runs whose outcome this warm instance already reported (the phone polls every 5 s; the stats page counts distinct run_id). */
const reported = new Set();
export function _resetReported() {
  reported.clear();
}

/**
 * @param {import("../../lib/http.js").ProxyRequest} request
 * @param {import("../../lib/http.js").Ctx} ctx
 */
export async function handle(request, ctx) {
  if (request.method !== "GET") return error(405, "method not allowed");
  const requestId = validateRequestId(param(request, "id", 1));
  const r = await buildStatus(githubOf(ctx), requestId, { baseUrl: baseUrlOf(ctx, request) });
  const b = /** @type {Record<string, any>} */ (r.body);
  if ((b.status === "ready" || b.status === "failed") && b.run_id && !reported.has(b.run_id)) {
    if (reported.size > 5000) reported.clear();
    reported.add(b.run_id);
    const repo = /^build ([\w.-]+\/[\w.-]+)@/.exec(String(b.title || ""));
    await track(ctx, "build_result", { run_id: b.run_id, repo: repo ? repo[1] : null, env: b.env, result: b.status, failure_class: b.failure_class }, deviceOf(request));
  }
  return json(r.status, r.body);
}

export default vercel(handle);
