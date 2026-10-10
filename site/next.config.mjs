import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // This app lives in site/ of the droidputter repo; never infer the workspace root from a parent lockfile.
  turbopack: { root: dirname(fileURLToPath(import.meta.url)) },
  images: {
    unoptimized: true,
  },
  // /privacy is the URL on the Google Play listing: keep it, served from the static public/privacy.html.
  async rewrites() {
    return [{ source: "/privacy", destination: "/privacy.html" }];
  },
  async headers() {
    return [
      { source: "/data/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=300" }] },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
