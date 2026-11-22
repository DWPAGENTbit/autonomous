"use client";

import { animate, useReducedMotion } from "motion/react";
import { area as d3area, curveMonotoneX, line as d3line } from "d3-shape";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useElementSize } from "@/hooks/use-element-size";
import { useMounted } from "@/hooks/use-mounted";
import { extent, lerp } from "@/lib/analytics/series";
import { chart, cssColor, easing, motionDuration } from "@/lib/design/tokens";

const PAD = { top: 12, right: 64, bottom: 24, left: 0 };

interface Props {
  values: number[];
  /** Hours the series spans, for hover time labels. */
  spanHours: number;
  formatValue: (v: number) => string;
  height?: number;
  ariaLabel: string;
  showArea?: boolean;
  /** Draw a dashed reference at the period's opening value. */
  showBaseline?: boolean;
}

function relativeTime(hoursAgo: number): string {
  if (hoursAgo < 0.05) return "Kini";
  if (hoursAgo < 1) return `${Math.round(hoursAgo * 60)} mnt lalu`;
  if (hoursAgo < 48) return `${Math.round(hoursAgo)} jam lalu`;
  return `${Math.round(hoursAgo / 24)} hari lalu`;
}

/**
 * Minimal line chart. When data changes (timeframe switch or live tick)
 * the line and its domain interpolate rather than jump.
 */
export const PerformanceChart = memo(function PerformanceChart({
  values,
  spanHours,
  formatValue,
  height = 280,
  ariaLabel,
  showArea = true,
  showBaseline = true,
}: Props) {
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(values);
  const shownRef = useRef(values);
  const [hover, setHover] = useState<number | null>(null);
  const mounted = useMounted();

  useEffect(() => {
    const from = shownRef.current;
    const to = values;
    if (reduced || from.length !== to.length) {
      shownRef.current = to;
      setShown(to);
      return;
    }
    const controls = animate(0, 1, {
      duration: motionDuration.meaning,
      ease: easing.out,
      onUpdate: (t) => {
        const next = to.map((v, i) => lerp(from[i], v, t));
        shownRef.current = next;
        setShown(next);
      },
    });
    return () => controls.stop();
  }, [values, reduced]);

  const geom = useMemo(() => {
    const innerW = Math.max(10, width - PAD.left - PAD.right);
    const innerH = height - PAD.top - PAD.bottom;
    const [lo, hi] = extent(shown);
    const pad = (hi - lo) * 0.08 || hi * 0.01;
    const y0 = lo - pad;
    const y1 = hi + pad;
    const x = (i: number) => PAD.left + (i / (shown.length - 1)) * innerW;
    const y = (v: number) => PAD.top + innerH - ((v - y0) / (y1 - y0)) * innerH;
    const linePath = d3line<number>().x((_, i) => x(i)).y(y).curve(curveMonotoneX)(shown) ?? "";
    const areaPath =
      d3area<number>()
        .x((_, i) => x(i))
        .y0(PAD.top + innerH)
        .y1(y)
        .curve(curveMonotoneX)(shown) ?? "";
    const ticks = [y1 - (y1 - y0) * 0.1, (y0 + y1) / 2, y0 + (y1 - y0) * 0.1];
    return { innerW, innerH, x, y, linePath, areaPath, ticks };
  }, [shown, width, height]);

  const n = shown.length;
  const last = shown[n - 1];
  const hoverIndex = hover ?? null;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))));
  };

  const onKey = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n - 1) - 1));
    else if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? n - 1) + 1));
    else if (e.key === "Escape") setHover(null);
    else return;
    e.preventDefault();
  };

  if (!mounted) return <div ref={ref} className="relative w-full" style={{ height }} aria-hidden />;

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${ariaLabel}. Latest ${formatValue(last)}.`}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
        className="block overflow-visible outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        {geom.ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={PAD.left + geom.innerW} y1={geom.y(t)} y2={geom.y(t)} stroke={cssColor.chartGrid} strokeWidth={1} />
            <text
              x={PAD.left + geom.innerW + 12}
              y={geom.y(t)}
              dy="0.32em"
              fontSize={chart.axisFontSize}
              fill={cssColor.ink3}
              className="num font-mono"
            >
              {formatValue(t)}
            </text>
          </g>
        ))}

        {showBaseline && (
          <line
            x1={PAD.left}
            x2={PAD.left + geom.innerW}
            y1={geom.y(shown[0])}
            y2={geom.y(shown[0])}
            stroke={cssColor.ink4}
            strokeDasharray="2 4"
            strokeWidth={1}
          />
        )}

        {showArea && <path d={geom.areaPath} fill={cssColor.chartArea} />}
        <path d={geom.linePath} fill="none" stroke={cssColor.chartLine} strokeWidth={chart.strokeWidth} strokeLinejoin="round" />

        {/* live point */}
        <circle cx={geom.x(n - 1)} cy={geom.y(last)} r={3} fill={cssColor.ink} />
        <circle cx={geom.x(n - 1)} cy={geom.y(last)} r={7} fill={cssColor.ink} opacity={0.08} />

        {hoverIndex !== null && (
          <g pointerEvents="none">
            <line
              x1={geom.x(hoverIndex)}
              x2={geom.x(hoverIndex)}
              y1={PAD.top}
              y2={PAD.top + geom.innerH}
              stroke={cssColor.ink}
              strokeWidth={1}
              opacity={0.25}
            />
            <circle cx={geom.x(hoverIndex)} cy={geom.y(shown[hoverIndex])} r={3.5} fill={cssColor.ink} stroke="white" strokeWidth={1.5} />
          </g>
        )}

        <text x={PAD.left} y={height - 4} fontSize={chart.axisFontSize} fill={cssColor.ink3}>
          {relativeTime(spanHours)}
        </text>
        <text x={PAD.left + geom.innerW} y={height - 4} fontSize={chart.axisFontSize} fill={cssColor.ink3} textAnchor="end">
          Kini
        </text>

        <rect
          x={PAD.left}
          y={0}
          width={geom.innerW}
          height={height}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>

      {hoverIndex !== null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 border border-line bg-surface px-2.5 py-1.5 shadow-raise"
          style={{ left: Math.min(Math.max(geom.x(hoverIndex), 60), Math.max(60, geom.innerW - 40)) }}
          aria-hidden
        >
          <p className="num text-sm text-ink">{formatValue(shown[hoverIndex])}</p>
          <p className="text-[10px] text-ink-3">{relativeTime(spanHours * (1 - hoverIndex / (n - 1)))}</p>
        </div>
      )}
      {hoverIndex !== null && (
        <p className="sr-only" aria-live="polite">
          {formatValue(shown[hoverIndex])}, {relativeTime(spanHours * (1 - hoverIndex / (n - 1)))}
        </p>
      )}
    </div>
  );
});

export function Sparkline({
  values,
  width = 96,
  height = 28,
  tone = "neutral",
}: {
  values: number[];
  width?: number;
  height?: number;
  tone?: "neutral" | "positive" | "negative";
}) {
  const mounted = useMounted();
  const path = useMemo(() => {
    const [lo, hi] = extent(values);
    const span = hi - lo || 1;
    return values
      .map((v, i) => `${i === 0 ? "M" : "L"}${((i / (values.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - lo) / span) * (height - 4)).toFixed(1)}`)
      .join("");
  }, [values, width, height]);
  const stroke = tone === "positive" ? cssColor.positive : tone === "negative" ? cssColor.negative : cssColor.ink3;
  if (!mounted) return <svg width={width} height={height} aria-hidden className="block" />;
  return (
    <svg width={width} height={height} aria-hidden className="block overflow-visible">
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.25} strokeLinejoin="round" />
    </svg>
  );
}
