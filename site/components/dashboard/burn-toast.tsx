"use client";

// Every time the public burn total rises between two polls of /api/stats, someone just flashed firmware onto an
// ESP32-S3 from the app: celebrate it. Only aggregates are compared (total + burns per app), so the toast never
// needs or reveals who burned what. `?celebrate=1` shows a preview with the most-burned app.
import { useEffect, useRef, useState } from "react";
import { Flame, X } from "lucide-react";
import { track } from "@/lib/analytics";
import { formatNumber, type Stats } from "@/lib/telemetry";

type Celebration = { id: number; app?: string; added: number; total: number; preview?: boolean };

const SPARKS = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2 + (i % 2 ? 0.17 : 0);
  const reach = 46 + (i % 5) * 13;
  return {
    x: Math.round(Math.cos(angle) * reach),
    y: Math.round(Math.sin(angle) * reach * 0.62),
    delay: (i % 6) * 70,
    size: 3 + (i % 3) * 2,
  };
});

function appsDiff(before: Map<string, number>, after: { app: string; burns: number }[]) {
  let best: string | undefined;
  let bestGain = 0;
  for (const row of after) {
    const gain = row.burns - (before.get(row.app) ?? 0);
    if (gain > bestGain) {
      best = row.app;
      bestGain = gain;
    }
  }
  return best;
}

export function BurnToast({ data, celebrate }: { data?: Stats; celebrate?: boolean }) {
  const [queue, setQueue] = useState<Celebration[]>([]);
  const last = useRef<{ total: number; apps: Map<string, number> } | null>(null);
  const previewed = useRef(false);
  const total = data?.burns?.ok ? data.burns.total : undefined;

  useEffect(() => {
    if (total == null || !data?.burns) return;
    const apps = new Map((data.burns.by_app ?? []).map((row) => [row.app, row.burns]));
    const prev = last.current;
    last.current = { total, apps };
    if (prev && total > prev.total) {
      const app = appsDiff(prev.apps, data.burns.by_app ?? []);
      setQueue((q) => [...q, { id: Date.now(), app, added: total - prev.total, total }]);
      track("burn_celebrated", { added: total - prev.total, app: app ?? "unknown" });
    }
    if (!previewed.current && celebrate) {
      previewed.current = true;
      setQueue((q) => [...q, { id: Date.now() + 1, app: data.burns?.by_app?.[0]?.app, added: 1, total, preview: true }]);
    }
  }, [total, data, celebrate]);

  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    const timer = window.setTimeout(() => setQueue((q) => q.slice(1)), 8000);
    return () => window.clearTimeout(timer);
  }, [current]);

  if (!current) return null;
  return (
    <div className="burn-toast-region" role="status" aria-live="polite">
      <div className="burn-toast" key={current.id}>
        <div className="burn-sparks" aria-hidden="true">
          {SPARKS.map((spark, index) => (
            <i
              key={index}
              style={{
                "--x": `${spark.x}px`,
                "--y": `${spark.y}px`,
                "--d": `${spark.delay}ms`,
                "--s": `${spark.size}px`,
              } as React.CSSProperties}
            />
          ))}
        </div>
        <span className="burn-icon" aria-hidden="true">
          <Flame size={20} strokeWidth={2.2} />
        </span>
        <div className="burn-copy">
          <span className="burn-kicker">
            {current.preview ? "PREVIEW · " : ""}FIRMWARE BURNED{current.added > 1 ? ` ×${current.added}` : ""}
          </span>
          <strong>
            {current.app ? (
              <>
                <em>{current.app}</em> just landed on an ESP32-S3
              </>
            ) : (
              "A phone just flashed an ESP32-S3"
            )}
          </strong>
          <span className="burn-total">{formatNumber(current.total)} firmwares burned from phones, all time</span>
        </div>
        <button
          type="button"
          className="burn-close"
          aria-label="Dismiss"
          onClick={() => setQueue((q) => q.slice(1))}
        >
          <X size={14} />
        </button>
        <span className="burn-timer" aria-hidden="true" />
      </div>
    </div>
  );
}
