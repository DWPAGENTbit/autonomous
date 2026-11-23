"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import Link from "next/link";
import { FlaskConical, Landmark, Radio } from "lucide-react";
import { useEffect } from "react";
import { PANEL } from "@/components/shared/PageIntro";
import { transition } from "@/lib/design/tokens";
import { type Mode, useMode, useModeStore } from "@/store/mode-store";

/** Restores the remembered mode after the first render, so server and client markup agree. */
export function ModeHydrator() {
  useEffect(() => {
    void useModeStore.persist.rehydrate();
  }, []);
  return null;
}

const OPTIONS: { mode: Mode; label: string; title: string }[] = [
  { mode: "live", label: "Live", title: "Akun dan harga nyata" },
  { mode: "demo", label: "Demo", title: "Simulasi agen, modal fiktif $10.000" },
];

/** Live / Demo segmented switch, shown in the top bar on every page. */
export function ModeSwitch({ className }: { className?: string }) {
  const mode = useMode();
  const setMode = useModeStore((s) => s.setMode);

  return (
    <div
      role="radiogroup"
      aria-label="Mode tampilan"
      className={clsx("relative inline-flex shrink-0 items-center rounded-full border border-glass-edge bg-white/70 p-0.5 shadow-[var(--shadow-raise)]", className)}
    >
      {OPTIONS.map((o) => {
        const active = mode === o.mode;
        return (
          <button
            key={o.mode}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => setMode(o.mode)}
            className={clsx(
              "relative inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-medium transition-colors sm:h-8 sm:gap-1.5 sm:px-3 sm:text-xs",
              active ? "text-white" : "text-ink-3 hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId="mode-thumb"
                className={clsx(
                  "absolute inset-0 rounded-full",
                  o.mode === "live"
                    ? "bg-gradient-to-r from-[#10b981] to-positive shadow-[0_4px_12px_rgb(13_155_99/0.35)]"
                    : "bg-gradient-to-r from-[#f5b544] to-caution shadow-[0_4px_12px_rgb(183_119_11/0.35)]",
                )}
                transition={transition.panel}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {o.mode === "live" ? (
                <span className={clsx("size-1.5 rounded-full", active ? "bg-white" : "bg-positive")} aria-hidden />
              ) : (
                <FlaskConical className="hidden size-3 sm:block" aria-hidden />
              )}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Renders its children only in the given mode. */
export function OnlyMode({ mode, children }: { mode: Mode; children: React.ReactNode }) {
  return useMode() === mode ? <>{children}</> : null;
}

/** Thin strip at the top of demo pages, so fictional numbers are never mistaken for real ones. */
export function DemoBanner() {
  const setMode = useModeStore((s) => s.setMode);
  return (
    <div className="mx-auto max-w-[1360px] px-3 pt-4 sm:px-4 md:pt-6 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-[18px] border border-caution/25 bg-caution-soft px-4 py-3">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.12em] text-caution uppercase">
          <FlaskConical className="hidden size-3 sm:block" aria-hidden /> Mode demo
        </span>
        <p className="order-last w-full text-xs text-ink-2 sm:order-none sm:w-auto sm:min-w-0 sm:flex-1">
          Latihan strategi tim agen dengan modal fiktif $10.000. Tidak memakai dan tidak mengubah uang Anda.
        </p>
        <button type="button" onClick={() => setMode("live")} className="pill !py-1 text-[11px] text-positive">
          <Radio className="size-3" aria-hidden /> Kembali ke Live
        </button>
      </div>
    </div>
  );
}

/** Shown in live mode on pages that only exist in the simulation. */
export function DemoOnlyNotice({ title, children }: { title: string; children: React.ReactNode }) {
  const setMode = useModeStore((s) => s.setMode);
  return (
    <section className={PANEL}>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-positive/25 bg-positive-soft px-2 py-0.5 font-mono text-[10px] font-medium tracking-[0.1em] text-positive uppercase">
        <span className="size-1.5 rounded-full bg-positive" aria-hidden /> Mode live
      </span>
      <h2 className="mt-4 text-xl font-normal tracking-[-0.015em] text-ink md:text-2xl">{title}</h2>
      <div className="mt-2 max-w-[68ch] space-y-2 text-sm leading-relaxed text-ink-2">{children}</div>
      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" onClick={() => setMode("demo")} className="pill pill-accent !px-4 !py-2 text-sm">
          <FlaskConical className="size-3.5" aria-hidden /> Lihat di mode Demo
        </button>
        <Link href="/akun" className="pill !px-4 !py-2 text-sm">
          <Landmark className="size-3.5" aria-hidden /> Akun nyata
        </Link>
      </div>
    </section>
  );
}
