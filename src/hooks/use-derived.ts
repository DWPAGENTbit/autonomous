"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { allStats, correlationMatrix, deriveRegime } from "@/lib/analytics/markets";
import { computeCapital, type CapitalSnapshot } from "@/lib/analytics/portfolio";
import { computeRisk } from "@/lib/risk/risk";
import { market } from "@/lib/simulation/initial-state";
import { useAppStore } from "@/store/app-store";
import { resample } from "@/lib/analytics/series";
import { chart } from "@/lib/design/tokens";
import type { InstrumentStats, MarketRegime, MarketSymbol, RiskState, Timeframe } from "@/types/domain";

/** Ticks only roughly every N market updates, for slow-moving derived views. */
const SLOW_EVERY = 5;

export function useCapital(): CapitalSnapshot {
  const { portfolio, quotes } = useAppStore(useShallow((s) => ({ portfolio: s.portfolio, quotes: s.quotes })));
  return useMemo(() => computeCapital(portfolio, quotes), [portfolio, quotes]);
}

export function useRisk(): RiskState {
  const capital = useCapital();
  const policy = useAppStore((s) => s.policy);
  const slow = useAppStore((s) => Math.floor(s.marketVersion / SLOW_EVERY));
  const positionsKey = capital.positions.map((p) => p.id).join();
  return useMemo(
    () => computeRisk(market, capital, policy),
    // Risk is recomputed when holdings change or every few ticks — not on every price update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [positionsKey, policy, slow],
  );
}

export function useRegime(): MarketRegime {
  const slow = useAppStore((s) => Math.floor(s.marketVersion / SLOW_EVERY));
  return useMemo(() => deriveRegime(market), [slow]);
}

export function useMarketStats(tf: Timeframe): InstrumentStats[] {
  const version = useAppStore((s) => s.marketVersion);
  return useMemo(() => allStats(market, tf), [tf, version]);
}

export function useCorrelations() {
  const slow = useAppStore((s) => Math.floor(s.marketVersion / (SLOW_EVERY * 4)));
  return useMemo(() => correlationMatrix(market), [slow]);
}

export function usePendingApproval() {
  return useAppStore(
    useShallow((s) => {
      const request = s.approvals[0];
      return { request, setup: request ? s.setups[request.setupId] : undefined };
    }),
  );
}

/** A resampled price window for charts; recomputed on every market tick. */
export function useSeries(symbol: MarketSymbol, tf: Timeframe, points: number = chart.resolution): number[] {
  const version = useAppStore((s) => s.marketVersion);
  return useMemo(() => resample(market.window(symbol, tf), points), [symbol, tf, points, version]);
}
