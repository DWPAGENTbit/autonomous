import type { ActivityKind, AgentState } from "@/types/domain";

export type Tone = "positive" | "negative" | "accent" | "caution" | "muted";

export const AGENT_STATE_META: Record<AgentState, { label: string; description: string; tone: Tone }> = {
  IDLE: { label: "Siaga", description: "Di antara siklus. Tidak ada yang sedang berjalan.", tone: "muted" },
  OBSERVING: { label: "Mengamati", description: "Memantau pasar dan sumber untuk perubahan.", tone: "accent" },
  RESEARCHING: { label: "Meneliti", description: "Mengumpulkan bukti dari pasar dan web.", tone: "accent" },
  ANALYZING: { label: "Menganalisis", description: "Menguji kandidat terhadap kriteria strategi.", tone: "accent" },
  SIMULATING: { label: "Menyimulasikan", description: "Menjalankan jalur hasil sebelum memakai modal.", tone: "accent" },
  DECIDING: { label: "Memutuskan", description: "Menimbang bukti terhadap kebijakan dan risiko.", tone: "accent" },
  EXECUTING: { label: "Mengeksekusi", description: "Menjalankan keputusan yang sudah disetujui.", tone: "accent" },
  MONITORING: { label: "Memantau", description: "Mengawasi posisi terbuka dan stop.", tone: "positive" },
  WAITING_FOR_APPROVAL: { label: "Menunggu Anda", description: "Ada keputusan di luar batas otonom.", tone: "caution" },
};

/** The agent's working loop, in order. */
export const PIPELINE: readonly { key: string; label: string; states: readonly AgentState[] }[] = [
  { key: "observe", label: "Amati", states: ["OBSERVING"] },
  { key: "research", label: "Teliti", states: ["RESEARCHING"] },
  { key: "analyze", label: "Analisis", states: ["ANALYZING"] },
  { key: "simulate", label: "Simulasi", states: ["SIMULATING"] },
  { key: "decide", label: "Putuskan", states: ["DECIDING", "WAITING_FOR_APPROVAL"] },
  { key: "execute", label: "Eksekusi", states: ["EXECUTING"] },
  { key: "monitor", label: "Pantau", states: ["MONITORING"] },
];

export const pipelineIndex = (state: AgentState) => PIPELINE.findIndex((p) => p.states.includes(state));

/** Activity kinds grouped by meaning; colour is reserved for outcomes. */
export const ACTIVITY_META: Record<ActivityKind, { label: string; tone: Tone }> = {
  SCANNING: { label: "Pindai", tone: "muted" },
  FILTERING: { label: "Saring", tone: "muted" },
  RESEARCH: { label: "Teliti", tone: "muted" },
  ANALYSIS: { label: "Analisis", tone: "muted" },
  SIMULATION: { label: "Simulasi", tone: "muted" },
  SEARCH: { label: "Pencarian", tone: "muted" },
  MONITOR: { label: "Pantau", tone: "positive" },
  DECISION: { label: "Keputusan", tone: "accent" },
  EXECUTION: { label: "Eksekusi", tone: "accent" },
  RISK: { label: "Risiko", tone: "negative" },
  APPROVAL: { label: "Persetujuan", tone: "caution" },
  BUSINESS: { label: "Bisnis", tone: "positive" },
};

export const toneText: Record<Tone, string> = {
  positive: "text-positive",
  negative: "text-negative",
  accent: "text-accent",
  caution: "text-caution",
  muted: "text-ink-3",
};
