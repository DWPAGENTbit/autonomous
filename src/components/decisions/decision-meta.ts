import type { Tone } from "@/components/agent/agent-meta";
import type { DecisionOutcome, StepStatus } from "@/types/domain";

export const OUTCOME_META: Record<DecisionOutcome, { label: string; tone: Tone }> = {
  TRADE: { label: "Trade", tone: "positive" },
  PURSUE: { label: "Pursue", tone: "positive" },
  REJECT: { label: "Rejected", tone: "negative" },
  PASS: { label: "Passed", tone: "muted" },
  AWAITING_APPROVAL: { label: "Awaiting you", tone: "caution" },
};

export const STEP_MARK: Record<StepStatus, { glyph: string; className: string; sr: string }> = {
  pass: { glyph: "✓", className: "text-positive", sr: "passed" },
  fail: { glyph: "✕", className: "text-negative", sr: "failed" },
  neutral: { glyph: "·", className: "text-ink-4", sr: "informational" },
};
