/**
 * Design tokens consumed from JavaScript (motion, charts, canvas).
 * CSS-facing tokens live in `src/app/globals.css` under `@theme`;
 * values here mirror them so JS and CSS never drift apart.
 */

export const motionDuration = {
  micro: 0.12,
  state: 0.18,
  panel: 0.25,
  meaning: 0.4,
  scene: 0.6,
} as const;

export const easing = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.65, 0, 0.35, 1],
} as const;

/** Stagger for meaningful groups only — never for every element. */
export const stagger = {
  tight: 0.04,
  group: 0.08,
  chain: 0.12,
} as const;

export const transition = {
  micro: { duration: motionDuration.micro, ease: easing.out },
  state: { duration: motionDuration.state, ease: easing.out },
  panel: { duration: motionDuration.panel, ease: easing.out },
  meaning: { duration: motionDuration.meaning, ease: easing.out },
  scene: { duration: motionDuration.scene, ease: easing.out },
} as const;

/** CSS variable references usable directly in SVG attributes. */
export const cssColor = {
  ink: "var(--color-ink)",
  ink2: "var(--color-ink-2)",
  ink3: "var(--color-ink-3)",
  ink4: "var(--color-ink-4)",
  line: "var(--color-line)",
  lineStrong: "var(--color-line-strong)",
  positive: "var(--color-positive)",
  negative: "var(--color-negative)",
  accent: "var(--color-accent)",
  accentSoft: "var(--color-accent-soft)",
  caution: "var(--color-caution)",
  chartLine: "var(--color-chart-line)",
  chartMuted: "var(--color-chart-muted)",
  chartGrid: "var(--color-chart-grid)",
  chartArea: "var(--color-chart-area)",
} as const;

/** Raw hex values for canvas rendering, where CSS variables are unavailable. */
export const rawColor = {
  ink: "#0d1626",
  ink3: "#5f6f69",
  ink4: "#93a19b",
  line: "#dbe5e0",
  accent: "#127562",
  positive: "#0d9b63",
  caution: "#b7770b",
} as const;

export const chart = {
  /** Number of points every timeframe is resampled to, so transitions can interpolate. */
  resolution: 120,
  sparkResolution: 48,
  strokeWidth: 1.5,
  axisFontSize: 11,
} as const;

export const simulation = {
  /** Real milliseconds between market ticks. */
  marketTickMs: 2000,
  /** Fixed seed: identical state on server and client, and across reloads. */
  seed: 20261114,
  /** Simulated wall-clock start, seconds since midnight (09:41:00). */
  startSecondOfDay: 9 * 3600 + 41 * 60,
  maxActivityEvents: 400,
} as const;
