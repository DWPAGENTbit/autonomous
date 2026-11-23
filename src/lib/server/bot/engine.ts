import { randomUUID } from "node:crypto";
import { BROKERS, executeOrder, limitFor } from "@/lib/server/brokers";
import type { BrokerId, Fill } from "@/lib/server/brokers/types";
import { idrTickers, type Ticker } from "@/lib/server/market";
import { activeBrokers, allowedPairs, FEE_PCT, isStablePair, MIN_ORDER, monthKey, positionKey, startOfDay, tradeMode } from "./settings";
import { decide, type Decision, type MarketView } from "./strategy";
import { loadState, saveState, updateState } from "./store";
import type { AgentStep, BotState, JournalEntry, LastDecision, Position, TradeMode } from "./types";

/** Idle checks are saved only this often; enough to show the bot and its schedule are alive. */
const HEARTBEAT_MS = 60 * 60_000;
/** Runs by the 15-minute schedule are labelled with this. */
export const SCHEDULE = "jadwal";
/** A run holding the lock longer than this is considered dead. */
const LOCK_MS = 90_000;

export interface TickResult {
  ran: boolean;
  mode?: TradeMode;
  actions: number;
  message: string;
  decisions: LastDecision[];
}

type Effect = (s: BotState) => void;

interface Plan {
  broker: BrokerId;
  pair: string;
  base: string;
  quote: string;
  price: number;
  feePct: number;
  minOrder: number;
  position: Position | null;
  decision: Exclude<Decision, { action: "hold" }>;
}

async function tokocryptoMarket(pair: string): Promise<MarketView | null> {
  try {
    const res = await fetch(`https://www.tokocrypto.site/api/v3/ticker/24hr?symbol=${pair.replace("_", "")}`, { cache: "no-store" });
    const j = (await res.json()) as { lastPrice?: string; priceChangePercent?: string; highPrice?: string; lowPrice?: string };
    const price = Number(j.lastPrice);
    if (!(price > 0)) return null;
    const change = Number(j.priceChangePercent);
    return {
      price,
      change24hPct: Number.isFinite(change) ? change : null,
      high24h: Number(j.highPrice) || null,
      low24h: Number(j.lowPrice) || null,
    };
  } catch {
    return null;
  }
}

async function marketFor(broker: BrokerId, pair: string, tickers: Map<string, Ticker>): Promise<MarketView | null> {
  if (broker === "tokocrypto") return tokocryptoMarket(pair);
  const [base, quote] = BROKERS.indodax.split(pair);
  const t = quote === "IDR" ? tickers.get(base) : undefined;
  if (t) return { price: t.last, change24hPct: t.change24hPct, high24h: t.high, low24h: t.low };
  const price = await BROKERS.indodax.price(pair);
  return price ? { price, change24hPct: null, high24h: null, low24h: null } : null;
}

const round8 = (v: number) => Math.floor(v * 1e8) / 1e8;

type Balances = { asset: string; free: number; locked: number }[];

/** Most traded Indodax IDR markets the bot may pick by itself (stablecoins left out). */
const AUTO_PICK = 6;
const AUTO_MIN_VOLUME_IDR = 2_000_000_000;

export function autoPicked(tickers: Map<string, Ticker>): string[] {
  return (
    [...tickers.values()]
      .filter((t) => !isStablePair(t.pair) && t.volIdr >= AUTO_MIN_VOLUME_IDR)
      .sort((a, b) => b.volIdr - a.volIdr)
      .slice(0, AUTO_PICK)
      // Deepest fall first, so the best entry gets the money when several want to buy.
      .sort((a, b) => (a.change24hPct ?? 0) - (b.change24hPct ?? 0))
      .map((t) => t.pair)
  );
}

/**
 * Keeps the bot's records true to the exchange: when the real balance of a coin is
 * below what the bot thinks it holds (the owner sold it on Indodax or in the app),
 * the position shrinks or closes and the journal says so. Runs on every check, even
 * with the master switch off. Live money only; returns how many positions changed.
 */
export async function syncPositions(
  state: BotState,
  mode: TradeMode,
  now: number,
  balancesOf: (id: BrokerId) => Promise<Balances | null>,
  tickers: Map<string, Ticker> | null,
): Promise<number> {
  if (mode !== "live") return 0;
  let changed = 0;
  for (const [key, p] of Object.entries(state.positions)) {
    if (p.mode !== "live" || !BROKERS[p.broker].configured()) continue;
    const balances = await balancesOf(p.broker);
    if (!balances) continue;
    const [base, quote] = BROKERS[p.broker].split(p.pair);
    const b = balances.find((x) => x.asset === base);
    const real = b ? b.free + b.locked : 0;
    if (real >= p.qty * 0.98) continue;

    const fromTicker = p.broker === "indodax" && quote === "IDR" ? tickers?.get(base)?.last : undefined;
    const price = fromTicker ?? (await BROKERS[p.broker].price(p.pair).catch(() => null)) ?? p.lastBuyPrice;
    const qty = round8(Math.max(0, real));
    const sold = round8(p.qty - qty);
    const costPart = p.cost * (sold / p.qty);
    const proceeds = sold * price * (1 - FEE_PCT[p.broker] / 100);
    const keep = qty * price >= (MIN_ORDER[quote] ?? 0) * 0.05;
    if (keep) state.positions[key] = { ...p, qty, cost: p.cost - costPart };
    else delete state.positions[key];

    const amount = quote === "IDR" ? `Rp${Math.round(proceeds).toLocaleString("id-ID")}` : `${proceeds.toFixed(2)} ${quote}`;
    state.journal.unshift({
      id: randomUUID(),
      at: now,
      mode,
      broker: p.broker,
      pair: p.pair,
      action: "sell",
      ok: true,
      external: true,
      price,
      qty: sold,
      quote: proceeds,
      pnl: proceeds - costPart,
      message: `Dijual di luar bot: saldo ${base} di ${BROKERS[p.broker].name} tinggal ${qty}, padahal bot mencatat ${p.qty}. Catatan bot disesuaikan${keep ? "" : " dan posisinya ditutup"}. Nilai ± ${amount} dihitung dengan harga sekarang (perkiraan, tidak masuk cuan bot).`,
      steps: [{ agent: "Pemindai", text: `Saldo nyata ${base} lebih kecil dari catatan bot: terjual di luar bot.` }],
    });
    changed++;
  }
  return changed;
}

/**
 * One pass of the autonomous agent: first make the records match the exchange, then
 * for every active exchange look at the chosen pairs, the coins the bot picked itself
 * and the coins it holds, decide, and — within the risk limits — trade.
 * Safe to call often: orders are only sent under a storage lock, and every decision
 * is checked again by the exchange layer (allowed pairs, per-order cap, live switch).
 */
export async function runTick(by: string): Promise<TickResult> {
  const now = Date.now();
  const snap = await loadState();
  const state = snap.state;
  const s = state.settings;
  const mode = tradeMode(s);

  // Even while off, note now and then that the schedule is alive.
  const stale = (at: number | null | undefined) => !at || now - at > HEARTBEAT_MS;
  const heartbeatDue = stale(state.lastTick?.at) || (by === SCHEDULE && stale(state.lastScheduledAt));
  const mark = (st: BotState, summary: string) => {
    st.lastTick = { at: now, by, summary };
    if (by === SCHEDULE) st.lastScheduledAt = now;
  };

  // Balances are read once per exchange per run.
  const balanceCache = new Map<BrokerId, Promise<Balances | null>>();
  const balancesOf = (id: BrokerId) => {
    if (!balanceCache.has(id)) balanceCache.set(id, BROKERS[id].balances().catch(() => null));
    return balanceCache.get(id)!;
  };
  const brokers = activeBrokers(s);
  const needTickers = brokers.includes("indodax") || Object.values(state.positions).some((p) => p.broker === "indodax");
  const tickers = needTickers ? await idrTickers().catch(() => new Map<string, Ticker>()) : new Map<string, Ticker>();

  // First, make the records match what is really on the exchange.
  const synced = await syncPositions(state, mode, now, balancesOf, tickers);
  const syncNote = synced ? ` · ${synced} posisi disesuaikan dengan saldo` : "";

  const idle = async (message: string): Promise<TickResult> => {
    if (heartbeatDue || synced) {
      mark(state, message + syncNote);
      await saveState(state, snap.etag).catch(() => null);
    }
    return { ran: false, mode, actions: 0, message: message + syncNote, decisions: [] };
  };

  if (!s.auto) return idle("Mode otomatis sedang mati.");
  if (!brokers.length) return idle("Tidak ada bursa aktif yang punya kunci API.");

  const decisions: LastDecision[] = [];
  const plans: Plan[] = [];
  const allowedFor = new Map<BrokerId, string[]>();
  const scanned: string[] = [];
  const dayStart = startOfDay(now);

  for (const id of brokers) {
    const broker = BROKERS[id];
    const allowed = allowedPairs(id, s);
    const chosen = s.brokers[id].pairs.filter((p) => allowed.includes(p));
    const picked = id === "indodax" && s.autoPairs ? autoPicked(tickers) : [];
    // Coins the bot holds are always looked after, even when no longer chosen.
    const held = Object.values(state.positions)
      .filter((p) => p.mode === mode && p.broker === id)
      .map((p) => p.pair);
    const pairs = [...new Set([...chosen, ...picked, ...held])];
    allowedFor.set(id, [...new Set([...allowed, ...picked, ...held])]);
    for (const pair of pairs) if (!chosen.includes(pair)) scanned.push(`${id}:${pair}`);

    const balances = await balancesOf(id);
    if (!balances) {
      for (const pair of pairs) {
        decisions.push({ at: now, mode, broker: id, pair, action: "hold", steps: [{ agent: "Pemindai", text: `Gagal membaca saldo ${broker.name}. Dicoba lagi pada cek berikutnya.` }] });
      }
      continue;
    }
    const free = (asset: string) => balances.find((b) => b.asset === asset)?.free ?? 0;

    // Spending budget per quote currency, shared by this exchange's pairs within one run.
    const budget = new Map<string, number>();
    const invested = (quote: string) =>
      Object.values(state.positions)
        .filter((p) => p.mode === mode && p.broker === id && broker.split(p.pair)[1] === quote)
        .reduce((sum, p) => sum + p.cost, 0);

    for (const pair of pairs) {
      const [base, quote] = broker.split(pair);
      const key = positionKey(mode, id, pair);
      const market = await marketFor(id, pair, tickers);
      if (!market) {
        decisions.push({ at: now, mode, broker: id, pair, action: "hold", steps: [{ agent: "Pemindai", text: `Harga ${base}/${quote} tidak bisa diambil saat ini.` }] });
        continue;
      }
      const position: Position | null = state.positions[key] ?? null;

      if (!budget.has(quote)) {
        const real = free(quote);
        budget.set(quote, mode === "live" ? real : Math.max(0, real - invested(quote)));
      }
      const today = state.journal.filter((j) => j.mode === mode && j.broker === id && j.at >= dayStart && j.ok && !j.external);
      const minOrder = MIN_ORDER[quote] ?? 0;
      const stable = isStablePair(pair);
      const decision = decide({
        base,
        quote,
        market,
        position,
        freeQuote: budget.get(quote)!,
        freeBase: mode === "live" ? free(base) : (position?.qty ?? 0),
        investedQuote: invested(quote),
        params: s.params,
        minOrder,
        maxOrder: limitFor(quote),
        feePct: FEE_PCT[id],
        buysToday: today.filter((j) => j.pair === pair && j.action === "buy").length,
        lossToday: -today.filter((j) => j.action === "sell" && (j.pnl ?? 0) < 0).reduce((sum, j) => sum + (j.pnl ?? 0), 0),
        now,
        sellOnly: stable || !(chosen.includes(pair) || picked.includes(pair)),
        stable,
      });
      decisions.push({ at: now, mode, broker: id, pair, action: decision.action, steps: decision.steps });
      if (decision.action === "hold") continue;
      if (decision.action === "buy") budget.set(quote, budget.get(quote)! - decision.quote);
      plans.push({ broker: id, pair, base, quote, price: market.price, feePct: FEE_PCT[id], minOrder, position, decision });
    }
  }

  const summary = `${decisions.length} pasangan dicek · ${plans.length ? `${plans.length} order` : "tidak ada order"}${syncNote}`;
  const record: Effect = (st) => {
    for (const d of decisions) st.decisions[positionKey(d.mode, d.broker, d.pair)] = d;
    st.scan = { at: now, pairs: scanned };
    mark(st, summary);
  };

  // Nothing to trade: write only now and then.
  if (!plans.length) {
    if (synced || heartbeatDue) {
      record(state);
      await saveState(state, snap.etag).catch(() => null);
    }
    return { ran: true, mode, actions: 0, message: summary, decisions };
  }

  // Take the lock before any order leaves; a conflict means another run is busy.
  if (state.lock && state.lock.until > now) return { ran: false, mode, actions: 0, message: "Run lain sedang mengirim order.", decisions };
  const lockId = randomUUID();
  state.lock = { id: lockId, until: now + LOCK_MS };
  const locked = await saveState(state, snap.etag);
  if (!locked) return { ran: false, mode, actions: 0, message: "Run lain baru saja mengubah data bot.", decisions };

  const effects: Effect[] = [];
  try {
    for (const plan of plans) effects.push(await execute(plan, mode, now, allowedFor.get(plan.broker) ?? allowedPairs(plan.broker, s)));
  } finally {
    // Always record what was sent and release the lock, even if a later order failed.
    await updateState((st) => {
      for (const f of effects) f(st);
      record(st);
      if (st.lock?.id === lockId) st.lock = null;
    });
  }
  return { ran: true, mode, actions: plans.length, message: summary, decisions };
}

/** Sends (or, in paper mode, simulates) one order and returns how to record it. */
async function execute(plan: Plan, mode: TradeMode, now: number, allowed: string[]): Promise<Effect> {
  const { broker, pair, base, quote, price, feePct, decision } = plan;
  const key = positionKey(mode, broker, pair);
  const id = randomUUID();
  const steps: AgentStep[] = decision.steps;
  const fee = feePct / 100;

  let fill: Fill | undefined;
  let message: string;
  if (decision.action === "buy") {
    if (mode === "live") {
      const res = await executeOrder(BROKERS[broker], { pair, side: "buy", amount: decision.quote }, allowed);
      if (!res.ok) return failed(res.message);
      fill = res.fill ?? { base: (decision.quote * (1 - fee)) / price, quote: decision.quote };
      message = res.message;
    } else {
      fill = { base: (decision.quote * (1 - fee)) / price, quote: decision.quote };
      message = "Mode uji: dicatat dengan harga pasar, tidak dikirim ke bursa.";
    }
    const f = fill;
    return (st) => {
      const p = st.positions[key];
      st.positions[key] = {
        mode,
        broker,
        pair,
        qty: round8((p?.qty ?? 0) + f.base),
        cost: (p?.cost ?? 0) + f.quote,
        lastBuyPrice: f.quote / f.base,
        lastBuyAt: now,
        openedAt: p?.openedAt ?? now,
        buys: (p?.buys ?? 0) + 1,
      };
      st.journal.unshift({ id, at: now, mode, broker, pair, action: "buy", ok: true, price: f.quote / f.base, qty: f.base, quote: f.quote, message, steps });
    };
  }

  const qty = round8(decision.qty);
  if (mode === "live") {
    const res = await executeOrder(BROKERS[broker], { pair, side: "sell", amount: qty }, allowed);
    if (!res.ok) return failed(res.message);
    fill = res.fill ?? { base: qty, quote: qty * price * (1 - fee) };
    message = res.message;
  } else {
    fill = { base: qty, quote: qty * price * (1 - fee) };
    message = "Mode uji: dicatat dengan harga pasar, tidak dikirim ke bursa.";
  }
  const f = fill;
  return (st) => {
    const p = st.positions[key];
    const held = p?.qty ?? f.base;
    const costPart = p ? p.cost * Math.min(1, f.base / held) : 0;
    const pnl = f.quote - costPart;
    const left = round8(held - f.base);
    if (p && left * price >= plan.minOrder * 0.05) st.positions[key] = { ...p, qty: left, cost: p.cost - costPart };
    else delete st.positions[key];

    const mk = monthKey(mode, now);
    const m = st.months[mk] ?? { realized: {}, trades: 0, wins: 0 };
    m.realized[quote] = (m.realized[quote] ?? 0) + pnl;
    m.trades += 1;
    if (pnl > 0) m.wins += 1;
    st.months[mk] = m;
    st.journal.unshift({ id, at: now, mode, broker, pair, action: "sell", ok: true, price: f.quote / f.base, qty: f.base, quote: f.quote, pnl, message, steps });
  };

  function failed(msg: string): Effect {
    return (st) => {
      st.journal.unshift({
        id,
        at: now,
        mode,
        broker,
        pair,
        action: "error",
        ok: false,
        message: `${decision.action === "buy" ? "Beli" : "Jual"} ${base}/${quote} gagal: ${msg}`,
        steps,
      });
    };
  }
}

/** Right after a hand-placed order: bring the bot's records in line with the exchange at once. */
export async function syncNow(): Promise<void> {
  for (let tries = 0; tries < 3; tries++) {
    const snap = await loadState();
    const mode = tradeMode(snap.state.settings);
    const brokers = new Set(Object.values(snap.state.positions).map((p) => p.broker));
    if (mode !== "live" || !brokers.size) return;
    const tickers = brokers.has("indodax") ? await idrTickers().catch(() => null) : null;
    const changed = await syncPositions(snap.state, mode, Date.now(), (id) => BROKERS[id].balances().catch(() => null), tickers);
    if (!changed || (await saveState(snap.state, snap.etag))) return;
  }
}
