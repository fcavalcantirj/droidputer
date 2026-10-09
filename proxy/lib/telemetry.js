// Server-side usage events for the public stats page (2026-10-09): every build request and verdict the proxy
// sees, from every app version (old APKs carry no analytics), sent to the same hosted PostHog project the app
// uses. Never person profiles, never the client IP in properties; `device` only when the phone opted in to
// analytics and sent its anonymous id (X-Droidputter-Device). Best effort: a slow or failing PostHog must
// never delay a build answer by more than TRACK_TIMEOUT_MS or turn it into an error.

const DEVICE_RE = /^device-[0-9a-f]{8}$/;
// Upper bound on how long a build answer waits for PostHog (it runs at most twice per build: dispatch + outcome).
// Measured 2026-10-09: ingestion (created_at) lands < 1 s after the call; events only become QUERYABLE 2-3 min later,
// which once looked like a lost build_result -- it was not. 4 s is margin, not a fix.
export const TRACK_TIMEOUT_MS = 4000;

/** @param {import("./http.js").ProxyRequest} request @returns {string | null} */
export function deviceOf(request) {
  const d = String(request.headers["x-droidputter-device"] || "").trim();
  return DEVICE_RE.test(d) ? d : null;
}

/**
 * @param {import("./http.js").Ctx} ctx
 * @param {string} event
 * @param {Record<string, unknown>} props
 * @param {string | null} [device]
 */
export async function track(ctx, event, props, device = null) {
  const { posthogKey, posthogHost } = ctx.config;
  if (!posthogKey) return;
  const properties = { ...props, source: "proxy", $process_person_profile: false };
  if (device) properties.device = device;
  const body = JSON.stringify({ api_key: posthogKey, event, distinct_id: device || "proxy", properties });
  const doFetch = ctx.fetch || globalThis.fetch;
  try {
    await Promise.race([
      doFetch(`${posthogHost}/i/v0/e/`, { method: "POST", headers: { "Content-Type": "application/json" }, body }),
      new Promise((resolve) => setTimeout(resolve, TRACK_TIMEOUT_MS)),
    ]);
  } catch {
    // analytics is never worth a failed build request
  }
}
