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
  ETH: { signal: "Momentum", thesis: "Momentum berlanjut setelah terbentuk higher low.", sizePct: 22, quantityDecimals: 2 },
  NDX: { signal: "Pullback tren", thesis: "Pullback ke rata-rata 20 hari di dalam tren naik.", sizePct: 12, quantityDecimals: 3 },
  BTC: { signal: "Kontraksi volatilitas", thesis: "Rentang harga menyempit menjelang pergerakan searah.", sizePct: 9, quantityDecimals: 4 },
  SPX: { signal: "Mengikuti tren", thesis: "Bertahan di atas rata-rata 50 hari dengan breadth membaik.", sizePct: 10, quantityDecimals: 3 },
  XAU: { signal: "Mengikuti tren", thesis: "Higher high terus terbentuk saat dolar melemah.", sizePct: 8, quantityDecimals: 2 },
  DXY: { signal: "Mean reversion", thesis: "Terlalu jauh di bawah rata-rata 20 harinya.", sizePct: 6, quantityDecimals: 1 },
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
