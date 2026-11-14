import { INSTRUMENTS } from "@/data/instruments";
import { CANDIDATE_ROTATION } from "@/data/strategy";
import { simulation } from "@/lib/design/tokens";
import type { EventBus } from "@/lib/events/bus";
import type { AppState } from "@/lib/simulation/initial-state";
import type { MarketModel } from "@/lib/simulation/market";
import { createRng, type Rng } from "@/lib/simulation/prng";
import {
  businessDiscovery,
  businessFollowUp,
  executionStep,
  idle,
  marketScan,
  monitorPositions,
  tradeCandidate,
  type Step,
  type StepContext,
} from "@/lib/simulation/scenarios";

type ScenarioKind = "scan" | "trade" | "business" | "monitor" | "followup" | "idle";

/** The agent's working rhythm. Repeats, with content that evolves as state changes. */
const CYCLE: readonly ScenarioKind[] = ["scan", "trade", "business", "monitor", "trade", "followup", "idle"];

const CLOCK_MS = 1000;
const RESUME_TASK = "Memulai siklus riset berikutnya";

export interface EngineDeps {
  bus: EventBus;
  market: MarketModel;
  read: () => AppState;
}

/**
 * Drives the simulated agent. Emits domain events only — it knows nothing
 * about React or the store. A real agent backend can replace it by emitting
 * the same events.
 */
export class SimulationEngine {
  private readonly bus: EventBus;
  private readonly market: MarketModel;
  private readonly read: () => AppState;
  private readonly rng: Rng;
  private readonly ctx: StepContext;

  private simTime: number;
  private counter = 0;
  private cycleIndex = 0;
  private candidateIndex = 0;
  private discoveryIndex = 0;

  private queue: Step[] = [];
  private current: Step | null = null;
  private stepTimer: ReturnType<typeof setTimeout> | null = null;
  private marketTimer: ReturnType<typeof setInterval> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private live = false;
  private agentPaused = false;

  constructor({ bus, market, read }: EngineDeps) {
    this.bus = bus;
    this.market = market;
    this.read = read;
    this.rng = createRng(simulation.seed + 101);
    this.simTime = read().simTime;
    this.ctx = {
      now: () => this.simTime,
      market: this.market,
      rng: this.rng,
      read: this.read,
      emit: (type, payload) => this.bus.emit(type, payload),
      nextId: (prefix) => `${prefix}-${++this.counter}`,
      log: (kind, message, extra) =>
        this.bus.emit("ACTIVITY_LOGGED", { id: `ev-${++this.counter}`, at: this.simTime, kind, message, ...extra }),
    };
  }

  // ── Lifecycle ──────────────────────────────────────────────

  start(): void {
    if (this.live) return;
    this.live = true;
    this.clockTimer = setInterval(() => {
      this.simTime += 1;
      this.bus.emit("CLOCK_TICK", { at: this.simTime });
    }, CLOCK_MS);
    this.marketTimer = setInterval(() => {
      this.bus.emit("MARKET_UPDATED", { quotes: this.market.tick(), at: this.simTime });
    }, simulation.marketTickMs);
    if (!this.agentPaused) {
      this.bus.emit("ENGINE_STATE", { running: true });
      this.advance();
    }
  }

  stop(): void {
    this.live = false;
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (this.marketTimer) clearInterval(this.marketTimer);
    this.clockTimer = this.marketTimer = null;
    this.interruptCurrent();
  }

  // ── Human controls ─────────────────────────────────────────

  pause(): void {
    if (this.agentPaused) return;
    this.agentPaused = true;
    this.interruptCurrent();
    this.bus.emit("ENGINE_STATE", { running: false });
    this.bus.emit("AGENT_STATE_CHANGED", {
      state: "IDLE",
      task: "Dijeda oleh Anda",
      next: "Lanjutkan untuk meneruskan siklus riset",
      since: this.simTime,
      stepDurationMs: 0,
    });
    this.ctx.log("APPROVAL", "Agen dijeda oleh Anda. Posisi terbuka tetap dijaga stop-nya.");
  }

  resume(): void {
    if (!this.agentPaused) return;
    this.agentPaused = false;
    this.bus.emit("ENGINE_STATE", { running: true });
    this.ctx.log("APPROVAL", "Agen dilanjutkan oleh Anda.");
    if (this.live) this.advance();
  }

  approve(approvalId: string, quantity?: number): void {
    const state = this.read();
    const request = state.approvals.find((a) => a.id === approvalId);
    if (!request) return;
    const setup = state.setups[request.setupId];
    if (!setup) return;
    const qty = quantity ?? setup.quantity;
    const modified = quantity !== undefined && quantity !== setup.quantity;
    const pair = INSTRUMENTS[setup.symbol].pair;

    this.bus.emit("APPROVAL_RESOLVED", { id: approvalId, resolution: "APPROVED" });
    this.bus.emit("DECISION_RESOLVED", { id: request.decisionId, outcome: "TRADE" });
    this.ctx.log(
      "APPROVAL",
      modified ? `Anda menyetujui ${pair} dengan ukuran yang diubah.` : `Anda menyetujui posisi ${pair}.`,
      { decisionId: request.decisionId, symbol: setup.symbol },
    );
    this.preempt([executionStep(setup, "setelah Anda setujui", qty)]);
  }

  reject(approvalId: string): void {
    const state = this.read();
    const request = state.approvals.find((a) => a.id === approvalId);
    if (!request) return;
    const setup = state.setups[request.setupId];
    const pair = setup ? INSTRUMENTS[setup.symbol].pair : "posisi ini";
    this.bus.emit("APPROVAL_RESOLVED", { id: approvalId, resolution: "REJECTED" });
    this.bus.emit("DECISION_RESOLVED", { id: request.decisionId, outcome: "REJECT" });
    this.ctx.log("APPROVAL", `Anda menolak ${pair}. Agen tidak akan masuk ke setup ini lagi hari ini.`, {
      decisionId: request.decisionId,
      symbol: setup?.symbol,
    });
  }

  // ── Step machinery ─────────────────────────────────────────

  private interruptCurrent(): void {
    if (this.stepTimer) clearTimeout(this.stepTimer);
    this.stepTimer = null;
    if (this.current) this.queue.unshift(this.current);
    this.current = null;
  }

  /** Runs the given steps immediately, then resumes the interrupted work. */
  private preempt(steps: Step[]): void {
    this.interruptCurrent();
    this.queue.unshift(...steps);
    if (this.live && !this.agentPaused) this.advance();
  }

  private nextScenario(): Step[] {
    const kind = CYCLE[this.cycleIndex % CYCLE.length];
    this.cycleIndex++;
    switch (kind) {
      case "scan":
        return marketScan(this.ctx);
      case "trade": {
        const symbol = CANDIDATE_ROTATION[this.candidateIndex % CANDIDATE_ROTATION.length];
        this.candidateIndex++;
        return tradeCandidate(this.ctx, symbol);
      }
      case "business":
        return businessDiscovery(this.ctx, this.discoveryIndex++);
      case "monitor":
        return monitorPositions(this.ctx);
      case "followup":
        return businessFollowUp(this.ctx);
      case "idle":
        return idle();
    }
  }

  private advance(): void {
    if (!this.live || this.agentPaused) return;
    while (this.queue.length === 0) this.queue = this.nextScenario();
    const step = this.queue.shift()!;
    this.current = step;
    this.bus.emit("AGENT_STATE_CHANGED", {
      state: step.state,
      task: step.task,
      next: this.queue[0]?.task ?? RESUME_TASK,
      since: this.simTime,
      stepDurationMs: step.durationMs,
    });
    this.stepTimer = setTimeout(() => this.complete(step), step.durationMs);
  }

  private complete(step: Step): void {
    this.stepTimer = null;
    this.current = null;
    const followUps = step.complete?.(this.ctx);
    if (followUps && followUps.length) this.queue.unshift(...followUps);
    this.advance();
  }
}
