import { timingSafeEqual, createHash } from "node:crypto";
import { BROKERS, liveTrading, pairsFor } from "@/lib/server/brokers";
import type { BrokerId } from "@/lib/server/brokers/types";
import { idrTickers } from "@/lib/server/market";
import { activeBrokers, FEE_PCT, MIN_ORDER, monthKey, PROFILES, tradeMode } from "./settings";
import { loadState, storageKind, type StorageKind } from "./store";
import type { BotSettings, BotState, JournalEntry, LastDecision, MonthStats, Position, Profile, StrategyParams, TradeMode } from "./types";

export interface PositionView extends Position {
  price: number | null;
  value: number | null;
  /** Result if sold now, after fees, in %. */
  netPct: number | null;
}

export interface BotView {
  settings: BotSettings;
  profiles: Record<Profile, StrategyParams>;
  mode: TradeMode;
  /** DWP_LIVE_TRADING=on on the server. */
  liveSwitch: boolean;
  storage: StorageKind;
  /** True on Vercel; local development may run without storage. */
  hosted: boolean;
  /** CRON_SECRET set, so the schedule can run the bot without the app open. */
  scheduled: boolean;
  lastTick: BotState["lastTick"];
  brokers: { id: BrokerId; name: string; configured: boolean; enabled: boolean; pairs: string[]; selected: string[]; feePct: number }[];
  minOrder: Record<string, number>;
  /** Working capital per quote currency on active exchanges: free cash + bot cost in coins. */
  capital: Record<string, number>;
  month: MonthStats & { key: string };
  positions: PositionView[];
  decisions: LastDecision[];
  journal: JournalEntry[];
}

/** Checks `Authorization: Bearer <CRON_SECRET>` from the scheduler (Vercel Cron or GitHub Actions). */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret || secret.length < 16 || !header.startsWith("Bearer ")) return false;
  const a = createHash("sha256").update(header.slice(7)).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

export async function botView(): Promise<BotView> {
  const { state } = await loadState(20_000);
  const s = state.settings;
  const mode = tradeMode(s);
  const active = activeBrokers(s);

  const tickers = await idrTickers().catch(() => null);
  const priceOf = async (broker: BrokerId, pair: string) => {
    const [base, quote] = BROKERS[broker].split(pair);
    if (broker === "indodax" && quote === "IDR" && tickers?.get(base)) return tickers.get(base)!.last;
    return BROKERS[broker].price(pair);
  };

  const positions: PositionView[] = await Promise.all(
    Object.values(state.positions)
      .filter((p) => p.mode === mode)
      .map(async (p) => {
        const price = await priceOf(p.broker, p.pair).catch(() => null);
        const value = price ? p.qty * price : null;
        const netPct = price && p.qty > 0 ? ((price * (1 - FEE_PCT[p.broker] / 100) - p.cost / p.qty) / (p.cost / p.qty)) * 100 : null;
        return { ...p, price, value, netPct };
      }),
  );

  // Working capital: what the bot could use on the active exchanges.
  const capital: Record<string, number> = {};
  await Promise.all(
    active.map(async (id) => {
      const quotes = new Set(s.brokers[id].pairs.map((p) => BROKERS[id].split(p)[1]));
      const balances = await BROKERS[id].balances().catch(() => []);
      for (const q of quotes) {
        const cash = balances.find((b) => b.asset === q)?.free ?? 0;
        const invested = positions.filter((p) => p.broker === id && BROKERS[id].split(p.pair)[1] === q).reduce((sum, p) => sum + p.cost, 0);
        capital[q] = (capital[q] ?? 0) + (mode === "live" ? cash + invested : cash);
      }
    }),
  );

  const key = monthKey(mode);
  return {
    settings: s,
    profiles: PROFILES,
    mode,
    liveSwitch: liveTrading(),
    storage: storageKind(),
    hosted: process.env.VERCEL === "1",
    scheduled: Boolean(process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 16),
    lastTick: state.lastTick,
    brokers: (Object.keys(BROKERS) as BrokerId[]).map((id) => ({
      id,
      name: BROKERS[id].name,
      configured: BROKERS[id].configured(),
      enabled: s.brokers[id].enabled,
      pairs: pairsFor(id),
      selected: s.brokers[id].pairs,
      feePct: FEE_PCT[id],
    })),
    minOrder: MIN_ORDER,
    capital,
    month: { key, ...(state.months[key] ?? { realized: {}, trades: 0, wins: 0 }) },
    positions,
    decisions: Object.values(state.decisions)
      .filter((d) => d.mode === mode && active.includes(d.broker) && s.brokers[d.broker].pairs.includes(d.pair))
      .sort((a, b) => b.at - a.at),
    journal: state.journal.filter((j) => j.mode === mode).slice(0, 40),
  };
}
