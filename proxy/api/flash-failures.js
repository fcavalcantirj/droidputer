// GET /api/flash-failures -- Vercel cron (vercel.json "crons", daily): failed phone flashes from the app's opt-in
// analytics become flash-failed GitHub issues (lib/flashfailures.js). Only Vercel cron may run it: it sends
// "Authorization: Bearer $CRON_SECRET"; without CRON_SECRET configured the endpoint refuses outright.
//
// Environment (Vercel, Production): CRON_SECRET (random, secret), POSTHOG_PERSONAL_KEY (PostHog personal API key with
// query read, secret), POSTHOG_PROJECT_ID, optional POSTHOG_API_HOST (default https://us.posthog.com); GITHUB_TOKEN
// already carries Issues: read+write for the verdicts.

import { timingSafeEqual } from "node:crypto";
import { error, githubOf, json, vercel } from "../lib/http.js";
import { queryFailures, syncFlashFailures } from "../lib/flashfailures.js";
import { track } from "../lib/telemetry.js";

const refuse = (message) => {
  const e = new Error(message);
  /** @type {any} */ (e).status = 500;
  return e;
};

const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * @param {import("../lib/http.js").ProxyRequest} request
 * @param {import("../lib/http.js").Ctx} ctx
 */
export async function handle(request, ctx) {
  if (request.method !== "GET") return error(405, "method not allowed");
  const c = /** @type {any} */ (ctx.config);
  if (!c.cronSecret) throw refuse("CRON_SECRET is not set on the proxy: /api/flash-failures runs only from Vercel cron");
  const auth = String((request.headers && request.headers.authorization) || "");
  if (!same(auth, `Bearer ${c.cronSecret}`)) return error(401, "cron only");
  if (!c.posthogPersonalKey || !c.posthogProjectId) throw refuse("POSTHOG_PERSONAL_KEY / POSTHOG_PROJECT_ID are not set on the proxy");
  const events = await queryFailures(c, ctx.fetch);
  const result = await syncFlashFailures(githubOf(ctx), events);
  // Every run leaves a trace (a run with nothing new writes nothing on GitHub): Vercel cron sends vercel-cron/1.0.
  const trigger = /vercel-cron/i.test(String((request.headers && request.headers["user-agent"]) || "")) ? "cron" : "manual";
  await track(ctx, "flash_failures_run", { ...result, trigger });
  return json(200, result);
}

export default vercel(handle);
