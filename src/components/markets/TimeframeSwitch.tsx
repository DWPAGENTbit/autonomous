"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import { useId } from "react";
import { transition } from "@/lib/design/tokens";
import { TIMEFRAMES } from "@/lib/simulation/market";
import type { Timeframe } from "@/types/domain";

export function TimeframeSwitch({
  value,
  onChange,
  label = "Timeframe",
}: {
  value: Timeframe;
  onChange: (tf: Timeframe) => void;
  label?: string;
}) {
  const group = useId();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex items-center gap-0.5">
      {TIMEFRAMES.map((tf) => {
        const active = tf === value;
        return (
          <button
            key={tf}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(tf)}
            onKeyDown={(e) => {
              const i = TIMEFRAMES.indexOf(value);
              if (e.key === "ArrowRight") onChange(TIMEFRAMES[Math.min(TIMEFRAMES.length - 1, i + 1)]);
              if (e.key === "ArrowLeft") onChange(TIMEFRAMES[Math.max(0, i - 1)]);
            }}
            tabIndex={active ? 0 : -1}
            className={clsx(
              "relative h-7 px-2.5 font-mono text-xs transition-colors duration-150",
              active ? "text-ink" : "text-ink-3 hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={`tf-${group}`}
                className="absolute inset-x-1.5 bottom-0 h-px bg-ink"
                transition={transition.panel}
              />
            )}
            {tf}
          </button>
        );
      })}
    </div>
  );
}
