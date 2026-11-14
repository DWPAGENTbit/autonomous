"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { INSTRUMENTS } from "@/data/instruments";
import { useElementSize } from "@/hooks/use-element-size";
import { useMounted } from "@/hooks/use-mounted";
import { chart, cssColor, transition } from "@/lib/design/tokens";
import { formatPct, formatSignedPct } from "@/lib/formatting/format";
import type { InstrumentStats, MarketSymbol } from "@/types/domain";

const PAD = { top: 20, right: 24, bottom: 34, left: 44 };

/**
 * The market as a space: return against volatility. Position, not a card,
 * tells you which markets are paying for their risk. Points glide when the
 * timeframe changes.
 */
export function ReturnVolatilityMap({
  stats,
  held,
  height = 300,
  onSelect,
  timeframeLabel,
}: {
  stats: InstrumentStats[];
  held: readonly MarketSymbol[];
  height?: number;
  onSelect?: (s: MarketSymbol) => void;
  timeframeLabel: string;
}) {
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const [focus, setFocus] = useState<MarketSymbol | null>(null);
  const mounted = useMounted();

  const g = useMemo(() => {
    const innerW = Math.max(10, width - PAD.left - PAD.right);
    const innerH = height - PAD.top - PAD.bottom;
    const maxVol = Math.max(...stats.map((s) => s.volatilityPct)) * 1.15;
    const maxRet = Math.max(1, ...stats.map((s) => Math.abs(s.returnPct))) * 1.25;
    const x = (v: number) => PAD.left + (v / maxVol) * innerW;
    const y = (r: number) => PAD.top + innerH / 2 - (r / maxRet) * (innerH / 2);
    const xTicks = [0.25, 0.5, 0.75, 1].map((f) => f * maxVol);
    // Nudge labels apart when points sit close together.
    const labelDy: Record<string, number> = {};
    const placed: { x: number; y: number }[] = [];
    [...stats]
      .sort((a, b) => y(a.returnPct) - y(b.returnPct))
      .forEach((s) => {
        const px = x(s.volatilityPct);
        let ly = y(s.returnPct);
        while (placed.some((p) => Math.abs(p.x - px) < 44 && Math.abs(p.y - ly) < 13)) ly += 13;
        placed.push({ x: px, y: ly });
        labelDy[s.symbol] = ly - y(s.returnPct);
      });
    return { innerW, innerH, x, y, maxRet, xTicks, labelDy };
  }, [stats, width, height]);

  const focused = focus ? stats.find((s) => s.symbol === focus) : null;

  if (!mounted) return <div ref={ref} className="relative w-full" style={{ height }} aria-hidden />;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      <svg width={width} height={height} className="block overflow-visible" role="img" aria-label={`Return versus volatility over ${timeframeLabel}`}>
        {/* zero return */}
        <line x1={PAD.left} x2={PAD.left + g.innerW} y1={g.y(0)} y2={g.y(0)} stroke={cssColor.lineStrong} />
        <text x={PAD.left - 10} y={g.y(0)} dy="0.32em" textAnchor="end" fontSize={chart.axisFontSize} fill={cssColor.ink3} className="font-mono">
          0%
        </text>
        <text x={PAD.left - 10} y={PAD.top} dy="0.32em" textAnchor="end" fontSize={chart.axisFontSize} fill={cssColor.ink3} className="font-mono">
          +{g.maxRet.toFixed(0)}%
        </text>
        <text x={PAD.left - 10} y={PAD.top + g.innerH} dy="0.32em" textAnchor="end" fontSize={chart.axisFontSize} fill={cssColor.ink3} className="font-mono">
          −{g.maxRet.toFixed(0)}%
        </text>
        {g.xTicks.map((t) => (
          <g key={t}>
            <line x1={g.x(t)} x2={g.x(t)} y1={PAD.top} y2={PAD.top + g.innerH} stroke={cssColor.chartGrid} />
            <text x={g.x(t)} y={height - 14} textAnchor="middle" fontSize={chart.axisFontSize} fill={cssColor.ink3} className="font-mono">
              {t.toFixed(0)}%
            </text>
          </g>
        ))}
        <text x={PAD.left + g.innerW} y={height - 1} textAnchor="end" fontSize={10} fill={cssColor.ink3} letterSpacing="0.08em">
          VOLATILITY →
        </text>
        <text x={PAD.left + 6} y={PAD.top + 4} fontSize={10} fill={cssColor.ink4} letterSpacing="0.08em">
          PAID FOR RISK
        </text>
        <text x={PAD.left + g.innerW - 4} y={PAD.top + g.innerH - 6} textAnchor="end" fontSize={10} fill={cssColor.ink4} letterSpacing="0.08em">
          RISK WITHOUT RETURN
        </text>

        {stats.map((s) => {
          const isHeld = held.includes(s.symbol);
          const dim = focus !== null && focus !== s.symbol;
          // Rounded so server and client serialise identical transforms.
          const cx = Math.round(g.x(s.volatilityPct) * 10) / 10;
          const cy = Math.round(g.y(s.returnPct) * 10) / 10;
          return (
            <motion.g
              key={s.symbol}
              initial={false}
              animate={{ x: cx, y: cy, opacity: dim ? 0.35 : 1 }}
              transition={transition.scene}
              className={clsx(onSelect && "cursor-pointer")}
              onPointerEnter={() => setFocus(s.symbol)}
              onPointerLeave={() => setFocus(null)}
              onFocus={() => setFocus(s.symbol)}
              onBlur={() => setFocus(null)}
              onClick={() => onSelect?.(s.symbol)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(s.symbol);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`${INSTRUMENTS[s.symbol].pair}: return ${formatSignedPct(s.returnPct)}, volatility ${formatPct(s.volatilityPct, 0)}${isHeld ? ", held" : ""}`}
            >
              <circle r={14} fill="transparent" />
              <circle
                r={isHeld ? 5 : 4.5}
                fill={isHeld ? cssColor.ink : cssColor.accentSoft}
                stroke={isHeld ? cssColor.ink : cssColor.accent}
                strokeWidth={1.25}
              />
              <text x={9} y={g.labelDy[s.symbol] ?? 0} dy="0.32em" fontSize={12} fill={cssColor.ink} className="font-medium">
                {s.symbol}
              </text>
            </motion.g>
          );
        })}
      </svg>

      {focused && (
        <div
          className="pointer-events-none absolute border border-line bg-surface px-3 py-2 shadow-raise"
          style={{
            left: Math.min(g.x(focused.volatilityPct) + 14, width - 170),
            top: Math.max(0, g.y(focused.returnPct) - 64),
          }}
          aria-hidden
        >
          <p className="text-sm text-ink">{INSTRUMENTS[focused.symbol].pair}</p>
          <p className="num text-xs text-ink-2">
            Return <span className={focused.returnPct >= 0 ? "text-positive" : "text-negative"}>{formatSignedPct(focused.returnPct)}</span> ·
            Vol {formatPct(focused.volatilityPct, 0)}
          </p>
          <p className="text-[10px] text-ink-3">
            {focused.returnPct / Math.max(focused.volatilityPct, 1) > 0.15 ? "Return is compensating for risk" : "Little return per unit of risk"}
          </p>
        </div>
      )}
    </div>
  );
}
