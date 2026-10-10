// GET /api/stats -> the public stats document (lib/stats-server.js). Same contract as the old api/stats.js: JSON,
// edge-cached 30 s (stale for 5 min while it refreshes) so new burns surface fast, readable cross-origin.
import { getStats } from "@/lib/stats-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const body = await getStats();
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
