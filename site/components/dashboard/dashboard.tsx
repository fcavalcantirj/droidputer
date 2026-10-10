"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpRight,
  CalendarDays,
  Download,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Sidebar,
  Topbar,
  InstallDialog,
} from "@/components/dashboard/navigation";
import { HardwareHero } from "@/components/dashboard/hero";
import { Metrics } from "@/components/dashboard/metrics";
import {
  BuildActivity,
  FlashOutcomes,
  HardwareBreakdown,
  PopularApps,
} from "@/components/dashboard/charts";
import {
  AboutView,
  AppsView,
  BuildsView,
  DataView,
  PhoneView,
  PlayView,
} from "@/components/dashboard/detail-views";
import { DashboardAnalytics } from "@/components/dashboard/analytics";
import { BurnToast } from "@/components/dashboard/burn-toast";
import { track } from "@/lib/analytics";
import {
  downloadData,
  fetchStats,
  PRIVACY_URL,
  REPO_URL,
  STATS_URL,
  type Period,
  type Stats,
  type View,
} from "@/lib/telemetry";
import { cn } from "@/lib/utils";

const headings: Record<View, { title: string; description: string }> = {
  overview: {
    title: "Project overview",
    description: "Real devices. Real activity. Everything out in the open.",
  },
  phones: {
    title: "Phone activity",
    description:
      "From the first connection to the last pixel. Here’s what real phones did.",
  },
  apps: {
    title: "The app ecosystem",
    description: "Made by the community. Rebuilt for a bigger screen.",
  },
  builds: {
    title: "Build pipeline",
    description: "Source code in. Firmware out. Every result, accounted for.",
  },
  play: {
    title: "Google Play health",
    description: "An honest look at crashes and freezes, straight from Google.",
  },
  data: {
    title: "Open data",
    description:
      "Inspect it, download it, build something with it. It’s yours to explore.",
  },
  about: {
    title: "Meet Droidputer",
    description:
      "A little more possibility from the hardware you already have.",
  },
};
const periods = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

export function Dashboard({
  initialData,
  view,
  celebrate,
}: {
  initialData?: Stats;
  view: View;
  celebrate?: boolean;
}) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<Stats>(
    STATS_URL,
    fetchStats,
    {
      fallbackData: initialData,
      refreshInterval: 30000,
      revalidateOnFocus: false,
      errorRetryCount: 2,
      dedupingInterval: 15000,
    },
  );
  const [period, setPeriod] = useState<Period>("30");
  const [installOpen, setInstallOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  useEffect(() => {
    if (installOpen) track("install_open", { view });
  }, [installOpen, view]);
  useEffect(() => {
    if (exportOpen) track("export_open", { view });
  }, [exportOpen, view]);
  const version = data?.github.releases?.[0]?.tag;
  const heading = headings[view];
  const partial =
    data &&
    (!data.posthog.ok ||
      !!data.posthog.errors ||
      !data.github.behaviour ||
      !data.play?.ok);
  const old = data
    ? Date.now() - new Date(data.generated_at).getTime() > 15 * 60000
    : false;
  const connected = !!data && !error && !old;
  const state =
    error || old
      ? "Last known data"
      : !data
        ? "Connecting"
        : partial
          ? "Partial feed"
          : "Live data";
  return (
    <div className="dashboard-shell">
      <DashboardAnalytics view={view} ready={!!data} />
      <BurnToast data={data} celebrate={celebrate} />
      <div className="gh-ribbon">
        <a href={REPO_URL} data-track="ribbon" target="_blank" rel="noreferrer">
          View on GitHub
        </a>
      </div>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Sidebar view={view} version={version} />
      <div className="dashboard-main">
        <Topbar
          view={view}
          version={version}
          connected={connected}
          onInstall={() => setInstallOpen(true)}
        />
        <main id="main-content" className="main-content">
          <div className="page-heading">
            <div>
              <div className="page-eyebrow">
                <span>DROIDPUTER TELEMETRY</span>
                <span className="eyebrow-divider">/</span>
                <span>PUBLIC DASHBOARD</span>
              </div>
              <h1>{heading.title}</h1>
              <p>{heading.description}</p>
            </div>
            <div className="page-status">
              <Badge variant="outline">
                <span
                  className={cn("status-dot", !connected && "status-muted")}
                />
                {state}
              </Badge>
              <span className="refresh-caption">Refreshes every 30s</span>
            </div>
          </div>
          {view === "overview" && (
            <HardwareHero onInstall={() => setInstallOpen(true)} burns={data?.burns?.ok ? data.burns.total : undefined} />
          )}
          {view !== "about" && (
            <div className="section-toolbar">
              <div className="section-toolbar-title">
                <span className="section-marker" />
                <h2>
                  {view === "overview"
                    ? "The project, by the numbers"
                    : "Behind the numbers"}
                </h2>
                <span className="section-toolbar-note">
                  {view === "overview" ? "All-time totals" : "Public telemetry"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Refresh telemetry"
                  onClick={() => {
                    track("refresh_click", { view });
                    void mutate();
                  }}
                  disabled={isValidating}
                >
                  <RefreshCw className={cn(isValidating && "animate-spin")} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExportOpen(true)}
                  disabled={!data}
                >
                  <Download data-icon="inline-start" />
                  Export data
                </Button>
              </div>
            </div>
          )}
          {(error || old || partial) && data && view !== "about" && (
            <p className="feed-notice" role="status">
              {error
                ? "The live feed is temporarily unavailable. Showing the last successful response; automatic retries are enabled."
                : old
                  ? "The source is returning an older snapshot. The timestamp below reflects its actual age."
                  : "Some upstream sources are temporarily unavailable. Available reports are shown without substituting sample data."}
            </p>
          )}
          {view === "about" ? (
            <AboutView onInstall={() => setInstallOpen(true)} />
          ) : !data ? (
            isLoading ? (
              <div
                className="loading-dashboard"
                aria-label="Loading public telemetry"
              >
                <div className="metrics-grid">
                  {[0, 1, 2, 3].map((index) => (
                    <Skeleton className="h-36" key={index} />
                  ))}
                </div>
                <div className="overview-grid">
                  <Skeleton className="h-80" />
                  <Skeleton className="h-80" />
                </div>
              </div>
            ) : (
              <Empty className="border py-16">
                <EmptyHeader>
                  <EmptyTitle>The signal is taking a moment.</EmptyTitle>
                  <EmptyDescription>
                    The public telemetry feed is temporarily unavailable. No
                    sample metrics are being shown.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={() => void mutate()}>
                    <RefreshCw data-icon="inline-start" />
                    Try again
                  </Button>
                </EmptyContent>
              </Empty>
            )
          ) : (
            <>
              {view === "overview" && <Metrics data={data} />}
              {["overview", "phones", "builds", "play"].includes(view) && (
                <div className="activity-toolbar">
                  <div className="flex items-center gap-2">
                    <h2>
                      {view === "overview"
                        ? "A closer look"
                        : "Activity & insights"}
                    </h2>
                    <span className="activity-label">
                      {view === "overview"
                        ? "How it’s being used, not just downloaded."
                        : "Explore the public record."}
                    </span>
                  </div>
                  <Select
                    value={period}
                    onValueChange={(value) => {
                      if (!value) return;
                      setPeriod(value as Period);
                      track("period_change", { period: value, view });
                    }}
                    items={periods}
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label="Time range for time-series charts"
                    >
                      <CalendarDays size={13} />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false} align="end">
                      <SelectGroup>
                        {periods.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {view === "overview" && (
                <div className="view-stack">
                  <div className="overview-grid">
                    <BuildActivity data={data} period={period} />
                    <FlashOutcomes data={data} />
                  </div>
                  <div className="overview-grid">
                    <PopularApps data={data} />
                    <HardwareBreakdown data={data} />
                  </div>
                  <div className="transparency-banner">
                    <span className="transparency-icon">
                      <ShieldCheck size={20} />
                    </span>
                    <div>
                      <strong>No vanity metrics. Just the real thing.</strong>
                      <p>
                        Every chart comes from public reports. Anonymous,
                        opt-in, and yours to inspect.
                      </p>
                    </div>
                    <Link href="/?view=data" scroll={false}>
                      Explore the raw data <ArrowUpRight size={15} />
                    </Link>
                  </div>
                </div>
              )}
              {view === "phones" && <PhoneView data={data} period={period} />}
              {view === "apps" && <AppsView data={data} />}
              {view === "builds" && <BuildsView data={data} period={period} />}
              {view === "play" && <PlayView data={data} period={period} />}
              {view === "data" && <DataView data={data} />}
            </>
          )}
          <footer className="dashboard-footer">
            <div>
              <span className="status-dot" />
              <span>
                {data
                  ? `Updated ${new Date(data.generated_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC · ${data.generated_at.slice(0, 10)}`
                  : "Waiting for the public feed"}
              </span>
              <span className="footer-divider">/</span>
              <span>Made for the curious.</span>
            </div>
            <a href={PRIVACY_URL}>
              Privacy & transparency <ArrowUpRight size={12} />
            </a>
          </footer>
        </main>
      </div>
      <InstallDialog
        open={installOpen}
        setOpen={setInstallOpen}
        version={version}
      />
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Take a closer look.</DialogTitle>
            <DialogDescription>
              Download the complete public dataset, not just the selected chart
              period. Aggregates only—no personal identifiers.
            </DialogDescription>
          </DialogHeader>
          <div className="export-options">
            <Button
              size="lg"
              onClick={() => {
                if (data) downloadData(data, "json");
                setExportOpen(false);
              }}
            >
              <ArrowDownToLine data-icon="inline-start" />
              Download JSON
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                if (data) downloadData(data, "csv");
                setExportOpen(false);
              }}
            >
              <ArrowDownToLine data-icon="inline-start" />
              Download CSV
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
