"use client";

// What GA4's enhanced measurement cannot see on this dashboard: scroll depth per view, which panels people actually
// reach, the Google Play / GitHub calls to action (with where on the page they were clicked: data-track) and which
// charts get hovered. Page views, including every ?view= switch (history change), come from the tag itself.
import { useEffect } from "react";
import { track } from "@/lib/analytics";
import type { View } from "@/lib/telemetry";

const REPO_PREFIX = "https://github.com/fcavalcantirj/droidputer";
const titleOf = (el: Element | null | undefined) =>
  (el?.querySelector("h3, h2") as HTMLElement | null)?.innerText?.replace(/\s+/g, " ").trim().slice(0, 80) || "";

export function DashboardAnalytics({ view, ready }: { view: View; ready: boolean }) {
  useEffect(() => {
    const marks = [25, 50, 75, 100];
    const sent = new Set<number>();
    const onScroll = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const percent = height > 0 ? (100 * window.scrollY) / height : 100;
      for (const mark of marks)
        if (percent >= mark - 0.5 && !sent.has(mark)) {
          sent.add(mark);
          track("scroll_depth", { percent_scrolled: mark, view });
        }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [view]);

  useEffect(() => {
    if (!ready) return;
    // A panel counts as reached when any part of it enters the top 60 % of the viewport.
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          const section = titleOf(entry.target);
          if (section && !seen.has(section)) {
            seen.add(section);
            track("section_view", { section, view });
          }
        }),
      { rootMargin: "0px 0px -40% 0px", threshold: 0 },
    );
    const timer = window.setTimeout(
      () =>
        document
          .querySelectorAll(".hardware-hero, .telemetry-panel, .raw-intro, .about-view")
          .forEach((el) => observer.observe(el)),
      0,
    );
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [view, ready]);

  useEffect(() => {
    const hovered = new Set<string>();
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const placement = link.dataset.track || "link";
      if (link.href.includes("play.google.com/store/apps"))
        track("store_click", { store: "google_play", placement, link_url: link.href });
      else if (link.href.startsWith(REPO_PREFIX))
        track("repo_click", { placement, link_url: link.href });
    };
    const onOver = (event: PointerEvent) => {
      const chart = (event.target as Element | null)?.closest?.('[data-slot="chart"]');
      if (!chart) return;
      const name =
        titleOf(chart.closest(".telemetry-panel")) ||
        chart.closest(".metric-card")?.querySelector(".metric-heading span")?.textContent?.trim() ||
        "";
      if (!name || hovered.has(name)) return;
      hovered.add(name);
      track("chart_hover", { chart: name });
    };
    document.addEventListener("click", onClick);
    document.addEventListener("pointerover", onOver);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("pointerover", onOver);
    };
  }, []);

  return null;
}
