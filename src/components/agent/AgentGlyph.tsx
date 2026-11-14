"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { motionDuration, rawColor } from "@/lib/design/tokens";
import type { AgentState } from "@/types/domain";

const GRID = 9;
const CROSSFADE_MS = motionDuration.meaning * 1000;
/** Frame used when motion is reduced: a representative still for each state. */
const STILL_T = 0.9;

type Ctx = CanvasRenderingContext2D;
interface Frame {
  ctx: Ctx;
  size: number;
  t: number;
  alpha: number;
}

const TAU = Math.PI * 2;

function nodes(size: number) {
  const pad = size * 0.14;
  const step = (size - pad * 2) / (GRID - 1);
  const out: { x: number; y: number; i: number; j: number }[] = [];
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) out.push({ x: pad + i * step, y: pad + j * step, i, j });
  return { list: out, step, pad, c: size / 2 };
}

function dot(ctx: Ctx, x: number, y: number, r: number, color: string, a: number) {
  ctx.globalAlpha = a;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function baseGrid(f: Frame, a = 0.45, skip?: (i: number, j: number) => boolean) {
  const { list } = nodes(f.size);
  for (const n of list) if (!skip?.(n.i, n.j)) dot(f.ctx, n.x, n.y, 1.3, rawColor.ink4, a * f.alpha);
}

/** Pseudo-random but stable per index, so patterns don't jitter. */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const RENDERERS: Record<AgentState, (f: Frame) => void> = {
  IDLE(f) {
    baseGrid(f, 0.35);
    const { c } = nodes(f.size);
    dot(f.ctx, c, c, 2.5, rawColor.ink4, f.alpha);
  },

  // Slow breathing: the agent is watching, not acting.
  OBSERVING(f) {
    baseGrid(f, 0.4);
    const { c, step } = nodes(f.size);
    const p = (Math.sin((f.t / 3.2) * TAU) + 1) / 2;
    const { ctx } = f;
    ctx.globalAlpha = (0.15 + 0.25 * (1 - p)) * f.alpha;
    ctx.strokeStyle = rawColor.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(c, c, step * (1.2 + p * 1.6), 0, TAU);
    ctx.stroke();
    dot(ctx, c, c, 3 + p * 1.6, rawColor.accent, (0.6 + 0.4 * p) * f.alpha);
  },

  // Data flowing in: particles travel along rows toward the centre column.
  RESEARCHING(f) {
    baseGrid(f, 0.3);
    const { list, pad, step } = nodes(f.size);
    const width = f.size - pad * 2;
    for (let row = 0; row < GRID; row++) {
      if (row % 2 === 1) continue;
      const y = pad + row * step;
      for (let k = 0; k < 3; k++) {
        const speed = 0.12 + hash(row * 7 + k) * 0.18;
        const phase = (f.t * speed + hash(row * 13 + k)) % 1;
        const x = pad + phase * width;
        const fade = Math.sin(phase * Math.PI);
        dot(f.ctx, x, y, 1.8, rawColor.accent, 0.85 * fade * f.alpha);
        dot(f.ctx, x - 5, y, 1.2, rawColor.accent, 0.35 * fade * f.alpha);
        dot(f.ctx, x - 10, y, 0.9, rawColor.accent, 0.15 * fade * f.alpha);
      }
    }
    for (const n of list) if (n.i === (GRID - 1) / 2) dot(f.ctx, n.x, n.y, 1.6, rawColor.ink, 0.6 * f.alpha);
  },

  // Nodes connecting: relationships being drawn and evaluated.
  ANALYZING(f) {
    baseGrid(f, 0.3);
    const { list } = nodes(f.size);
    const picks = [10, 14, 22, 30, 38, 40, 42, 50, 58, 66, 70];
    const edges: [number, number][] = [
      [0, 3], [3, 5], [5, 6], [1, 4], [4, 5], [5, 7], [6, 8], [7, 9], [8, 10], [2, 6], [4, 7],
    ];
    const cycle = 3.6;
    const { ctx } = f;
    ctx.lineWidth = 1;
    edges.forEach(([a, b], k) => {
      const start = (k / edges.length) * cycle * 0.6;
      const local = ((f.t % cycle) - start) / 0.6;
      const prog = Math.max(0, Math.min(1, local));
      const fadeOut = f.t % cycle > cycle * 0.85 ? 1 - ((f.t % cycle) - cycle * 0.85) / (cycle * 0.15) : 1;
      if (prog <= 0) return;
      const A = list[picks[a]];
      const B = list[picks[b]];
      ctx.globalAlpha = 0.55 * fadeOut * f.alpha;
      ctx.strokeStyle = rawColor.ink;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(A.x + (B.x - A.x) * prog, A.y + (B.y - A.y) * prog);
      ctx.stroke();
    });
    picks.forEach((p, k) => {
      const n = list[p];
      const lit = (f.t * 1.4 + k * 0.37) % 1 < 0.5;
      dot(ctx, n.x, n.y, 2.4, k === 5 ? rawColor.accent : rawColor.ink, (lit ? 0.9 : 0.55) * f.alpha);
    });
  },

  // Fast but quiet waveforms: many futures being run.
  SIMULATING(f) {
    const { pad, c } = nodes(f.size);
    const width = f.size - pad * 2;
    const { ctx } = f;
    ctx.lineWidth = 1;
    for (let w = 0; w < 6; w++) {
      const amp = f.size * (0.05 + hash(w) * 0.06);
      const freq = 1.5 + hash(w + 9) * 2;
      const phase = f.t * (2.2 + w * 0.35);
      ctx.globalAlpha = (w === 0 ? 0.85 : 0.18 + 0.06 * (5 - w)) * f.alpha;
      ctx.strokeStyle = w === 0 ? rawColor.accent : rawColor.ink;
      ctx.beginPath();
      for (let k = 0; k <= 64; k++) {
        const x = pad + (k / 64) * width;
        const env = Math.sin((k / 64) * Math.PI);
        const y = c + Math.sin((k / 64) * freq * TAU + phase) * amp * env + (w - 2.5) * 2;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  },

  // Converging: many inputs reduced to one choice.
  DECIDING(f) {
    baseGrid(f, 0.25);
    const { list, c } = nodes(f.size);
    const sources = [0, 4, 8, 36, 44, 72, 76, 80];
    const cycle = 2.2;
    const p = (f.t % cycle) / cycle;
    const ease = 1 - Math.pow(1 - p, 3);
    const { ctx } = f;
    ctx.lineWidth = 1;
    sources.forEach((s) => {
      const n = list[s];
      const x = n.x + (c - n.x) * ease;
      const y = n.y + (c - n.y) * ease;
      ctx.globalAlpha = 0.25 * f.alpha;
      ctx.strokeStyle = rawColor.ink;
      ctx.beginPath();
      ctx.moveTo(n.x, n.y);
      ctx.lineTo(c, c);
      ctx.stroke();
      dot(ctx, x, y, 2, rawColor.ink, (0.4 + 0.6 * ease) * f.alpha);
    });
    dot(ctx, c, c, 3 + ease * 2.5, rawColor.accent, (0.5 + 0.5 * ease) * f.alpha);
  },

  // A clear directional pulse: action leaving the system.
  EXECUTING(f) {
    const { list, c, step } = nodes(f.size);
    const mid = (GRID - 1) / 2;
    const { ctx } = f;
    for (const n of list) {
      if (Math.abs(n.j - mid) > 1) {
        dot(ctx, n.x, n.y, 1.2, rawColor.ink4, 0.25 * f.alpha);
        continue;
      }
      const front = (f.t * 0.9) % 1.4;
      const pos = n.i / (GRID - 1);
      const d = front - pos;
      const lit = d > 0 && d < 0.35 ? 1 - d / 0.35 : 0;
      const onAxis = n.j === mid;
      dot(ctx, n.x, n.y, onAxis ? 1.6 + lit * 1.6 : 1.2 + lit, lit > 0.05 ? rawColor.accent : rawColor.ink4, (0.35 + lit * 0.65) * f.alpha);
    }
    const tip = list[mid * GRID + (GRID - 1)];
    ctx.globalAlpha = 0.9 * f.alpha;
    ctx.strokeStyle = rawColor.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tip.x - step * 0.55, c - step * 0.55);
    ctx.lineTo(tip.x, c);
    ctx.lineTo(tip.x - step * 0.55, c + step * 0.55);
    ctx.stroke();
  },

  // A slow sweep across the book: watching positions.
  MONITORING(f) {
    const { list, c } = nodes(f.size);
    const angle = ((f.t / 5) % 1) * TAU;
    const { ctx } = f;
    for (const n of list) {
      const dx = n.x - c;
      const dy = n.y - c;
      const r = Math.hypot(dx, dy);
      if (r > f.size * 0.42) continue;
      let diff = angle - Math.atan2(dy, dx);
      diff = ((diff % TAU) + TAU) % TAU;
      const lit = diff < 1.2 ? 1 - diff / 1.2 : 0;
      dot(ctx, n.x, n.y, 1.3 + lit * 1.2, lit > 0.2 ? rawColor.positive : rawColor.ink4, (0.3 + lit * 0.7) * f.alpha);
    }
    ctx.globalAlpha = 0.35 * f.alpha;
    ctx.strokeStyle = rawColor.positive;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + Math.cos(angle) * f.size * 0.4, c + Math.sin(angle) * f.size * 0.4);
    ctx.stroke();
    dot(ctx, c, c, 2.4, rawColor.positive, f.alpha);
  },

  // Holding still, signalling that a person is needed.
  WAITING_FOR_APPROVAL(f) {
    baseGrid(f, 0.22);
    const { c, step } = nodes(f.size);
    const p = (Math.sin((f.t / 2.4) * TAU) + 1) / 2;
    const { ctx } = f;
    ctx.globalAlpha = (0.5 + 0.3 * p) * f.alpha;
    ctx.strokeStyle = rawColor.caution;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c, c, step * 1.6, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 0.9 * f.alpha;
    ctx.fillStyle = rawColor.caution;
    const w = step * 0.18;
    const h = step * 0.9;
    ctx.fillRect(c - w * 2, c - h / 2, w, h);
    ctx.fillRect(c + w, c - h / 2, w, h);
  },
};

/**
 * Canvas visualisation of agent state. Each state has its own motion
 * signature so the user can read what the agent is doing peripherally.
 */
export function AgentGlyph({ state, size = 200 }: { state: AgentState; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const states = useRef({ current: state, previous: state, changedAt: 0 });

  useEffect(() => {
    const s = states.current;
    if (s.current !== state) states.current = { current: state, previous: s.current, changedAt: performance.now() };
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const t0 = performance.now();
    const draw = (now: number) => {
      ctx.clearRect(0, 0, size, size);
      const s = states.current;
      const t = reduced ? STILL_T : (now - t0) / 1000;
      const mix = reduced ? 1 : Math.min(1, (now - s.changedAt) / CROSSFADE_MS);
      if (mix < 1 && s.previous !== s.current) RENDERERS[s.previous]({ ctx, size, t, alpha: 1 - mix });
      RENDERERS[s.current]({ ctx, size, t, alpha: mix });
      ctx.globalAlpha = 1;
    };

    if (reduced) {
      draw(performance.now());
      return;
    }

    let raf = 0;
    let visible = true;
    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    const startLoop = () => {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const stopLoop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) startLoop();
      else stopLoop();
    });
    io.observe(canvas);
    const onVis = () => (document.hidden ? stopLoop() : startLoop());
    document.addEventListener("visibilitychange", onVis);
    startLoop();
    return () => {
      stopLoop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
    // In reduced motion, redraw the still whenever the state changes.
  }, [size, reduced, reduced ? state : null]);

  return <canvas ref={canvasRef} style={{ width: size, height: size }} aria-hidden className="block" />;
}
