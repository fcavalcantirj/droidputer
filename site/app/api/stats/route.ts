// GET /api/stats -> the public stats document (lib/stats-server.js). Same contract as the old api/stats.js: JSON,
// edge-cached 120 s (stale for 10 min while it refreshes), readable cross-origin.
import { getStats } from "@/lib/stats-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const body = await getStats();
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
