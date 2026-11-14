"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import { useRegime } from "@/hooks/use-derived";
import { transition } from "@/lib/design/tokens";

const SCALE: Record<string, number> = {
  Rendah: 1,
  Sedang: 2,
  Tinggi: 3,
  "Sangat tinggi": 4,
  Tipis: 1,
  Cukup: 2,
  Sehat: 4,
  Negatif: 1,
  Netral: 2,
  Positif: 4,
};

/** Four readings that summarise the environment the agent is operating in. */
export function MarketRegime({ layout = "row" }: { layout?: "row" | "stack" }) {
  const r = useRegime();
  const items = [
    { label: "Selera risiko", value: r.riskAppetite, hint: "Aset berisiko vs. aset aman selama 1M" },
    { label: "Volatilitas", value: r.volatility, hint: "Realisasi 1M vs. level 1Y", warn: r.volatility === "Tinggi" || r.volatility === "Sangat tinggi" },
    { label: "Likuiditas", value: r.liquidity, hint: "Spread dan kedalaman di berbagai bursa" },
    { label: "Tren", value: r.trend, hint: "Porsi pasar di atas tren" },
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
