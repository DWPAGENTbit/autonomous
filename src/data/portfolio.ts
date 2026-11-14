import type { AutonomyPolicy, Position } from "@/types/domain";

const t = (h: number, m: number) => h * 3600 + m * 60;

/** Simulated starting book. Not real funds. */
export const SEED_CASH = 6182.1;
export const SEED_REALIZED_PNL = 412.17;
export const SEED_MONTH_START_EQUITY = 10000;

export const SEED_POSITIONS: readonly Position[] = [
  {
    id: "pos-spx-1",
    symbol: "SPX",
    quantity: 0.5,
    entryPrice: 5730.0,
    stopPrice: 5640,
    targetPrice: 6050,
    openedAt: t(6, 48),
  },
  {
    id: "pos-xau-1",
    symbol: "XAU",
    quantity: 0.44,
    entryPrice: 2505.0,
    stopPrice: 2580,
    targetPrice: 2780,
    openedAt: t(5, 30),
  },
];

/** Limits the agent may act within without asking. */
export const AUTONOMY_POLICY: AutonomyPolicy = {
  mode: "AUTONOMOUS_WITHIN_LIMITS",
  maxRiskPerTradePct: 0.5,
  maxPortfolioExposurePct: 60,
  maxPositionPctOfEquity: 15,
  maxCorrelation: 0.7,
  maxDrawdownPct: 6,
  minExpectedValueR: 0.8,
};
