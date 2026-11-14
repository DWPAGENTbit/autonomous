import { rewardMultiple } from "@/lib/risk/risk";
import { createRng } from "@/lib/simulation/prng";
import type { SimulationResult, TradeSetup } from "@/types/domain";

const PATHS = 500;
const TIMEOUT_SHARE = 0.18;
const FEE_R = 0.04;
const BUCKET_WIDTH = 0.5;
const BUCKET_MIN = -1.5;
const BUCKET_MAX = 3;

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic Monte Carlo of a trade's R outcomes. The same setup always
 * yields the same distribution — simulation must never look like luck.
 */
export function simulateTrade(setup: TradeSetup): SimulationResult {
  const rng = createRng(hashString(setup.id));
  const reward = rewardMultiple(setup);
  const outcomes: number[] = [];

  for (let i = 0; i < PATHS; i++) {
    const u = rng.next();
    let r: number;
    if (u < TIMEOUT_SHARE) {
      // Time stop: exit somewhere between the stop and the target.
      r = rng.range(-0.6, reward * 0.6);
    } else if (rng.next() < setup.winProbability) {
      r = reward - FEE_R;
    } else {
      r = -1 - FEE_R - rng.next() * 0.12; // slippage past the stop
    }
    outcomes.push(r);
  }

  const bucketCount = Math.round((BUCKET_MAX - BUCKET_MIN) / BUCKET_WIDTH) + 1;
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    r: BUCKET_MIN + i * BUCKET_WIDTH,
    count: 0,
  }));
  for (const r of outcomes) {
    const idx = Math.round((Math.min(Math.max(r, BUCKET_MIN), BUCKET_MAX) - BUCKET_MIN) / BUCKET_WIDTH);
    buckets[idx].count++;
  }

  return {
    paths: PATHS,
    winRate: outcomes.filter((r) => r > 0).length / PATHS,
    expectedR: outcomes.reduce((a, b) => a + b, 0) / PATHS,
    buckets,
    worstR: Math.min(...outcomes),
  };
}
