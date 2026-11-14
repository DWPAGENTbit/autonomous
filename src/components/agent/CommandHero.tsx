"use client";

import { motion } from "motion/react";
import { useShallow } from "zustand/react/shallow";
import { AgentPipeline, AgentStatus } from "@/components/agent/AgentStatus";
import { AnimatedValue, Delta, SimBadge } from "@/components/shared/primitives";
import { Sparkline } from "@/components/markets/PerformanceChart";
import { useCapital } from "@/hooks/use-derived";
import { stagger, transition } from "@/lib/design/tokens";
import { formatSignedUsd, formatUsd, greetingFor } from "@/lib/formatting/format";
import { useAppStore } from "@/store/app-store";

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: transition.scene },
};

/**
 * The first screen answers, in order: is the agent working, on what,
 * and how is capital doing. Typography and space do the work — no cards.
 */
export function CommandHero() {
  const { simTime, running, approvals, decisionsToday } = useAppStore(
    useShallow((s) => ({
      simTime: s.simTime,
      running: s.running,
      approvals: s.approvals.length,
      decisionsToday: s.decisions.length,
    })),
  );
  const capital = useCapital();
  const history = useAppStore((s) => s.portfolio.equityHistory);
  const headline = !running
    ? "Your economic agent is paused."
    : approvals > 0
      ? "Your economic agent needs you."
      : "Your economic agent is active.";

  return (
    <motion.section
      className="mx-auto max-w-[1360px] px-4 pt-10 pb-12 sm:px-6 md:px-10 md:pt-16 lg:px-12"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger.group * 1.5 } } }}
      aria-labelledby="hero-title"
    >
      <motion.p variants={item} className="label num mb-4">
        {greetingFor(simTime)} <span className="mx-1.5 text-ink-4">·</span> Simulated session
      </motion.p>
      <motion.h1
        variants={item}
        id="hero-title"
        className="max-w-[18ch] text-4xl leading-[1.05] font-light tracking-[-0.035em] text-ink sm:text-5xl lg:text-display"
      >
        {headline}
      </motion.h1>

      <div className="mt-12 grid grid-cols-12 gap-x-6 gap-y-12 md:mt-16">
        {/* Status first on phones; equity first on wide screens. */}
        <motion.div variants={item} className="order-2 col-span-12 lg:order-1 lg:col-span-5">
          <div className="mb-2 flex items-center gap-3">
            <p className="label">Current equity</p>
            <SimBadge compact />
          </div>
          <AnimatedValue
            value={capital.total}
            format={(v) => formatUsd(v)}
            className="block text-5xl font-light tracking-[-0.04em] text-ink sm:text-6xl"
          />
          <p className="mt-3 text-sm text-ink-2">
            <Delta value={capital.monthReturnPct} /> this month
            <span className="mx-2 text-ink-4">·</span>
            <Delta value={capital.monthPnl} format={(v) => formatSignedUsd(v)} />
          </p>
          <div className="mt-6 flex items-end gap-6">
            <Sparkline values={[...history.slice(0, -1), capital.total]} width={180} height={40} tone="neutral" />
            <p className="text-xs leading-relaxed text-ink-3">
              30-day equity
              <br />
              {decisionsToday} decisions today
            </p>
          </div>
        </motion.div>

        <motion.div variants={item} className="order-1 col-span-12 lg:order-2 lg:col-span-7 lg:pl-6">
          <AgentStatus />
        </motion.div>
      </div>

      <motion.div variants={item} className="mt-14">
        <AgentPipeline />
      </motion.div>
    </motion.section>
  );
}
