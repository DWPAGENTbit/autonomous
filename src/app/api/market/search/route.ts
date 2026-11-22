import { guard, json } from "@/lib/server/http";
import { idrTickers, type Ticker } from "@/lib/server/market";
import { searchStocks, stockQuote, type StockQuote } from "@/lib/server/stocks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

/** Search every Indodax rupiah market and IDX stocks by code or name. */
export async function GET(req: Request) {
  const denied = await guard(req);
  if (denied) return denied;
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 40);
  const needle = q.toLowerCase();

  let crypto: Ticker[] = [];
  let cryptoError: string | undefined;
  try {
    const all = [...(await idrTickers()).values()];
    const score = (t: Ticker) => {
      const a = t.asset.toLowerCase();
      const n = t.name.toLowerCase();
      if (!needle) return 1;
      if (a === needle) return 4;
      if (a.startsWith(needle)) return 3;
      if (n.startsWith(needle)) return 2;
      return a.includes(needle) || n.includes(needle) ? 1 : 0;
    };
    crypto = all
      .map((t) => ({ t, s: score(t) }))
      .filter((x) => x.s > 0)
      .sort((x, y) => y.s - x.s || y.t.volIdr - x.t.volIdr)
      .slice(0, 15)
      .map((x) => x.t);
  } catch {
    cryptoError = "Harga Indodax tidak bisa diambil saat ini.";
  }

  let stocks: StockQuote[] = [];
  if (q) {
    const found = await searchStocks(q);
    stocks = (await Promise.all(found.map(async (f) => (await stockQuote(f.symbol)) ?? null))).filter((x): x is StockQuote => x !== null);
  }

  return json({ q, crypto, cryptoError, stocks });
}
