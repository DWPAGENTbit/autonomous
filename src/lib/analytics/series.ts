/** Pure numeric helpers for price series. No UI, no state. */

export type NumericSeries = ArrayLike<number>;

/** Evenly resamples a series to `n` points, always keeping the final value. */
export function resample(series: NumericSeries, n: number): number[] {
  const len = series.length;
  if (len === 0) return [];
  if (len <= n) return Array.from(series);
  const out = new Array<number>(n);
  const step = (len - 1) / (n - 1);
  for (let i = 0; i < n; i++) out[i] = series[Math.round(i * step)];
  out[n - 1] = series[len - 1];
  return out;
}

export function pctChange(from: number, to: number): number {
  return from === 0 ? 0 : ((to - from) / from) * 100;
}

export function mean(xs: NumericSeries): number {
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i];
  return xs.length ? s / xs.length : 0;
}

export function stdev(xs: NumericSeries): number {
  const m = mean(xs);
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += (xs[i] - m) ** 2;
  return xs.length > 1 ? Math.sqrt(s / (xs.length - 1)) : 0;
}

/** Annualised realised volatility in percent. */
export function realisedVolPct(series: NumericSeries, stepsPerYear: number): number {
  if (series.length < 3) return 0;
  const rets = new Float64Array(series.length - 1);
  for (let i = 1; i < series.length; i++) rets[i - 1] = Math.log(series[i] / series[i - 1]);
  return stdev(rets) * Math.sqrt(stepsPerYear) * 100;
}

export function pearson(a: NumericSeries, b: NumericSeries): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
}

export function extent(xs: NumericSeries): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] < lo) lo = xs[i];
    if (xs[i] > hi) hi = xs[i];
  }
  return [lo, hi];
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
