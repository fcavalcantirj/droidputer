import { Dashboard } from "@/components/dashboard/dashboard";
import { peekStats } from "@/lib/stats-server";
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
  // Only a fresh build this instance already holds (shared 60 s cache with /api/stats): the page never waits on the
  // upstreams, so the first paint is immediate; otherwise the skeletons show and the client's SWR poll of /api/stats
  // (edge-cached) fills in.
  const body = peekStats() as Stats | undefined;
  const data = body?.generated_at && body.github && body.posthog ? body : undefined;
  return <Dashboard initialData={data} view={view} celebrate={!!params.celebrate} />;
}
