import { SEED_ACTIVITY, SEED_DECISIONS } from "@/data/history";
import { SEED_OPPORTUNITIES } from "@/data/opportunities";
import {
  AUTONOMY_POLICY,
  SEED_CASH,
  SEED_MONTH_START_EQUITY,
  SEED_POSITIONS,
  SEED_REALIZED_PNL,
} from "@/data/portfolio";
import type { QuoteMap } from "@/lib/analytics/portfolio";
import { simulation } from "@/lib/design/tokens";
import { MarketModel } from "@/lib/simulation/market";
import { createRng } from "@/lib/simulation/prng";
import type {
  ActivityEvent,
  AgentStatus,
  ApprovalRequest,
  AutonomyPolicy,
  Decision,
  Opportunity,
  PortfolioState,
  SimTime,
  TradeSetup,
} from "@/types/domain";

/** One market model per runtime; deterministic, so server and client agree. */
export const market = new MarketModel(simulation.seed);

export interface AppState {
  simTime: SimTime;
  running: boolean;
  status: AgentStatus;
  policy: AutonomyPolicy;
  activity: ActivityEvent[];
  decisions: Decision[];
  opportunities: Opportunity[];
  quotes: QuoteMap;
  marketVersion: number;
  portfolio: PortfolioState;
  setups: Record<string, TradeSetup>;
  approvals: ApprovalRequest[];
  riskWarning: { message: string; at: SimTime } | null;
}

/** Trailing 30-day equity curve: a bridge from month start to today, with one earlier peak. */
function buildEquityHistory(start: number, end: number, seed: number): number[] {
  const rng = createRng(seed);
  const days = 30;
  const peakDay = 22;
  const out: number[] = [];
  let noise = 0;
  for (let d = 0; d <= days; d++) {
    const t = d / days;
    noise = noise * 0.7 + rng.normal() * 0.0035;
    const bridge = noise * Math.sin(Math.PI * t);
    const hump = 0.021 * Math.exp(-((d - peakDay) ** 2) / 10);
    out.push((start + (end - start) * t) * (1 + bridge + hump));
  }
  out[0] = start;
  out[days] = end;
  return out;
}

export function createInitialState(): AppState {
  const quoteList = market.quotes();
  const quotes = Object.fromEntries(quoteList.map((q) => [q.symbol, q])) as QuoteMap;
  const deployed = SEED_POSITIONS.reduce((acc, p) => acc + p.quantity * quotes[p.symbol].price, 0);
  const equity = SEED_CASH + deployed;
  const equityHistory = buildEquityHistory(SEED_MONTH_START_EQUITY, equity, simulation.seed + 7);
  const start = simulation.startSecondOfDay;

  return {
    simTime: start,
    running: true,
    status: {
      state: "OBSERVING",
      task: "Observing market conditions",
      next: "Scan instruments for liquidity and spread",
      since: start,
      stepDurationMs: 3500,
    },
    policy: AUTONOMY_POLICY,
    activity: [...SEED_ACTIVITY].reverse(),
    decisions: [...SEED_DECISIONS].reverse(),
    opportunities: [...SEED_OPPORTUNITIES],
    quotes,
    marketVersion: 0,
    portfolio: {
      cash: SEED_CASH,
      positions: [...SEED_POSITIONS],
      realizedPnl: SEED_REALIZED_PNL,
      monthStartEquity: SEED_MONTH_START_EQUITY,
      peakEquity: Math.max(...equityHistory),
      equityHistory,
    },
    setups: {},
    approvals: [],
    riskWarning: null,
  };
}
