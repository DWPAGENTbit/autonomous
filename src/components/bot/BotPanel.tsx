"use client";

import clsx from "clsx";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Bot, ChevronDown, Play, Radar, ShieldCheck, Sparkles, TrendingUp, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { StatusDot } from "@/components/shared/primitives";
import { isStablePair } from "@/lib/stablecoins";
import type { AgentStep, BotSettings, JournalEntry, LastDecision, Profile, StrategyParams } from "@/lib/server/bot/types";
import { AGENT_TONE, baseOf, type BotView, capitalShort, dateTimeOf, money, monthProgress, quoteOf, signedMoney, timeOf, useBot } from "./bot-client";

// ── Small pieces ─────────────────────────────────────────────

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  tone = "positive",
  size = "md",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  tone?: "positive" | "caution" | "accent";
  size?: "md" | "lg";
}) {
  const on = { positive: "bg-positive", caution: "bg-caution", accent: "bg-accent" }[tone];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative inline-flex shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        size === "lg" ? "h-9 w-16" : "h-6 w-11",
        checked ? on : "bg-ink-4/40",
      )}
    >
      <span
        className={clsx(
          "inline-block rounded-full bg-white shadow transition-transform",
          size === "lg" ? "size-7" : "size-5",
          checked ? (size === "lg" ? "translate-x-8" : "translate-x-5") : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function Steps({ steps }: { steps: AgentStep[] }) {
  return (
    <ol className="mt-2 space-y-1">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-2 text-xs leading-relaxed">
          <span className={clsx("w-[4.5rem] shrink-0 font-mono text-[10px] font-semibold tracking-[0.06em] uppercase", AGENT_TONE[s.agent])}>{s.agent}</span>
          <span className="min-w-0 text-ink-2">{s.text}</span>
        </li>
      ))}
    </ol>
  );
}

const ACTION_LABEL = { buy: "Beli", sell: "Jual", hold: "Tahan", error: "Gagal" } as const;
const ACTION_TONE = {
  buy: "bg-accent-soft text-accent",
  sell: "bg-positive-soft text-positive",
  hold: "bg-sunken text-ink-3",
  error: "bg-negative-soft text-negative",
} as const;

export function DecisionList({ decisions, empty }: { decisions: LastDecision[]; empty: string }) {
  if (!decisions.length) return <p className="text-sm text-ink-3">{empty}</p>;
  return (
    <ul className="space-y-3">
      {decisions.map((d) => (
        <li key={`${d.broker}-${d.pair}`} className="rounded-[16px] border border-glass-edge bg-white/55 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-medium", ACTION_TONE[d.action])}>{ACTION_LABEL[d.action]}</span>
            <span className="text-sm font-medium text-ink">
              {baseOf(d.pair)} / {quoteOf(d.pair)}
            </span>
            <span className="text-xs text-ink-3">· {d.broker === "indodax" ? "Indodax" : "Tokocrypto"}</span>
            <span className="num ml-auto text-[11px] text-ink-3">{timeOf(d.at)}</span>
          </div>
          <Steps steps={d.steps} />
        </li>
      ))}
    </ul>
  );
}

export function JournalList({ journal, empty }: { journal: JournalEntry[]; empty: string }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!journal.length) return <p className="text-sm text-ink-3">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {journal.map((j) => (
        <li key={j.id} className="py-2.5">
          <button type="button" onClick={() => setOpen(open === j.id ? null : j.id)} className="flex w-full items-center gap-3 text-left" aria-expanded={open === j.id}>
            <span className={clsx("w-12 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-medium", ACTION_TONE[j.action])}>{ACTION_LABEL[j.action]}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-ink">
                {baseOf(j.pair)}
                {j.quote !== undefined && <span className="num text-ink-3"> · {money(j.quote, quoteOf(j.pair))}</span>}
              </span>
              <span className="num block text-[11px] text-ink-3">{dateTimeOf(j.at)}</span>
            </span>
            {j.pnl !== undefined && (
              <span className={clsx("num text-sm font-medium", j.pnl >= 0 ? "text-positive" : "text-negative")}>{signedMoney(j.pnl, quoteOf(j.pair))}</span>
            )}
            <ChevronDown className={clsx("size-4 shrink-0 text-ink-4 transition-transform", open === j.id && "rotate-180")} aria-hidden />
          </button>
          {open === j.id && (
            <div className="mt-2 pl-[3.75rem]">
              <p className={clsx("text-xs", j.ok ? "text-ink-3" : "text-negative")}>{j.message}</p>
              <Steps steps={j.steps} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

// ── Warnings: what still keeps the bot from running on its own ──

function warnings(v: BotView) {
  const out: { tone: "negative" | "caution"; text: React.ReactNode }[] = [];
  if (v.hosted && v.storage === "memory")
    out.push({ tone: "negative", text: "Penyimpanan bot (Supabase) belum tersambung, jadi bot belum bisa dinyalakan. Jalankan supabase/dwp-bot.sql di Supabase dan isi kuncinya di Vercel." });
  if (!v.brokers.some((b) => b.enabled && b.configured)) out.push({ tone: "negative", text: "Belum ada bursa aktif yang punya kunci API." });
  if (v.settings.auto && !v.scheduled)
    out.push({
      tone: "caution",
      text: "Jadwal 15 menit belum tercatat berjalan dalam 2,5 jam terakhir, jadi bot mungkin hanya jalan sekali sehari atau saat Anda menekan Cek sekarang. Jadwalnya ada di Supabase (skrip supabase/dwp-bot.sql); peringatan ini hilang sendiri begitu jadwal berjalan.",
    });
  if (!v.liveSwitch) out.push({ tone: "caution", text: "DWP_LIVE_TRADING belum on di Vercel, jadi bot berjalan di mode uji (tanpa uang sungguhan)." });
  const short = capitalShort(v);
  if (short)
    out.push({
      tone: "caution",
      text: `Saldo belum cukup untuk order pertama. Modal kerja ${money(short.capital, short.quote)}; bot hanya boleh memakai ${v.settings.params.maxAllocPct}%-nya untuk koin (${money((short.capital * v.settings.params.maxAllocPct) / 100, short.quote)}), padahal minimum order bursa ${money(short.min, short.quote)}. Bot baru bisa membeli setelah modal kerja minimal ${money(short.need, short.quote)}; sampai itu bot hanya memantau.`,
    });
  return out;
}

const PARAM_FIELDS: { key: keyof StrategyParams; label: string; unit: string; hint: string }[] = [
  { key: "buyPct", label: "Ukuran sekali beli", unit: "% modal", hint: "Bagian modal kerja untuk satu kali beli." },
  { key: "maxAllocPct", label: "Maksimum di koin", unit: "% modal", hint: "Sisanya selalu tetap uang tunai." },
  { key: "takeProfitPct", label: "Ambil untung", unit: "%", hint: "Jual semua milik bot saat untung bersih sebesar ini." },
  { key: "stepPct", label: "Tambah beli tiap turun", unit: "%", hint: "Beli lagi setelah harga turun sejauh ini dari beli terakhir." },
  { key: "entryDipPct", label: "Masuk saat turun 24 jam", unit: "%", hint: "Syarat beli pertama." },
  { key: "stopLossPct", label: "Batas rugi (0 = tidak ada)", unit: "%", hint: "Jual rugi jika turun sejauh ini dari rata-rata." },
  { key: "maxBuysPerDay", label: "Maks. beli per hari", unit: "kali", hint: "Per pasangan." },
  { key: "cooldownMin", label: "Jeda antar-beli", unit: "menit", hint: "Per pasangan." },
  { key: "crashGuardPct", label: "Rem saat jatuh 24 jam", unit: "%", hint: "Tidak beli saat pasar jatuh lebih dari ini." },
  { key: "dailyLossPct", label: "Batas rugi harian", unit: "% modal", hint: "Berhenti beli hari itu jika tercapai." },
];

const PROFILE_LABEL: Record<Profile, string> = { "hati-hati": "Hati-hati", seimbang: "Seimbang", agresif: "Agresif" };

// ── Main panel ───────────────────────────────────────────────

/** The bot's control room on the Akun page. */
export function BotPanel({ onBrokersChange }: { onBrokersChange?: () => void }) {
  const { view: v, error, busy, save, runNow } = useBot();
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [draft, setDraft] = useState<StrategyParams | null>(null);
  const [target, setTarget] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  useEffect(() => {
    if (v) {
      setDraft(v.settings.params);
      setTarget(String(v.settings.monthlyTargetPct));
      setAmount(v.settings.monthlyTargetAmount ? String(v.settings.monthlyTargetAmount) : "");
    }
  }, [v]);

  if (!v)
    return (
      <section id="bot" className="glass scroll-mt-24 p-5 md:p-8">
        <p className="text-sm text-ink-3">{error ?? "Memuat bot…"}</p>
      </section>
    );

  const s = v.settings;
  const live = v.mode === "live";
  const progress = monthProgress(v);
  const warn = warnings(v);

  const setAuto = async (on: boolean) => {
    if (on && live && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    await save({ auto: on });
  };
  const patchBroker = async (id: keyof BotSettings["brokers"], change: Partial<BotSettings["brokers"]["indodax"]>) => {
    const ok = await save({ brokers: { ...s.brokers, [id]: { ...s.brokers[id], ...change } } });
    if (ok) onBrokersChange?.();
  };

  return (
    <section
      id="bot"
      aria-labelledby="bot-title"
      className={clsx(
        "glass scroll-mt-24 overflow-hidden p-5 md:p-8",
        s.auto && (live ? "border-positive/30 bg-gradient-to-br from-positive-soft via-white/70 to-[#3fa58c]/10" : "border-caution/25 bg-caution-soft"),
      )}
    >
      {/* Header: the master switch */}
      <div className="flex items-center gap-3 sm:gap-4">
        <span
          className={clsx(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-[14px] text-white sm:size-12 sm:rounded-[16px]",
            s.auto ? "bg-gradient-to-br from-[#10b981] to-positive shadow-[0_8px_20px_rgb(13_155_99/0.35)]" : "bg-ink-4",
          )}
        >
          <Bot className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="bot-title" className="text-lg font-medium text-ink sm:text-xl">
            Mode otomatis
          </h2>
          <p className="mt-1 flex flex-wrap gap-1.5">
            <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold", s.auto ? "bg-positive text-white" : "bg-sunken text-ink-3")}>
              <span aria-hidden className={clsx("size-1.5 rounded-full bg-current", s.auto && "animate-pulse")} />
              {s.auto ? "AKTIF" : "MATI"}
            </span>
            <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-medium", live ? "bg-negative-soft text-negative" : "bg-caution-soft text-caution")}>
              {live ? "Uang sungguhan" : "Uji tanpa uang"}
            </span>
          </p>
        </div>
        <Switch checked={s.auto} onChange={setAuto} label="Mode otomatis" size="lg" disabled={busy} />
      </div>
      <p className="mt-3 max-w-[70ch] text-sm text-ink-2">
        {s.auto
          ? "Tim agen membeli saat harga turun dan menjual saat untung — tanpa menunggu persetujuan Anda, di dalam batas risiko di bawah."
          : "Nyalakan, dan tim agen akan trading sendiri di bursa yang aktif, di dalam batas risiko yang Anda pilih."}
      </p>

      {confirming && (
        <div role="alertdialog" aria-label="Konfirmasi mode otomatis" className="mt-4 rounded-[16px] border border-negative/25 bg-white/80 p-4">
          <p className="text-sm text-ink">
            Bot akan membeli dan menjual dengan <b>uang sungguhan</b> di {v.brokers.filter((b) => b.enabled && b.configured).map((b) => b.name).join(" & ") || "bursa aktif"} tanpa
            menunggu Anda. Hasil tidak dijamin; harga bisa turun dan bot bisa memegang koin dalam keadaan rugi. Anda bisa mematikannya kapan saja.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setAuto(true)} className="pill pill-accent !px-4 !py-2 text-sm" disabled={busy}>
              <Zap className="size-3.5" aria-hidden /> Ya, nyalakan
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="pill !px-4 !py-2 text-sm">
              Batal
            </button>
          </div>
        </div>
      )}

      {(error || warn.length > 0) && (
        <ul className="mt-4 space-y-2">
          {error && (
            <li role="alert" className="flex gap-2 rounded-[14px] bg-negative-soft px-3 py-2 text-xs text-negative">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {error}
            </li>
          )}
          {warn.map((w, i) => (
            <li key={i} className={clsx("flex gap-2 rounded-[14px] px-3 py-2 text-xs", w.tone === "negative" ? "bg-negative-soft text-negative" : "bg-caution-soft text-ink-2")}>
              <AlertTriangle className={clsx("mt-0.5 size-3.5 shrink-0", w.tone === "caution" && "text-caution")} aria-hidden /> <span>{w.text}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 grid grid-cols-12 gap-4 md:gap-5">
        {/* Income this month */}
        <div className="col-span-12 rounded-[18px] border border-glass-edge bg-white/65 p-5 lg:col-span-7">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              <TrendingUp className="size-4 text-positive" aria-hidden /> Cuan bulan ini {live ? "" : "(uji)"}
            </p>
            <span className="label text-[10px]">Sudah terealisasi</span>
          </div>
          <p className={clsx("num mt-2 text-4xl font-light tracking-[-0.03em]", progress.realized > 0 ? "text-positive" : progress.realized < 0 ? "text-negative" : "text-ink")}>
            {signedMoney(progress.realized, progress.quote)}
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuenow={Math.round(progress.ratio * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Kemajuan target bulanan">
            <div className="h-full rounded-full bg-gradient-to-r from-[#3fa58c] to-positive" style={{ width: `${progress.ratio * 100}%` }} />
          </div>
          <p className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-ink-3">
            <span>
              {progress.fixed ? (
                <>
                  Target Anda <b className="text-ink-2">{money(progress.target, progress.quote)}</b>
                  {progress.targetPct !== null && ` = ${progress.targetPct.toLocaleString("id-ID", { maximumFractionDigits: 1 })}% dari modal kerja ${money(progress.capital, progress.quote)}`}
                </>
              ) : (
                <>
                  Target {s.monthlyTargetPct}% dari modal kerja {money(progress.capital, progress.quote)} = <b className="text-ink-2">{money(progress.target, progress.quote)}</b>
                </>
              )}
            </span>
            <span>
              {v.month.trades} kali ambil untung/keluar · {v.month.wins} untung
            </span>
          </p>
          <form
            className="mt-3 flex flex-wrap items-center gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await save({ monthlyTargetAmount: Number(amount.replace(/\D/g, "")) || 0 });
            }}
          >
            <label htmlFor="target-amount" className="text-xs text-ink-2">
              Target bulan ini
            </label>
            <span className="flex h-9 items-center rounded-[12px] border border-line-strong bg-white/80 pl-2.5">
              <span className="text-xs text-ink-4">Rp</span>
              <input
                id="target-amount"
                inputMode="numeric"
                placeholder={String(Math.round((progress.capital * s.monthlyTargetPct) / 100))}
                value={amount ? Number(amount.replace(/\D/g, "")).toLocaleString("id-ID") : ""}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                className="h-full w-28 min-w-0 bg-transparent px-1.5 font-mono text-sm text-ink outline-none"
              />
            </span>
            <button type="submit" className="pill pill-accent !px-3 !py-1.5 text-xs" disabled={busy}>
              Simpan
            </button>
            {progress.fixed && (
              <button type="button" className="pill !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => save({ monthlyTargetAmount: 0 })}>
                Pakai {s.monthlyTargetPct}% modal
              </button>
            )}
          </form>
          {progress.fixed && progress.targetPct !== null && progress.targetPct > 10 && (
            <p className="mt-2 rounded-[12px] bg-caution-soft px-3 py-2 text-[11px] text-ink-2">
              Target ini {progress.targetPct.toLocaleString("id-ID", { maximumFractionDigits: 0 })}% dari modal kerja per bulan — jauh di atas yang bisa dicapai dengan aman. Bot tetap
              berdagang di dalam batas risiko yang Anda pilih dan tidak menaikkan risiko untuk mengejarnya; yang mendekatkan target adalah modal lebih besar
              atau profil risiko yang Anda ubah sendiri.
            </p>
          )}
          <p className="mt-1 text-[11px] text-ink-4">Target adalah sasaran, bukan janji. Hanya penjualan yang sudah terjadi yang dihitung.</p>

          <p className="label mt-6 mb-2 text-[10px]">Koin yang dipegang bot</p>
          {v.positions.length ? (
            <ul className="divide-y divide-line">
              {v.positions.map((p) => (
                <li key={`${p.broker}-${p.pair}`} className="flex items-center gap-3 py-2">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[10px] font-semibold text-accent">{baseOf(p.pair).slice(0, 4)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">
                      {p.qty.toPrecision(6)} {baseOf(p.pair)}
                    </span>
                    <span className="num block text-[11px] text-ink-3">
                      modal {money(p.cost, quoteOf(p.pair))} · {p.buys}× beli
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="num block text-sm text-ink">{p.value !== null ? money(p.value, quoteOf(p.pair)) : "—"}</span>
                    {p.netPct !== null && (
                      <span className={clsx("num block text-[11px]", p.netPct >= 0 ? "text-positive" : "text-negative")}>
                        {p.netPct >= 0 ? "+" : ""}
                        {p.netPct.toFixed(2)}% bersih
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">Belum ada. Bot hanya menjual koin yang ia beli sendiri — aset Anda yang lain tidak disentuh.</p>
          )}
        </div>

        {/* Exchanges and risk */}
        <div className="col-span-12 space-y-4 lg:col-span-5">
          <div className="rounded-[18px] border border-glass-edge bg-white/65 p-5">
            <p className="text-sm font-medium text-ink">Bursa aktif</p>
            <p className="mt-0.5 text-xs text-ink-3">Indodax bisa jalan sendiri. Tokocrypto opsional — nyalakan kapan saja. Stablecoin (mis. USDT) tidak dibeli bot; yang sudah dipegang tetap dijual saat untung.</p>
            <ul className="mt-3 space-y-3">
              {v.brokers.map((b) => (
                <li key={b.id} className="rounded-[14px] border border-line p-3">
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">{b.name}</span>
                      <span className="block text-[11px] text-ink-3">
                        {b.configured ? (b.enabled ? "Aktif" : "Nonaktif") : `Kunci API belum diatur (${b.id.toUpperCase()}_API_KEY)`}
                      </span>
                    </span>
                    <Switch checked={b.enabled} onChange={(on) => patchBroker(b.id, { enabled: on })} label={`Aktifkan ${b.name}`} disabled={busy} tone="accent" />
                  </div>
                  {b.enabled && (
                    <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`Pasangan ${b.name}`}>
                      {b.pairs.map((pair) => {
                        const on = b.selected.includes(pair);
                        return (
                          <button
                            key={pair}
                            type="button"
                            aria-pressed={on}
                            disabled={busy}
                            onClick={() => patchBroker(b.id, { pairs: on ? b.selected.filter((x) => x !== pair) : [...b.selected, pair] })}
                            className={clsx("rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors", on ? "border-accent bg-accent text-white" : "border-line-strong text-ink-3 hover:text-ink")}
                          >
                            {baseOf(pair)}/{quoteOf(pair)}
                            {isStablePair(pair) && <span className="ml-1 font-normal opacity-80">· jual saja</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[18px] border border-glass-edge bg-white/65 p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              <ShieldCheck className="size-4 text-accent" aria-hidden /> Profil risiko
            </p>
            <div className="mt-3 grid grid-cols-3 gap-1 rounded-full border border-line p-1" role="radiogroup" aria-label="Profil risiko">
              {(Object.keys(PROFILE_LABEL) as Profile[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={s.profile === p}
                  disabled={busy}
                  onClick={() => save({ profile: p, params: v.profiles[p] })}
                  className={clsx("rounded-full py-1.5 text-xs font-medium transition-colors", s.profile === p ? "bg-accent text-white" : "text-ink-3 hover:text-ink")}
                >
                  {PROFILE_LABEL[p]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-ink-3">
              Sekali beli {s.params.buyPct}% modal · maks. {s.params.maxAllocPct}% di koin · ambil untung +{s.params.takeProfitPct}% · tambah tiap turun {s.params.stepPct}%
            </p>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
              <span>
                <span className="block text-sm text-ink">Uji dulu tanpa uang</span>
                <span className="block text-[11px] text-ink-3">Keputusan sama, harga nyata, order tidak dikirim.</span>
              </span>
              <Switch checked={s.paper} onChange={(on) => save({ paper: on })} label="Mode uji tanpa uang" disabled={busy} tone="caution" />
            </div>

            <details className="group mt-3 border-t border-line pt-3">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm text-ink-2">
                Atur detail <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              {draft && (
                <form
                  className="mt-3 grid grid-cols-2 gap-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await save({ params: draft, monthlyTargetPct: Number(target) });
                  }}
                >
                  {PARAM_FIELDS.map((f) => (
                    <label key={f.key} className="block" title={f.hint}>
                      <span className="mb-1 block text-[11px] text-ink-3">{f.label}</span>
                      <span className="flex items-center rounded-[10px] border border-line-strong bg-white/80 pr-2">
                        <input
                          inputMode="decimal"
                          value={draft[f.key]}
                          onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value.replace(",", ".") as unknown as number })}
                          className="h-9 w-full min-w-0 bg-transparent px-2 font-mono text-sm text-ink outline-none"
                        />
                        <span className="shrink-0 text-[10px] text-ink-4">{f.unit}</span>
                      </span>
                    </label>
                  ))}
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-ink-3">Target bulanan</span>
                    <span className="flex items-center rounded-[10px] border border-line-strong bg-white/80 pr-2">
                      <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value.replace(",", "."))} className="h-9 w-full min-w-0 bg-transparent px-2 font-mono text-sm text-ink outline-none" />
                      <span className="shrink-0 text-[10px] text-ink-4">%</span>
                    </span>
                  </label>
                  <div className="col-span-2">
                    <button type="submit" className="pill pill-accent !px-4 !py-2 text-sm" disabled={busy}>
                      Simpan pengaturan
                    </button>
                  </div>
                </form>
              )}
            </details>
          </div>
        </div>

        {/* What the agents think and did */}
        <div className="col-span-12 rounded-[18px] border border-glass-edge bg-white/65 p-5 lg:col-span-6">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
            <Radar className="size-4 text-accent" aria-hidden /> Pikiran tim agen saat ini
          </p>
          <DecisionList decisions={v.decisions} empty={s.auto ? "Menunggu pemeriksaan pertama…" : "Nyalakan mode otomatis untuk mulai."} />
        </div>
        <div className="col-span-12 rounded-[18px] border border-glass-edge bg-white/65 p-5 lg:col-span-6">
          <p className="mb-1 flex items-center gap-2 text-sm font-medium text-ink">
            <Sparkles className="size-4 text-positive" aria-hidden /> Jurnal transaksi bot
          </p>
          <JournalList journal={v.journal} empty="Belum ada transaksi. Bot hanya bertindak saat syaratnya terpenuhi." />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-ink-3">
        <button
          type="button"
          onClick={async () => setNote(await runNow())}
          disabled={busy || !s.auto}
          className="pill !px-3 !py-1.5 text-xs disabled:opacity-50"
          title={s.auto ? "Jalankan satu pemeriksaan sekarang" : "Nyalakan mode otomatis dulu"}
        >
          <Play className="size-3" aria-hidden /> Cek sekarang
        </button>
        <span>
          {v.lastTick
            ? `Pemeriksaan tercatat ${dateTimeOf(v.lastTick.at)} (${v.lastTick.by}) — ${v.lastTick.summary.replace(/\.$/, "")}. Bila tidak ada transaksi, catatan disimpan tiap jam.`
            : "Belum pernah berjalan."}
        </span>
        {note && <span className="text-ink-2">· {note}</span>}
      </div>
    </section>
  );
}

// ── Compact card for the Live dashboard ──────────────────────

export function BotSummaryCard() {
  const { view: v } = useBot();
  if (!v) return null;
  const s = v.settings;
  const progress = monthProgress(v);
  const last = v.journal[0];
  return (
    <div className="glass col-span-12 flex flex-wrap items-center gap-4 p-5 md:p-6">
      <span className={clsx("inline-flex size-11 items-center justify-center rounded-[14px] text-white", s.auto ? "bg-gradient-to-br from-[#10b981] to-positive" : "bg-ink-4")}>
        <Bot className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
          Bot otomatis {s.auto ? "aktif" : "mati"}
          {s.auto && <StatusDot tone="positive" pulse />}
          {s.auto && v.mode === "paper" && <span className="rounded-full bg-caution-soft px-2 py-0.5 text-[10px] text-caution">uji</span>}
        </p>
        <p className="mt-0.5 truncate text-xs text-ink-3">
          {last ? `Terakhir: ${last.action === "buy" ? "beli" : last.action === "sell" ? "jual" : "gagal"} ${baseOf(last.pair)} · ${dateTimeOf(last.at)}` : s.auto ? "Menunggu titik masuk yang pas." : "Nyalakan agar tim agen trading sendiri."}
        </p>
      </div>
      <div className="text-right">
        <p className={clsx("num text-lg font-medium", progress.realized > 0 ? "text-positive" : progress.realized < 0 ? "text-negative" : "text-ink")}>{signedMoney(progress.realized, progress.quote)}</p>
        <p className="text-[11px] text-ink-3">cuan bulan ini · target {money(progress.target, progress.quote)}</p>
      </div>
      <Link href="/akun#bot" className="pill pill-accent !px-4 !py-2 text-sm">
        {s.auto ? "Lihat bot" : "Nyalakan"} <ArrowUpRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}

// ── Every pair's reasoning and every trade, for the Agen page ─

export function BotAgentsLive({ view: v }: { view: BotView }) {
  return (
    <div className="grid grid-cols-12 gap-4 lg:gap-8">
      <div className="col-span-12 lg:col-span-6">
        <p className="label mb-3 text-[10px]">Pikiran terbaru per pasangan</p>
        <DecisionList decisions={v.decisions} empty={v.settings.auto ? "Menunggu pemeriksaan pertama…" : "Mode otomatis mati. Nyalakan di halaman Akun."} />
      </div>
      <div className="col-span-12 lg:col-span-6">
        <p className="label mb-3 text-[10px]">Setiap transaksi dan alasannya</p>
        <JournalList journal={v.journal} empty="Belum ada transaksi nyata dari bot." />
      </div>
    </div>
  );
}
