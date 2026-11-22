"use client";

import { useEffect, useRef } from "react";

/**
 * Runs `fn` now and then every `ms`, but only while the page is on screen.
 * A hidden tab or a phone app in the background costs no requests; when it
 * comes back, `fn` runs once if the last run is older than `ms`.
 * Keeps the platform inside Vercel Hobby limits.
 */
export function useVisibleInterval(fn: () => unknown, ms: number, enabled = true) {
  const saved = useRef(fn);
  saved.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let last = Date.now();
    void saved.current();
    const run = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < ms - 1000) return;
      last = Date.now();
      void saved.current();
    };
    const id = window.setInterval(run, ms);
    document.addEventListener("visibilitychange", run);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", run);
    };
  }, [ms, enabled]);
}
