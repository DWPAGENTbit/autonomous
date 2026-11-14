"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import { useRegime } from "@/hooks/use-derived";
import { transition } from "@/lib/design/tokens";

const SCALE: Record<string, number> = {
  Low: 1,
  Moderate: 2,
  Elevated: 3,
  High: 4,
  Thin: 1,
  Adequate: 2,
  Healthy: 4,
  Negative: 1,
  Neutral: 2,
  Positive: 4,
};

/** Four readings that summarise the environment the agent is operating in. */
export function MarketRegime({ layout = "row" }: { layout?: "row" | "stack" }) {
  const r = useRegime();
  const items = [
    { label: "Risk appetite", value: r.riskAppetite, hint: "Risk assets vs. havens over 1M" },
    { label: "Volatility", value: r.volatility, hint: "1M realised vs. 1Y level", warn: r.volatility === "Elevated" || r.volatility === "High" },
    { label: "Liquidity", value: r.liquidity, hint: "Spread and depth across venues" },
    { label: "Trend", value: r.trend, hint: "Share of markets above trend" },
  ];

  return (
    <div>
      <dl className={clsx("grid gap-x-6 gap-y-6", layout === "row" ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2")}>
        {items.map((it) => (
          <div key={it.label} className="group min-w-0" title={it.hint}>
            <dt className="label mb-1.5 text-[10px]">{it.label}</dt>
            <dd>
              <motion.span
                key={it.value}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={transition.meaning}
                className={clsx("block text-xl tracking-[-0.01em]", it.warn ? "text-caution" : "text-ink")}
              >
                {it.value}
              </motion.span>
              <span className="mt-2 flex gap-1" aria-hidden>
                {[1, 2, 3, 4].map((n) => (
                  <span
                    key={n}
                    className={clsx(
                      "h-[3px] w-4 transition-colors duration-300",
                      n <= (SCALE[it.value] ?? 0) ? (it.warn ? "bg-caution" : "bg-ink") : "bg-line",
                    )}
                  />
                ))}
              </span>
              <span className="mt-2 block text-xs text-ink-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                {it.hint}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 max-w-[70ch] text-sm text-ink-2">{r.summary}</p>
    </div>
  );
}
