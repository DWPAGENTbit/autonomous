import { INSTRUMENT_SEEDS, type InstrumentSeed } from "@/data/instruments";
import { createRng, type Rng } from "@/lib/simulation/prng";
import type { MarketSymbol, Quote, Timeframe } from "@/types/domain";

const HOURS_PER_YEAR = 24 * 365;
const FIVE_MIN_PER_YEAR = HOURS_PER_YEAR * 12;
const INTRADAY_POINTS = 24 * 12; // 5-minute bars for 24 hours
const FACTOR_COUNT = 3;
/** Live ticks are a fraction of a 5-minute move, so motion stays plausible. */
const TICK_SCALE = 0.35;

/** Hours of hourly history each timeframe covers (1D uses intraday bars). */
export const TIMEFRAME_HOURS: Record<Exclude<Timeframe, "1D">, number> = {
  "1W": 24 * 7,
  "1M": 24 * 30,
  "3M": 24 * 90,
  "1Y": HOURS_PER_YEAR,
};

export const TIMEFRAMES: readonly Timeframe[] = ["1D", "1W", "1M", "3M", "1Y"];

interface SeriesBundle {
  seed: InstrumentSeed;
  hourly: Float64Array;
  intraday: Float64Array;
  dayOpen: number;
  lastTick: -1 | 0 | 1;
}

function idiosyncraticWeight(loadings: readonly number[]): number {
  const explained = loadings.reduce((acc, l) => acc + l * l, 0);
  return Math.sqrt(Math.max(0, 1 - explained));
}

/**
 * Correlated shocks from a small factor model: global risk, crypto, US dollar.
 * Gives the correlation matrix and regime readouts real structure.
 */
function correlatedShocks(rng: Rng, seeds: readonly InstrumentSeed[]): number[] {
  const factors = Array.from({ length: FACTOR_COUNT }, () => rng.normal());
  return seeds.map((s) => {
    const common = s.loadings.reduce((acc, l, i) => acc + l * factors[i], 0);
    return common + idiosyncraticWeight(s.loadings) * rng.normal();
  });
}

const WEEK_HOURS = 24 * 7;
const MONTH_HOURS = 24 * 30;

/**
 * Bends a random walk so its trailing week and month returns hit authored
 * targets. The log-price is shifted by a piecewise-linear amount anchored at
 * now (0), one week ago and one month ago; older history shifts as a block,
 * so all noise and earlier returns are preserved.
 */
function shapeRecentReturns(
  hourly: Float64Array,
  intraday: Float64Array,
  target: { week: number; month: number },
): void {
  const end = hourly.length - 1;
  const logRet = (h: number) => Math.log(hourly[end] / hourly[end - h]);
  const a = logRet(WEEK_HOURS) - Math.log(1 + target.week);
  const b = logRet(MONTH_HOURS) - Math.log(1 + target.month);
  const shift = (hoursAgo: number) =>
    hoursAgo <= WEEK_HOURS
      ? (a * hoursAgo) / WEEK_HOURS
      : hoursAgo <= MONTH_HOURS
        ? a + ((b - a) * (hoursAgo - WEEK_HOURS)) / (MONTH_HOURS - WEEK_HOURS)
        : b;
  for (let k = 0; k <= end; k++) hourly[k] *= Math.exp(shift(end - k));
  const last = intraday.length - 1;
  for (let i = 0; i <= last; i++) intraday[i] *= Math.exp(shift((last - i) / 12));
}

/**
 * Deterministic market model. Series are generated backwards from the
 * seed price, so the latest point always equals the current quote.
 */
export class MarketModel {
  private readonly rng: Rng;
  private readonly bundles: Map<MarketSymbol, SeriesBundle>;
  private readonly seeds: readonly InstrumentSeed[];

  constructor(seed: number, seeds: readonly InstrumentSeed[] = INSTRUMENT_SEEDS) {
    this.rng = createRng(seed);
    this.seeds = seeds;
    this.bundles = new Map();
    this.generate();
  }

  private generate(): void {
    const n = this.seeds.length;
    const intraday = this.seeds.map(() => new Float64Array(INTRADAY_POINTS + 1));
    // One extra point so a one-year window has a full year of returns.
    const hourlyCount = HOURS_PER_YEAR + 1;
    const hourly = this.seeds.map(() => new Float64Array(hourlyCount));

    // Intraday, backwards from the current price.
    for (let i = 0; i < n; i++) intraday[i][INTRADAY_POINTS] = this.seeds[i].price;
    for (let k = INTRADAY_POINTS; k > 0; k--) {
      const shocks = correlatedShocks(this.rng, this.seeds);
      for (let i = 0; i < n; i++) {
        const s = this.seeds[i];
        const sigma = s.annualVol / Math.sqrt(FIVE_MIN_PER_YEAR);
        const mu = Math.log(1 + s.annualReturn) / FIVE_MIN_PER_YEAR;
        intraday[i][k - 1] = intraday[i][k] / Math.exp(mu + sigma * shocks[i]);
      }
    }

    // Hourly: last 24 points are sampled from intraday so both views agree.
    const tail = 24;
    for (let i = 0; i < n; i++) {
      for (let h = 0; h < tail; h++) {
        hourly[i][hourlyCount - tail + h] = intraday[i][(h + 1) * 12];
      }
      hourly[i][hourlyCount - tail - 1] = intraday[i][0];
    }
    for (let k = hourlyCount - tail - 1; k > 0; k--) {
      const shocks = correlatedShocks(this.rng, this.seeds);
      for (let i = 0; i < n; i++) {
        const s = this.seeds[i];
        const sigma = s.annualVol / Math.sqrt(HOURS_PER_YEAR);
        const mu = Math.log(1 + s.annualReturn) / HOURS_PER_YEAR;
        hourly[i][k - 1] = hourly[i][k] / Math.exp(mu + sigma * shocks[i]);
      }
    }

    this.seeds.forEach((s, i) => shapeRecentReturns(hourly[i], intraday[i], s.recent));

    this.seeds.forEach((s, i) => {
      this.bundles.set(s.symbol, {
        seed: s,
        hourly: hourly[i],
        intraday: intraday[i],
        dayOpen: intraday[i][0],
        lastTick: 0,
      });
    });
  }

  /** Advances every instrument by one live tick. Mutates the latest bar only. */
  tick(): Quote[] {
    const shocks = correlatedShocks(this.rng, this.seeds);
    this.seeds.forEach((s, i) => {
      const b = this.bundles.get(s.symbol)!;
      const sigma = (s.annualVol / Math.sqrt(FIVE_MIN_PER_YEAR)) * TICK_SCALE;
      const prev = b.intraday[b.intraday.length - 1];
      const next = prev * Math.exp(sigma * shocks[i]);
      b.intraday[b.intraday.length - 1] = next;
      b.hourly[b.hourly.length - 1] = next;
      b.lastTick = next > prev ? 1 : next < prev ? -1 : 0;
    });
    return this.quotes();
  }

  quotes(): Quote[] {
    return this.seeds.map((s) => this.quote(s.symbol));
  }

  quote(symbol: MarketSymbol): Quote {
    const b = this.bundles.get(symbol)!;
    return {
      symbol,
      price: b.intraday[b.intraday.length - 1],
      dayOpen: b.dayOpen,
      tick: b.lastTick,
    };
  }

  /** Raw window of prices for a timeframe (not resampled). */
  window(symbol: MarketSymbol, tf: Timeframe): Float64Array {
    const b = this.bundles.get(symbol)!;
    if (tf === "1D") return b.intraday;
    const hours = TIMEFRAME_HOURS[tf];
    return b.hourly.subarray(b.hourly.length - hours - 1);
  }

  /** Steps per year for a timeframe window's sampling, used to annualise volatility. */
  static stepsPerYear(tf: Timeframe): number {
    return tf === "1D" ? FIVE_MIN_PER_YEAR : HOURS_PER_YEAR;
  }

  /** Hourly log returns over a trailing window, for correlation. */
  logReturns(symbol: MarketSymbol, hours: number): Float64Array {
    const h = this.bundles.get(symbol)!.hourly;
    const start = h.length - hours - 1;
    const out = new Float64Array(hours);
    for (let k = 0; k < hours; k++) out[k] = Math.log(h[start + k + 1] / h[start + k]);
    return out;
  }
}
