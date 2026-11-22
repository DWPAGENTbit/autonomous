import { BROKERS, liveTrading, pairsFor } from "@/lib/server/brokers";
import type { BrokerId } from "@/lib/server/brokers/types";
import type { BotSettings, BotState, Profile, StrategyParams, TradeMode } from "./types";

/** Three ready-made risk profiles. Every number can still be changed by hand. */
export const PROFILES: Record<Profile, StrategyParams> = {
  "hati-hati": {
    buyPct: 10,
    maxAllocPct: 40,
    takeProfitPct: 2.5,
    stepPct: 3,
    entryDipPct: 2,
    stopLossPct: 0,
    cooldownMin: 120,
    maxBuysPerDay: 2,
    crashGuardPct: 6,
    dailyLossPct: 3,
  },
  seimbang: {
    buyPct: 15,
    maxAllocPct: 60,
    takeProfitPct: 3,
    stepPct: 2.5,
    entryDipPct: 1.5,
    stopLossPct: 0,
    cooldownMin: 60,
    maxBuysPerDay: 3,
    crashGuardPct: 8,
    dailyLossPct: 5,
  },
  agresif: {
    buyPct: 20,
    maxAllocPct: 80,
    takeProfitPct: 4,
    stepPct: 2,
    entryDipPct: 1,
    stopLossPct: 0,
    cooldownMin: 30,
    maxBuysPerDay: 5,
    crashGuardPct: 10,
    dailyLossPct: 8,
  },
};

/** Smallest order each exchange accepts, in the quote currency. */
export const MIN_ORDER: Record<string, number> = { IDR: 10_000, USDT: 5 };
/** Trading fee per side used for estimates (taker, tax included). Real fills use the exchange's figures. */
export const FEE_PCT: Record<BrokerId, number> = { indodax: 0.35, tokocrypto: 0.1 };

const BOUNDS: Record<keyof StrategyParams, [number, number]> = {
  buyPct: [1, 50],
  maxAllocPct: [5, 100],
  takeProfitPct: [0.8, 50],
  stepPct: [0.5, 50],
  entryDipPct: [0, 30],
  stopLossPct: [0, 50],
  cooldownMin: [5, 1440],
  maxBuysPerDay: [1, 24],
  crashGuardPct: [2, 50],
  dailyLossPct: [0.5, 50],
};

export function defaultSettings(): BotSettings {
  return {
    auto: false,
    paper: false,
    profile: "seimbang",
    params: { ...PROFILES.seimbang },
    brokers: {
      // Indodax works on its own; Tokocrypto is optional and stays off until switched on.
      indodax: { enabled: true, pairs: pairsFor("indodax").filter((p) => p !== "usdt_idr").slice(0, 1) },
      tokocrypto: { enabled: false, pairs: pairsFor("tokocrypto").slice(0, 1) },
    },
    monthlyTargetPct: 3,
    updatedAt: 0,
  };
}

export function emptyState(): BotState {
  return { version: 1, settings: defaultSettings(), positions: {}, journal: [], months: {}, decisions: {}, lastTick: null, lock: null };
}

const clamp = (v: unknown, [lo, hi]: [number, number], fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

/** Accepts settings from storage or from the owner's form, keeping only valid values. */
export function cleanSettings(input: unknown, base: BotSettings = defaultSettings()): BotSettings {
  const raw = (input ?? {}) as Partial<BotSettings> & { params?: Partial<StrategyParams>; brokers?: Partial<Record<BrokerId, Partial<{ enabled: unknown; pairs: unknown }>>> };
  const profile: Profile = raw.profile && raw.profile in PROFILES ? raw.profile : base.profile;
  const params = { ...base.params };
  for (const k of Object.keys(BOUNDS) as (keyof StrategyParams)[]) {
    if (raw.params && k in raw.params) params[k] = clamp(raw.params[k], BOUNDS[k], base.params[k]);
  }
  params.maxBuysPerDay = Math.round(params.maxBuysPerDay);
  params.cooldownMin = Math.round(params.cooldownMin);

  const brokers = { ...base.brokers };
  for (const id of Object.keys(BROKERS) as BrokerId[]) {
    const b = raw.brokers?.[id];
    if (!b) continue;
    const allowed = pairsFor(id);
    const pairs = Array.isArray(b.pairs) ? b.pairs.filter((p): p is string => typeof p === "string" && allowed.includes(p)) : base.brokers[id].pairs;
    brokers[id] = { enabled: typeof b.enabled === "boolean" ? b.enabled : base.brokers[id].enabled, pairs: [...new Set(pairs)] };
  }

  return {
    auto: typeof raw.auto === "boolean" ? raw.auto : base.auto,
    paper: typeof raw.paper === "boolean" ? raw.paper : base.paper,
    profile,
    params,
    brokers,
    monthlyTargetPct: clamp(raw.monthlyTargetPct, [0.1, 100], base.monthlyTargetPct),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : base.updatedAt,
  };
}

/** Real orders need both the server switch (DWP_LIVE_TRADING=on) and paper mode off. */
export const tradeMode = (s: BotSettings): TradeMode => (liveTrading() && !s.paper ? "live" : "paper");

/** Exchanges the bot and the dashboard use: switched on here and with API keys on the server. */
export const activeBrokers = (s: BotSettings) => (Object.keys(BROKERS) as BrokerId[]).filter((id) => s.brokers[id].enabled && BROKERS[id].configured());

export const monthKey = (mode: TradeMode, at = Date.now()) => {
  // Months follow Jakarta time (UTC+7).
  const d = new Date(at + 7 * 3600_000);
  return `${mode}:${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Start of today in Jakarta time, as a UTC timestamp. */
export const startOfDay = (at = Date.now()) => {
  const d = new Date(at + 7 * 3600_000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 7 * 3600_000;
};

export const positionKey = (mode: TradeMode, broker: BrokerId, pair: string) => `${mode}:${broker}:${pair}`;
