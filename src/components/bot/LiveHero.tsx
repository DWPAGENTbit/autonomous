"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import Link from "next/link";
import { ArrowUpRight, Bot, Clock3, Coins, Landmark, Radar, RefreshCw, ShieldAlert, ShieldCheck, Target, TrendingUp, Wallet, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { AnimatedValue } from "@/components/shared/primitives";
import { TargetDial } from "@/components/shared/TargetDial";
import { stagger, transition } from "@/lib/design/tokens";
import type { RealPortfolio } from "@/lib/server/portfolio";
import { botHoldings, type BotView, capitalShort, money, monthProgress, ordersThisMonth, signedMoney } from "./bot-client";

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: transition.scene },
};

const toneOf = (v: number) => (v > 0 ? "text-positive" : v < 0 ? "text-negative" : "text-ink");
const pctText = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`);

/** Greeting by the viewer's clock; set after mount so server and phone never disagree. */
function useGreeting() {
  const [text, setText] = useState("Halo");
  useEffect(() => {
    const h = new Date().getHours();
    setText(h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam");
  }, []);
  return text;
}

function Kpi({
  icon: Icon,
  label,
  children,
  foot,
  featured,
}: {
  icon: typeof Wallet;
  label: string;
  children: React.ReactNode;
  foot?: React.ReactNode;
  /** The deep-teal card, for the number that matters most. */
  featured?: boolean;
}) {
  return (
    <motion.div variants={item} className={clsx("lift flex min-w-0 flex-col p-4 md:p-5", featured ? "glass-teal" : "glass")}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className={clsx("truncate text-xs", featured ? "text-white/85" : "text-ink-3")}>{label}</p>
        <span
          className={clsx(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-full",
            featured ? "bg-white/20 text-white" : "bg-white/70 text-ink-2 shadow-[var(--shadow-raise)]",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </span>
      </div>
      <div className={clsx("truncate text-xl font-medium tracking-[-0.03em] sm:text-2xl md:text-[1.75rem]", featured ? "text-white" : "text-ink")}>{children}</div>
      <p className={clsx("mt-auto pt-3 text-[11px]", featured ? "text-white/80" : "text-ink-3")}>{foot}</p>
    </motion.div>
  );
}

/**
 * The first screen in Live mode, built like the Demo dashboard but from real data:
 * what the bot is doing, this month's realized result against the target, and the
 * money behind it. Switching the bot on or off stays on the Akun page.
 */
export function LiveHero({
  view: v,
  botError,
  portfolio: p,
  manual,
  error,
  loading,
  reload,
}: {
  view: BotView | null;
  botError: string | null;
  portfolio: RealPortfolio | null;
  manual: number;
  error: string | null;
  loading: boolean;
  reload: () => void;
}) {
  const greeting = useGreeting();
  const total = p ? p.totalIdr + manual : null;
  const progress = v ? monthProgress(v) : null;
  const held = v && progress ? botHoldings(v, progress.quote) : null;
  const short = v ? capitalShort(v) : null;
  const auto = v?.settings.auto ?? false;
  // `watch` is new; a server from the previous deploy may still answer without it.
  const pairs = v?.watch?.length ?? 0;
  const orders = v ? ordersThisMonth(v) : 0;

  const headline = !v
    ? "Menghubungi tim agen…"
    : !auto
      ? "Mode otomatis sedang mati."
      : v.mode === "paper"
        ? "Agen berlatih dengan harga nyata, tanpa uang sungguhan."
        : short
          ? "Agen siap bekerja, menunggu saldo cukup untuk order pertama."
          : held && held.count > 0
            ? `Agen sedang menjaga ${held.count} koin menuju target untung.`
            : "Agen Anda sedang bekerja mencari cuan.";

  const problems = [error, botError, ...(p?.errors ?? [])].filter(Boolean) as string[];

  return (
    <motion.div className="col-span-12 grid grid-cols-12 gap-4 md:gap-5" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: stagger.group } } }}>
      {/* Greeting and the one-line state of the money */}
      <motion.div variants={item} className="glass relative col-span-12 overflow-hidden p-6 md:p-8 xl:col-span-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-28 -right-20 size-80 rounded-full opacity-80 blur-3xl"
          style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--ac-3) 42%, transparent), color-mix(in srgb, var(--ac) 14%, transparent) 55%, transparent 72%)" }}
        />
        <div className="relative flex flex-wrap items-center gap-2">
          <span className="pill !py-1 text-[11px]">
            <Clock3 className="size-3" aria-hidden /> {greeting}
          </span>
          {v && (
            <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", auto ? "bg-positive text-white" : "bg-sunken text-ink-3")}>
              <span aria-hidden className={clsx("size-1.5 rounded-full bg-current", auto && "animate-pulse")} />
              Otomatis {auto ? "aktif" : "mati"}
            </span>
          )}
          {v && (
            <span className={clsx("pill !py-1 text-[11px]", v.mode === "live" ? "text-negative" : "text-caution")}>
              {v.mode === "live" ? <ShieldAlert className="size-3" aria-hidden /> : <ShieldCheck className="size-3" aria-hidden />}
              {v.mode === "live" ? "Uang sungguhan" : "Uji tanpa uang"}
            </span>
          )}
          <button type="button" onClick={reload} className="pill !py-1 text-[11px]" aria-label="Muat ulang data nyata">
            <RefreshCw className={clsx("size-3", loading && "animate-spin")} aria-hidden /> Muat ulang
          </button>
        </div>

        <h2 id="real-title" className="relative mt-5 max-w-[22ch] text-3xl leading-[1.08] font-light tracking-[-0.035em] text-ink sm:text-4xl lg:text-5xl">
          {headline}
        </h2>
        {v && progress && (
          <p className="relative mt-4 max-w-[60ch] text-base text-ink-2">
            Bulan ini bot sudah merealisasikan <b className={clsx("num font-medium", toneOf(progress.realized))}>{signedMoney(progress.realized, progress.quote)}</b> dari
            target {money(progress.target, progress.quote)}, dengan {pairs} pasangan dipantau
            {held && held.count > 0 ? ` dan ${held.count} koin dipegang bot` : ""}.
            {short && ` Modal kerja ${money(short.capital, short.quote)}; order pertama butuh minimal ${money(short.need, short.quote)}.`}
          </p>
        )}

        {problems.length > 0 && (
          <p role="alert" className="relative mt-3 text-xs text-negative">
            {problems.join(" ")}
          </p>
        )}
        {p && p.connected.length === 0 && (
          <p className="relative mt-4 rounded-[16px] border border-caution/25 bg-caution-soft p-3 text-sm text-ink-2">
            Belum ada bursa yang terhubung. Hubungkan Indodax di halaman{" "}
            <Link href="/akun" className="font-medium text-accent underline">
              Akun nyata
            </Link>
            .
          </p>
        )}

        <div className="relative mt-6 flex flex-wrap gap-2">
          <Link href="/akun#bot" className="pill pill-accent !px-4 !py-2 text-sm">
            <Bot className="size-3.5" aria-hidden /> {auto ? "Atur bot" : "Nyalakan bot"}
          </Link>
          <Link href="/akun" className="pill !px-4 !py-2 text-sm">
            <Landmark className="size-3.5" aria-hidden /> Akun nyata
          </Link>
          <Link href="/agent" className="pill !px-4 !py-2 text-sm">
            Tim agen <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>

        {/* Quick tiles, as in the Demo dashboard */}
        <div className="relative mt-7 grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {[
            { k: "Pasangan dipantau", v: v ? String(pairs) : "…", href: "/akun#bot", icon: Radar },
            { k: "Koin dipegang bot", v: held ? String(held.count) : "…", href: "/agent", icon: Coins },
            { k: "Order bulan ini", v: v ? String(orders) : "…", href: "/agent", icon: Zap },
            { k: "Kas tersedia", v: p ? money(p.cashIdr, "IDR") : "…", href: "/akun", icon: Wallet, warn: Boolean(short) },
          ].map((t) => (
            <Link
              key={t.k}
              href={t.href}
              className={clsx(
                "lift group flex min-w-0 items-center gap-3 rounded-[18px] border border-glass-edge bg-white/50 p-3 hover:bg-white/80",
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
        <div className="flex w-full items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink">Target cuan bulan ini</p>
          {v && progress && (
            <Link href="/akun#bot" className="pill !py-0.5 text-[10px]" title="Ubah target di halaman Akun">
              {progress.fixed ? "Target Anda" : `${v.settings.monthlyTargetPct}% modal kerja`}
            </Link>
          )}
        </div>
        <div className="relative mt-2">
          <TargetDial progress={progress?.ratio ?? 0} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <AnimatedValue value={(progress?.ratio ?? 0) * 100} format={(x) => `${x.toFixed(0)}%`} className="text-5xl font-light tracking-[-0.04em] text-ink" />
            <p className="mt-1 text-[11px] text-ink-3">tercapai</p>
          </div>
        </div>
        <div className="mt-1 grid w-full grid-cols-2 gap-2 text-center">
          <div className="min-w-0 rounded-[14px] bg-white/55 p-2.5">
            <p className="text-[11px] text-ink-3">Sudah</p>
            <p className={clsx("num truncate text-sm font-medium", toneOf(progress?.realized ?? 0))}>{progress ? signedMoney(progress.realized, progress.quote) : "…"}</p>
          </div>
          <div className="min-w-0 rounded-[14px] bg-white/55 p-2.5">
            <p className="text-[11px] text-ink-3">Target</p>
            <p className="num truncate text-sm font-medium text-ink">{progress ? money(progress.target, progress.quote) : "…"}</p>
          </div>
        </div>
        <p className="mt-3 text-center text-[11px] text-ink-4">Sasaran, bukan janji. Hanya penjualan yang sudah terjadi yang dihitung.</p>
      </motion.div>

      {/* KPI tiles */}
      <div className="col-span-12 grid grid-cols-2 gap-4 md:col-span-6 md:gap-5 xl:col-span-12 xl:grid-cols-4">
        <Kpi
          icon={Wallet}
          label="Total aset nyata"
          foot={p ? <span className={toneOf(p.change24hPct ?? 0)}>24 jam {pctText(p.change24hPct)}</span> : "Memuat…"}
        >
          {total !== null ? <AnimatedValue value={total} format={(x) => money(x, "IDR")} /> : "…"}
        </Kpi>
        <Kpi featured icon={TrendingUp} label="Cuan bulan ini" foot={v ? `${v.month.trades} kali jual · ${v.month.wins} untung` : "…"}>
          {progress ? signedMoney(progress.realized, progress.quote) : "…"}
        </Kpi>
        <Kpi icon={Coins} label="Koin milik bot" foot={held ? (held.count ? `${held.count} posisi · modal ${money(held.cost, progress!.quote)}` : "Belum ada posisi") : "…"}>
          {held && progress ? money(held.value, progress.quote) : "…"}
        </Kpi>
        <Kpi icon={Target} label="Belum terealisasi" foot="Bila dijual sekarang, setelah biaya">
          {held && progress ? <span className={toneOf(held.unrealized)}>{signedMoney(held.unrealized, progress.quote)}</span> : "…"}
        </Kpi>
      </div>
    </motion.div>
  );
}
