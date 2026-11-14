"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import { transition } from "@/lib/design/tokens";

const SEGMENTS = 10;

/**
 * Segmented meter. Reads at a glance; the policy limit is a tick,
 * and segments past the limit turn the meaning colour.
 */
export function Meter({
  level,
  limit,
  inverted = false,
  label,
}: {
  level: number;
  limit?: number;
  inverted?: boolean;
  label: string;
}) {
  const filled = Math.round(level * SEGMENTS);
  const breach = limit !== undefined && !inverted && level > limit;
  const near = limit !== undefined && !inverted && level > limit * 0.85;

  return (
    <div
      className="relative flex h-3 w-full items-stretch gap-[3px]"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(level * 100)}
    >
      {Array.from({ length: SEGMENTS }, (_, i) => {
        const on = i < filled;
        return (
          <motion.span
            key={i}
            className={clsx(
              "flex-1 rounded-[1px]",
              !on && "bg-line",
              on && (breach ? "bg-negative" : near ? "bg-caution" : inverted ? "bg-positive/80" : "bg-ink/80"),
            )}
            initial={false}
            animate={{ opacity: on ? 1 : 0.9, scaleY: on ? 1 : 0.6 }}
            transition={{ ...transition.meaning, delay: on ? i * 0.02 : 0 }}
          />
        );
      })}
      {limit !== undefined && (
        <span
          aria-hidden
          className="absolute -top-1 -bottom-1 w-px bg-ink"
          style={{ left: `calc(${limit * 100}% - 1px)` }}
          title="Batas kebijakan"
        />
      )}
    </div>
  );
}
