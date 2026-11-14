import { INSTRUMENTS } from "@/data/instruments";
import { SETUP_RULES, STRATEGY } from "@/data/strategy";
import { deriveRegime } from "@/lib/analytics/markets";
import type { MarketModel } from "@/lib/simulation/market";
import type { MarketSymbol, TradeSetup } from "@/types/domain";

const floorTo = (v: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.floor(v * f) / f;
};

/**
 * Builds the trade setup the strategy would propose right now.
 * Shared by the agent (to act) and the workspace (to show the user).
 */
export function proposeSetup(args: {
  id: string;
  symbol: MarketSymbol;
  market: MarketModel;
  equity: number;
  cash: number;
  decisionId?: string;
}): TradeSetup {
  const { id, symbol, market, equity, cash, decisionId = "" } = args;
  const inst = INSTRUMENTS[symbol];
  const profile = STRATEGY[symbol];
  const regime = deriveRegime(market);
  const price = market.quote(symbol).price;
  const entry = price * (1 - SETUP_RULES.entryDiscount);
  const stopPct = inst.annualVol * SETUP_RULES.stopVolMultiple;
  const intended = (profile.sizePct / 100) * equity;
  const affordable = Math.max(0, Math.min(intended, cash * 0.95));
  const winProbability = SETUP_RULES.baseWinProbability + (regime.trend === "Positif" ? SETUP_RULES.trendBonus : 0);

  return {
    id,
    symbol,
    side: "LONG",
    trend: regime.trend === "Positif" ? "Bullish" : regime.trend === "Negatif" ? "Bearish" : "Sideways",
    signal: profile.signal,
    entry,
    stop: entry * (1 - stopPct),
    target: entry * (1 + stopPct * SETUP_RULES.rewardMultiple),
    quantity: floorTo(affordable / entry, profile.quantityDecimals),
    winProbability,
    confidence: Math.min(0.9, winProbability + 0.11),
    decisionId,
  };
}
