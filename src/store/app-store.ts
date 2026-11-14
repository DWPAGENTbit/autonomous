import { create } from "zustand";
import { computeCapital } from "@/lib/analytics/portfolio";
import { simulation } from "@/lib/design/tokens";
import type { EventBus } from "@/lib/events/bus";
import { createInitialState, type AppState } from "@/lib/simulation/initial-state";
import type { Decision, Opportunity } from "@/types/domain";

export type { AppState };

/**
 * Single client store. It is written to only by reducing bus events —
 * components never mutate it directly; they call services.
 */
export const useAppStore = create<AppState>()(() => createInitialState());

const patchById = <T extends { id: string }>(items: T[], id: string, patch: Partial<T>): T[] =>
  items.map((it) => (it.id === id ? { ...it, ...patch } : it));

/** Wires bus events into store updates. Returns an unsubscribe function. */
export function bindStoreToBus(bus: EventBus): () => void {
  const set = useAppStore.setState;

  const offs = [
    bus.on("CLOCK_TICK", ({ at }) => set({ simTime: at })),

    bus.on("ENGINE_STATE", ({ running }) => set({ running })),

    bus.on("AGENT_STATE_CHANGED", (status) => set({ status })),

    bus.on("ACTIVITY_LOGGED", (event) =>
      set((s) => ({ activity: [event, ...s.activity].slice(0, simulation.maxActivityEvents) })),
    ),

    bus.on("MARKET_UPDATED", ({ quotes }) =>
      set((s) => {
        const next = { ...s.quotes };
        quotes.forEach((q) => (next[q.symbol] = q));
        const equity = computeCapital(s.portfolio, next).total;
        const portfolio =
          equity > s.portfolio.peakEquity ? { ...s.portfolio, peakEquity: equity } : s.portfolio;
        return { quotes: next, marketVersion: s.marketVersion + 1, portfolio };
      }),
    ),

    bus.on("OPPORTUNITY_FOUND", (opp: Opportunity) =>
      set((s) => ({ opportunities: [opp, ...s.opportunities.filter((o) => o.id !== opp.id)] })),
    ),

    bus.on("OPPORTUNITY_UPDATED", ({ id, patch }) =>
      set((s) => ({ opportunities: patchById(s.opportunities, id, patch) })),
    ),

    bus.on("DECISION_CREATED", (d: Decision) => set((s) => ({ decisions: [d, ...s.decisions] }))),

    bus.on("DECISION_RESOLVED", ({ id, outcome }) =>
      set((s) => ({ decisions: patchById(s.decisions, id, { outcome }) })),
    ),

    bus.on("RISK_WARNING", (w) => set({ riskWarning: w })),

    bus.on("APPROVAL_REQUIRED", ({ request, setup }) =>
      set((s) => ({
        approvals: [...s.approvals, request],
        setups: { ...s.setups, [setup.id]: setup },
      })),
    ),

    bus.on("APPROVAL_RESOLVED", ({ id }) =>
      set((s) => ({ approvals: s.approvals.filter((a) => a.id !== id) })),
    ),

    bus.on("TRADE_EXECUTED", ({ position, cost }) =>
      set((s) => ({
        portfolio: {
          ...s.portfolio,
          cash: s.portfolio.cash - cost,
          positions: [...s.portfolio.positions, position],
        },
      })),
    ),

    bus.on("TRADE_CLOSED", ({ positionId, exitPrice, pnl }) =>
      set((s) => {
        const pos = s.portfolio.positions.find((p) => p.id === positionId);
        if (!pos) return {};
        return {
          portfolio: {
            ...s.portfolio,
            cash: s.portfolio.cash + pos.quantity * exitPrice,
            realizedPnl: s.portfolio.realizedPnl + pnl,
            positions: s.portfolio.positions.filter((p) => p.id !== positionId),
          },
        };
      }),
    ),
  ];

  return () => offs.forEach((off) => off());
}
