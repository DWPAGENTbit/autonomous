"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { transition } from "@/lib/design/tokens";

/** Server and client must print identical coordinates. */
const round = (v: number) => Math.round(v * 100) / 100;

/** Circular progress toward the month's profit target, drawn like a dial. */
export function TargetDial({ progress, size = 220 }: { progress: number; size?: number }) {
  const gradient = useId();
  const r = size / 2 - 16;
  const c = 2 * Math.PI * r;
  const arc = 0.75; // a 270° dial, open at the bottom
  const p = Math.max(0, Math.min(1, progress));
  const ticks = Array.from({ length: 37 }, (_, i) => i);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="max-w-full" aria-hidden>
      <defs>
        <linearGradient id={gradient} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#3fa58c" />
          <stop offset="0.6" stopColor="#6cc9b1" />
          <stop offset="1" stopColor="#6cc9b1" />
        </linearGradient>
      </defs>
      <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
        {ticks.map((i) => {
          const a = (i / 36) * arc * 2 * Math.PI;
          const lit = i / 36 <= p;
          const r1 = r + 9;
          const r2 = r + (i % 6 === 0 ? 15 : 12);
          return (
            <line
              key={i}
              x1={round(size / 2 + r1 * Math.cos(a))}
              y1={round(size / 2 + r1 * Math.sin(a))}
              x2={round(size / 2 + r2 * Math.cos(a))}
              y2={round(size / 2 + r2 * Math.sin(a))}
              stroke={lit ? "#3fa58c" : "rgba(15,40,32,0.15)"}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          );
        })}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(15,40,32,0.08)" strokeWidth={12} strokeDasharray={`${c * arc} ${c}`} strokeLinecap="round" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradient})`}
          strokeWidth={12}
          strokeLinecap="round"
          initial={false}
          animate={{ strokeDasharray: `${c * arc * Math.max(p, 0.004)} ${c}` }}
          transition={transition.meaning}
        />
      </g>
      <circle cx={size / 2} cy={size / 2} r={r - 22} fill="rgba(255,255,255,0.7)" />
    </svg>
  );
}
