import { randomUUID } from "node:crypto";
import { BROKERS, executeOrder, limitFor, pairsFor } from "@/lib/server/brokers";
import { BrokerError, type BrokerId, type Fill } from "@/lib/server/brokers/types";
import { idrTickers, type Ticker } from "@/lib/server/market";
import { activeBrokers, FEE_PCT, MIN_ORDER, monthKey, positionKey, startOfDay, tradeMode } from "./settings";
import { decide, type Decision, type MarketView } from "./strategy";
import { loadState, saveState, updateState } from "./store";
import type { AgentStep, BotState, JournalEntry, LastDecision, Position, TradeMode } from "./types";

/** Idle checks are written at most this often, to keep storage writes low. */
const HEARTBEAT_MS = 55 * 60_000;
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

/**
 * One pass of the autonomous agent: for every active exchange and pair, look at the
 * market and the bot's own position, decide, and — within the risk limits — trade.
 * Safe to call often: orders are only sent under a storage lock, and every decision
 * is checked again by the exchange layer (allowed pairs, per-order cap, live switch).
 */
export async function runTick(by: string): Promise<TickResult> {
  const now = Date.now();
  const snap = await loadState();
  const state = snap.state;
  const s = state.settings;

  if (!s.auto) return { ran: false, actions: 0, message: "Mode otomatis sedang mati.", decisions: [] };
  const mode = tradeMode(s);
  const brokers = activeBrokers(s);
  if (!brokers.length) return { ran: false, mode, actions: 0, message: "Tidak ada bursa aktif yang punya kunci API.", decisions: [] };

  let tickers = new Map<string, Ticker>();
  if (brokers.includes("indodax")) tickers = await idrTickers().catch(() => tickers);

  const decisions: LastDecision[] = [];
  const plans: Plan[] = [];
  const fixes: Effect[] = [];
  const dayStart = startOfDay(now);

  for (const id of brokers) {
    const broker = BROKERS[id];
    const pairs = s.brokers[id].pairs.filter((p) => pairsFor(id).includes(p));
    let balances: { asset: string; free: number; locked: number }[];
    try {
      balances = await broker.balances();
    } catch (e) {
      const msg = e instanceof BrokerError ? e.message : "bursa tidak bisa dihubungi";
      for (const pair of pairs) {
        decisions.push({ at: now, mode, broker: id, pair, action: "hold", steps: [{ agent: "Pemindai", text: `Gagal membaca saldo ${broker.name}: ${msg}` }] });
      }
      continue;
    }
    const free = (asset: string) => balances.find((b) => b.asset === asset)?.free ?? 0;
    const total = (asset: string) => {
      const b = balances.find((x) => x.asset === asset);
      return b ? b.free + b.locked : 0;
    };

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

      let position: Position | null = state.positions[key] ?? null;
      // Live: if the owner sold some of the bot's coins by hand, follow the real balance.
      if (position && mode === "live" && total(base) < position.qty * 0.98) {
        const qty = round8(total(base));
        const cost = position.qty > 0 ? position.cost * (qty / position.qty) : 0;
        position = qty * market.price >= 1 ? { ...position, qty, cost } : null;
        const fixed = position;
        fixes.push((st) => {
          if (fixed) st.positions[key] = fixed;
          else delete st.positions[key];
        });
      }

      if (!budget.has(quote)) {
        const real = free(quote);
        budget.set(quote, mode === "live" ? real : Math.max(0, real - invested(quote)));
      }
      const today = state.journal.filter((j) => j.mode === mode && j.broker === id && j.at >= dayStart && j.ok);
      const minOrder = MIN_ORDER[quote] ?? 0;
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
      });
      decisions.push({ at: now, mode, broker: id, pair, action: decision.action, steps: decision.steps });
      if (decision.action === "hold") continue;
      if (decision.action === "buy") budget.set(quote, budget.get(quote)! - decision.quote);
      plans.push({ broker: id, pair, base, quote, price: market.price, feePct: FEE_PCT[id], minOrder, position, decision });
    }
  }

  const summary = `${decisions.length} pasangan dicek · ${plans.length ? `${plans.length} order` : "tidak ada order"}`;
  const record: Effect = (st) => {
    for (const d of decisions) st.decisions[positionKey(d.mode, d.broker, d.pair)] = d;
    st.lastTick = { at: now, by, summary };
  };

  // Nothing to trade: write only now and then.
  if (!plans.length) {
    if (fixes.length || !state.lastTick || now - state.lastTick.at > HEARTBEAT_MS) {
      for (const f of [...fixes, record]) f(state);
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

  const effects: Effect[] = [...fixes];
  try {
    for (const plan of plans) effects.push(await execute(plan, mode, now));
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
async function execute(plan: Plan, mode: TradeMode, now: number): Promise<Effect> {
  const { broker, pair, base, quote, price, feePct, decision } = plan;
  const key = positionKey(mode, broker, pair);
  const id = randomUUID();
  const steps: AgentStep[] = decision.steps;
  const fee = feePct / 100;

  let fill: Fill | undefined;
  let message: string;
  if (decision.action === "buy") {
    if (mode === "live") {
      const res = await executeOrder(BROKERS[broker], { pair, side: "buy", amount: decision.quote });
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
    const res = await executeOrder(BROKERS[broker], { pair, side: "sell", amount: qty });
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
