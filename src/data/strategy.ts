import type { MarketSymbol } from "@/types/domain";

/** How the strategy approaches each instrument. Demo parameters. */
export interface StrategyProfile {
  signal: string;
  thesis: string;
  /** Intended position size as percent of equity. */
  sizePct: number;
  quantityDecimals: number;
}

export const STRATEGY: Record<MarketSymbol, StrategyProfile> = {
  ETH: { signal: "Momentum", thesis: "Momentum continuation after a higher low.", sizePct: 22, quantityDecimals: 2 },
  NDX: { signal: "Trend pullback", thesis: "Pullback to the 20-day average inside an uptrend.", sizePct: 12, quantityDecimals: 3 },
  BTC: { signal: "Volatility contraction", thesis: "Range compression ahead of a directional move.", sizePct: 9, quantityDecimals: 4 },
  SPX: { signal: "Trend following", thesis: "Holding above the 50-day average with improving breadth.", sizePct: 10, quantityDecimals: 3 },
  XAU: { signal: "Trend following", thesis: "Higher highs while the dollar weakens.", sizePct: 8, quantityDecimals: 2 },
  DXY: { signal: "Mean reversion", thesis: "Stretched below its 20-day average.", sizePct: 6, quantityDecimals: 1 },
};

/** Instruments the agent actively hunts for entries, in rotation. */
export const CANDIDATE_ROTATION: readonly MarketSymbol[] = ["ETH", "NDX", "BTC"];

/** Strategy constants shared by the agent and the trading workspace. */
export const SETUP_RULES = {
  /** Stop distance as a multiple of annual volatility. */
  stopVolMultiple: 0.035,
  rewardMultiple: 2.5,
  baseWinProbability: 0.56,
  trendBonus: 0.04,
  /** Limit entry slightly below the last price. */
  entryDiscount: 0.002,
} as const;
