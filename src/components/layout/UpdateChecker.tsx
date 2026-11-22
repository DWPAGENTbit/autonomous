"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

const BUILD = process.env.NEXT_PUBLIC_BUILD ?? "dev";
/** At most one check per 5 minutes, and only when the app comes back on screen. */
const MIN_GAP_MS = 5 * 60_000;
const RELOADED_KEY = "dwp.reloadedFor";

async function latestBuild(): Promise<string | null> {
  try {
    const r = await fetch("/api/version", { cache: "no-store" });
    if (!r.ok) return null;
    return ((await r.json()) as { build?: string }).build ?? null;
  } catch {
    return null;
  }
}

/**
 * A home-screen app on a phone can stay open for days and keep showing an old
 * version. When the app comes back to the screen and a newer version is out,
 * it reloads itself once; if that did not help, it offers a reload instead.
 * The check is a tiny static file, made at most once per 5 minutes.
 */
export function UpdateChecker() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (BUILD === "dev") return;
    let last = 0;
    const check = async () => {
      if (Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      const build = await latestBuild();
      if (!build || build === "dev" || build === BUILD) return;
      // Reload by itself at most once per new version, so a mismatch can never loop.
      let tried = true;
      try {
        tried = sessionStorage.getItem(RELOADED_KEY) === build;
        if (!tried) sessionStorage.setItem(RELOADED_KEY, build);
      } catch {
        // Storage blocked: offer the reload instead of doing it.
      }
      if (!tried) window.location.reload();
      else setStale(true);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onShow);
    };
  }, []);

  if (!stale) return null;
  return (
    <div role="status" className="glass fixed inset-x-3 bottom-24 z-50 flex items-center gap-3 p-3 pl-4 text-sm text-ink sm:left-auto sm:right-6 sm:max-w-sm lg:bottom-6">
      <span className="flex-1">Versi baru DWP EARN MONEY sudah tersedia.</span>
      <button type="button" onClick={() => window.location.reload()} className="pill shrink-0 !px-3 !py-1.5 text-xs text-accent">
        <RefreshCw className="size-3" aria-hidden /> Muat ulang
      </button>
    </div>
  );
}
