"use client";

import {
  ArrowDownToLine,
  CheckCheck,
  GitBranch,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { Area, AreaChart } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { buildActivity, formatNumber, type Stats } from "@/lib/telemetry";

function Metric({
  title,
  value,
  note,
  source,
  icon: Icon,
  points,
  progress,
}: {
  title: string;
  value: string;
  note: string;
  source: string;
  icon: LucideIcon;
  points?: number[];
  progress?: number;
}) {
  return (
    <article className="metric-card">
      <div className="metric-heading">
        <span>{title}</span>
        <Icon size={16} strokeWidth={1.5} />
      </div>
      <div className="metric-middle">
        <strong>{value}</strong>
        {points && points.length > 1 ? (
          <ChartContainer
            config={{ value: { color: "var(--chart-1)" } }}
            className="metric-sparkline"
          >
            <AreaChart
              data={points.map((value) => ({ value }))}
              accessibilityLayer
            >
              <Area
                dataKey="value"
                type="monotone"
                stroke="var(--color-value)"
                strokeWidth={1.5}
                fill="var(--color-value)"
                fillOpacity={0.06}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          progress !== undefined && (
            <div className="metric-progress" aria-hidden="true">
              {Array.from({ length: 18 }, (_, index) => (
                <i
                  key={index}
                  className={index / 18 < progress ? "filled" : ""}
                />
              ))}
            </div>
          )
        )}
      </div>
      <div className="metric-bottom">
        <span>{note}</span>
        <span>{source}</span>
      </div>
    </article>
  );
}

export function Metrics({ data }: { data: Stats }) {
  const behaviour = data.github.behaviour;
  const verdicts = data.github.verdicts;
  const downloads = data.github.releases?.reduce(
    (sum, release) => sum + release.apk_downloads,
    0,
  );
  const builds = data.history
    ? data.history.runs.length +
      Number(data.posthog.totals?.[0]?.build_requests ?? 0)
    : undefined;
  const percent = behaviour?.flashes_observed
    ? Math.round((behaviour.mirror_up / behaviour.flashes_observed) * 100)
    : 0;
  return (
    <div className="metrics-grid">
      <Metric
        title="Phones reporting"
        value={formatNumber(verdicts?.reporters)}
        note={
          behaviour
            ? `${behaviour.phones_that_flashed} flashed from the app`
            : "Public community verdicts"
        }
        source="ALL TIME"
        icon={Smartphone}
        points={verdicts?.timeline.map((day) => day.phones_cumulative)}
      />
      <Metric
        title="Builds requested"
        value={formatNumber(builds)}
        note="From source to firmware"
        source="SINCE SEP 4"
        icon={GitBranch}
        points={buildActivity(data, "all").map((day) => day.requests)}
      />
      <Metric
        title="Successful mirrors"
        value={formatNumber(behaviour?.mirror_up)}
        note={
          behaviour
            ? `${percent}% of ${behaviour.flashes_observed} observed flashes`
            : "Automatic post-flash reports"
        }
        source="ALL TIME"
        icon={CheckCheck}
        progress={percent / 100}
      />
      <Metric
        title="APK downloads"
        value={formatNumber(downloads)}
        note="Direct from GitHub Releases"
        source="ALL RELEASES"
        icon={ArrowDownToLine}
        points={
          data.github.releases
            ? [...data.github.releases]
                .reverse()
                .map((release) => release.apk_downloads)
            : undefined
        }
      />
    </div>
  );
}
