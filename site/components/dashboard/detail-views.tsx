"use client";

import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  Copy,
  Cpu,
  CodeXml,
  Keyboard,
  Monitor,
  ShieldCheck,
  Smartphone,
  Usb,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BuildActivity,
  FlashOutcomes,
  HardwareBreakdown,
  NoData,
  Panel,
  PopularApps,
  RankedBars,
  TimeChart,
} from "@/components/dashboard/charts";
import {
  downloadData,
  formatDay,
  formatNumber,
  inPeriod,
  PRIVACY_URL,
  REPO_URL,
  requestedApps,
  type Period,
  type Stats,
} from "@/lib/telemetry";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export function StatStrip({
  items,
}: {
  items: {
    label: string;
    value: number | string | null | undefined;
    note: string;
  }[];
}) {
  return (
    <div className="stat-strip">
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>
            {typeof item.value === "string"
              ? item.value
              : formatNumber(item.value)}
          </strong>
          <small>{item.note}</small>
        </div>
      ))}
    </div>
  );
}

export function PhoneView({ data, period }: { data: Stats; period: Period }) {
  const totals = data.posthog.totals?.[0];
  const funnelNames = [
    ["Application Opened", "Opened the app"],
    ["catalog_open", "Explored the catalog"],
    ["build_requested", "Requested a build"],
    ["usb_attached", "Connected USB"],
    ["flash_finished", "Finished a flash"],
    ["link_up", "Linked the ESP"],
    ["verdict_sent", "Sent a verdict"],
  ];
  const daily = (data.posthog.daily ?? []).filter((day) =>
    inPeriod(day.day, period, data.generated_at),
  );
  return (
    <div className="view-stack">
      <div className="data-context">
        <ShieldCheck size={15} />
        <p>
          Anonymous, opt-in reports from real phones. Emulator sessions are
          excluded. Live analytics started with v0.0.7.
        </p>
      </div>
      <StatStrip
        items={[
          {
            label: "Phones today",
            value: totals?.devices_24h,
            note: "Last 24 hours · opted in",
          },
          {
            label: "Phones this week",
            value: totals?.devices_7d,
            note: "Last 7 days · opted in",
          },
          {
            label: "Minutes mirrored",
            value: totals ? (totals.mirror_minutes ?? 0) : undefined,
            note: "Since live analytics began",
          },
          {
            label: "Firmware flashes",
            value: totals?.flashes,
            note: "Successfully verified flashes",
          },
        ]}
      />
      <div className="two-column-grid">
        <Panel
          title="From first open to first verdict"
          description="Distinct phones at each step · last 30 days"
        >
          <RankedBars
            data={
              data.posthog.funnel
                ? funnelNames.map(([event, name]) => ({
                    name,
                    value: Number(
                      data.posthog.funnel?.find((row) => row.event === event)
                        ?.devices ?? 0,
                    ),
                  }))
                : []
            }
            label="Phones"
          />
        </Panel>
        <Panel
          title="Active phones"
          description="Daily active phones in the selected period."
        >
          <TimeChart
            data={daily}
            dataKey="devices"
            label="Active phones"
            height={265}
          />
        </Panel>
        <FlashOutcomes data={data} />
        <Panel
          title="Mirror activity after a flash"
          description="Frames streamed in the first 20 seconds · sorted, all time"
        >
          <TimeChart
            data={(data.github.behaviour?.frames_in_20s ?? []).map(
              (frames, index) => ({ day: `#${index + 1}`, frames }),
            )}
            dataKey="frames"
            label="Frames"
            dateAxis={false}
            height={270}
          />
        </Panel>
        <Panel
          title="Apps each phone tried"
          description="Distinct apps with a public verdict · all time"
        >
          <RankedBars
            data={Object.entries(
              data.github.behaviour?.apps_per_phone ?? {},
            ).map(([name, value]) => ({
              name: `${name} ${name === "1" ? "app" : "apps"}`,
              value,
            }))}
            label="Phones"
          />
        </Panel>
        <Panel
          title="What they run, live"
          description="Apps flashed or mirrored · opted-in phones, last 30 days"
        >
          <RankedBars
            data={(data.posthog.apps ?? []).map((app) => ({
              name: app.app,
              value: app.devices,
            }))}
            label="Phones"
          />
        </Panel>
        <Panel
          title="Community participation"
          description="Cumulative phones submitting a verdict · selected period"
        >
          <TimeChart
            data={(data.github.verdicts?.timeline ?? []).filter((day) =>
              inPeriod(day.day, period, data.generated_at),
            )}
            dataKey="phones_cumulative"
            label="Phones"
          />
        </Panel>
        <Panel
          title="App and firmware health"
          description="App exceptions and ESP panics · last 30 days"
        >
          {data.posthog.health?.length ? (
            <RankedBars
              data={data.posthog.health.map((item) => ({
                name: `${item.event === "$exception" ? "App crash" : "ESP panic"}${item.app ? ` · ${item.app}` : ""}`,
                value: item.n,
              }))}
              color="var(--destructive)"
            />
          ) : (
            <NoData
              message={
                data.posthog.health
                  ? "No app exceptions or ESP panics have been reported in the last 30 days."
                  : "App health reports are temporarily unavailable."
              }
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

export function AppsView({ data }: { data: Stats }) {
  const apps = requestedApps(data);
  const verdicts = data.github.verdicts;
  return (
    <div className="view-stack">
      <StatStrip
        items={[
          {
            label: "Requested repositories",
            value: apps.filter((app) => app.name !== "Unknown repository")
              .length,
            note: "From build history and live requests",
          },
          {
            label: "Community verdicts",
            value: verdicts?.total,
            note: "Public works / broken reports",
          },
          {
            label: "Participating phones",
            value: verdicts?.reporters,
            note: "Anonymous per-install identifiers",
          },
          {
            label: "Apps with verdicts",
            value: verdicts?.by_app.length,
            note: "A real-world compatibility record",
          },
        ]}
      />
      <Tabs defaultValue="phones">
        <TabsList variant="line" className="max-w-full overflow-x-auto [scrollbar-width:none]">
          <TabsTrigger value="phones">Popular on phones</TabsTrigger>
          <TabsTrigger value="requests">Build requests</TabsTrigger>
          <TabsTrigger value="verdicts">Community verdicts</TabsTrigger>
        </TabsList>
        <TabsContent value="phones" className="pt-5">
          <div className="two-column-grid">
            <PopularApps data={data} full />
            <HardwareBreakdown data={data} />
          </div>
        </TabsContent>
        <TabsContent value="requests" className="pt-5">
          <Panel
            title="What people asked to build"
            description="Historical builds plus live proxy requests, since September 4."
          >
            <div className="data-table-wrap">
              <table className="data-table">
                <caption className="sr-only">
                  Requested application repositories
                </caption>
                <thead>
                  <tr>
                    <th>Repository</th>
                    <th>Requests</th>
                    <th>Historical successful builds</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((app) => (
                    <tr key={app.name}>
                      <td>
                        {app.name.includes("/") ? (
                          <a
                            href={`https://github.com/${app.name.split("/").map(encodeURIComponent).join("/")}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {app.name}
                            <ArrowUpRight size={12} />
                          </a>
                        ) : (
                          app.name
                        )}
                      </td>
                      <td>{app.requests}</td>
                      <td>{app.built}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="verdicts" className="pt-5">
          <Panel
            title="Does it work on real hardware?"
            description="One public verdict per phone per firmware. The developer’s test phones are included."
          >
            <div className="data-table-wrap">
              <table className="data-table">
                <caption className="sr-only">
                  Community application compatibility reports
                </caption>
                <thead>
                  <tr>
                    <th>Application</th>
                    <th>Works</th>
                    <th>Broken</th>
                    <th>Reported success</th>
                  </tr>
                </thead>
                <tbody>
                  {(verdicts?.by_app ?? []).map((app) => (
                    <tr key={app.app}>
                      <td>{app.app}</td>
                      <td className="text-primary">{app.works}</td>
                      <td>{app.broken}</td>
                      <td>
                        <span className="verdict-track">
                          <span
                            style={{
                              width: `${(app.works / (app.works + app.broken)) * 100}%`,
                            }}
                          />
                        </span>
                        <span className="font-mono text-xs">
                          {Math.round(
                            (app.works / (app.works + app.broken)) * 100,
                          )}
                          %
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function BuildsView({ data, period }: { data: Stats; period: Period }) {
  const runs = data.history?.runs ?? [];
  const historical = new Map<string, number>();
  runs.forEach((run) =>
    historical.set(run.class, (historical.get(run.class) ?? 0) + 1),
  );
  const replay = new Map<string, number>();
  data.replay?.pairs.forEach((pair) =>
    replay.set(pair.outcome, (replay.get(pair.outcome) ?? 0) + 1),
  );
  return (
    <div className="view-stack">
      <div className="data-context">
        <GitBranchIcon />
        <p>
          Every app is rebuilt against the Droidputer display and keyboard shim.
          Build failures are public, too.
        </p>
      </div>
      <BuildActivity data={data} period={period} />
      <div className="two-column-grid">
        <Panel
          title="Before the fix"
          description={`${runs.length} builds · September 4 – October 8, 2026`}
        >
          <RankedBars
            data={[...historical]
              .map(([name, value]) => ({
                name: name.replaceAll("-", " "),
                value,
              }))
              .sort((a, b) => b.value - a.value)}
            label="Builds"
          />
        </Panel>
        <Panel
          title="Same repos. Better answers."
          description={
            data.replay
              ? `Replayed on ${formatDay(data.replay.date)} · ${data.replay.pairs.length} repo + target pairs`
              : "Build replay results"
          }
        >
          <RankedBars
            data={[...replay].map(([name, value]) => ({ name, value }))}
            label="Repo + target pairs"
          />
          <p className="panel-explanation">
            A clear answer means the app explains why a repository is
            incompatible, rather than reporting a generic failure.
          </p>
        </Panel>
        <Panel
          title="Since the fix"
          description="Live build outcomes · distinct runs, since October 9"
        >
          <RankedBars
            data={(data.posthog.builds ?? [])
              .filter((row) => row.kind === "result")
              .map((row) => ({
                name: row.k.startsWith("ready")
                  ? "Built successfully"
                  : (row.k.split("|")[1] || "Failed").replaceAll("-", " "),
                value: Number(row.n),
              }))}
            label="Builds"
          />
        </Panel>
        <Panel
          title="Most requested repositories"
          description="Live proxy requests since analytics began"
        >
          <RankedBars
            data={(data.posthog.builds ?? [])
              .filter((row) => row.kind === "repo")
              .map((row) => ({ name: row.k, value: Number(row.n) }))}
            label="Requests"
          />
        </Panel>
      </div>
      <Panel
        title="Historical build log"
        description="Latest 20 historical runs in the selected period. Download the complete log from Raw data."
      >
        <div className="data-table-wrap">
          <table className="data-table">
            <caption className="sr-only">Historical build log</caption>
            <thead>
              <tr>
                <th>Repository</th>
                <th>Target</th>
                <th>Date</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {runs
                .filter((run) => inPeriod(run.date, period, data.generated_at))
                .slice(-20)
                .reverse()
                .map((run, index) => (
                  <tr key={`${run.repo}-${index}`}>
                    <td>{run.repo || "Unknown repository"}</td>
                    <td>
                      {run.env === "m5cardputer-virtual"
                        ? "Bare ESP32-S3"
                        : run.env}
                    </td>
                    <td>{formatDay(run.date)}</td>
                    <td>
                      <Badge
                        variant={
                          run.result === "built" ? "secondary" : "outline"
                        }
                      >
                        {run.result === "built"
                          ? "Built"
                          : run.class.replaceAll("-", " ")}
                      </Badge>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function GitBranchIcon() {
  return <Cpu size={15} />;
}

export function PlayView({ data, period }: { data: Stats; period: Period }) {
  const play = data.play;
  const days = (play?.errors?.daily ?? []).filter((day) =>
    inPeriod(day.day, period, data.generated_at),
  );
  const crashes = play?.errors
    ? days.reduce((sum, day) => sum + day.crash_reports, 0)
    : undefined;
  const freezes = play?.errors
    ? days.reduce((sum, day) => sum + day.anr_reports, 0)
    : undefined;
  return (
    <div className="view-stack">
      <div className="data-context">
        <ShieldCheck size={15} />
        <p>
          Reported directly by Google Play, across all app versions. Days use
          Pacific time; closed days are published with a delay.
        </p>
      </div>
      <StatStrip
        items={[
          {
            label: "Crash reports",
            value: crashes,
            note: "Selected period · Google Play",
          },
          {
            label: "Freeze reports",
            value: freezes,
            note: "Application not responding (ANR)",
          },
          {
            label: "Grouped issues",
            value: play?.issues?.length,
            note: "Latest available issue groups",
          },
          {
            label: "Latest reporting day",
            value: play?.errors?.freshest
              ? formatDay(play.errors.freshest)
              : undefined,
            note: "America/Los_Angeles",
          },
        ]}
      />
      {!play?.ok && (
        <NoData message="Google Play reporting is temporarily unavailable. Other public telemetry is still accessible." />
      )}
      <div className="two-column-grid">
        <Panel
          title="Crashes over time"
          description="Crash reports Google received each day · selected period"
        >
          <TimeChart
            data={days}
            dataKey="crash_reports"
            label="Crash reports"
            color="var(--chart-3)"
          />
        </Panel>
        <Panel
          title="Freezes over time"
          description="ANR reports Google received each day · selected period"
        >
          <TimeChart
            data={days}
            dataKey="anr_reports"
            label="ANR reports"
            color="var(--chart-2)"
          />
        </Panel>
      </div>
      <Panel
        title="What crashed"
        description="Google’s issue groups, with affected users and the last reported version."
      >
        {play?.issues?.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <caption className="sr-only">Google Play crash causes</caption>
              <thead>
                <tr>
                  <th>Exception / cause</th>
                  <th>Reports</th>
                  <th>Users</th>
                  <th>Version</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {play.issues.map((issue, index) => (
                  <tr key={index}>
                    <td>
                      <strong>{issue.exception}</strong>
                      <small className="issue-cause">{issue.cause}</small>
                    </td>
                    <td>{issue.reports}</td>
                    <td>{issue.users}</td>
                    <td>{issue.last_version}</td>
                    <td>{formatDay(issue.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <NoData message="No crash issue groups are currently available from Google Play." />
        )}
      </Panel>
      {play?.daily?.length ? (
        <div className="two-column-grid">
          <Panel
            title="Daily Play users"
            description="Users in the selected period · Google Play"
          >
            <TimeChart
              data={play.daily
                .filter((day) => inPeriod(day.day, period, data.generated_at))
                .map((day) => ({ day: day.day, users: day.users ?? null }))}
              dataKey="users"
              label="Users"
            />
          </Panel>
          <Panel
            title="Crash rate"
            description="Percentage of daily users experiencing a crash"
          >
            <TimeChart
              data={play.daily
                .filter((day) => inPeriod(day.day, period, data.generated_at))
                .map((day) => ({
                  day: day.day,
                  rate: day.crash_rate == null ? null : day.crash_rate * 100,
                }))}
              dataKey="rate"
              label="Crash rate (%)"
              color="var(--chart-3)"
            />
          </Panel>
        </div>
      ) : (
        <p className="quiet-note">
          Google has not yet published daily user counts or crash-rate metrics
          for this app. Missing data is never displayed as zero.
        </p>
      )}
    </div>
  );
}

export function DataView({ data }: { data: Stats }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      track("copy_json");
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  }
  return (
    <div className="view-stack">
      <div className="raw-intro">
        <div className="raw-icon">
          <BracesIcon />
        </div>
        <h2>Nothing behind the curtain.</h2>
        <p>
          Every number on this dashboard, in one public dataset.
          <br />
          Aggregates only. No device IDs, IP addresses, or individual events.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={() => downloadData(data, "json")}>
            <ArrowDownToLine data-icon="inline-start" />
            Download JSON
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => downloadData(data, "csv")}
          >
            <ArrowDownToLine data-icon="inline-start" />
            Download CSV
          </Button>
        </div>
      </div>
      <div className="two-column-grid">
        <Panel
          title="APK downloads by release"
          description="GitHub Releases · live counts"
        >
          <RankedBars
            data={(data.github.releases ?? []).map((release) => ({
              name: release.tag,
              value: release.apk_downloads,
            }))}
            label="APK downloads"
          />
        </Panel>
        <Panel
          title="Where visitors come from"
          description={
            data.traffic
              ? `GitHub’s 14-day traffic snapshot · taken ${formatDay(data.traffic.taken)}`
              : "GitHub repository traffic"
          }
        >
          <RankedBars
            data={(data.traffic?.referrers ?? []).map((source) => ({
              name: source.referrer,
              value: source.uniques,
            }))}
            label="Unique visitors"
          />
        </Panel>
      </div>
      <Panel
        title="The complete response"
        description={`Generated ${new Date(data.generated_at).toUTCString()}`}
        action={
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? (
              <Check data-icon="inline-start" />
            ) : (
              <Copy data-icon="inline-start" />
            )}
            {copied ? "Copied" : "Copy JSON"}
          </Button>
        }
      >
        <pre
          className="json-preview"
          tabIndex={0}
          aria-label="Public telemetry JSON"
        >
          {JSON.stringify(data, null, 2)}
        </pre>
        {copyError && (
          <p className="quiet-note" role="status">
            Clipboard access is unavailable. Use Download JSON instead.
          </p>
        )}
      </Panel>
    </div>
  );
}

function BracesIcon() {
  return (
    <span className="font-mono" aria-hidden="true">
      {"{ }"}
    </span>
  );
}

export function AboutView({ onInstall }: { onInstall: () => void }) {
  return (
    <div className="about-view">
      <Badge variant="outline">OPEN HARDWARE. OPEN POSSIBILITIES.</Badge>
      <h2>
        A tiny board.
        <br />
        <span>Your whole world.</span>
      </h2>
      <p className="about-lede">
        The Cardputer is a lovely little computer. But most people already carry
        a better screen, keyboard, and GPS in their pocket. Droidputer connects
        the two.
      </p>
      <div className="about-features">
        {[
          {
            icon: Cpu,
            title: "The ESP runs the app",
            text: "Open-source Cardputer apps are rebuilt against a small display and keyboard shim. The code runs on the board, not on your phone.",
          },
          {
            icon: Smartphone,
            title: "Your phone is the interface",
            text: "Pixels travel over USB. Your phone draws them, forwards keystrokes, and supplies GPS. No emulation, and no cloud compute to run the app.",
          },
          {
            icon: Usb,
            title: "One cable. That’s it.",
            text: "Build, flash, and launch apps directly from Android. Start with a bare ESP32-S3 board and a data-capable USB-OTG cable.",
          },
        ].map((item) => (
          <article key={item.title}>
            <item.icon size={24} />
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
      <Button size="lg" onClick={onInstall}>
        Get started with Droidputer <ArrowUpRight data-icon="inline-end" />
      </Button>
      <section className="about-privacy">
        <ShieldCheck size={23} />
        <div>
          <h3>Public numbers. Private people.</h3>
          <p>
            Analytics are opt-in. Only phones whose owners choose “Send” share
            anonymous events. Location, accounts, keystrokes, and screen
            contents are never collected. This dashboard publishes aggregates,
            not individual records. Developer test phones are included in public
            verdicts.
          </p>
          <a href={PRIVACY_URL}>
            Read the privacy policy <ArrowUpRight size={13} />
          </a>
        </div>
      </section>
      <a
        href={REPO_URL}
        data-track="about"
        className={buttonVariants({ variant: "outline", size: "lg" })}
        target="_blank"
        rel="noreferrer"
      >
        <CodeXml data-icon="inline-start" />
        Explore the source code <ArrowUpRight data-icon="inline-end" />
      </a>
    </div>
  );
}
