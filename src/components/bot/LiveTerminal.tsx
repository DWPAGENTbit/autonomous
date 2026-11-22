"use client";

import clsx from "clsx";
import Link from "next/link";
import { LineChart, NotebookPen, Power, Radar, ShieldCheck, UserRound, Zap, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";
import type { AgentName, JournalEntry, LastDecision } from "@/lib/server/bot/types";
import { AGENT_TONE, baseOf, type BotView, money, monthProgress, ordersThisMonth, quoteOf, signedMoney, timeOf } from "./bot-client";

/**
 * The real bot drawn as the Demo terminal: the same team and flow, but every number,
 * step and log line comes from the bot's own last checks and its trade journal.
 */

type Stage = AgentName | "Pencatat";
type Tone = "accent" | "violet" | "caution" | "positive" | "negative" | "muted";

const toneBg: Record<Tone, string> = {
  accent: "bg-accent-soft text-accent",
  violet: "bg-[#7c3aed]/10 text-[#7c3aed]",
  caution: "bg-caution-soft text-caution",
  positive: "bg-positive-soft text-positive",
  negative: "bg-negative-soft text-negative",
  muted: "bg-sunken text-ink-2",
};
const toneText: Record<Tone, string> = {
  accent: "text-accent",
  violet: "text-[#7c3aed]",
  caution: "text-caution",
  positive: "text-positive",
  negative: "text-negative",
  muted: "text-ink-2",
};

const FLOW: Stage[] = ["Pemindai", "Analis", "Risiko", "Eksekutor", "Pencatat"];
const FLOW_LABEL: Record<Stage, string> = { Pemindai: "Pindai", Analis: "Analisis", Risiko: "Risiko", Eksekutor: "Eksekusi", Pencatat: "Catat" };

function Chip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={clsx("inline-flex items-center px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-[0.1em] uppercase", toneBg[tone])}>{children}</span>;
}

const ACTION: Record<LastDecision["action"] | JournalEntry["action"], { label: string; tone: Tone }> = {
  buy: { label: "Beli", tone: "accent" },
  sell: { label: "Jual", tone: "positive" },
  hold: { label: "Tahan", tone: "muted" },
  error: { label: "Gagal", tone: "negative" },
};

const pctText = (v: number) => `${v > 0 ? "+" : ""}${v.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;
const priceText = (v: number, quote: string) => (quote === "IDR" ? money(v, "IDR") : v.toLocaleString("en-US", { maximumFractionDigits: 6 }));
/** Why: for an order, the Analis's signal; for a hold, the agent that said no (the last one to speak). */
const reasonOf = (steps: { agent: AgentName; text: string }[], acted: boolean) =>
  (acted ? steps.find((s) => s.agent === "Analis")?.text : undefined) ?? steps.at(-1)?.text ?? "";

export function LiveTerminal({ view: v, equity }: { view: BotView; equity?: number | null }) {
  const reduced = useReducedMotion();
  const s = v.settings;
  const p = s.params;
  const auto = s.auto;
  const progress = monthProgress(v);
  const holds = v.decisions.filter((d) => d.action === "hold").length;
  const acted = v.decisions.length - holds;
  const orders = ordersThisMonth(v);
  const newest = v.decisions[0];

  // Where the newest check ended: a hold stops at the agent that said no, an order runs to the log.
  const stage: Stage | null = !auto ? null : !newest ? "Pemindai" : newest.action === "hold" ? (newest.steps.at(-1)?.agent ?? "Pemindai") : "Pencatat";
  const flowIdx = stage ? FLOW.indexOf(stage) : -1;
  const stageNote = !newest ? "menunggu" : newest.action === "hold" ? "berhenti" : "tercatat";

  // `watch` is new; a server from the previous deploy may still answer without it.
  const watch = useMemo(() => v.watch ?? [], [v.watch]);
  const movers = useMemo(() => [...watch].sort((a, b) => Math.abs(b.change24hPct ?? 0) - Math.abs(a.change24hPct ?? 0)).slice(0, 4), [watch]);
  const waitingEntry = v.decisions.filter((d) => d.action === "hold" && d.steps.at(-1)?.agent === "Analis").length;
  const top = movers.find((m) => m.change24hPct !== null);

  const AGENTS: { key: Stage | "Anda"; role: string; rule: string; tag: string; icon: LucideIcon; tone: Tone; live: string }[] = [
    {
      key: "Pemindai",
      role: "Membaca harga, saldo, dan perubahan 24 jam",
      rule: "hanya membaca, tidak pernah bertransaksi",
      tag: "Pindai",
      icon: Radar,
      tone: "accent",
      live: `${watch.length} pasangan${top ? ` · ${baseOf(top.pair)} ${pctText(top.change24hPct!)}` : ""}`,
    },
    {
      key: "Analis",
      role: "Mencari titik masuk dan titik ambil untung",
      rule: `masuk saat turun ${p.entryDipPct}% · jual di +${p.takeProfitPct}% bersih`,
      tag: "Analisis",
      icon: LineChart,
      tone: "violet",
      live: `${waitingEntry} menunggu titik masuk`,
    },
    {
      key: "Risiko",
      role: "Menjaga ukuran order dan batas modal",
      rule: `maks ${p.maxAllocPct}% modal di koin, sisanya tunai`,
      tag: "Periksa",
      icon: ShieldCheck,
      tone: "caution",
      live: `disaring ${holds} · lolos ${acted}`,
    },
    {
      key: "Eksekutor",
      role: "Mengirim order ke bursa",
      rule: "hanya menjual koin yang dibeli bot sendiri",
      tag: "Eksekusi",
      icon: Zap,
      tone: "positive",
      live: `${v.positions.length} posisi · ${orders} order bulan ini`,
    },
    {
      key: "Pencatat",
      role: "Menulis setiap keputusan dan transaksi",
      rule: "tak ada transaksi tanpa alasan",
      tag: "Tulis",
      icon: NotebookPen,
      tone: "muted",
      live: v.lastTick ? `cek terakhir ${timeOf(v.lastTick.at)} · ${v.journal.length} catatan` : "belum ada catatan",
    },
    {
      key: "Anda",
      role: "Menyalakan atau mematikan mode otomatis",
      rule: "bot tidak pernah menyalakan dirinya sendiri",
      tag: "Pemilik",
      icon: UserRound,
      tone: "muted",
      live: auto ? `otomatis aktif · ${v.mode === "live" ? "uang sungguhan" : "uji"}` : "otomatis mati",
    },
  ];

  // Last real trade, and the bot's position in that pair if it still holds one.
  const lastTrade = v.journal.find((j) => j.ok && j.action !== "error");
  const lastPos = lastTrade ? v.positions.find((x) => x.broker === lastTrade.broker && x.pair === lastTrade.pair) : undefined;

  // A log tail: the agents' words on the newest checks, and the trades, newest first.
  const tail = useMemo(() => {
    const lines: { id: string; at: number; tag: string; tone: string; text: string }[] = [];
    for (const d of v.decisions.slice(0, 3))
      d.steps.forEach((st, i) => lines.push({ id: `${d.broker}-${d.pair}-${i}`, at: d.at, tag: st.agent, tone: AGENT_TONE[st.agent], text: `${baseOf(d.pair)}: ${st.text}` }));
    for (const j of v.journal.slice(0, 5))
      lines.push({ id: j.id, at: j.at, tag: ACTION[j.action].label, tone: j.ok ? "text-positive" : "text-negative", text: `${baseOf(j.pair)}: ${j.message}` });
    return lines.sort((a, b) => b.at - a.at).slice(0, 8);
  }, [v.decisions, v.journal]);

  const x = (i: number) => 60 + i * 120;
  const target = progress.target;
  const done = Math.max(progress.realized, 0);
  const max = Math.max(target, done, 1);

  return (
    <div className="glass overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 items-center gap-x-6 gap-y-5 border-b border-line p-5 md:p-6">
        <div className="col-span-12 flex items-center gap-4 md:col-span-6">
          <Link
            href="/akun#bot"
            className={clsx(
              "inline-flex size-14 shrink-0 items-center justify-center rounded-full border transition-colors",
              auto ? "border-positive/40 bg-positive-soft text-positive" : "border-line-strong bg-canvas text-ink-3 hover:border-ink/40",
            )}
            aria-label="Atur mode otomatis di halaman Akun"
          >
            <Power className="size-5" aria-hidden />
          </Link>
          <div className="min-w-0">
            <p className="text-xl tracking-[-0.01em] text-ink md:text-2xl">
              <span className="font-semibold text-accent">DWP</span> Terminal Earn Money
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-ink-3">
              <span className={clsx("inline-flex items-center gap-1.5", auto ? "text-positive" : "text-ink-3")}>
                <span className={clsx("size-1.5 rounded-full", auto ? "animate-pulse bg-positive" : "bg-ink-4")} />
                {auto ? "berjalan" : "mati"}
              </span>
              {v.lastTick && <span className="num">cek {timeOf(v.lastTick.at)}</span>}
              <span className={clsx("rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.1em] uppercase", v.mode === "live" ? "bg-negative-soft text-negative" : "bg-caution-soft text-caution")}>
                {v.mode === "live" ? "Uang nyata" : "Uji"}
              </span>
            </p>
            <p className="mt-1 text-xs text-ink-3">
              Setiap transaksi punya alasan.{v.scheduled ? " Jalan sendiri tiap 15 menit, walau HP mati." : ""}
            </p>
          </div>
        </div>
        <dl className="col-span-12 grid grid-cols-2 gap-x-4 gap-y-3 min-[420px]:grid-cols-4 md:col-span-6">
          {[
            { k: "Ekuitas", v: equity != null ? money(equity, "IDR") : money(progress.capital, progress.quote) },
            { k: "Keputusan", v: String(v.decisions.length) },
            { k: "Transaksi", v: String(orders), tone: "text-positive" },
            { k: "Disaring", v: String(holds), tone: "text-negative" },
          ].map((t) => (
            <div key={t.k} className="min-w-0">
              <dd className={clsx("num truncate text-lg font-light tracking-[-0.02em] md:text-2xl", t.tone ?? "text-ink")}>{t.v}</dd>
              <dt className="label text-[9px]">{t.k}</dt>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid grid-cols-12">
        {/* Roster */}
        <aside className="col-span-12 border-b border-line p-4 lg:col-span-4 lg:border-r lg:border-b-0" aria-label="Tim agen">
          <p className="label mb-3 flex justify-between text-[10px]">
            <span>Agen</span>
            <span className="text-ink-4">{auto ? "5 aktif" : "dijeda"}</span>
          </p>
          <ul className="space-y-2">
            {AGENTS.map((a) => {
              const on = stage === a.key;
              const Icon = a.icon;
              return (
                <li key={a.key} className={clsx("relative rounded-sm border p-3 transition-colors duration-300", on ? "border-accent/60 bg-accent-soft/40 shadow-raise" : "border-line")}>
                  <div className="flex items-start gap-3">
                    <span className={clsx("inline-flex size-8 shrink-0 items-center justify-center rounded-sm", toneBg[a.tone])}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-ink">{a.key}</p>
                        <span className="ml-auto">
                          <Chip tone={on ? "accent" : a.key === "Anda" && !auto ? "caution" : "muted"}>{a.key === "Anda" && !auto ? "Dibutuhkan" : a.tag}</Chip>
                        </span>
                      </div>
                      <p className="text-xs text-ink-3">{a.role}</p>
                      <p className={clsx("mt-1 text-xs font-medium", toneText[a.tone])}>{a.rule}</p>
                      <p className="num mt-0.5 truncate font-mono text-[11px] text-ink-2">{a.live}</p>
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
              <span>Alur langsung · pindai → analisis → risiko → eksekusi → catat</span>
              <span className="text-ink-4">dicek {v.decisions.length}</span>
            </p>
            {movers.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {movers.map((m) => (
                  <div key={`${m.broker}-${m.pair}`} className="flex min-w-0 items-center justify-between gap-2 rounded-sm border border-line px-2.5 py-1.5">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-medium text-ink">
                        {baseOf(m.pair)}/{quoteOf(m.pair)}
                      </p>
                      <p className={clsx("num truncate font-mono text-[10px]", (m.change24hPct ?? 0) >= 0 ? "text-positive" : "text-negative")}>
                        {m.change24hPct !== null ? `${pctText(m.change24hPct)} 24j` : m.price !== null ? priceText(m.price, quoteOf(m.pair)) : "—"}
                      </p>
                    </div>
                    <span className={clsx("size-1.5 shrink-0 rounded-full", (m.change24hPct ?? 0) > 0 ? "bg-positive" : (m.change24hPct ?? 0) < 0 ? "bg-negative" : "bg-ink-4")} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-3">Belum ada pasangan yang dipantau. Pilih di halaman Akun.</p>
            )}

            {/* On a phone the drawing would shrink to unreadable text, so the steps are plain rows of dots. */}
            <ol className="relative mt-4 grid grid-cols-5 gap-1 sm:hidden" aria-label={stage ? `Pemeriksaan terakhir sampai tahap ${stage}` : "Mode otomatis mati"}>
              <span aria-hidden className="absolute top-[18px] right-[10%] left-[10%] h-0.5 bg-line" />
              {flowIdx > 0 && (
                <span
                  aria-hidden
                  className="absolute top-[18px] left-[10%] h-0.5 bg-gradient-to-r from-[#0a63f2] to-[#19d3f0]"
                  style={{ width: `${(flowIdx / (FLOW.length - 1)) * 80}%` }}
                />
              )}
              {FLOW.map((k, i) => {
                const on = i === flowIdx;
                const passed = flowIdx >= 0 && i < flowIdx;
                return (
                  <li key={k} className="relative flex flex-col items-center text-center">
                    <span
                      className={clsx(
                        "inline-flex size-9 items-center justify-center rounded-full border font-mono text-sm font-semibold",
                        on ? "border-accent bg-accent text-white shadow-[0_0_0_5px_rgb(10_99_242/0.15)]" : passed ? "border-accent bg-white text-accent" : "border-line-strong bg-white text-ink-4",
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className={clsx("mt-1.5 text-[11px]", on ? "font-semibold text-ink" : "text-ink-3")}>{FLOW_LABEL[k]}</span>
                    <span className={clsx("font-mono text-[9px]", on ? "text-accent" : "text-ink-4")}>{on ? stageNote : passed ? "lolos" : "menunggu"}</span>
                  </li>
                );
              })}
            </ol>

            <svg viewBox="0 0 600 130" className="mt-4 hidden w-full sm:block" role="img" aria-label={stage ? `Pemeriksaan terakhir sampai tahap ${stage}` : "Mode otomatis mati"}>
              <defs>
                <linearGradient id="live-flow-line" x1="0" x2="1">
                  <stop offset="0" stopColor="#0a63f2" />
                  <stop offset="1" stopColor="#19d3f0" />
                </linearGradient>
              </defs>
              <line x1={x(0)} y1={52} x2={x(4)} y2={52} stroke="#dbe5e0" strokeWidth={2} />
              {flowIdx > 0 && <line x1={x(0)} y1={52} x2={x(flowIdx)} y2={52} stroke="url(#live-flow-line)" strokeWidth={2} />}
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
                const on = i === flowIdx;
                const passed = flowIdx >= 0 && i < flowIdx;
                return (
                  <g key={k}>
                    {on && !reduced && (
                      <motion.circle
                        cx={x(i)}
                        cy={52}
                        fill="none"
                        stroke="#0a63f2"
                        strokeWidth={1.5}
                        initial={{ r: 22, opacity: 0.6 }}
                        animate={{ r: 34, opacity: 0 }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                      />
                    )}
                    <circle cx={x(i)} cy={52} r={22} fill={on ? "#0a63f2" : "#ffffff"} stroke={on || passed ? "#0a63f2" : "#c6d3cd"} strokeWidth={on ? 0 : 1.5} />
                    <text x={x(i)} y={57} textAnchor="middle" fontSize={14} fontWeight={600} fill={on ? "#ffffff" : passed ? "#0a63f2" : "#93a19b"} fontFamily="ui-monospace, monospace">
                      {i + 1}
                    </text>
                    <text x={x(i)} y={96} textAnchor="middle" fontSize={12} fill={on ? "#0f1d18" : "#5f6f69"} fontWeight={on ? 600 : 400}>
                      {FLOW_LABEL[k]}
                    </text>
                    <text x={x(i)} y={113} textAnchor="middle" fontSize={10} fill={on ? "#0a63f2" : "#93a19b"} fontFamily="ui-monospace, monospace">
                      {on ? stageNote : passed ? "lolos" : "menunggu"}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { k: "Disaring", v: String(holds), s: `${acted} bertindak`, tone: "text-negative" },
                { k: "Modal kerja", v: money(progress.capital, progress.quote), s: `maks ${p.maxAllocPct}% di koin`, tone: "text-accent" },
                { k: "Pencatat", v: `#${v.journal.length}`, s: "masing-masing beralasan", tone: "text-caution" },
                { k: "Cuan bulan ini", v: signedMoney(progress.realized, progress.quote), s: "sudah terealisasi", tone: progress.realized >= 0 ? "text-positive" : "text-negative" },
              ].map((t) => (
                <div key={t.k} className="min-w-0 rounded-sm border border-line px-3 py-2">
                  <p className="label text-[9px]">{t.k}</p>
                  <p className={clsx("num truncate text-lg font-light tracking-[-0.02em]", t.tone)}>{t.v}</p>
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
                <Chip tone={lastPos ? "positive" : "muted"}>{lastPos ? "Terbuka" : lastTrade ? "Ditutup" : "Belum ada"}</Chip>
              </p>
              {lastTrade ? (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-mono text-xl font-medium text-ink">
                      {baseOf(lastTrade.pair)}/{quoteOf(lastTrade.pair)}
                    </p>
                    {lastPos && lastPos.netPct !== null ? (
                      <p className={clsx("num font-mono text-lg", lastPos.netPct >= 0 ? "text-positive" : "text-negative")}>{pctText(lastPos.netPct)}</p>
                    ) : (
                      lastTrade.pnl !== undefined && (
                        <p className={clsx("num font-mono text-lg", lastTrade.pnl >= 0 ? "text-positive" : "text-negative")}>{signedMoney(lastTrade.pnl, quoteOf(lastTrade.pair))}</p>
                      )
                    )}
                  </div>
                  <dl className="num mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
                    <dt className="text-ink-3">{ACTION[lastTrade.action].label.toLowerCase()}</dt>
                    <dd className="text-ink">
                      {lastTrade.price !== undefined ? priceText(lastTrade.price, quoteOf(lastTrade.pair)) : "—"} · pkl {timeOf(lastTrade.at)}
                    </dd>
                    {lastPos && (
                      <>
                        <dt className="text-ink-3">rata-rata</dt>
                        <dd className="text-ink">{priceText(lastPos.cost / lastPos.qty, quoteOf(lastPos.pair))}</dd>
                        <dt className="text-ink-3">kini</dt>
                        <dd className="text-ink">{lastPos.price !== null ? priceText(lastPos.price, quoteOf(lastPos.pair)) : "—"}</dd>
                        <dt className="text-ink-3">ambil untung</dt>
                        <dd className="text-positive">+{p.takeProfitPct}% bersih</dd>
                        <dt className="text-ink-3">modal</dt>
                        <dd className="text-ink">{money(lastPos.cost, quoteOf(lastPos.pair))}</dd>
                      </>
                    )}
                    {!lastPos && lastTrade.quote !== undefined && (
                      <>
                        <dt className="text-ink-3">nilai</dt>
                        <dd className="text-ink">{money(lastTrade.quote, quoteOf(lastTrade.pair))}</dd>
                      </>
                    )}
                  </dl>
                  <p className="mt-3 text-xs text-ink-2">
                    <span className="font-mono text-ink-3">alasan: </span>
                    {reasonOf(lastTrade.steps, true) || lastTrade.message}
                  </p>
                </>
              ) : (
                <p className="text-sm text-ink-3">
                  Belum ada transaksi. Bot hanya bertindak saat syaratnya terpenuhi{auto ? "" : " — dan mode otomatis sedang mati"}.
                </p>
              )}
            </section>

            <section className="col-span-12 min-w-0 border-line bg-white/45 p-4 md:col-span-6 md:border-l md:p-5" aria-label="Log langsung">
              <p className="mb-3 flex justify-between font-mono text-[10px] text-ink-4">
                <span>$ tail -f agen.log</span>
                <span>{tail.length} baris</span>
              </p>
              {tail.length ? (
                <ol className="space-y-1.5 font-mono text-[11px] leading-snug">
                  {tail.map((e, i) => (
                    <motion.li
                      key={e.id}
                      initial={reduced || i > 0 ? false : { opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="grid grid-cols-[2.8rem_4.4rem_1fr] gap-2"
                    >
                      <span className="num text-ink-4">{timeOf(e.at)}</span>
                      <span className={clsx("truncate uppercase", e.tone)}>{e.tag}</span>
                      <span className="truncate text-ink-2" title={e.text}>
                        {e.text}
                      </span>
                    </motion.li>
                  ))}
                  <li aria-hidden className="h-3 w-1.5 animate-pulse bg-accent" />
                </ol>
              ) : (
                <p className="font-mono text-[11px] text-ink-3">{auto ? "Menunggu pemeriksaan pertama…" : "Mode otomatis mati."}</p>
              )}
            </section>
          </div>

          {/* Result */}
          <section className="border-b border-line p-4 md:p-5" aria-label="Hasil">
            <p className="label mb-3 text-[10px]">Hasil · target bulan ini vs sudah terealisasi</p>
            {[
              { k: "Target", v: target, bar: "bg-ink-4" },
              { k: "Sudah", v: done, bar: "" },
            ].map((r) => (
              <div key={r.k} className="mb-2 grid grid-cols-[3.5rem_1fr_auto] items-center gap-3">
                <span className="label text-[10px]">{r.k}</span>
                <span className="h-1.5 rounded-full bg-sunken">
                  <motion.span
                    className={clsx("block h-full rounded-full", r.bar)}
                    style={r.bar ? undefined : { background: "linear-gradient(90deg, #0a63f2, #19d3f0)" }}
                    initial={false}
                    animate={{ width: `${(r.v / max) * 100}%` }}
                  />
                </span>
                <span className="num font-mono text-sm text-ink">{money(r.v, progress.quote)}</span>
              </div>
            ))}
          </section>

          {/* Decision log with reasons */}
          <section className="p-4 md:p-5" aria-label="Log keputusan">
            <p className="label mb-3 flex justify-between text-[10px]">
              <span>Log keputusan</span>
              <span className="text-ink-4">setiap baris beralasan</span>
            </p>
            {v.decisions.length ? (
              <ol className="divide-y divide-line">
                {v.decisions.slice(0, 7).map((d) => {
                  const meta = ACTION[d.action];
                  return (
                    <li key={`${d.broker}-${d.pair}`} className="grid grid-cols-[2.8rem_4.2rem_1fr] items-start gap-x-3 py-2.5 sm:grid-cols-[3rem_4.6rem_1fr_auto]">
                      <span className="num pt-0.5 font-mono text-[11px] text-ink-3">{timeOf(d.at)}</span>
                      <span>
                        <Chip tone={meta.tone}>{meta.label}</Chip>
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-medium text-ink">
                          {baseOf(d.pair)}/{quoteOf(d.pair)} · {d.broker === "indodax" ? "Indodax" : "Tokocrypto"}
                        </p>
                        <p className="line-clamp-2 text-[11px] text-ink-3">
                          <span className="font-mono">alasan: </span>
                          {reasonOf(d.steps, d.action !== "hold")}
                        </p>
                      </div>
                      <span className="col-start-3 font-mono text-[11px] text-ink-3 sm:col-start-auto sm:text-right">
                        {d.action === "buy" ? "dibeli" : d.action === "sell" ? "dijual" : "tidak ditransaksikan"}
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm text-ink-3">{auto ? "Menunggu pemeriksaan pertama…" : "Mode otomatis mati. Nyalakan di halaman Akun."}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
