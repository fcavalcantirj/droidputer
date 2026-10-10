// Google Analytics 4 custom events (the tag itself loads in app/layout.tsx). A no-op on the server, before the tag
// loads, or when it is blocked.
type Gtag = (command: "event", name: string, params?: Record<string, unknown>) => void;

export function track(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  try {
    (window as unknown as { gtag?: Gtag }).gtag?.("event", name, params);
  } catch {
    // analytics must never break the page
  }
}
