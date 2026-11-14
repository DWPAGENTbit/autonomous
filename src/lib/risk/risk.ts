import { INSTRUMENTS } from "@/data/instruments";
import { correlationBetween } from "@/lib/analytics/markets";
import type { CapitalSnapshot } from "@/lib/analytics/portfolio";
import { clamp } from "@/lib/analytics/series";
import type { MarketModel } from "@/lib/simulation/market";
import type {
  AssetClass,
  AutonomyPolicy,
  MarketSymbol,
  RiskMetric,
  RiskState,
  RiskStatus,
  TradeSetup,
} from "@/types/domain";

/** Meter scales: the value at which a meter reads full. */
const SCALE = {
  drawdownPct: 10,
  volatilityPct: 40,
  leverage: 3,
} as const;

const HOURS_90D = 24 * 90;
const HOURS_PER_YEAR = 24 * 365;

/** Value-weighted average pairwise correlation among held instruments. */
export function weightedCorrelation(
  model: MarketModel,
  weights: { symbol: MarketSymbol; value: number }[],
): number {
  let num = 0;
  let den = 0;
  for (let i = 0; i < weights.length; i++) {
    for (let j = i + 1; j < weights.length; j++) {
      const w = weights[i].value * weights[j].value;
      num += w * correlationBetween(model, weights[i].symbol, weights[j].symbol, HOURS_90D);
      den += w;
    }
  }
  return den > 0 ? num / den : 0;
}

/** Annualised portfolio volatility as a percent of total equity. */
function portfolioVolPct(model: MarketModel, capital: CapitalSnapshot): number {
  if (capital.total <= 0 || capital.positions.length === 0) return 0;
  const rets = capital.positions.map((p) => model.logReturns(p.symbol, HOURS_90D));
  const w = capital.positions.map((p) => p.marketValue / capital.total);
  const n = rets[0].length;
  let sumSq = 0;
  let sum = 0;
  for (let k = 0; k < n; k++) {
    let r = 0;
    for (let i = 0; i < rets.length; i++) r += w[i] * rets[i][k];
    sum += r;
    sumSq += r * r;
  }
  const m = sum / n;
  const variance = sumSq / n - m * m;
  return Math.sqrt(Math.max(variance, 0) * HOURS_PER_YEAR) * 100;
}

function statusFrom(metrics: RiskMetric[]): RiskStatus {
  const worst = metrics
    .filter((m) => m.limit !== undefined && !m.inverted)
    .reduce((acc, m) => Math.max(acc, m.level / (m.limit as number)), 0);
  return worst < 0.75 ? "LOW" : worst < 0.95 ? "MODERATE" : "ELEVATED";
}

export function computeRisk(
  model: MarketModel,
  capital: CapitalSnapshot,
  policy: AutonomyPolicy,
): RiskState {
  const exposurePct = capital.total > 0 ? (capital.deployed / capital.total) * 100 : 0;
  const corr = weightedCorrelation(
    model,
    capital.positions.map((p) => ({ symbol: p.symbol, value: p.marketValue })),
  );
  const volPct = portfolioVolPct(model, capital);
  const leverage = capital.total > 0 ? capital.deployed / capital.total : 0;

  const metrics: RiskMetric[] = [
    {
      key: "exposure",
      label: "Portfolio exposure",
      level: clamp(exposurePct / 100, 0, 1),
      limit: policy.maxPortfolioExposurePct / 100,
      display: `${exposurePct.toFixed(1)}%`,
      context: `Share of equity deployed. Policy allows up to ${policy.maxPortfolioExposurePct}% without approval.`,
    },
    {
      key: "correlation",
      label: "Correlation",
      level: clamp(corr, 0, 1),
      limit: policy.maxCorrelation,
      display: corr.toFixed(2),
      context: `Value-weighted correlation between held positions over 90 days. New positions above ${policy.maxCorrelation.toFixed(2)} are rejected.`,
    },
    {
      key: "drawdown",
      label: "Drawdown",
      level: clamp(capital.drawdownPct / SCALE.drawdownPct, 0, 1),
      limit: policy.maxDrawdownPct / SCALE.drawdownPct,
      display: `${capital.drawdownPct.toFixed(1)}%`,
      context: `Distance from peak equity. The agent stops opening positions at ${policy.maxDrawdownPct}%.`,
    },
    {
      key: "volatility",
      label: "Volatility",
      level: clamp(volPct / SCALE.volatilityPct, 0, 1),
      display: `${volPct.toFixed(1)}%`,
      context: "Annualised volatility of the whole book, as a share of equity.",
    },
    {
      key: "leverage",
      label: "Leverage",
      level: clamp(leverage / SCALE.leverage, 0, 1),
      limit: 1 / SCALE.leverage,
      display: `${leverage.toFixed(2)}×`,
      context: "Gross exposure divided by equity. The agent does not borrow; the limit is 1.00×.",
    },
    {
      key: "liquidity",
      label: "Liquidity",
      level: 0.84,
      display: "Healthy",
      context: "Every position can be exited within one minute at under 0.05% estimated slippage.",
      inverted: true,
    },
  ];

  const byClass = new Map<AssetClass, number>();
  capital.positions.forEach((p) => {
    const cls = INSTRUMENTS[p.symbol].assetClass;
    byClass.set(cls, (byClass.get(cls) ?? 0) + p.marketValue);
  });
  const sectorExposure = Array.from(byClass.entries())
    .map(([assetClass, v]) => ({ assetClass, pct: capital.deployed > 0 ? (v / capital.deployed) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct);

  return { status: statusFrom(metrics), metrics, sectorExposure };
}

export interface SetupImpact {
  positionValue: number;
  positionPctOfEquity: number;
  maxLoss: number;
  maxLossPctOfEquity: number;
  expectedReturn: number;
  rewardR: number;
  expectedValueR: number;
  exposureBeforePct: number;
  exposureAfterPct: number;
  correlationAfter: number;
}

export function rewardMultiple(setup: Pick<TradeSetup, "entry" | "stop" | "target">): number {
  const risk = Math.abs(setup.entry - setup.stop);
  return risk === 0 ? 0 : Math.abs(setup.target - setup.entry) / risk;
}

export function expectedValueR(setup: Pick<TradeSetup, "entry" | "stop" | "target" | "winProbability">): number {
  const r = rewardMultiple(setup);
  return setup.winProbability * r - (1 - setup.winProbability);
}

/** What happens to the book if this setup is executed at a given size. */
export function setupImpact(
  model: MarketModel,
  capital: CapitalSnapshot,
  setup: TradeSetup,
  quantity = setup.quantity,
): SetupImpact {
  const positionValue = quantity * setup.entry;
  const maxLoss = quantity * Math.abs(setup.entry - setup.stop);
  const rewardR = rewardMultiple(setup);
  const evR = expectedValueR(setup);
  const total = capital.total;
  const correlationAfter = weightedCorrelation(model, [
    ...capital.positions.map((p) => ({ symbol: p.symbol, value: p.marketValue })),
    { symbol: setup.symbol, value: positionValue },
  ]);
  return {
    positionValue,
    positionPctOfEquity: (positionValue / total) * 100,
    maxLoss,
    maxLossPctOfEquity: (maxLoss / total) * 100,
    expectedReturn: evR * maxLoss,
    rewardR,
    expectedValueR: evR,
    exposureBeforePct: (capital.deployed / total) * 100,
    exposureAfterPct: ((capital.deployed + positionValue) / total) * 100,
    correlationAfter,
  };
}
