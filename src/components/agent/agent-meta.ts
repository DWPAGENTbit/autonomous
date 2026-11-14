import type { ActivityKind, AgentState } from "@/types/domain";

export type Tone = "positive" | "negative" | "accent" | "caution" | "muted";

export const AGENT_STATE_META: Record<AgentState, { label: string; description: string; tone: Tone }> = {
  IDLE: { label: "Idle", description: "Between cycles. Nothing in progress.", tone: "muted" },
  OBSERVING: { label: "Observing", description: "Watching markets and sources for change.", tone: "accent" },
  RESEARCHING: { label: "Researching", description: "Collecting evidence from markets and the web.", tone: "accent" },
  ANALYZING: { label: "Analyzing", description: "Testing candidates against strategy criteria.", tone: "accent" },
  SIMULATING: { label: "Simulating", description: "Running outcome paths before committing capital.", tone: "accent" },
  DECIDING: { label: "Deciding", description: "Weighing evidence against policy and risk.", tone: "accent" },
  EXECUTING: { label: "Executing", description: "Acting on an approved decision.", tone: "accent" },
  MONITORING: { label: "Monitoring", description: "Watching open positions and stops.", tone: "positive" },
  WAITING_FOR_APPROVAL: { label: "Waiting for you", description: "A decision is outside autonomous limits.", tone: "caution" },
};

/** The agent's working loop, in order. */
export const PIPELINE: readonly { key: string; label: string; states: readonly AgentState[] }[] = [
  { key: "observe", label: "Observe", states: ["OBSERVING"] },
  { key: "research", label: "Research", states: ["RESEARCHING"] },
  { key: "analyze", label: "Analyze", states: ["ANALYZING"] },
  { key: "simulate", label: "Simulate", states: ["SIMULATING"] },
  { key: "decide", label: "Decide", states: ["DECIDING", "WAITING_FOR_APPROVAL"] },
  { key: "execute", label: "Execute", states: ["EXECUTING"] },
  { key: "monitor", label: "Monitor", states: ["MONITORING"] },
];

export const pipelineIndex = (state: AgentState) => PIPELINE.findIndex((p) => p.states.includes(state));

/** Activity kinds grouped by meaning; colour is reserved for outcomes. */
export const ACTIVITY_META: Record<ActivityKind, { label: string; tone: Tone }> = {
  SCANNING: { label: "Scanning", tone: "muted" },
  FILTERING: { label: "Filtering", tone: "muted" },
  RESEARCH: { label: "Research", tone: "muted" },
  ANALYSIS: { label: "Analysis", tone: "muted" },
  SIMULATION: { label: "Simulation", tone: "muted" },
  SEARCH: { label: "Search", tone: "muted" },
  MONITOR: { label: "Monitor", tone: "positive" },
  DECISION: { label: "Decision", tone: "accent" },
  EXECUTION: { label: "Execution", tone: "accent" },
  RISK: { label: "Risk", tone: "negative" },
  APPROVAL: { label: "Approval", tone: "caution" },
  BUSINESS: { label: "Business", tone: "positive" },
};

export const toneText: Record<Tone, string> = {
  positive: "text-positive",
  negative: "text-negative",
  accent: "text-accent",
  caution: "text-caution",
  muted: "text-ink-3",
};
