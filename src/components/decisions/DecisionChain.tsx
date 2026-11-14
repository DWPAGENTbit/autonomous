"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toneText } from "@/components/agent/agent-meta";
import { OUTCOME_META, STEP_MARK } from "@/components/decisions/decision-meta";
import { Button } from "@/components/shared/primitives";
import { stagger, transition } from "@/lib/design/tokens";
import { formatClock } from "@/lib/formatting/format";
import { useUiStore } from "@/store/ui-store";
import type { Decision, DecisionStep } from "@/types/domain";

/**
 * The reasoning structure of a decision, drawn as a chain of gates.
 * Each gate can be opened to show its evidence. The chain assembles
 * itself step by step when a new decision arrives.
 */
export function DecisionChain({ decision, compact = false }: { decision: Decision; compact?: boolean }) {
  const openWhy = useUiStore((s) => s.openWhy);
  const [selected, setSelected] = useState<number | null>(null);
  const outcome = OUTCOME_META[decision.outcome];
  const active = selected !== null ? decision.chain[selected] : null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="label num mb-2">
            {decision.domain === "MARKETS" ? "Keputusan pasar" : "Keputusan bisnis"} · {formatClock(decision.at)}
          </p>
          <p className="text-2xl font-normal tracking-[-0.015em] text-ink">
            {decision.subject}
            <span className={clsx("ml-3 align-middle text-sm", toneText[outcome.tone])}>{outcome.label}</span>
          </p>
          <p className="mt-1.5 max-w-[60ch] text-sm text-ink-2">{decision.headline}</p>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <p className="label text-[10px]">Keyakinan</p>
            <p className="num text-lg text-ink">{Math.round(decision.confidence * 100)}%</p>
          </div>
          <Button size="sm" onClick={() => openWhy(decision.id)} aria-label={`Why: reasoning for ${decision.subject}`}>
            Mengapa?
          </Button>
        </div>
      </div>

      {/* Desktop: horizontal chain */}
      <motion.ol
        key={decision.id}
        className={clsx("hidden gap-0 md:grid", compact && "md:hidden xl:grid")}
        style={{ gridTemplateColumns: `repeat(${decision.chain.length}, minmax(0, 1fr))` }}
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: stagger.chain } } }}
        aria-label={`Rantai keputusan untuk ${decision.subject}`}
      >
        {decision.chain.map((step, i) => (
          <ChainNode
            key={step.label}
            step={step}
            index={i}
            last={i === decision.chain.length - 1}
            selected={selected === i}
            onSelect={() => setSelected(selected === i ? null : i)}
          />
        ))}
      </motion.ol>

      <AnimatePresence initial={false} mode="wait">
        {active && (
          <motion.div
            key={selected}
            className={clsx("hidden overflow-hidden md:block", compact && "md:hidden xl:block")}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transition.panel}
          >
            <StepDetail step={active} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile and narrow columns: vertical chain */}
      <motion.ol
        key={`${decision.id}-v`}
        className={clsx("md:hidden", compact && "md:block xl:hidden")}
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: stagger.chain } } }}
      >
        {decision.chain.map((step, i) => (
          <VerticalNode
            key={step.label}
            step={step}
            last={i === decision.chain.length - 1}
            open={selected === i}
            onToggle={() => setSelected(selected === i ? null : i)}
          />
        ))}
      </motion.ol>
    </div>
  );
}

const nodeVariants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: transition.meaning },
};

function ChainNode({
  step,
  index,
  last,
  selected,
  onSelect,
}: {
  step: DecisionStep;
  index: number;
  last: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const mark = STEP_MARK[step.status];
  return (
    <motion.li variants={nodeVariants} className="relative min-w-0">
      {/* connector */}
      <div className="relative mb-3 flex h-3 items-center">
        <span
          className={clsx(
            "relative z-10 size-2.5 shrink-0 rounded-full border",
            step.status === "fail" ? "border-negative bg-negative" : last ? "border-ink bg-ink" : "border-ink-3 bg-canvas",
          )}
        />
        {!last && (
          <motion.span
            className="h-px flex-1 origin-left bg-line-strong"
            variants={{ hidden: { scaleX: 0 }, show: { scaleX: 1, transition: { ...transition.meaning, delay: 0.1 } } }}
          />
        )}
      </div>
      <button
        type="button"
        onClick={onSelect}
        aria-expanded={selected}
        className={clsx(
          "group w-full pr-3 text-left transition-colors duration-150",
          selected ? "text-ink" : "text-ink-2 hover:text-ink",
        )}
      >
        <span className="label num block min-h-[2rem] text-[10px] leading-4 text-balance">
          <span className="sr-only">Step {index + 1}: </span>
          {step.label}
        </span>
        <span
          className={clsx(
            "mt-1 block min-h-[2.6rem] text-[0.95rem] leading-snug break-words",
            last ? "font-medium text-ink" : "",
            step.status === "fail" && "text-negative",
          )}
        >
          {step.value}
        </span>
        <span className="mt-1.5 flex items-center gap-1.5 text-xs">
          <span className={mark.className} aria-hidden>
            {mark.glyph}
          </span>
          <span className="sr-only">{mark.sr}</span>
          <span
            className={clsx(
              "h-px flex-1 transition-colors duration-200",
              selected ? "bg-ink" : "bg-transparent group-hover:bg-line-strong",
            )}
            aria-hidden
          />
        </span>
      </button>
    </motion.li>
  );
}

function StepDetail({ step }: { step: DecisionStep }) {
  return (
    <div className="mt-5 grid grid-cols-12 gap-6 border-t border-line pt-5">
      <p className="col-span-12 text-sm text-ink-2 lg:col-span-7">
        <span className="label mr-2 text-ink">{step.label}</span>
        {step.detail}
      </p>
      {step.metrics && (
        <dl className="col-span-12 flex flex-wrap gap-x-8 gap-y-2 lg:col-span-5 lg:justify-end">
          {step.metrics.map((m) => (
            <div key={m.label}>
              <dt className="label text-[10px]">{m.label}</dt>
              <dd className="num text-sm text-ink">{m.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function VerticalNode({
  step,
  last,
  open,
  onToggle,
}: {
  step: DecisionStep;
  last: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const mark = STEP_MARK[step.status];
  return (
    <motion.li variants={nodeVariants} className="relative grid grid-cols-[1.25rem_1fr] gap-x-3">
      <div className="relative flex justify-center">
        <span
          className={clsx(
            "relative z-10 mt-1.5 size-2.5 rounded-full border",
            step.status === "fail" ? "border-negative bg-negative" : last ? "border-ink bg-ink" : "border-ink-3 bg-canvas",
          )}
        />
        {!last && <span className="absolute top-4 bottom-0 w-px bg-line-strong" aria-hidden />}
      </div>
      <div className="pb-4">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-baseline justify-between gap-3 text-left">
          <span className="min-w-0">
            <span className="label block text-[10px]">{step.label}</span>
            <span className={clsx("block text-[0.95rem]", last && "font-medium", step.status === "fail" ? "text-negative" : "text-ink")}>
              {step.value}
            </span>
          </span>
          <span className={clsx("text-xs", mark.className)}>
            <span aria-hidden>{mark.glyph}</span>
            <span className="sr-only">{mark.sr}</span>
          </span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.p
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={transition.panel}
              className="overflow-hidden pt-1.5 text-sm text-ink-2"
            >
              {step.detail}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  );
}
