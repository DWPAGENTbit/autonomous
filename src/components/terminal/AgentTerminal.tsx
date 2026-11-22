"use client";

import clsx from "clsx";
import { NotebookPen, Pause, Play, Radar, Scale, ShieldCheck, UserRound, Wallet, Zap, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { OUTCOME_META } from "@/components/decisions/decision-meta";
import { ACTIVITY_META, toneText, type Tone } from "@/components/agent/agent-meta";
import { useAgentService } from "@/components/layout/SimulationProvider";
import { SimBadge } from "@/components/shared/primitives";
import { INSTRUMENTS } from "@/data/instruments";
import { useCapital } from "@/hooks/use-derived";
import { formatClock, formatSignedPct, formatSignedUsd, formatUsd } from "@/lib/formatting/format";
import { useAppStore } from "@/store/app-store";
import type { AgentState, Decision } from "@/types/domain";

/**
 * The agent as a team: each specialist has one job and one rule it never
 * breaks, work flows scan → check → size → execute → log, and every line
 * in the log carries its reason.
 */

type AgentKey = "scan" | "check" | "size" | "exec" | "log" | "equity" | "you";

const AGENTS: { key: AgentKey; name: string; role: string; rule: string; tag: string; icon: LucideIcon; tone: Tone }[] = [
  { key: "scan", name: "Pemindai", role: "Mencari pasar dan peluang yang bergerak", rule: "hanya menandai, tidak pernah bertransaksi", tag: "Pindai", icon: Radar, tone: "caution" },
  { key: "check", name: "Pemeriksa risiko", role: "Menyaring kandidat yang lemah atau berbahaya", rule: "tak ada eksekusi sebelum lolos", tag: "Periksa", icon: ShieldCheck, tone: "negative" },
  { key: "size", name: "Penentu ukuran", role: "Menghitung ukuran dari ekuitas akun", rule: "tidak pernah memakai tiket tetap", tag: "Ukur", icon: Scale, tone: "accent" },
  { key: "exec", name: "Eksekutor", role: "Membuka dan menutup posisi, menjaga stop", rule: "risiko per transaksi selalu dibatasi", tag: "Eksekusi", icon: Zap, tone: "positive" },
  { key: "log", name: "Pencatat", role: "Menulis setiap keputusan", rule: "tak ada transaksi tanpa alasan", tag: "Tulis", icon: NotebookPen, tone: "caution" },
  { key: "equity", name: "Ekuitas", role: "Saldo dan kurva modal", rule: "diperbarui setiap posisi berubah", tag: "Perbarui", icon: Wallet, tone: "accent" },
  { key: "you", name: "Anda", role: "Membaca log, menyetujui yang besar", rule: "keputusan di luar batas menunggu Anda", tag: "Membaca", icon: UserRound, tone: "muted" },
];

const ACTIVE: Record<AgentState, AgentKey> = {
  IDLE: "log",
  OBSERVING: "scan",
  RESEARCHING: "scan",
  ANALYZING: "check",
  SIMULATING: "size",
  DECIDING: "size",
  EXECUTING: "exec",
  MONITORING: "equity",
  WAITING_FOR_APPROVAL: "you",
};

const FLOW: AgentKey[] = ["scan", "check", "size", "exec", "log"];

const toneBg: Record<Tone, string> = {
  positive: "bg-positive-soft text-positive",
  negative: "bg-negative-soft text-negative",
  accent: "bg-accent-soft text-accent",
  caution: "bg-caution-soft text-caution",
  muted: "bg-sunken text-ink-2",
};

const toneStroke: Record<Tone, string> = {
  positive: "#2e7a4e",
  negative: "#b0412e",
  accent: "#0b63e5",
  caution: "#9a6410",
  muted: "#55554f",
};

function Chip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={clsx("inline-flex items-center px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-[0.1em] uppercase", toneBg[tone])}>{children}</span>;
}

const sizeOf = (d: Decision) => d.chain.find((s) => s.label === "Ukuran posisi")?.value;

export function AgentTerminal() {
  const reduced = useReducedMotion();
  const service = useAgentService();
  const capital = useCapital();
  const { state, simTime, running, approvals, decisions, activity, quotes, policy, monthStart } = useAppStore(
    useShallow((s) => ({
      state: s.status.state,
      simTime: s.simTime,
      running: s.running,
      approvals: s.approvals.length,
      decisions: s.decisions,
      activity: s.activity,
      quotes: s.quotes,
      policy: s.policy,
      monthStart: s.portfolio.monthStartEquity,
    })),
  );

  const active = running ? ACTIVE[state] : null;
  const recent = useMemo(() => [...decisions].sort((a, b) => b.at - a.at), [decisions]);
  const tail = useMemo(() => [...activity].sort((a, b) => b.at - a.at).slice(0, 7), [activity]);
  const filtered = decisions.filter((d) => d.outcome === "REJECT" || d.outcome === "PASS").length;
  const passed = decisions.length - filtered;
  const trades = decisions.filter((d) => d.outcome === "TRADE").length;
  const movers = useMemo(
    () =>
      Object.values(quotes)
        .map((q) => ({ symbol: q.symbol, change: ((q.price - q.dayOpen) / q.dayOpen) * 100, tick: q.tick }))
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
        .slice(0, 4),
    [quotes],
  );
  const biggest = capital.positions.reduce((m, p) => Math.max(m, p.weightPct), 0);
  // The newest open position, or failing that the newest trade decision.
  const newestPos = [...capital.positions].sort((a, b) => b.openedAt - a.openedAt)[0];
  const tradeDecision = recent.find((d) => d.outcome === "TRADE");
  const lastPos =
    tradeDecision && (!newestPos || tradeDecision.at >= newestPos.openedAt)
      ? capital.positions.find((p) => p.decisionId === tradeDecision.id)
      : newestPos;
  const lastTrade = lastPos ? decisions.find((d) => d.id === lastPos.decisionId) : tradeDecision;
  const lastSubject = lastPos ? INSTRUMENTS[lastPos.symbol].pair : lastTrade?.subject;
  const lastReason = lastTrade ? (lastTrade.factors[0] ?? lastTrade.headline) : lastPos ? "Dibuka pada sesi sebelumnya; stop dan target dipantau terus." : "";

  const live: Record<AgentKey, string> = {
    scan: movers[0] ? `berikutnya ${movers[0].symbol} · ${formatSignedPct(movers[0].change, 1)}` : "menunggu data",
    check: `disaring ${filtered} · lolos ${passed}`,
    size: `terbesar ${biggest.toFixed(0)}% · otonom ≤${policy.maxPositionPctOfEquity}%`,
    exec: `${capital.positions.length} posisi · risiko maks ${policy.maxRiskPerTradePct}%`,
    log: `keputusan #${decisions.length}`,
    equity: `${formatUsd(capital.total)} · ${formatSignedUsd(capital.monthPnl)}`,
    you: approvals > 0 ? `${approvals} keputusan menunggu` : "tidak ada yang menunggu",
  };

  const flowIdx = active ? FLOW.indexOf(active) : -1;
  const x = (i: number) => 60 + i * 120;

  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface">
      {/* Header */}
      <div className="grid grid-cols-12 items-center gap-x-6 gap-y-5 border-b border-line p-5 md:p-6">
        <div className="col-span-12 flex items-center gap-4 md:col-span-6">
          <button
            type="button"
            onClick={() => (running ? service.pause() : service.resume())}
            className="inline-flex size-14 shrink-0 items-center justify-center rounded-full border border-line-strong bg-canvas text-ink transition-colors hover:border-ink/40"
            aria-label={running ? "Jeda tim agen" : "Lanjutkan tim agen"}
          >
            {running ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
          </button>
          <div className="min-w-0">
            <p className="text-xl tracking-[-0.01em] text-ink md:text-2xl">
              <span className="font-semibold text-accent">DWP</span> Terminal Earn Money
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-ink-3">
              <span className={clsx("inline-flex items-center gap-1.5", running ? "text-positive" : "text-ink-3")}>
                <span className={clsx("size-1.5 rounded-full", running ? "bg-positive" : "bg-ink-4")} />
                {running ? "berjalan" : "dijeda"}
              </span>
              <span className="num">{formatClock(simTime)}</span>
              <SimBadge compact />
            </p>
            <p className="mt-1 text-xs text-ink-3">Setiap transaksi punya alasan.</p>
          </div>
        </div>
        <dl className="col-span-12 grid grid-cols-4 gap-4 md:col-span-6">
          {[
            { k: "Ekuitas", v: formatUsd(capital.total, { whole: true }) },
            { k: "Keputusan", v: String(decisions.length) },
            { k: "Transaksi", v: String(trades), tone: "text-positive" },
            { k: "Disaring", v: String(filtered), tone: "text-negative" },
          ].map((s) => (
            <div key={s.k} className="min-w-0">
              <dd className={clsx("num truncate text-lg font-light tracking-[-0.02em] md:text-2xl", s.tone ?? "text-ink")}>{s.v}</dd>
              <dt className="label text-[9px]">{s.k}</dt>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid grid-cols-12">
        {/* Roster */}
        <aside className="col-span-12 border-b border-line p-4 lg:col-span-4 lg:border-r lg:border-b-0" aria-label="Tim agen">
          <p className="label mb-3 flex justify-between text-[10px]">
            <span>Agen</span>
            <span className="text-ink-4">6 aktif</span>
          </p>
          <ul className="space-y-2">
            {AGENTS.map((a) => {
              const on = active === a.key;
              const Icon = a.icon;
              return (
                <li
                  key={a.key}
                  className={clsx(
                    "relative rounded-sm border p-3 transition-colors duration-300",
                    on ? "border-accent/60 bg-accent-soft/40 shadow-raise" : "border-line",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className={clsx("inline-flex size-8 shrink-0 items-center justify-center rounded-sm", toneBg[a.tone])}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-ink">{a.name}</p>
                        <span className="ml-auto">
                          <Chip tone={on ? "accent" : a.key === "you" && approvals > 0 ? "caution" : "muted"}>{a.key === "you" && approvals > 0 ? "Dibutuhkan" : a.tag}</Chip>
                        </span>
                      </div>
                      <p className="text-xs text-ink-3">{a.role}</p>
                      <p className={clsx("mt-1 text-xs font-medium", toneText[a.tone])}>{a.rule}</p>
                      <p className="num mt-0.5 truncate font-mono text-[11px] text-ink-2">{live[a.key]}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="col-span-12 min-w-0 lg:col-span-8">
          {/* Live flow */}
          <section className="border-b border-line p-4 md:p-5" aria-label="Alur langsung">
            <p className="label mb-3 flex flex-wrap justify-between gap-2 text-[10px]">
              <span>Alur langsung · pindai → periksa → ukur → eksekusi → catat</span>
              <span className="text-ink-4">diperiksa {decisions.length}</span>
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {movers.map((m) => (
                <div key={m.symbol} className="flex items-center justify-between rounded-sm border border-line px-2.5 py-1.5">
                  <div>
                    <p className="font-mono text-xs font-medium text-ink">{m.symbol}</p>
                    <p className={clsx("num font-mono text-[10px]", m.change >= 0 ? "text-positive" : "text-negative")}>{formatSignedPct(m.change, 2)}</p>
                  </div>
                  <span className={clsx("size-1.5 rounded-full", m.tick > 0 ? "bg-positive" : m.tick < 0 ? "bg-negative" : "bg-ink-4")} />
                </div>
              ))}
            </div>

            <svg viewBox="0 0 600 130" className="mt-4 w-full" role="img" aria-label={active ? `Tahap aktif: ${AGENTS.find((a) => a.key === active)?.name}` : "Tim dijeda"}>
              <defs>
                <linearGradient id="flow-line" x1="0" x2="1">
                  <stop offset="0" stopColor="#0b63e5" />
                  <stop offset="1" stopColor="#19d3f0" />
                </linearGradient>
              </defs>
              <line x1={x(0)} y1={52} x2={x(4)} y2={52} stroke="#e7e6e1" strokeWidth={2} />
              {flowIdx > 0 && <line x1={x(0)} y1={52} x2={x(flowIdx)} y2={52} stroke="url(#flow-line)" strokeWidth={2} />}
              {flowIdx >= 0 && !reduced && (
                <motion.circle
                  key={flowIdx}
                  r={4}
                  cy={52}
                  fill="#19d3f0"
                  initial={{ cx: x(Math.max(0, flowIdx - 1)), opacity: 0 }}
                  animate={{ cx: x(flowIdx), opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              {FLOW.map((k, i) => {
                const a = AGENTS.find((g) => g.key === k)!;
                const on = i === flowIdx;
                const done = flowIdx >= 0 && i < flowIdx;
                return (
                  <g key={k}>
                    {on && !reduced && (
                      <motion.circle
                        cx={x(i)}
                        cy={52}
                        fill="none"
                        stroke={toneStroke.accent}
                        strokeWidth={1.5}
                        initial={{ r: 22, opacity: 0.6 }}
                        animate={{ r: 34, opacity: 0 }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                      />
                    )}
                    <circle
                      cx={x(i)}
                      cy={52}
                      r={22}
                      fill={on ? "#0b63e5" : "#ffffff"}
                      stroke={on || done ? "#0b63e5" : "#d5d4cd"}
                      strokeWidth={on ? 0 : 1.5}
                    />
                    <text x={x(i)} y={57} textAnchor="middle" fontSize={14} fontWeight={600} fill={on ? "#ffffff" : done ? "#0b63e5" : "#a3a29b"} fontFamily="ui-monospace, monospace">
                      {i + 1}
                    </text>
                    <text x={x(i)} y={96} textAnchor="middle" fontSize={12} fill={on ? "#141413" : "#6f6e68"} fontWeight={on ? 600 : 400}>
                      {a.name.split(" ")[0]}
                    </text>
                    <text x={x(i)} y={113} textAnchor="middle" fontSize={10} fill={on ? "#0b63e5" : "#a3a29b"} fontFamily="ui-monospace, monospace">
                      {on ? "aktif" : done ? "selesai" : "menunggu"}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { k: "Disaring", v: String(filtered), s: `${passed} lolos`, tone: "text-negative" },
                { k: "Ukuran", v: `${biggest.toFixed(0)}% eq`, s: "dari ekuitas", tone: "text-accent" },
                { k: "Pencatat", v: `#${decisions.length}`, s: "masing-masing beralasan", tone: "text-caution" },
                { k: "Ekuitas", v: formatSignedUsd(capital.monthPnl, { whole: true }), s: "bulan ini", tone: capital.monthPnl >= 0 ? "text-positive" : "text-negative" },
              ].map((t) => (
                <div key={t.k} className="rounded-sm border border-line px-3 py-2">
                  <p className="label text-[9px]">{t.k}</p>
                  <p className={clsx("num text-lg font-light tracking-[-0.02em]", t.tone)}>{t.v}</p>
                  <p className="truncate text-[10px] text-ink-4">{t.s}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Last trade + tail */}
          <div className="grid grid-cols-12 border-b border-line">
            <section className="col-span-12 border-b border-line p-4 md:col-span-6 md:border-r md:border-b-0 md:p-5" aria-label="Transaksi terakhir">
              <p className="label mb-3 flex justify-between text-[10px]">
                <span>Transaksi terakhir · masuk vs kini</span>
                <Chip tone={lastPos ? "positive" : "muted"}>{lastPos ? "Terbuka" : "Ditutup"}</Chip>
              </p>
              {lastSubject ? (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-mono text-xl font-medium text-ink">{lastSubject}</p>
                    {lastPos && (
                      <p className={clsx("num font-mono text-lg", lastPos.unrealized >= 0 ? "text-positive" : "text-negative")}>
                        {formatSignedUsd(lastPos.unrealized)}
                      </p>
                    )}
                  </div>
                  {lastPos && (
                    <dl className="num mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
                      <dt className="text-ink-3">masuk</dt>
                      <dd className="text-ink">{lastPos.entryPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })}</dd>
                      <dt className="text-ink-3">kini</dt>
                      <dd className="text-ink">{lastPos.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}</dd>
                      <dt className="text-ink-3">stop</dt>
                      <dd className="text-negative">{lastPos.stopPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })}</dd>
                      <dt className="text-ink-3">ukuran</dt>
                      <dd className="text-ink">{lastPos.weightPct.toFixed(0)}% dari ekuitas</dd>
                    </dl>
                  )}
                  <p className="mt-3 text-xs text-ink-2">
                    <span className="font-mono text-ink-3">alasan: </span>
                    {lastReason}
                  </p>
                </>
              ) : (
                <p className="text-sm text-ink-3">Belum ada transaksi hari ini.</p>
              )}
            </section>

            <section className="col-span-12 bg-[#141413] p-4 md:col-span-6 md:p-5" aria-label="Log langsung">
              <p className="mb-3 flex justify-between font-mono text-[10px] text-[#a3a29b]">
                <span>$ tail -f agen.log</span>
                <span>{activity.length} baris</span>
              </p>
              <ol className="space-y-1.5 font-mono text-[11px] leading-snug">
                {tail.map((e, i) => (
                  <motion.li
                    key={e.id}
                    initial={reduced || i > 0 ? false : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="grid grid-cols-[3.2rem_4.6rem_1fr] gap-2"
                  >
                    <span className="num text-[#6f6e68]">{formatClock(e.at, false)}</span>
                    <span className={clsx("uppercase", ACTIVITY_META[e.kind].tone === "muted" ? "text-[#a3a29b]" : "text-[#19d3f0]")}>
                      {ACTIVITY_META[e.kind].label}
                    </span>
                    <span className="truncate text-[#efeeea]">{e.message}</span>
                  </motion.li>
                ))}
                <li aria-hidden className="h-3 w-1.5 animate-pulse bg-[#efeeea]" />
              </ol>
            </section>
          </div>

          {/* Result */}
          <section className="border-b border-line p-4 md:p-5" aria-label="Hasil">
            <p className="label mb-3 text-[10px]">Hasil · awal bulan vs kini</p>
            {[
              { k: "Awal", v: monthStart },
              { k: "Kini", v: capital.total },
            ].map((r) => {
              const max = Math.max(monthStart, capital.total);
              return (
                <div key={r.k} className="mb-2 grid grid-cols-[3.5rem_1fr_auto] items-center gap-3">
                  <span className="label text-[10px]">{r.k}</span>
                  <span className="h-1.5 rounded-full bg-sunken">
                    <motion.span
                      className={clsx("block h-full rounded-full", r.k !== "Kini" && "bg-ink-4")}
                      style={r.k === "Kini" ? { background: "linear-gradient(90deg, #0b63e5, #19d3f0)" } : undefined}
                      initial={false}
                      animate={{ width: `${(r.v / max) * 100}%` }}
                    />
                  </span>
                  <span className="num font-mono text-sm text-ink">{formatUsd(r.v)}</span>
                </div>
              );
            })}
          </section>

          {/* Decision log with reasons */}
          <section className="p-4 md:p-5" aria-label="Log keputusan">
            <p className="label mb-3 flex justify-between text-[10px]">
              <span>Log keputusan</span>
              <span className="text-ink-4">setiap baris beralasan</span>
            </p>
            <ol className="divide-y divide-line">
              {recent.slice(0, 7).map((d) => {
                const meta = OUTCOME_META[d.outcome];
                const size = sizeOf(d);
                return (
                  <li key={d.id} className="grid grid-cols-[3rem_5.8rem_1fr] items-start gap-x-3 py-2.5 sm:grid-cols-[3.2rem_6.4rem_1fr_auto]">
                    <span className="num pt-0.5 font-mono text-[11px] text-ink-3">{formatClock(d.at, false)}</span>
                    <span>
                      <Chip tone={meta.tone}>{meta.label}</Chip>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-medium text-ink">{d.subject}</p>
                      <p className="truncate text-[11px] text-ink-3">
                        <span className="font-mono">alasan: </span>
                        {d.headline}
                      </p>
                    </div>
                    <span className="col-start-3 font-mono text-[11px] text-ink-3 sm:col-start-auto sm:text-right">
                      {d.outcome === "TRADE" || d.outcome === "AWAITING_APPROVAL" ? (size ?? "masuk") : d.outcome === "PURSUE" ? "dikejar" : "tidak ditransaksikan"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
