// Proxy configuration from the environment. Only the token is secret; it never appears in a response,
// an error message or a log line (GitHubError carries status + path, never headers).

/**
 * @typedef {object} ProxyConfig
 * @property {string} token     GITHUB_TOKEN -- fine-grained PAT (Actions read+write, Contents read, Issues read+write on the one repo)
 * @property {string} repo      GITHUB_REPO  -- owner/name that hosts build-app.yml (default fcavalcantirj/droidputer)
 * @property {string} workflow  WORKFLOW     -- workflow file name (default build-app.yml)
 * @property {string} baseUrl   BASE_URL     -- public origin of this proxy for part URLs ("" = derive from the request Host)
 * @property {string} apiBase   GITHUB_API   -- GitHub REST origin (tests point it at a fake)
 * @property {string} posthogKey  POSTHOG_KEY  -- PostHog project token for usage events (public by design; "" = off)
 * @property {string} posthogHost POSTHOG_HOST -- PostHog ingestion origin (default the US cloud)
 * @property {string} cronSecret  CRON_SECRET  -- Vercel cron's bearer for /api/flash-failures (secret; "" = the endpoint refuses)
 * @property {string} posthogApiHost     POSTHOG_API_HOST     -- PostHog app origin for queries (default https://us.posthog.com)
 * @property {string} posthogProjectId   POSTHOG_PROJECT_ID   -- the project whose events /api/flash-failures reads
 * @property {string} posthogPersonalKey POSTHOG_PERSONAL_KEY -- PostHog personal API key, query read (secret)
 */

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {ProxyConfig}
 */
export function loadConfig(env = process.env) {
  return {
    // Rotation lane (2026-09-05): the PAT on Vercel has NO expiry set (GET /user returns no
    // github-authentication-token-expiration header); to rotate: `vercel env rm GITHUB_TOKEN production`,
    // `vercel env add GITHUB_TOKEN production`, `vercel --prod`, and update the git-ignored proxy/.env.local.
    token: env.GITHUB_TOKEN || "",
    repo: env.GITHUB_REPO || "fcavalcantirj/droidputer",
    workflow: env.WORKFLOW || "build-app.yml",
    baseUrl: (env.BASE_URL || "").replace(/\/+$/, ""),
    apiBase: (env.GITHUB_API || "https://api.github.com").replace(/\/+$/, ""),
    posthogKey: env.POSTHOG_KEY || "",
    posthogHost: (env.POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/+$/, ""),
    cronSecret: env.CRON_SECRET || "",
    posthogApiHost: (env.POSTHOG_API_HOST || "https://us.posthog.com").replace(/\/+$/, ""),
    posthogProjectId: env.POSTHOG_PROJECT_ID || "",
    posthogPersonalKey: env.POSTHOG_PERSONAL_KEY || "",
  };
}
