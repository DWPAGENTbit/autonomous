import type { Tone } from "@/components/agent/agent-meta";
import type { DecisionOutcome, StepStatus } from "@/types/domain";

export const OUTCOME_META: Record<DecisionOutcome, { label: string; tone: Tone }> = {
  TRADE: { label: "Transaksi", tone: "positive" },
  PURSUE: { label: "Dikejar", tone: "positive" },
  REJECT: { label: "Ditolak", tone: "negative" },
  PASS: { label: "Dilewati", tone: "muted" },
  AWAITING_APPROVAL: { label: "Menunggu Anda", tone: "caution" },
};

export const STEP_MARK: Record<StepStatus, { glyph: string; className: string; sr: string }> = {
  pass: { glyph: "✓", className: "text-positive", sr: "lolos" },
  fail: { glyph: "✕", className: "text-negative", sr: "gagal" },
  neutral: { glyph: "·", className: "text-ink-4", sr: "informasi" },
};
