"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Meter } from "@/components/shared/Meter";
import { useRisk } from "@/hooks/use-derived";
import { transition } from "@/lib/design/tokens";
import { formatClock, formatPct } from "@/lib/formatting/format";
import { useAppStore } from "@/store/app-store";
import type { RiskStatus } from "@/types/domain";

const STATUS_TONE: Record<RiskStatus, string> = {
  LOW: "text-positive",
  MODERATE: "text-caution",
  ELEVATED: "text-negative",
};

/** Risk in seconds: one word, then each measure against its policy limit. */
export function RiskSurface({ showSectors = true }: { showSectors?: boolean }) {
  const risk = useRisk();
  const warning = useAppStore((s) => s.riskWarning);
  const [hover, setHover] = useState<string | null>(null);

  const limited = risk.metrics.filter((m) => m.limit !== undefined && !m.inverted);
  const closest = limited.reduce((a, b) => (b.level / (b.limit as number) > a.level / (a.limit as number) ? b : a), limited[0]);
  const summary =
    risk.status === "LOW"
      ? `Semua ukuran dalam kebijakan. Paling dekat ke batasnya: ${closest.label.toLowerCase()} di ${closest.display}.`
      : `${closest.label} di ${closest.display} mendekati batas kebijakan. Posisi baru diperkecil.`;

  return (
    <div>
      <p className="label mb-1">Status risiko</p>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={risk.status}
          className={clsx("text-4xl font-light tracking-[-0.02em]", STATUS_TONE[risk.status])}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={transition.meaning}
        >
          {risk.status.charAt(0) + risk.status.slice(1).toLowerCase()}
        </motion.p>
      </AnimatePresence>
      <p className="mt-2 max-w-[48ch] text-sm text-ink-2">{summary}</p>

      <ul className="mt-7 space-y-0" aria-label="Ukuran risiko">
        {risk.metrics.map((m) => (
          <li
            key={m.key}
            onPointerEnter={() => setHover(m.key)}
            onPointerLeave={() => setHover(null)}
            className="border-b border-line py-3"
          >
            <div className="grid grid-cols-[8.5rem_1fr_4.5rem] items-center gap-x-4">
              <span className="text-sm text-ink-2">{m.label}</span>
              <Meter level={m.level} limit={m.limit} inverted={m.inverted} label={`${m.label}: ${m.display}`} />
              <span className="num text-right text-sm text-ink">{m.display}</span>
            </div>
            <AnimatePresence initial={false}>
              {hover === m.key && (
                <motion.p
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={transition.panel}
                  className="overflow-hidden pt-2 text-xs text-ink-3"
                >
                  {m.context}
                </motion.p>
              )}
            </AnimatePresence>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex items-center gap-2 text-[11px] text-ink-3">
        <span className="inline-block h-3 w-px bg-ink" aria-hidden /> Batas kebijakan
      </p>

      {showSectors && risk.sectorExposure.length > 0 && (
        <div className="mt-8">
          <p className="label mb-2 text-[10px]">Eksposur per kelas aset</p>
          <div className="flex h-2 w-full gap-[2px]" aria-hidden>
            {risk.sectorExposure.map((s, i) => (
              <motion.span
                key={s.assetClass}
                layout
                transition={transition.scene}
                className={clsx("h-full", ["bg-ink", "bg-ink-2", "bg-ink-3", "bg-ink-4"][i % 4])}
                style={{ flexGrow: s.pct }}
              />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
            {risk.sectorExposure.map((s) => (
              <li key={s.assetClass} className="text-xs text-ink-2">
                {s.assetClass} <span className="num text-ink">{formatPct(s.pct, 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AnimatePresence>
        {warning && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={transition.meaning}
            className="mt-6 border-l-2 border-caution pl-3 text-sm text-ink-2"
            role="status"
          >
            <span className="num mr-2 font-mono text-xs text-ink-3">{formatClock(warning.at, false)}</span>
            {warning.message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
