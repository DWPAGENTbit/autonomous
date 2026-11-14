"use client";

import clsx from "clsx";
import { useState } from "react";
import { INSTRUMENTS } from "@/data/instruments";
import { useCorrelations } from "@/hooks/use-derived";

/**
 * Lower-triangle correlation matrix. Intensity encodes strength;
 * hue separates moving together from moving apart.
 */
export function CorrelationMatrix({ limit }: { limit: number }) {
  const { symbols, values } = useCorrelations();
  const [hover, setHover] = useState<[number, number] | null>(null);

  return (
    <div>
      <table className="w-full border-separate border-spacing-[3px] text-center">
        <caption className="sr-only">Correlation of hourly returns over 90 days</caption>
        <thead>
          <tr>
            <th scope="col" className="w-12" />
            {symbols.slice(0, -1).map((s, j) => (
              <th
                key={s}
                scope="col"
                className={clsx("label pb-1 text-[10px] font-medium transition-colors", hover?.[1] === j ? "text-ink" : "text-ink-3")}
              >
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {symbols.slice(1).map((row, k) => {
            const i = k + 1;
            return (
              <tr key={row}>
                <th
                  scope="row"
                  className={clsx("label pr-1 text-left text-[10px] font-medium transition-colors", hover?.[0] === i ? "text-ink" : "text-ink-3")}
                >
                  {row}
                </th>
                {symbols.slice(0, -1).map((col, j) => {
                  if (j >= i) return <td key={col} />;
                  const v = values[i][j];
                  const strength = Math.min(1, Math.abs(v));
                  const above = v > limit;
                  return (
                    <td
                      key={col}
                      onPointerEnter={() => setHover([i, j])}
                      onPointerLeave={() => setHover(null)}
                      className={clsx("num h-10 font-mono text-[11px] transition-shadow", above && "ring-1 ring-ink ring-inset")}
                      style={{
                        background: `color-mix(in srgb, ${v >= 0 ? "var(--color-accent)" : "var(--color-caution)"} ${Math.round(
                          (0.06 + strength * (v >= 0 ? 0.55 : 0.45)) * 100,
                        )}%, transparent)`,
                        color: strength > 0.55 ? "white" : "var(--color-ink)",
                      }}
                      title={`${INSTRUMENTS[row].pair} vs ${INSTRUMENTS[col].pair}: ${v.toFixed(2)}`}
                    >
                      {v.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 bg-accent/60" aria-hidden /> Move together
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 bg-caution/50" aria-hidden /> Move apart
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 ring-1 ring-ink ring-inset" aria-hidden /> Above {limit.toFixed(2)} policy limit
        </span>
      </p>
    </div>
  );
}
