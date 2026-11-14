"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { CornerDownRight } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { AgentGlyph } from "@/components/agent/AgentGlyph";
import { AGENT_STATE_META, PIPELINE, pipelineIndex, toneText } from "@/components/agent/agent-meta";
import { StatusDot } from "@/components/shared/primitives";
import { transition } from "@/lib/design/tokens";
import { useAppStore } from "@/store/app-store";

/**
 * Answers "what is the agent doing right now?" — state, task, progress,
 * and what comes next. Motion encodes the state; text states it plainly.
 */
export function AgentStatus({ glyphSize = 184, showGlyph = true }: { glyphSize?: number; showGlyph?: boolean }) {
  const status = useAppStore((s) => s.status);
  const meta = AGENT_STATE_META[status.state];
  const stepKey = `${status.since}-${status.task}`;

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
      {showGlyph && (
        <div className="relative shrink-0 self-start border border-line bg-surface/60" style={{ width: glyphSize, height: glyphSize }}>
          <AgentGlyph state={status.state} size={glyphSize} />
          <span className="label absolute bottom-2 left-2.5 text-[10px] text-ink-4">{meta.label}</span>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center gap-2.5">
          <StatusDot tone={meta.tone} pulse={status.state !== "IDLE"} />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={status.state}
              className={clsx("label", toneText[meta.tone])}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={transition.state}
            >
              Agen · {meta.label}
            </motion.span>
          </AnimatePresence>
        </div>

        <div className="relative min-h-[3.5rem]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={stepKey}
              className="text-xl leading-snug font-normal tracking-[-0.01em] text-ink md:text-[1.375rem]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={transition.meaning}
            >
              {status.task}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="mt-4 h-px w-full overflow-hidden bg-line" aria-hidden>
          {status.stepDurationMs > 0 && (
            <motion.div
              key={stepKey}
              className="h-px origin-left bg-ink"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: status.stepDurationMs / 1000, ease: "linear" }}
            />
          )}
        </div>

        <p className="mt-3 flex items-start gap-2 text-sm text-ink-3">
          <CornerDownRight className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            <span className="text-ink-2">Berikutnya</span> · {status.next}
          </span>
        </p>
      </div>
    </div>
  );
}

/** The working loop as a quiet track, with the active stage marked. */
export function AgentPipeline() {
  const { state, running } = useAppStore(useShallow((s) => ({ state: s.status.state, running: s.running })));
  const active = pipelineIndex(state);
  const waiting = state === "WAITING_FOR_APPROVAL";

  return (
    <ol className="grid grid-cols-7 border-t border-line" aria-label="Siklus kerja agen">
      {PIPELINE.map((stage, i) => {
        const isActive = i === active && running;
        const done = active >= 0 && i < active;
        return (
          <li key={stage.key} className="relative pt-3" aria-current={isActive ? "step" : undefined}>
            {isActive && (
              <motion.span
                layoutId="pipeline-marker"
                className={clsx("absolute -top-px left-0 h-[2px] w-full", waiting ? "bg-caution" : "bg-ink")}
                transition={transition.meaning}
              />
            )}
            <span
              className={clsx(
                "label num block truncate text-[10px] transition-colors duration-200 sm:text-micro",
                isActive ? (waiting ? "text-caution" : "text-ink") : done ? "text-ink-2" : "text-ink-4",
              )}
            >
              <span className="hidden sm:inline">0{i + 1} </span>
              {stage.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Screen-reader narration of state changes, without announcing every tick. */
export function AgentAnnouncer() {
  const { state, approvals } = useAppStore(
    useShallow((s) => ({ state: s.status.state, approvals: s.approvals.length })),
  );
  // Announces state transitions only; task text changes every few seconds and would be noise.
  return (
    <>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {`Agen sekarang ${AGENT_STATE_META[state].label.toLowerCase()}.`}
      </p>
      <p className="sr-only" aria-live="assertive" aria-atomic="true">
        {approvals > 0 ? `${approvals} keputusan butuh persetujuan Anda.` : ""}
      </p>
    </>
  );
}
