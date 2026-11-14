import { simulateTrade } from "@/lib/analytics/monte-carlo";
import type { SimulationEngine } from "@/lib/simulation/engine";
import type { SimulationResult, TradeSetup } from "@/types/domain";

/**
 * Everything the UI may ask the agent to do. The simulation implements
 * it today; a real backend (HTTP, WebSocket) can implement it later
 * without touching a single component.
 */
export interface AgentService {
  approve(approvalId: string, quantity?: number): void;
  reject(approvalId: string): void;
  pause(): void;
  resume(): void;
  simulate(setup: TradeSetup): Promise<SimulationResult>;
}

export function createSimulatedAgentService(engine: SimulationEngine): AgentService {
  return {
    approve: (id, quantity) => engine.approve(id, quantity),
    reject: (id) => engine.reject(id),
    pause: () => engine.pause(),
    resume: () => engine.resume(),
    simulate: async (setup) => simulateTrade(setup),
  };
}
