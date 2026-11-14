"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import Link from "next/link";
import { memo } from "react";
import { INSTRUMENTS, SYMBOLS } from "@/data/instruments";
import { useMarketStats, useSeries } from "@/hooks/use-derived";
import { Sparkline } from "@/components/markets/PerformanceChart";
import { Delta } from "@/components/shared/primitives";
import { chart, motionDuration } from "@/lib/design/tokens";
import { pctChange } from "@/lib/analytics/series";
import { formatPct, formatPrice } from "@/lib/formatting/format";
import { useAppStore } from "@/store/app-store";
import type { MarketSymbol } from "@/types/domain";

/** Price that briefly takes the colour of its last tick, then settles. */
export function LivePrice({ symbol, className }: { symbol: MarketSymbol; className?: string }) {
  const quote = useAppStore((s) => s.quotes[symbol]);
  const inst = INSTRUMENTS[symbol];
  const tickColor = quote.tick > 0 ? "var(--color-positive)" : quote.tick < 0 ? "var(--color-negative)" : "var(--color-ink)";
  return (
    <motion.span
      key={quote.price}
      className={clsx("num", className)}
      initial={{ color: tickColor }}
      animate={{ color: "var(--color-ink)" }}
      transition={{ duration: motionDuration.scene * 1.5, ease: "easeOut" }}
      suppressHydrationWarning
    >
      {formatPrice(quote.price, inst.decimals)}
    </motion.span>
  );
}

const TapeRow = memo(function TapeRow({
  symbol,
  volPct,
  aboveTrend,
  held,
  selected,
  onSelect,
  compact,
}: {
  symbol: MarketSymbol;
  volPct: number;
  aboveTrend: boolean;
  held: boolean;
  selected?: boolean;
  onSelect?: (s: MarketSymbol) => void;
  compact?: boolean;
}) {
  const inst = INSTRUMENTS[symbol];
  const quote = useAppStore((s) => s.quotes[symbol]);
  const series = useSeries(symbol, "1D", chart.sparkResolution);
  const day = pctChange(quote.dayOpen, quote.price);

  const content = (
    <>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm text-ink">{inst.pair}</span>
          {held && <span className="label text-[9px] text-accent">Dipegang</span>}
        </span>
        <span className="block truncate text-xs text-ink-3">{inst.assetClass}</span>
      </span>
      <span className={compact ? "hidden" : "hidden sm:block"}>
        <Sparkline values={series} tone={day >= 0 ? "positive" : "negative"} width={88} height={24} />
      </span>
      <span className="text-right">
        <LivePrice symbol={symbol} className="block text-sm" />
        <Delta value={day} className="block text-xs" />
      </span>
      <span className={compact ? "hidden" : "hidden text-right md:block"}>
        <span className="num block text-sm text-ink-2">{formatPct(volPct, 0)}</span>
        <span className="block text-xs text-ink-3">{aboveTrend ? "Di atas tren" : "Di bawah tren"}</span>
      </span>
    </>
  );

  const rowClass = clsx(
    "grid w-full items-center gap-x-5 border-b border-line py-3 text-left transition-colors duration-150",
    compact ? "grid-cols-[1fr_auto]" : "grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_6.5rem] md:grid-cols-[1fr_auto_6.5rem_5.5rem]",
    selected ? "bg-sunken/70" : "hover:bg-sunken/50",
  );

  return onSelect ? (
    <button type="button" className={clsx(rowClass, "px-2")} onClick={() => onSelect(symbol)} aria-pressed={selected}>
      {content}
    </button>
  ) : (
    <Link href={`/markets?symbol=${symbol}`} className={rowClass}>
      {content}
    </Link>
  );
});

/** All watched instruments as a quiet, scannable tape. */
export function InstrumentTape({
  selected,
  onSelect,
  compact = false,
}: {
  selected?: MarketSymbol;
  onSelect?: (s: MarketSymbol) => void;
  /** Two columns only — for narrow side columns. */
  compact?: boolean;
}) {
  const stats = useMarketStats("1M");
  const heldSymbols = useAppStore((s) => s.portfolio.positions.map((p) => p.symbol).join());
  return (
    <div>
      <div
        className={clsx(
          "label grid gap-x-5 border-b border-line pb-2 text-[10px]",
          compact ? "grid-cols-[1fr_auto] px-2" : "grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_6.5rem] md:grid-cols-[1fr_auto_6.5rem_5.5rem]",
        )}
      >
        <span className={onSelect && !compact ? "px-2" : ""}>Instrumen</span>
        {!compact && <span className="hidden w-[88px] sm:block">24 jam</span>}
        <span className="text-right">Harga · 24 jam</span>
        {!compact && <span className="hidden text-right md:block">Vol · 1M</span>}
      </div>
      {SYMBOLS.map((s) => {
        const st = stats.find((x) => x.symbol === s)!;
        return (
          <TapeRow
            key={s}
            symbol={s}
            volPct={st.volatilityPct}
            aboveTrend={st.aboveTrend}
            held={heldSymbols.split(",").includes(s)}
            selected={selected === s}
            onSelect={onSelect}
            compact={compact}
          />
        );
      })}
    </div>
  );
}
