/** Live market data from Indodax's public API (no key needed). Prices are in IDR. */
export interface Ticker {
  pair: string; // e.g. "btc_idr"
  asset: string; // e.g. "BTC"
  name: string;
  last: number;
  high: number;
  low: number;
  volIdr: number;
  change24hPct: number | null;
  change7dPct: number | null;
}

interface Summaries {
  tickers: Record<string, { last: string; high: string; low: string; name?: string; vol_idr?: string }>;
  prices_24h: Record<string, string>;
  prices_7d: Record<string, string>;
}

const pct = (now: number, then: number) => (then > 0 ? ((now - then) / then) * 100 : null);

/** All IDR tickers, keyed by asset symbol. Cached for 20 seconds across requests. */
export async function idrTickers(): Promise<Map<string, Ticker>> {
  const res = await fetch("https://indodax.com/api/summaries", { next: { revalidate: 20 } });
  if (!res.ok) throw new Error(`Indodax summaries HTTP ${res.status}`);
  const data = (await res.json()) as Summaries;
  const out = new Map<string, Ticker>();
  for (const [pair, t] of Object.entries(data.tickers)) {
    if (!pair.endsWith("_idr")) continue;
    const key = pair.replace("_", "");
    const last = Number(t.last);
    if (!Number.isFinite(last) || last <= 0) continue;
    const asset = pair.slice(0, -4).toUpperCase();
    out.set(asset, {
      pair,
      asset,
      name: t.name ?? asset,
      last,
      high: Number(t.high) || last,
      low: Number(t.low) || last,
      volIdr: Number(t.vol_idr) || 0,
      change24hPct: pct(last, Number(data.prices_24h[key])),
      change7dPct: pct(last, Number(data.prices_7d[key])),
    });
  }
  return out;
}
