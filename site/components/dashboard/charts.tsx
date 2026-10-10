"use client";

import { useId, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, Radio, Smartphone } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import {
  buildActivity,
  formatDay,
  formatNumber,
  type Period,
  type Stats,
} from "@/lib/telemetry";
import { cn } from "@/lib/utils";

export function NoData({
  message = "No reports are available for this period.",
}: {
  message?: string;
}) {
  return (
    <Empty className="min-h-44">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Radio />
        </EmptyMedia>
        <EmptyTitle>Waiting for a signal</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function Panel({
  title,
  description,
  children,
  action,
  footer,
  className,
}: {
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("telemetry-panel", className)}>
      <CardHeader>
        <CardTitle>
          <h3>{title}</h3>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}

export function TimeChart({
  data,
  dataKey,
  label,
  color = "var(--chart-1)",
  dateAxis = true,
  height = 200,
}: {
  data: Record<string, string | number | null>[];
  dataKey: string;
  label: string;
  color?: string;
  dateAxis?: boolean;
  height?: number;
}) {
  const id = useId().replaceAll(":", "");
  if (!data.length) return <NoData />;
  return (
    <ChartContainer
      config={{ [dataKey]: { label, color } }}
      className="w-full aspect-auto"
      style={{ height }}
    >
      <AreaChart
        accessibilityLayer
        data={data}
        margin={{ left: -22, right: 12, top: 12, bottom: 0 }}
      >
        <defs>
          <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0.015} />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          strokeDasharray="3 5"
          stroke="var(--border)"
        />
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          minTickGap={42}
          tickMargin={12}
          tickFormatter={dateAxis ? formatDay : undefined}
          fontSize={10}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          tickCount={4}
          fontSize={10}
        />
        <ChartTooltip
          content={<ChartTooltipContent indicator="line" />}
          labelFormatter={(value) =>
            dateAxis ? formatDay(String(value)) : value
          }
          cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
        />
        <Area
          dataKey={dataKey}
          type="monotone"
          fill={`url(#area-${id})`}
          stroke={`var(--color-${dataKey})`}
          strokeWidth={2}
          dot={false}
          activeDot={{
            r: 4,
            fill: color,
            stroke: "var(--card)",
            strokeWidth: 3,
          }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function BuildActivity({
  data,
  period,
}: {
  data: Stats;
  period: Period;
}) {
  const points = buildActivity(data, period);
  const total = points.reduce((sum, point) => sum + point.requests, 0);
  return (
    <Panel
      title="Build activity"
      description="From a GitHub repo to a tiny computer."
      action={
        <span className="chart-legend">
          <i />
          Build requests
        </span>
      }
      footer={
        <>
          <span className="source-caption">GITHUB ACTIONS + BUILD PROXY</span>
          <Link href="/?view=builds" scroll={false} className="panel-link">
            Explore builds <ArrowUpRight size={13} />
          </Link>
        </>
      }
    >
      <div className="chart-big-number">
        {formatNumber(total)}
        <span>requests in this period</span>
      </div>
      <TimeChart
        data={points}
        dataKey="requests"
        label="Build requests"
        height={190}
      />
    </Panel>
  );
}

export function FlashOutcomes({ data }: { data: Stats }) {
  const behaviour = data.github.behaviour;
  const values = behaviour
    ? [
        {
          name: "Mirrored successfully",
          value: behaviour.mirror_up,
          fill: "var(--color-mirrored)",
          key: "mirrored",
        },
        {
          name: "No HELLO received",
          value: behaviour.no_hello,
          fill: "var(--color-noHello)",
          key: "noHello",
        },
        {
          name: "Connected, no frames",
          value: behaviour.hello_no_frames,
          fill: "var(--color-noFrames)",
          key: "noFrames",
        },
      ]
    : [];
  const percent = behaviour?.flashes_observed
    ? Math.round((behaviour.mirror_up / behaviour.flashes_observed) * 100)
    : 0;
  const config = {
    mirrored: { label: "Mirrored successfully", color: "var(--chart-1)" },
    noHello: { label: "No HELLO received", color: "var(--chart-3)" },
    noFrames: { label: "Connected, no frames", color: "var(--chart-2)" },
  } satisfies ChartConfig;
  return (
    <Panel
      title="The first 20 seconds"
      description="What happens after a phone flashes an app."
      action={<Badge variant="outline">All time</Badge>}
      footer={
        <>
          <span className="source-caption">AUTOMATIC FLASH REPORTS</span>
          <span className="text-muted-foreground text-xs">
            {formatNumber(behaviour?.flashes_observed)} observed
          </span>
        </>
      }
    >
      {!behaviour || !behaviour.flashes_observed ? (
        <NoData />
      ) : (
        <>
          <ChartContainer
            config={config}
            className="mx-auto h-[180px] w-full aspect-auto"
          >
            <PieChart accessibilityLayer>
              <ChartTooltip
                content={<ChartTooltipContent nameKey="name" hideLabel />}
              />
              <Pie
                data={values}
                dataKey="value"
                nameKey="name"
                innerRadius={61}
                outerRadius={78}
                paddingAngle={4}
                stroke="none"
                cornerRadius={3}
                startAngle={90}
                endAngle={-270}
                isAnimationActive={false}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox)
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                          <tspan
                            x={viewBox.cx}
                            dy="2"
                            fill="var(--foreground)"
                            fontSize="33"
                            fontWeight="550"
                            letterSpacing="-1.5"
                          >
                            {percent}%
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            dy="23"
                            fill="var(--muted-foreground)"
                            fontSize="11"
                          >
                            mirror success
                          </tspan>
                        </text>
                      );
                    return null;
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="outcome-legend">
            {values.map((value) => (
              <div key={value.key}>
                <span>
                  <i
                    style={{
                      background:
                        config[value.key as keyof typeof config].color,
                    }}
                  />
                  {value.name}
                </span>
                <strong>{formatNumber(value.value)}</strong>
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

export function RankedBars({
  data,
  label = "Reports",
  color = "var(--chart-1)",
  limit = 10,
}: {
  data: { name: string; value: number }[];
  label?: string;
  color?: string;
  limit?: number;
}) {
  const points = data.slice(0, limit);
  if (!points.length) return <NoData />;
  return (
    <ChartContainer
      config={{ value: { label, color } }}
      className="w-full aspect-auto"
      style={{ height: Math.max(170, points.length * 38) }}
    >
      <BarChart
        data={points}
        layout="vertical"
        accessibilityLayer
        margin={{ left: 0, right: 18, top: 6, bottom: 6 }}
      >
        <XAxis type="number" hide />
        <YAxis
          dataKey="name"
          type="category"
          width={145}
          axisLine={false}
          tickLine={false}
          fontSize={11}
          tickFormatter={(value) =>
            String(value).length > 23 ? `${String(value).slice(0, 21)}…` : value
          }
        />
        <ChartTooltip
          content={<ChartTooltipContent />}
          cursor={{ fill: "var(--muted)", opacity: 0.3 }}
        />
        <Bar
          dataKey="value"
          fill="var(--color-value)"
          radius={[0, 3, 3, 0]}
          barSize={13}
          isAnimationActive={false}
          background={{ fill: "var(--muted)", radius: 3 }}
        />
      </BarChart>
    </ChartContainer>
  );
}

export function PopularApps({
  data,
  full = false,
}: {
  data: Stats;
  full?: boolean;
}) {
  const apps = data.github.behaviour?.most_flashed ?? [];
  const max = Math.max(...apps.map((app) => app.phones), 1);
  return (
    <Panel
      title="What people are running"
      description="The apps making their way onto real hardware."
      action={
        !full && (
          <Link href="/?view=apps" scroll={false} className="panel-link">
            All apps <ArrowUpRight size={13} />
          </Link>
        )
      }
      footer={
        <>
          <span className="source-caption">
            DISTINCT PHONES PER APP · ALL TIME
          </span>
          <Smartphone size={13} className="text-muted-foreground" />
        </>
      }
    >
      {!apps.length ? (
        <NoData />
      ) : (
        <div className="app-ranking">
          <div className="app-table-head">
            <span>APPLICATION</span>
            <span>PHONES</span>
          </div>
          {apps.slice(0, full ? 10 : 5).map((app, index) => (
            <div className="app-row" key={app.app}>
              <span className="app-rank">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="app-avatar">
                <span>{app.app.slice(0, 2).toUpperCase()}</span>
              </span>
              <span className="app-name">{app.app}</span>
              <span className="app-bar-track">
                <span style={{ width: `${(app.phones / max) * 100}%` }} />
              </span>
              <strong>{app.phones}</strong>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function HardwareBreakdown({ data }: { data: Stats }) {
  const runs = data.history?.runs ?? [];
  const boards = [
    {
      name: "Bare ESP32-S3",
      subtitle: "Your phone is the entire interface",
      key: "m5cardputer-virtual",
    },
    {
      name: "Cardputer ADV",
      subtitle: "Onboard screen, mirrored to your phone",
      key: "m5cardputer",
    },
  ].map((board) => ({
    ...board,
    value: runs.filter((run) => run.env === board.key).length,
  }));
  const total = boards.reduce((sum, board) => sum + board.value, 0);
  return (
    <Panel
      title="Hardware in the wild"
      description="Small boards. Real-world builds."
      action={<Badge variant="outline">Historical</Badge>}
      footer={
        <>
          <span className="source-caption">BUILD TARGETS · SEP 4 – OCT 8</span>
          <span className="text-muted-foreground text-xs">{total} builds</span>
        </>
      }
    >
      {!total ? (
        <NoData />
      ) : (
        <div className="hardware-breakdown">
          <div className="hardware-total">
            {formatNumber(total)}
            <span>build requests across 2 targets</span>
          </div>
          <div className="hardware-segmented" aria-hidden="true">
            {boards.map((board, index) => (
              <span
                key={board.key}
                style={{
                  width: `${(board.value / total) * 100}%`,
                  background: index === 0 ? "var(--chart-1)" : "var(--chart-2)",
                }}
              />
            ))}
          </div>
          {boards.map((board, index) => (
            <div className="hardware-row" key={board.key}>
              <span
                className={cn("board-icon", index === 1 && "secondary-board")}
              >
                <CpuIcon />
              </span>
              <div>
                <strong>{board.name}</strong>
                <p>{board.subtitle}</p>
              </div>
              <div className="hardware-percent">
                <strong>{Math.round((board.value / total) * 100)}%</strong>
                <span>{board.value} builds</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function CpuIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3" />
    </svg>
  );
}
