"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useShallow } from "zustand/react/shallow";
import { toneText } from "@/components/agent/agent-meta";
import { DecisionChain } from "@/components/decisions/DecisionChain";
import { OUTCOME_META } from "@/components/decisions/decision-meta";
import { transition } from "@/lib/design/tokens";
import { formatClock } from "@/lib/formatting/format";
import { useAppStore } from "@/store/app-store";
import { useUiStore } from "@/store/ui-store";

/** The decision in focus: the user's pick, otherwise the latest. */
export function FocusedDecision({ compact = false }: { compact?: boolean }) {
  const focusedId = useUiStore((s) => s.focusedDecisionId);
  const decision = useAppStore((s) => (focusedId && s.decisions.find((d) => d.id === focusedId)) || s.decisions[0]);
  if (!decision) return null;
  return <DecisionChain key={decision.id} decision={decision} compact={compact} />;
}

/** Recent decisions as a compact index; selecting one brings it into focus. */
export function DecisionIndex({ limit = 5 }: { limit?: number }) {
  const decisions = useAppStore(useShallow((s) => s.decisions.slice(0, limit)));
  const { focusedId, focus } = useUiStore(useShallow((s) => ({ focusedId: s.focusedDecisionId, focus: s.focusDecision })));
  const current = focusedId ?? decisions[0]?.id;

  return (
    <ul aria-label="Recent decisions">
      <AnimatePresence initial={false}>
        {decisions.map((d) => {
          const o = OUTCOME_META[d.outcome];
          const isCurrent = d.id === current;
          return (
            <motion.li
              key={d.id}
              layout="position"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={transition.meaning}
              className="overflow-hidden"
            >
              <button
                type="button"
                onClick={() => focus(d.id === decisions[0]?.id ? null : d.id)}
                aria-pressed={isCurrent}
                className={clsx(
                  "group grid w-full grid-cols-[4.25rem_1fr_auto] items-baseline gap-x-3 border-b border-line py-3 text-left transition-colors duration-150",
                  isCurrent ? "text-ink" : "text-ink-2 hover:text-ink",
                )}
              >
                <span className="num font-mono text-xs text-ink-3">{formatClock(d.at, false)}</span>
                <span className="flex min-w-0 items-baseline gap-2">
                  <span
                    aria-hidden
                    className={clsx("h-3 w-px shrink-0 self-center transition-colors", isCurrent ? "bg-ink" : "bg-transparent")}
                  />
                  <span className="truncate text-sm">{d.subject}</span>
                </span>
                <span className={clsx("label text-[10px]", toneText[o.tone])}>{o.label}</span>
              </button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
