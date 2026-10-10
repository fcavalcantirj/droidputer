import { Dashboard } from "@/components/dashboard/dashboard";
import { getStats } from "@/lib/stats-server";
import type { Stats, View } from "@/lib/telemetry";

const views: View[] = [
  "overview",
  "phones",
  "apps",
  "builds",
  "play",
  "data",
  "about",
];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; celebrate?: string }>;
}) {
  const params = await searchParams;
  const view = views.includes(params.view as View)
    ? (params.view as View)
    : "overview";
  let data: Stats | undefined;
  try {
    // Built in-process (no HTTP round trip to ourselves), shared 60 s cache with /api/stats. Capped at 12 s so a slow
    // upstream never blocks the first paint; the client's SWR poll of /api/stats fills in.
    const body = (await Promise.race([
      getStats(),
      new Promise((resolve) => setTimeout(() => resolve(undefined), 12000)),
    ])) as Stats | undefined;
    if (body?.generated_at && body.github && body.posthog) data = body;
  } catch {
    // The client can retry independently if the upstream feed is slow during server rendering.
  }
  return <Dashboard initialData={data} view={view} celebrate={!!params.celebrate} />;
}
