"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { useElementSize } from "@/hooks/use-element-size";
import type { AppState } from "@/lib/simulation/initial-state";
import { useAppStore } from "@/store/app-store";
import type { AgentState, Decision, MarketSymbol } from "@/types/domain";

/**
 * The agent as a living system: a core (the agent) with the markets it
 * trades on the inner ring and the business sources it searches on the
 * outer ring. Every state has its own motion, so the picture alone tells
 * you what the agent is doing.
 */

const BLUE = "#127562";
const CYAN = "#6cc9b1";
const AMBER = "#c9971c";
const POSITIVE = "13,155,99";
const INK2 = "#3b4a45";
const INK3 = "#7d8c86";

const MARKETS: { id: MarketSymbol; label: string }[] = [
  { id: "BTC", label: "BTC" },
  { id: "ETH", label: "ETH" },
  { id: "SPX", label: "S&P 500" },
  { id: "NDX", label: "Nasdaq" },
  { id: "XAU", label: "Emas" },
  { id: "DXY", label: "USD" },
];
const SOURCES = ["Upwork", "LinkedIn", "GitHub", "Gumroad", "Contra", "Forum"];

/** Orbit speed per state, radians per second. Waiting freezes the system. */
const ROT_SPEED: Record<AgentState, number> = {
  IDLE: 0.03,
  OBSERVING: 0.12,
  RESEARCHING: 0.08,
  ANALYZING: 0.06,
  SIMULATING: 0.1,
  DECIDING: 0.04,
  EXECUTING: 0.05,
  MONITORING: 0.06,
  WAITING_FOR_APPROVAL: 0,
};

interface Node {
  x: number;
  y: number;
  a: number;
  label: string;
  id?: MarketSymbol;
}
interface Geo {
  c: number;
  rIn: number;
  rOut: number;
  core: number;
  markets: Node[];
  sources: Node[];
}
interface Frame {
  ctx: CanvasRenderingContext2D;
  size: number;
  t: number;
  rot: number;
  state: AgentState;
  prev: AgentState;
  mix: number;
  held: string[];
  target: string;
  font: string;
}

const TAU = Math.PI * 2;
const frac = (v: number) => v - Math.floor(v);
const hash = (i: number) => frac(Math.sin(i * 127.1 + 311.7) * 43758.5453);
const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
const angDist = (a: number, b: number) => {
  const d = Math.abs(frac((a - b) / TAU) * TAU);
  return Math.min(d, TAU - d);
};

function geometry(size: number, rot: number): Geo {
  const c = size / 2;
  const rIn = size * 0.24;
  const rOut = size * 0.38;
  const markets = MARKETS.map((m, i) => {
    const a = -Math.PI / 2 + (i * TAU) / 6 + rot;
    return { ...m, a, x: c + Math.cos(a) * rIn, y: c + Math.sin(a) * rIn };
  });
  const sources = SOURCES.map((label, j) => {
    const a = -Math.PI / 2 + Math.PI / 6 + (j * TAU) / 6 - rot * 0.6;
    return { label, a, x: c + Math.cos(a) * rOut, y: c + Math.sin(a) * rOut };
  });
  return { c, rIn, rOut, core: size * 0.085, markets, sources };
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, TAU);
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/** Moves a particle from `from` to the core along a gentle curve. */
function particle(f: Frame, g: Geo, from: Node, p: number, color: string, r = 2.2) {
  const e = easeInOut(p);
  const nx = -(from.y - g.c);
  const ny = from.x - g.c;
  const len = Math.hypot(nx, ny) || 1;
  const bend = Math.sin(p * Math.PI) * f.size * 0.03;
  const x = from.x + (g.c - from.x) * e + (nx / len) * bend;
  const y = from.y + (g.c - from.y) * e + (ny / len) * bend;
  const alpha = f.ctx.globalAlpha;
  f.ctx.globalAlpha = alpha * Math.sin(p * Math.PI);
  f.ctx.fillStyle = color;
  circle(f.ctx, x, y, r);
  f.ctx.fill();
  f.ctx.globalAlpha = alpha;
}

function targetNode(f: Frame, g: Geo): Node {
  return g.markets.find((m) => m.id === f.target) ?? g.markets[1];
}

const EFFECTS: Record<AgentState, (f: Frame, g: Geo) => void> = {
  IDLE: () => {},

  // A radar sweep; nodes brighten as it passes.
  OBSERVING: (f, g) => {
    const { ctx } = f;
    const sweep = f.t * 1.1;
    ctx.lineWidth = 2;
    for (let k = 0; k < 26; k++) {
      const a = sweep - k * 0.035;
      ctx.strokeStyle = `rgba(18,117,98,${0.24 * (1 - k / 26)})`;
      line(ctx, g.c + Math.cos(a) * g.core * 1.25, g.c + Math.sin(a) * g.core * 1.25, g.c + Math.cos(a) * g.rOut, g.c + Math.sin(a) * g.rOut);
    }
    ctx.lineWidth = 1.5;
    for (const n of [...g.markets, ...g.sources]) {
      const d = angDist(n.a, sweep);
      if (d > 0.4) continue;
      ctx.strokeStyle = `rgba(18,117,98,${0.6 * (1 - d / 0.4)})`;
      circle(ctx, n.x, n.y, f.size * 0.036);
      ctx.stroke();
    }
  },

  // Evidence flows in from the business sources and markets.
  RESEARCHING: (f, g) => {
    const { ctx } = f;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(108,201,177,0.14)";
    for (const s of g.sources) line(ctx, s.x, s.y, g.c, g.c);
    g.sources.forEach((s, j) => {
      for (let k = 0; k < 3; k++) particle(f, g, s, frac(f.t * 0.45 + j * 0.21 + k / 3), CYAN, 2.4);
    });
    g.markets.forEach((m, i) => particle(f, g, m, frac(f.t * 0.35 + i * 0.29), BLUE, 1.8));
  },

  // Candidates are tested one at a time.
  ANALYZING: (f, g) => {
    const { ctx } = f;
    const active = Math.floor(f.t * 1.4) % g.markets.length;
    const p = frac(f.t * 1.4);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(18,117,98,0.1)";
    for (const m of g.markets) line(ctx, g.c, g.c, m.x, m.y);
    const m = g.markets[active];
    ctx.lineWidth = 1.75;
    ctx.strokeStyle = "rgba(18,117,98,0.75)";
    line(ctx, g.c, g.c, m.x, m.y);
    ctx.fillStyle = CYAN;
    circle(ctx, g.c + (m.x - g.c) * p, g.c + (m.y - g.c) * p, 3);
    ctx.fill();
    ctx.strokeStyle = `rgba(18,117,98,${0.7 * (1 - p)})`;
    circle(ctx, m.x, m.y, f.size * (0.03 + 0.03 * p));
    ctx.stroke();
  },

  // Hundreds of possible futures fan out from the core.
  SIMULATING: (f, g) => {
    const { ctx } = f;
    const paths = 30;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < paths; i++) {
      const base = (i / paths) * TAU + f.t * 0.15;
      const reach = 0.5 + 0.5 * hash(i);
      const start = g.core * 1.3;
      ctx.strokeStyle = i % 3 === 0 ? `rgba(108,201,177,${0.18 + 0.2 * hash(i + 7)})` : `rgba(18,117,98,${0.1 + 0.16 * hash(i + 3)})`;
      ctx.beginPath();
      let ex = 0;
      let ey = 0;
      for (let s = 0; s <= 16; s++) {
        const q = s / 16;
        const r = start + (g.rOut - start) * q * reach;
        const a = base + 0.28 * Math.sin(s * 0.7 + i * 1.3 + f.t * 2.2) * q;
        ex = g.c + Math.cos(a) * r;
        ey = g.c + Math.sin(a) * r;
        if (s === 0) ctx.moveTo(ex, ey);
        else ctx.lineTo(ex, ey);
      }
      ctx.stroke();
      ctx.fillStyle = hash(i + 11) > 0.42 ? `rgba(${POSITIVE},0.7)` : "rgba(217,67,75,0.6)";
      circle(ctx, ex, ey, 1.8);
      ctx.fill();
    }
  },

  // Everything converges; the core tightens.
  DECIDING: (f, g) => {
    const { ctx } = f;
    [...g.markets, ...g.sources].forEach((n, i) => particle(f, g, n, frac(f.t * 0.9 + i * 0.13), i < 6 ? BLUE : CYAN, 2));
    const q = frac(f.t * 0.8);
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(18,117,98,${0.5 * q})`;
    circle(ctx, g.c, g.c, g.core * (2.8 - 1.5 * q));
    ctx.stroke();
  },

  // An order travels from the agent to the market.
  EXECUTING: (f, g) => {
    const { ctx } = f;
    const m = targetNode(f, g);
    const grad = ctx.createLinearGradient(g.c, g.c, m.x, m.y);
    grad.addColorStop(0, "rgba(18,117,98,0.85)");
    grad.addColorStop(1, "rgba(108,201,177,0.85)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    line(ctx, g.c, g.c, m.x, m.y);
    for (let k = 0; k < 3; k++) {
      const p = frac(f.t * 1.2 + k / 3);
      ctx.fillStyle = "#ffffff";
      circle(ctx, g.c + (m.x - g.c) * p, g.c + (m.y - g.c) * p, 3.2);
      ctx.fill();
    }
    const q = frac(f.t * 1.2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(108,201,177,${1 - q})`;
    circle(ctx, m.x, m.y, f.size * (0.03 + 0.035 * q));
    ctx.stroke();
  },

  // A steady heartbeat; held positions pulse.
  MONITORING: (f, g) => {
    const { ctx } = f;
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 2; k++) {
      const q = frac(f.t * 0.45 + k * 0.5);
      ctx.strokeStyle = `rgba(18,117,98,${0.35 * (1 - q)})`;
      circle(ctx, g.c, g.c, g.core * 1.2 + q * (g.rOut - g.core * 1.2));
      ctx.stroke();
    }
    for (const m of g.markets) {
      if (!f.held.includes(m.id ?? "")) continue;
      const s = 0.5 + 0.5 * Math.sin(f.t * 3 + m.a);
      ctx.strokeStyle = `rgba(${POSITIVE},${0.35 + 0.4 * s})`;
      ctx.lineWidth = 2;
      circle(ctx, m.x, m.y, f.size * (0.03 + 0.01 * s));
      ctx.stroke();
    }
  },

  // Everything holds still; the agent asks you.
  WAITING_FOR_APPROVAL: (f, g) => {
    const { ctx } = f;
    const s = 0.5 + 0.5 * Math.sin(f.t * 2.2);
    const m = targetNode(f, g);
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = `rgba(201,151,28,${0.45 + 0.3 * s})`;
    line(ctx, g.c, g.c, m.x, m.y);
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(201,151,28,${0.25 + 0.35 * s})`;
    circle(ctx, g.c, g.c, g.core * (1.55 + 0.12 * s));
    ctx.stroke();
    circle(ctx, m.x, m.y, f.size * (0.034 + 0.008 * s));
    ctx.stroke();
  },
};

function drawNodes(f: Frame, g: Geo) {
  const { ctx, size } = f;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = `500 ${Math.max(10, Math.round(size * 0.026))}px ${f.font}`;
  for (const m of g.markets) {
    const held = f.held.includes(m.id ?? "");
    circle(ctx, m.x, m.y, size * 0.019);
    ctx.fillStyle = held ? BLUE : "#ffffff";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = BLUE;
    ctx.stroke();
    const lr = g.rIn + size * 0.058;
    ctx.fillStyle = INK2;
    ctx.fillText(m.label, g.c + Math.cos(m.a) * lr, g.c + Math.sin(m.a) * lr);
  }

  ctx.font = `${Math.max(9, Math.round(size * 0.023))}px ${f.font}`;
  for (const s of g.sources) {
    circle(ctx, s.x, s.y, size * 0.012);
    ctx.fillStyle = CYAN;
    ctx.fill();
    const lr = g.rOut + size * 0.05;
    ctx.fillStyle = INK3;
    ctx.fillText(s.label, g.c + Math.cos(s.a) * lr, g.c + Math.sin(s.a) * lr);
  }
}

function drawCore(f: Frame, g: Geo) {
  const { ctx } = f;
  const waiting = f.state === "WAITING_FOR_APPROVAL";
  const r = g.core * (1 + 0.035 * Math.sin(f.t * 2));

  const glow = ctx.createRadialGradient(g.c, g.c, r * 0.6, g.c, g.c, r * 2.7);
  glow.addColorStop(0, waiting ? "rgba(201,151,28,0.22)" : "rgba(108,201,177,0.3)");
  glow.addColorStop(1, "rgba(108,201,177,0)");
  ctx.fillStyle = glow;
  circle(ctx, g.c, g.c, r * 2.7);
  ctx.fill();

  const body = ctx.createLinearGradient(g.c - r, g.c + r, g.c + r, g.c - r);
  body.addColorStop(0, "#0a3fc4");
  body.addColorStop(0.55, BLUE);
  body.addColorStop(1, CYAN);
  ctx.fillStyle = body;
  circle(ctx, g.c, g.c, r);
  ctx.fill();

  // The DWP EARN MONEY mark: a forward "play" shape with the agent's dot.
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = r * 0.17;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(g.c - r * 0.36, g.c - r * 0.34);
  ctx.lineTo(g.c + r * 0.38, g.c + r * 0.08);
  ctx.lineTo(g.c - r * 0.36, g.c + r * 0.5);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  circle(ctx, g.c + r * 0.36, g.c - r * 0.42, r * 0.13);
  ctx.fill();

  if (waiting) {
    ctx.fillStyle = AMBER;
    circle(ctx, g.c + r * 0.78, g.c - r * 0.78, r * 0.16);
    ctx.fill();
  }
}

function draw(f: Frame) {
  const { ctx, size } = f;
  ctx.clearRect(0, 0, size, size);
  const g = geometry(size, f.rot);

  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(18,117,98,0.14)";
  circle(ctx, g.c, g.c, g.rIn);
  ctx.stroke();
  ctx.setLineDash([2, 5]);
  ctx.strokeStyle = "rgba(108,201,177,0.35)";
  circle(ctx, g.c, g.c, g.rOut);
  ctx.stroke();
  ctx.setLineDash([]);

  if (f.mix < 1 && f.prev !== f.state) {
    ctx.globalAlpha = 1 - f.mix;
    EFFECTS[f.prev](f, g);
  }
  ctx.globalAlpha = f.mix;
  EFFECTS[f.state](f, g);
  ctx.globalAlpha = 1;

  drawNodes(f, g);
  drawCore(f, g);
}

function targetSymbol(s: AppState): string {
  const a = s.approvals[0];
  if (a) return s.setups[a.setupId]?.symbol ?? "";
  let best: Decision | undefined;
  for (const d of s.decisions) if (d.symbol && (!best || d.at > best.at)) best = d;
  return best?.symbol ?? "";
}

export function AgentCore({ maxSize = 520 }: { maxSize?: number }) {
  const [wrapRef, { width }] = useElementSize<HTMLDivElement>(420);
  const size = Math.max(240, Math.min(Math.round(width), maxSize));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const { state, held, target } = useAppStore(
    useShallow((s) => ({
      state: s.status.state,
      held: s.portfolio.positions.map((p) => p.symbol).join(","),
      target: targetSymbol(s),
    })),
  );

  const live = useRef({ state, prev: state, changedAt: 0, held, target });
  useEffect(() => {
    const l = live.current;
    if (l.state !== state) {
      l.prev = l.state;
      l.state = state;
      l.changedAt = performance.now();
    }
    l.held = held;
    l.target = target;
  }, [state, held, target]);

  const redrawKey = reduced ? `${state}|${held}|${target}` : "";

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const font = getComputedStyle(document.body).fontFamily || "sans-serif";

    let raf = 0;
    let onScreen = true;
    let last = performance.now();
    let rot = 0.35;

    const frame = (now: number) => {
      const l = live.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      rot += dt * ROT_SPEED[l.state];
      const mix = reduced ? 1 : Math.min(1, (now - l.changedAt) / 400);
      draw({ ctx, size, t: reduced ? 1.2 : now / 1000, rot, state: l.state, prev: l.prev, mix, held: l.held.split(","), target: l.target, font });
      raf = !reduced && onScreen && !document.hidden ? requestAnimationFrame(frame) : 0;
    };
    const start = () => {
      if (!raf && !reduced) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    frame(performance.now());
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      if (onScreen) start();
    });
    io.observe(canvas);
    const onVis = () => !document.hidden && onScreen && start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [size, reduced, redrawKey]);

  return (
    <div ref={wrapRef} className="w-full" style={{ maxWidth: maxSize }}>
      <canvas ref={canvasRef} aria-hidden className="mx-auto block" style={{ width: size, height: size }} />
    </div>
  );
}
