"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import Link from "next/link";
import { ArrowUpRight, Bot, Clock3, Landmark, Pause, Play, Sparkles, Target, TrendingUp, Wallet } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { AgentCore } from "@/components/agent/AgentCore";
import { AgentPipeline, AgentStatus } from "@/components/agent/AgentStatus";
import { useAgentService } from "@/components/layout/SimulationProvider";
import { Sparkline } from "@/components/markets/PerformanceChart";
import { expectedValue } from "@/components/opportunities/OpportunityFeed";
import { AnimatedValue, Delta, SimBadge } from "@/components/shared/primitives";
import { TargetDial } from "@/components/shared/TargetDial";
import { useCapital } from "@/hooks/use-derived";
import { stagger, transition } from "@/lib/design/tokens";
import { formatSignedUsd, formatUsd, greetingFor } from "@/lib/formatting/format";
import { useAppStore } from "@/store/app-store";

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: transition.scene },
};

/** Monthly profit target: 5% on the equity the month started with. */
const TARGET_RATE = 0.05;

function Kpi({
  icon: Icon,
  label,
  children,
  foot,
  spark,
  tone = "neutral",
}: {
  icon: typeof Wallet;
  label: string;
  children: React.ReactNode;
  foot?: React.ReactNode;
  spark?: number[];
  tone?: "neutral" | "positive" | "negative";
}) {
  return (
    <motion.div variants={item} className="glass flex flex-col p-4 md:p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex size-7 items-center justify-center rounded-[9px] bg-white/80 text-accent shadow-[var(--shadow-raise)]">
          <Icon className="size-3.5" aria-hidden />
        </span>
        <p className="text-xs text-ink-3">{label}</p>
      </div>
      <div className="text-2xl font-light tracking-[-0.03em] text-ink md:text-[1.7rem]">{children}</div>
      <div className="mt-auto flex items-end justify-between gap-3 pt-3">
        <p className="text-[11px] text-ink-3">{foot}</p>
        {spark && spark.length > 1 && <Sparkline values={spark} width={84} height={26} tone={tone} />}
      </div>
    </motion.div>
  );
}

/**
 * The first screen is an earnings dashboard: how much the agent has made,
 * how close it is to the month's target, and what it is doing right now.
 */
export function CommandHero() {
  const { simTime, running, approvals, decisions, opportunities } = useAppStore(
    useShallow((s) => ({
      simTime: s.simTime,
      running: s.running,
      approvals: s.approvals.length,
      decisions: s.decisions.length,
      opportunities: s.opportunities,
    })),
  );
  const service = useAgentService();
  const capital = useCapital();
  const history = useAppStore((s) => s.portfolio.equityHistory);
  const equity = [...history.slice(0, -1), capital.total];
  const monthStart = history[0] ?? capital.total - capital.monthPnl;
  const target = monthStart * TARGET_RATE;
  const progress = target > 0 ? capital.monthPnl / target : 0;
  const pnlSeries = equity.map((v) => v - monthStart);
  const active = opportunities.filter((o) => o.status !== "Dilewati");
  const pipelineEv = active.reduce((a, o) => a + expectedValue(o), 0);

  const headline = !running
    ? "Mesin cuan Anda sedang dijeda."
    : approvals > 0
      ? "Ada peluang yang menunggu persetujuan Anda."
      : "Agen Anda sedang bekerja mencari cuan.";

  return (
    <motion.section
      className="mx-auto max-w-[1360px] px-3 pt-4 pb-5 sm:px-4 md:pt-6 lg:px-6"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger.group } } }}
      aria-labelledby="hero-title"
    >
      <div className="grid grid-cols-12 gap-4 md:gap-5">
        {/* Greeting and the one-line state of the money */}
        <motion.div variants={item} className="glass relative col-span-12 overflow-hidden p-6 md:p-8 xl:col-span-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-28 -right-20 size-80 rounded-full opacity-80 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(108,201,177,0.42), rgba(18,117,98,0.14) 55%, transparent 72%)" }}
          />
          <div className="relative flex flex-wrap items-center gap-2">
            <span className="pill !py-1 text-[11px]">
              <Clock3 className="size-3" aria-hidden /> {greetingFor(simTime)}
            </span>
            <SimBadge />
          </div>
          <h2 id="hero-title" className="relative mt-5 max-w-[22ch] text-3xl leading-[1.08] font-light tracking-[-0.035em] text-ink sm:text-4xl lg:text-5xl">
            {headline}
          </h2>
          <p className="relative mt-4 max-w-[60ch] text-base text-ink-2">
            Bulan ini agen menghasilkan <Delta value={capital.monthPnl} format={(v) => formatSignedUsd(v)} className="font-medium" /> (
            <Delta value={capital.monthReturnPct} />) dari modal Anda, dengan {active.length} peluang di luar pasar sedang dikerjakan.
          </p>
          <div className="relative mt-6 flex flex-wrap gap-2">
            <Link href="/opportunities" className="pill pill-accent !px-4 !py-2 text-sm">
              <Sparkles className="size-3.5" aria-hidden /> Lihat peluang cuan
            </Link>
            <Link href="/akun" className="pill !px-4 !py-2 text-sm">
              <Landmark className="size-3.5" aria-hidden /> Akun nyata
            </Link>
            <button type="button" onClick={() => (running ? service.pause() : service.resume())} className="pill !px-4 !py-2 text-sm">
              {running ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
              {running ? "Jeda agen" : "Lanjutkan agen"}
            </button>
          </div>

          {/* Quick tiles, as in a control dashboard */}
          <div className="relative mt-7 grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {[
              { k: "Peluang aktif", v: String(active.length), href: "/opportunities", icon: Sparkles },
              { k: "Menunggu Anda", v: String(approvals), href: "/#approval", icon: Target, warn: approvals > 0 },
              { k: "Keputusan hari ini", v: String(decisions), href: "/agent", icon: Bot },
              { k: "Kas tersedia", v: formatUsd(capital.available, { whole: true }), href: "/capital", icon: Wallet },
            ].map((t) => (
              <Link
                key={t.k}
                href={t.href}
                className={clsx(
                  "group flex items-center gap-3 rounded-[16px] border border-glass-edge bg-white/55 p-3 transition-colors hover:bg-white/85",
                  t.warn && "ring-1 ring-caution/40",
                )}
              >
                <span className={clsx("inline-flex size-8 shrink-0 items-center justify-center rounded-[10px]", t.warn ? "bg-caution-soft text-caution" : "bg-accent-soft text-accent")}>
                  <t.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="num block truncate text-sm font-medium text-ink">{t.v}</span>
                  <span className="block text-[11px] leading-tight text-ink-3">{t.k}</span>
                </span>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Monthly target dial */}
        <motion.div variants={item} className="glass col-span-12 flex flex-col items-center p-6 md:col-span-6 xl:col-span-4">
          <div className="flex w-full items-center justify-between">
            <p className="text-sm font-medium text-ink">Target cuan bulan ini</p>
            <span className="pill !py-0.5 text-[10px]">{Math.round(TARGET_RATE * 100)}% modal</span>
          </div>
          <div className="relative mt-2">
            <TargetDial progress={progress} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <AnimatedValue value={Math.max(0, progress) * 100} format={(v) => `${v.toFixed(0)}%`} className="text-5xl font-light tracking-[-0.04em] text-ink" />
              <p className="mt-1 text-[11px] text-ink-3">tercapai</p>
            </div>
          </div>
          <div className="mt-1 grid w-full grid-cols-2 gap-2 text-center">
            <div className="rounded-[14px] bg-white/55 p-2.5">
              <p className="text-[11px] text-ink-3">Sudah</p>
              <Delta value={capital.monthPnl} format={(v) => formatSignedUsd(v)} className="text-sm font-medium" />
            </div>
            <div className="rounded-[14px] bg-white/55 p-2.5">
              <p className="text-[11px] text-ink-3">Target</p>
              <p className="num text-sm font-medium text-ink">{formatUsd(target, { whole: true })}</p>
            </div>
          </div>
        </motion.div>

        {/* KPI tiles */}
        <div className="col-span-12 grid grid-cols-2 gap-4 md:col-span-6 md:gap-5 xl:col-span-12 xl:grid-cols-4">
          <Kpi icon={Wallet} label="Ekuitas" spark={equity} foot="30 hari terakhir">
            <AnimatedValue value={capital.total} format={(v) => formatUsd(v, { whole: true })} />
          </Kpi>
          <Kpi icon={TrendingUp} label="Cuan bulan ini" spark={pnlSeries} tone={capital.monthPnl >= 0 ? "positive" : "negative"} foot={<Delta value={capital.monthReturnPct} />}>
            <AnimatedValue
              value={capital.monthPnl}
              format={(v) => formatSignedUsd(v)}
              className={capital.monthPnl >= 0 ? "text-positive" : "text-negative"}
            />
          </Kpi>
          <Kpi icon={Sparkles} label="Nilai harapan peluang" foot={`${active.length} peluang aktif`}>
            <AnimatedValue value={pipelineEv} format={(v) => formatUsd(v, { whole: true })} />
          </Kpi>
          <Kpi icon={Target} label="Belum terealisasi" foot={`Drawdown ${capital.drawdownPct.toFixed(1)}%`}>
            <AnimatedValue
              value={capital.unrealized}
              format={(v) => formatSignedUsd(v)}
              className={capital.unrealized >= 0 ? "text-positive" : "text-negative"}
            />
          </Kpi>
        </div>

        {/* The agent itself, drawn live */}
        <motion.div variants={item} className="glass col-span-12 overflow-hidden p-6 md:p-8">
          <div className="grid grid-cols-12 items-center gap-x-6 gap-y-8">
            <div className="col-span-12 lg:col-span-5">
              <div className="relative mx-auto max-w-[420px]">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-[8%] rounded-full opacity-70 blur-3xl"
                  style={{ background: "radial-gradient(circle, rgba(108,201,177,0.3), rgba(18,117,98,0.08) 55%, transparent 70%)" }}
                />
                <AgentCore maxSize={420} />
              </div>
            </div>
            <div className="col-span-12 lg:col-span-7">
              <div className="mb-5 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink">Apa yang dikerjakan agen sekarang</p>
                <Link href="/agent" className="pill">
                  Tim agen <ArrowUpRight className="size-3" aria-hidden />
                </Link>
              </div>
              <AgentStatus showGlyph={false} />
            </div>
          </div>
          <div className="mt-8 rounded-[18px] border border-glass-edge bg-white/45 p-4 md:p-5">
            <AgentPipeline />
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
