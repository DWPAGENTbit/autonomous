import { BROKERS, liveTrading } from "@/lib/server/brokers";
import { BrokerError, type BrokerId } from "@/lib/server/brokers/types";
import { idrTickers, type Ticker } from "@/lib/server/market";
import { SETTINGS_MAX_AGE, loadState } from "@/lib/server/bot/store";

export interface Holding {
  broker: BrokerId;
  asset: string;
  amount: number;
  /** Price per unit in IDR, or null if no IDR market exists for it. */
  priceIdr: number | null;
  valueIdr: number;
  change24hPct: number | null;
  change7dPct: number | null;
}

export interface RealPortfolio {
  at: number;
  live: boolean;
  connected: BrokerId[];
  totalIdr: number;
  /** Value change if today's holdings were held for the last 24h / 7d (mark-to-market). */
  change24hIdr: number;
  change24hPct: number | null;
  change7dIdr: number;
  change7dPct: number | null;
  cashIdr: number;
  holdings: Holding[];
  errors: string[];
}

/** Rupiah and stablecoins count as cash. */
const CASH = new Set(["IDR", "USDT", "USDC"]);

function value(t: Ticker | undefined, asset: string, amount: number) {
  if (asset === "IDR") return { priceIdr: 1, valueIdr: amount, change24hPct: 0, change7dPct: 0 };
  if (!t) return { priceIdr: null, valueIdr: 0, change24hPct: null, change7dPct: null };
  return { priceIdr: t.last, valueIdr: amount * t.last, change24hPct: t.change24hPct, change7dPct: t.change7dPct };
}

/** What the change percentage implies the value was `pct`% ago. */
const before = (now: number, pct: number | null) => (pct === null || pct <= -100 ? now : now / (1 + pct / 100));

/** Every connected exchange account, valued in rupiah at live Indodax prices. */
export async function realPortfolio(): Promise<RealPortfolio> {
  const errors: string[] = [];
  let tickers = new Map<string, Ticker>();
  try {
    tickers = await idrTickers();
  } catch {
    errors.push("Harga pasar Indodax tidak bisa diambil saat ini.");
  }

  const { state } = await loadState(SETTINGS_MAX_AGE).catch(() => ({ state: null }));
  const enabled = (id: BrokerId) => state?.settings.brokers[id].enabled ?? id === "indodax";
  const connected = Object.values(BROKERS).filter((b) => b.configured() && enabled(b.id));
  const holdings: Holding[] = [];
  await Promise.all(
    connected.map(async (b) => {
      try {
        for (const bal of await b.balances()) {
          const amount = bal.free + bal.locked;
          if (amount <= 0) continue;
          holdings.push({ broker: b.id, asset: bal.asset, amount, ...value(tickers.get(bal.asset), bal.asset, amount) });
        }
      } catch (e) {
        errors.push(e instanceof BrokerError ? `${b.name}: ${e.message}` : `${b.name} tidak bisa dihubungi.`);
      }
    }),
  );
  holdings.sort((a, b) => b.valueIdr - a.valueIdr);

  const totalIdr = holdings.reduce((s, h) => s + h.valueIdr, 0);
  const total24hAgo = holdings.reduce((s, h) => s + before(h.valueIdr, h.change24hPct), 0);
  const total7dAgo = holdings.reduce((s, h) => s + before(h.valueIdr, h.change7dPct), 0);
  const cashIdr = holdings.filter((h) => CASH.has(h.asset)).reduce((s, h) => s + h.valueIdr, 0);

  return {
    at: Date.now(),
    live: liveTrading(),
    connected: connected.map((b) => b.id),
    totalIdr,
    change24hIdr: totalIdr - total24hAgo,
    change24hPct: total24hAgo > 0 ? ((totalIdr - total24hAgo) / total24hAgo) * 100 : null,
    change7dIdr: totalIdr - total7dAgo,
    change7dPct: total7dAgo > 0 ? ((totalIdr - total7dAgo) / total7dAgo) * 100 : null,
    cashIdr,
    holdings,
    errors,
  };
}

/** Large, liquid coins shown first on the price board. */
const MAJORS = ["BTC", "ETH", "USDT", "SOL", "XRP", "BNB", "DOGE", "ADA", "TRX", "LINK", "TON", "SUI"];

/** The main IDR markets for a live price board — majors first, then other liquid pairs (no micro-caps). */
export async function topMarkets(limit = 12): Promise<Ticker[]> {
  const t = await idrTickers();
  const head = MAJORS.map((s) => t.get(s)).filter((x): x is Ticker => Boolean(x));
  const rest = [...t.values()]
    .filter((x) => !MAJORS.includes(x.asset) && x.volIdr >= 1_000_000_000 && x.last >= 100)
    .sort((a, b) => b.volIdr - a.volIdr);
  return [...head, ...rest].slice(0, limit);
}
