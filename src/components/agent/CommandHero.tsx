"use client";

import { motion } from "motion/react";
import { useShallow } from "zustand/react/shallow";
import { AgentCore } from "@/components/agent/AgentCore";
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
    ? "Mesin cuan Anda sedang dijeda."
    : approvals > 0
      ? "Ada peluang yang menunggu persetujuan Anda."
      : "Agen Anda sedang bekerja mencari cuan.";

  return (
    <motion.section
      className="mx-auto max-w-[1360px] px-4 pt-10 pb-12 sm:px-6 md:px-10 md:pt-16 lg:px-12"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger.group * 1.5 } } }}
      aria-labelledby="hero-title"
    >
      <motion.p variants={item} className="label num mb-4">
        {greetingFor(simTime)} <span className="mx-1.5 text-ink-4">·</span> DWP EARN MONEY <span className="mx-1.5 text-ink-4">·</span> Sesi simulasi
      </motion.p>
      <motion.h1
        variants={item}
        id="hero-title"
        className="max-w-[20ch] text-4xl leading-[1.05] font-light tracking-[-0.035em] text-ink sm:text-5xl lg:text-display"
      >
        {headline}
      </motion.h1>

      <div className="mt-10 grid grid-cols-12 items-center gap-x-6 gap-y-10 md:mt-12">
        {/* The agent itself is the hero: what it is doing, drawn live. */}
        <motion.div variants={item} className="col-span-12 lg:col-span-6">
          <div className="relative mx-auto max-w-[540px]">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-[8%] rounded-full opacity-60 blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(25,211,240,0.18), rgba(11,99,229,0.06) 55%, transparent 70%)" }}
            />
            <AgentCore maxSize={540} />
          </div>
        </motion.div>

        <motion.div variants={item} className="col-span-12 lg:col-span-6 lg:pl-4">
          <AgentStatus showGlyph={false} />

          <div className="mt-10 border-t border-line pt-8">
            <div className="mb-2 flex items-center gap-3">
              <p className="label">Ekuitas saat ini</p>
              <SimBadge compact />
            </div>
            <AnimatedValue
              value={capital.total}
              format={(v) => formatUsd(v)}
              className="block text-5xl font-light tracking-[-0.04em] text-ink sm:text-6xl"
            />
            <p className="mt-3 text-sm text-ink-2">
              <Delta value={capital.monthReturnPct} /> bulan ini
              <span className="mx-2 text-ink-4">·</span>
              <Delta value={capital.monthPnl} format={(v) => formatSignedUsd(v)} />
            </p>
            <div className="mt-6 flex items-end gap-6">
              <Sparkline values={[...history.slice(0, -1), capital.total]} width={180} height={40} tone="neutral" />
              <p className="text-xs leading-relaxed text-ink-3">
                Ekuitas 30 hari
                <br />
                {decisionsToday} keputusan hari ini
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div variants={item} className="mt-14">
        <AgentPipeline />
      </motion.div>
    </motion.section>
  );
}
