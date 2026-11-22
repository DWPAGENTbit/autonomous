/**
 * Indonesian stocks (IDX) from Yahoo Finance's public endpoints: search and
 * delayed quotes (about 15 minutes). No account or key is needed; there is no
 * trading API for Bibit or Stockbit, so stocks are tracked, not traded, here.
 */
const UA = "Mozilla/5.0 (compatible; DWP-Earn-Money/1.0)";

export interface StockQuote {
  /** IDX code, e.g. "BBCA". */
  symbol: string;
  name: string;
  price: number;
  prevClose: number | null;
  changePct: number | null;
  /** Time of the last trade, ms. */
  at: number | null;
}

const CODE = /^[A-Z]{4}$/;

export async function searchStocks(q: string): Promise<{ symbol: string; name: string }[]> {
  const query = q.trim();
  if (!query) return [];
  const out = new Map<string, string>();
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=12&newsCount=0&lang=id-ID&region=ID`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, next: { revalidate: 3600 } });
    const data = (await res.json()) as { quotes?: { symbol?: string; exchange?: string; quoteType?: string; shortname?: string; longname?: string }[] };
    for (const r of data.quotes ?? []) {
      if (r.exchange !== "JKT" || r.quoteType !== "EQUITY" || !r.symbol?.endsWith(".JK")) continue;
      out.set(r.symbol.slice(0, -3), r.longname ?? r.shortname ?? r.symbol);
    }
  } catch {
    // Search unavailable: fall back to a typed code below.
  }
  const code = query.toUpperCase();
  if (CODE.test(code) && !out.has(code)) out.set(code, code);
  return [...out].slice(0, 8).map(([symbol, name]) => ({ symbol, name }));
}

export async function stockQuote(symbol: string): Promise<StockQuote | null> {
  if (!CODE.test(symbol)) return null;
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.JK?range=5d&interval=1d`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, next: { revalidate: 60 } });
    const data = (await res.json()) as {
      chart?: { result?: { meta?: { regularMarketPrice?: number; chartPreviousClose?: number; longName?: string; shortName?: string; regularMarketTime?: number } }[] };
    };
    const m = data.chart?.result?.[0]?.meta;
    const price = Number(m?.regularMarketPrice);
    if (!m || !(price > 0)) return null;
    const prev = Number(m.chartPreviousClose);
    return {
      symbol,
      name: m.longName ?? m.shortName ?? symbol,
      price,
      prevClose: prev > 0 ? prev : null,
      changePct: prev > 0 ? ((price - prev) / prev) * 100 : null,
      at: m.regularMarketTime ? m.regularMarketTime * 1000 : null,
    };
  } catch {
    return null;
  }
}

export async function stockQuotes(symbols: string[]): Promise<StockQuote[]> {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter((s) => CODE.test(s)))].slice(0, 30);
  const quotes = await Promise.all(unique.map(stockQuote));
  return quotes.filter((q): q is StockQuote => q !== null);
}
