"use client";

import { MotionConfig } from "motion/react";
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { bus } from "@/lib/events/bus";
import { createSimulatedAgentService, type AgentService } from "@/lib/services/agent-service";
import { SimulationEngine } from "@/lib/simulation/engine";
import { market } from "@/lib/simulation/initial-state";
import { bindStoreToBus, useAppStore } from "@/store/app-store";

const AgentServiceContext = createContext<AgentService | null>(null);

let engineSingleton: SimulationEngine | null = null;
function getEngine(): SimulationEngine {
  engineSingleton ??= new SimulationEngine({ bus, market, read: useAppStore.getState });
  return engineSingleton;
}

/**
 * Starts the live simulation once for the whole app, so the agent keeps
 * working while the user moves between areas.
 */
export function SimulationProvider({ children }: { children: ReactNode }) {
  const service = useMemo(() => createSimulatedAgentService(getEngine()), []);

  useEffect(() => {
    const unbind = bindStoreToBus(bus);
    const engine = getEngine();
    engine.start();
    return () => {
      engine.stop();
      unbind();
    };
  }, []);

  return (
    <AgentServiceContext.Provider value={service}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </AgentServiceContext.Provider>
  );
}

export function useAgentService(): AgentService {
  const svc = useContext(AgentServiceContext);
  if (!svc) throw new Error("useAgentService must be used inside SimulationProvider");
  return svc;
}
