"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import { toneText } from "@/components/agent/agent-meta";
import { OUTCOME_META, STEP_MARK } from "@/components/decisions/decision-meta";
import { stagger, transition } from "@/lib/design/tokens";
import type { Decision } from "@/types/domain";

/**
 * Concise reasoning for a decision: the factors, the confidence, and what
 * would make it wrong. Deliberately not a transcript of internal deliberation.
 */
export function WhyPanel({ decision }: { decision: Decision }) {
  const outcome = OUTCOME_META[decision.outcome];
  return (
    <div className="space-y-9">
      <div>
        <p className={clsx("label mb-2", toneText[outcome.tone])}>{outcome.label}</p>
        <p className="text-lg leading-relaxed text-ink">{decision.headline}</p>
      </div>

      <section aria-labelledby="why-factors">
        <h3 id="why-factors" className="label mb-4">
          Alasan keputusan ini
        </h3>
        <motion.ol
          className="space-y-3"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: stagger.tight, delayChildren: 0.1 } } }}
        >
          {decision.factors.map((f, i) => (
            <motion.li
              key={f}
              className="grid grid-cols-[1.5rem_1fr] text-sm text-ink-2"
              variants={{ hidden: { opacity: 0, x: -4 }, show: { opacity: 1, x: 0, transition: transition.state } }}
            >
              <span className="num font-mono text-xs text-ink-4">{i + 1}.</span>
              <span>{f}</span>
            </motion.li>
          ))}
        </motion.ol>
      </section>

      <section className="grid grid-cols-2 gap-6 border-t border-line pt-6">
        <div>
          <h3 className="label mb-2">Keyakinan</h3>
          <p className="num text-4xl font-light tracking-[-0.02em] text-ink">{Math.round(decision.confidence * 100)}%</p>
          <div className="mt-3 h-[3px] w-full bg-line" aria-hidden>
            <motion.div
              className="h-full origin-left bg-ink"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: decision.confidence }}
              transition={transition.scene}
            />
          </div>
        </div>
        <div>
          <h3 className="label mb-2">Batal jika</h3>
          <p className="text-sm leading-relaxed text-ink-2">“{decision.invalidation}”</p>
        </div>
      </section>

      <section aria-labelledby="why-chain" className="border-t border-line pt-6">
        <h3 id="why-chain" className="label mb-4">
          Decision gates
        </h3>
        <ol className="space-y-0">
          {decision.chain.map((s) => {
            const mark = STEP_MARK[s.status];
            return (
              <li key={s.label} className="grid grid-cols-[1fr_auto] gap-x-4 border-b border-line py-2.5 text-sm">
                <span className="text-ink-3">{s.label}</span>
                <span className="flex items-baseline gap-2 text-right text-ink">
                  {s.value}
                  <span className={clsx("text-xs", mark.className)} aria-label={mark.sr}>
                    {mark.glyph}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {decision.assumptions.length > 0 && (
        <section aria-labelledby="why-assumptions">
          <h3 id="why-assumptions" className="label mb-3">
            Assumptions
          </h3>
          <ul className="space-y-1.5 text-sm text-ink-2">
            {decision.assumptions.map((a) => (
              <li key={a}>— {a}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="border-t border-line pt-5 text-xs leading-relaxed text-ink-3">
        Ditampilkan: faktor, bukti, dan batasan yang dipakai untuk menilai keputusan ini. Angka berasal dari
        simulasi dan merupakan data demo.
      </p>
    </div>
  );
}
