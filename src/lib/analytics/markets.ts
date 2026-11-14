import { SYMBOLS } from "@/data/instruments";
import { mean, pctChange, pearson, realisedVolPct } from "@/lib/analytics/series";
import { MarketModel } from "@/lib/simulation/market";
import type {
  InstrumentStats,
  MarketRegime,
  MarketSymbol,
  RegimeLevel,
  Timeframe,
} from "@/types/domain";

export function instrumentStats(
  model: MarketModel,
  symbol: MarketSymbol,
  tf: Timeframe,
): InstrumentStats {
  const w = model.window(symbol, tf);
  const last = w[w.length - 1];
  return {
    symbol,
    returnPct: pctChange(w[0], last),
    volatilityPct: realisedVolPct(w, MarketModel.stepsPerYear(tf)),
    aboveTrend: last > mean(w),
  };
}

export function allStats(model: MarketModel, tf: Timeframe): InstrumentStats[] {
  return SYMBOLS.map((s) => instrumentStats(model, s, tf));
}

/** Correlation matrix of hourly returns over the trailing window. */
export function correlationMatrix(
  model: MarketModel,
  hours = 24 * 90,
): { symbols: readonly MarketSymbol[]; values: number[][] } {
  const rets = SYMBOLS.map((s) => model.logReturns(s, hours));
  const values = rets.map((a, i) => rets.map((b, j) => (i === j ? 1 : pearson(a, b))));
  return { symbols: SYMBOLS, values };
}

export function correlationBetween(
  model: MarketModel,
  a: MarketSymbol,
  b: MarketSymbol,
  hours = 24 * 90,
): number {
  if (a === b) return 1;
  return pearson(model.logReturns(a, hours), model.logReturns(b, hours));
}

const levelFromScore = (score: number, cuts: [number, number, number]): RegimeLevel =>
  score < cuts[0] ? "Rendah" : score < cuts[1] ? "Sedang" : score < cuts[2] ? "Tinggi" : "Sangat tinggi";

/**
 * Derives the market regime from the instruments themselves, so the
 * readout always agrees with the charts beside it.
 */
export function deriveRegime(model: MarketModel): MarketRegime {
  const month = allStats(model, "1M");
  const year = allStats(model, "1Y");
  const bySym = (xs: InstrumentStats[], s: MarketSymbol) => xs.find((x) => x.symbol === s)!;

  // Risk appetite: risk assets' 1M return relative to gold and the dollar.
  const risk = mean([bySym(month, "BTC").returnPct, bySym(month, "NDX").returnPct, bySym(month, "SPX").returnPct]);
  const haven = mean([bySym(month, "XAU").returnPct, bySym(month, "DXY").returnPct]);
  const appetiteScore = risk - haven;
  const riskAppetite = levelFromScore(appetiteScore, [-2, 2, 6]);

  // Volatility: recent realised vol relative to its 1Y level.
  const volRatio = mean(month.map((m, i) => m.volatilityPct / Math.max(year[i].volatilityPct, 1e-6)));
  const volatility = levelFromScore(volRatio, [0.85, 1.0, 1.2]);

  const breadth = month.filter((m) => m.aboveTrend).length / month.length;
  const trend = breadth >= 0.6 ? "Positif" : breadth <= 0.35 ? "Negatif" : "Netral";
  const liquidity = volatility === "Sangat tinggi" ? "Cukup" : "Sehat";

  const summary =
    trend === "Positif"
      ? `${Math.round(breadth * 100)}% pasar yang dipantau berada di atas tren; volatilitas ${volatility.toLowerCase()} dibanding setahun terakhir.`
      : `Breadth ${Math.round(breadth * 100)}%; agen memilih posisi lebih kecil sampai tren terkonfirmasi.`;

  return { riskAppetite, volatility, liquidity, trend, summary };
}
