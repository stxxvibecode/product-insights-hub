/**
 * Client-side performance logger.
 *
 * Logs route transition durations and any fetch() calls that take longer
 * than a threshold (most importantly the /_serverFn RPC calls).
 *
 * Open the browser console and filter for "[perf:" to see results.
 */
import type { Router } from "@tanstack/react-router";

const SLOW_FETCH_MS = 400;
const SLOW_ROUTE_MS = 600;

let installed = false;

export function installClientPerfLogger(router: Router<any, any>) {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // 1. Monkey-patch fetch to time RPC + API calls.
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const start = performance.now();
    try {
      const res = await originalFetch(input as RequestInfo, init);
      const ms = Math.round(performance.now() - start);
      const isInteresting =
        url.includes("/_serverFn") || url.includes("/api/") || ms >= SLOW_FETCH_MS;
      if (isInteresting) {
        const tag = ms >= 1000 ? "SLOW" : ms >= SLOW_FETCH_MS ? "warn" : "ok";
        const short = shorten(url);
        // eslint-disable-next-line no-console
        console.log(`[perf:fetch] ${tag} ${ms}ms ${res.status} ${short}`);
      }
      return res;
    } catch (err) {
      const ms = Math.round(performance.now() - start);
      // eslint-disable-next-line no-console
      console.log(`[perf:fetch] ERR ${ms}ms ${shorten(url)}`);
      throw err;
    }
  };

  // 2. Time route transitions via router subscriptions.
  let pendingFrom: string | null = null;
  let pendingStart = 0;

  router.subscribe("onBeforeNavigate", (event) => {
    pendingFrom = event.fromLocation?.pathname ?? null;
    pendingStart = performance.now();
  });

  router.subscribe("onResolved", (event) => {
    if (!pendingStart) return;
    const ms = Math.round(performance.now() - pendingStart);
    const to = event.toLocation?.pathname ?? "?";
    const tag = ms >= 1500 ? "SLOW" : ms >= SLOW_ROUTE_MS ? "warn" : "ok";
    // eslint-disable-next-line no-console
    console.log(`[perf:route] ${tag} ${ms}ms ${pendingFrom ?? "·"} → ${to}`);
    pendingStart = 0;
    pendingFrom = null;
  });

  // 3. Log initial paint timings once the page settles.
  if ("PerformanceObserver" in window) {
    try {
      const nav = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (nav) {
        window.setTimeout(() => {
          // eslint-disable-next-line no-console
          console.log(
            `[perf:nav] ttfb=${Math.round(nav.responseStart)}ms domContentLoaded=${Math.round(
              nav.domContentLoadedEventEnd,
            )}ms load=${Math.round(nav.loadEventEnd)}ms`,
          );
        }, 0);
      }
    } catch {
      // ignore
    }
  }
}

function shorten(url: string) {
  try {
    const u = new URL(url, window.location.origin);
    return `${u.pathname}${u.search.length > 60 ? u.search.slice(0, 60) + "…" : u.search}`;
  } catch {
    return url.length > 80 ? url.slice(0, 80) + "…" : url;
  }
}