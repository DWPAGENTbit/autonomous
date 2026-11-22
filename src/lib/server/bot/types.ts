import type { BrokerId } from "@/lib/server/brokers/types";

/** live = real orders on the exchange; paper = same decisions at real prices, nothing sent. */
export type TradeMode = "live" | "paper";

export type Profile = "hati-hati" | "seimbang" | "agresif";

export interface StrategyParams {
  /** Size of one buy, as % of the capital the bot may work with. */
  buyPct: number;
  /** Most of that capital the bot may have in coins at once, in %. */
  maxAllocPct: number;
  /** Sell everything the bot bought once it is this % above its average price, after fees. */
  takeProfitPct: number;
  /** Buy more only after the price falls this % below the bot's last buy. */
  stepPct: number;
  /** First buy only after a dip of this % in 24 hours (or near the 24h low). */
  entryDipPct: number;
  /** Sell at a loss once this % below the average price; 0 = never. */
  stopLossPct: number;
  /** Minutes between buys of the same pair. */
  cooldownMin: number;
  /** Most buys per pair per day. */
  maxBuysPerDay: number;
  /** No buys while the price is down more than this % in 24 hours. */
  crashGuardPct: number;
  /** Stop buying for the day once realized losses reach this % of capital. */
  dailyLossPct: number;
}

export interface BrokerSettings {
  enabled: boolean;
  pairs: string[];
}

export interface BotSettings {
  /** Master switch for automatic trading. */
  auto: boolean;
  /** Paper trading: decide and record, never send. */
  paper: boolean;
  profile: Profile;
  params: StrategyParams;
  brokers: Record<BrokerId, BrokerSettings>;
  /** Extra pairs the owner added by search, on top of the server's default list. */
  watchlist: Record<BrokerId, string[]>;
  /** Shown as a goal, never promised. */
  monthlyTargetPct: number;
  updatedAt: number;
}

/** Coins the bot itself bought and still holds. It never sells what it did not buy. */
export interface Position {
  mode: TradeMode;
  broker: BrokerId;
  pair: string;
  qty: number;
  /** Quote currency spent, fees included. */
  cost: number;
  lastBuyPrice: number;
  lastBuyAt: number;
  openedAt: number;
  buys: number;
}

export type AgentName = "Pemindai" | "Analis" | "Risiko" | "Eksekutor";

export interface AgentStep {
  agent: AgentName;
  text: string;
}

export interface JournalEntry {
  id: string;
  at: number;
  mode: TradeMode;
  broker: BrokerId;
  pair: string;
  action: "buy" | "sell" | "error";
  ok: boolean;
  price?: number;
  qty?: number;
  /** Quote currency spent (buy) or received (sell), fees included. */
  quote?: number;
  /** Realized profit or loss of a sell, in the quote currency. */
  pnl?: number;
  message: string;
  steps: AgentStep[];
}

export interface LastDecision {
  at: number;
  mode: TradeMode;
  broker: BrokerId;
  pair: string;
  action: "buy" | "sell" | "hold";
  steps: AgentStep[];
}

export interface MonthStats {
  /** Realized profit/loss per quote currency (IDR, USDT). */
  realized: Record<string, number>;
  trades: number;
  wins: number;
}

export interface BotState {
  version: 1;
  settings: BotSettings;
  /** Keyed `${mode}:${broker}:${pair}`. */
  positions: Record<string, Position>;
  /** Newest first. */
  journal: JournalEntry[];
  /** Keyed `${mode}:${YYYY-MM}`. */
  months: Record<string, MonthStats>;
  /** What the agents concluded on the last check, per position key. */
  decisions: Record<string, LastDecision>;
  lastTick: { at: number; by: string; summary: string } | null;
  /** Last run by the 15-minute schedule (Supabase), to tell whether it is connected. */
  lastScheduledAt: number | null;
  /** Held while a tick is sending orders, so two ticks never trade at once. */
  lock: { id: string; until: number } | null;
}
