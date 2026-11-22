"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, ChartCandlestick, Landmark, LayoutDashboard, LogOut, Pause, Play, Sparkles, Wallet, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { AGENT_STATE_META, toneText } from "@/components/agent/agent-meta";
import { BrandMark, BrandWordmark } from "@/components/brand/BrandMark";
import { ModeSwitch } from "@/components/mode/ModeSwitch";
import { useAgentService } from "@/components/layout/SimulationProvider";
import { StatusDot } from "@/components/shared/primitives";
import { transition } from "@/lib/design/tokens";
import { formatClock } from "@/lib/formatting/format";
import { useAppStore } from "@/store/app-store";
import { useMode } from "@/store/mode-store";

export const NAV: { href: string; label: string; long: string; icon: LucideIcon; note: string }[] = [
  { href: "/", label: "Kendali", long: "Dashboard cuan", icon: LayoutDashboard, note: "Ringkasan hasil & agen" },
  { href: "/opportunities", label: "Peluang", long: "Peluang cuan", icon: Sparkles, note: "Sumber penghasilan" },
  { href: "/markets", label: "Pasar", long: "Pasar", icon: ChartCandlestick, note: "Harga & risiko pasar" },
  { href: "/agent", label: "Agen", long: "Tim agen", icon: Bot, note: "Keputusan & alasannya" },
  { href: "/capital", label: "Modal", long: "Modal & risiko", icon: Wallet, note: "Posisi & batas risiko" },
  { href: "/akun", label: "Akun", long: "Akun nyata", icon: Landmark, note: "Indodax, Tokocrypto, Bibit" },
];

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
  window.location.assign("/masuk");
}

const iconButton =
  "inline-flex size-8 sm:size-9 items-center justify-center rounded-full border border-glass-edge bg-glass-strong text-ink-2 transition-colors hover:bg-white hover:text-ink";

/** Agent state, clock and the pause switch — always one glance away. */
function LiveControls({ compact = false }: { compact?: boolean }) {
  const { state, simTime, approvals, running } = useAppStore(
    useShallow((s) => ({ state: s.status.state, simTime: s.simTime, approvals: s.approvals.length, running: s.running })),
  );
  const service = useAgentService();
  const meta = AGENT_STATE_META[state];
  const demo = useMode() === "demo";

  return (
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
      <ModeSwitch />
      {demo && approvals > 0 && !compact && (
        <Link href="/#approval" className="pill hidden text-caution md:inline-flex">
          <StatusDot tone="caution" pulse />
          {approvals} menunggu Anda
        </Link>
      )}
      {demo && (
        <>
          <span className="pill hidden xl:inline-flex" aria-hidden>
            <StatusDot tone={running ? meta.tone : "muted"} pulse={running && state !== "IDLE"} />
            <span className={clsx("font-mono text-[10px] tracking-[0.08em] uppercase", running ? toneText[meta.tone] : "text-ink-3")}>
              {running ? meta.label : "Dijeda"}
            </span>
            <span className="num hidden font-mono text-[11px] text-ink-3 md:inline" aria-label={`Waktu simulasi ${formatClock(simTime)}`}>
              {formatClock(simTime)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => (running ? service.pause() : service.resume())}
            className={clsx(iconButton, "!hidden sm:!inline-flex")}
            aria-label={running ? "Jeda agen" : "Lanjutkan agen"}
            title={running ? "Jeda agen" : "Lanjutkan agen"}
          >
            {running ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
          </button>
        </>
      )}
      <button type="button" onClick={logout} className={iconButton} aria-label="Keluar" title="Keluar">
        <LogOut className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

/** Desktop: a floating glass sidebar, as in a control dashboard. */
export function Sidebar() {
  const pathname = usePathname();
  const demo = useMode() === "demo";
  const approvals = useAppStore((s) => (demo ? s.approvals.length : 0));
  return (
    <aside className="glass-strong fixed top-3 bottom-3 left-3 z-40 hidden w-[4.75rem] flex-col rounded-[var(--radius-xl)] p-3 lg:flex xl:w-[15.5rem] xl:p-4">
      <Link href="/" className="flex items-center justify-center gap-2.5 pt-1 pb-5 xl:justify-start xl:px-2" aria-label="DWP EARN MONEY — Dashboard">
        <span className="inline-flex size-9 items-center justify-center rounded-[12px] bg-white shadow-[var(--shadow-raise)]">
          <BrandMark size={22} />
        </span>
        <BrandWordmark className="hidden !text-[12px] !tracking-[0.14em] xl:inline" />
      </Link>

      <p className="label mb-2 hidden px-3 text-[10px] xl:block">Menu</p>
      <nav aria-label="Utama">
        <ul className="space-y-1">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="relative">
                {active && (
                  <motion.span
                    layoutId="side-active"
                    className="absolute inset-0 rounded-[14px] bg-white shadow-[var(--shadow-raise)]"
                    transition={transition.panel}
                  />
                )}
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={item.long}
                  className={clsx(
                    "relative flex items-center justify-center gap-3 rounded-[14px] p-2 text-sm transition-colors xl:justify-start xl:px-3 xl:py-2.5",
                    active ? "text-ink" : "text-ink-2 hover:bg-white/50 hover:text-ink",
                  )}
                >
                  <span
                    className={clsx(
                      "inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] transition-colors",
                      active ? "bg-gradient-to-br from-[#12c9f0] to-accent text-white shadow-[0_6px_16px_rgb(10_99_242/0.32)]" : "bg-sunken text-ink-3",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="sr-only">{item.long}</span>
                  <span className="hidden min-w-0 xl:block" aria-hidden>
                    <span className="block leading-tight font-medium">{item.long}</span>
                    <span className="block truncate text-[11px] leading-tight text-ink-3">{item.note}</span>
                  </span>
                  {item.href === "/" && approvals > 0 && (
                    <span className="absolute top-1 right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-caution px-1.5 text-[10px] font-semibold text-white xl:static xl:ml-auto">
                      {approvals}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        className={clsx(
          "mt-auto hidden rounded-[18px] border p-4 xl:block",
          demo ? "border-caution/25 bg-caution-soft" : "border-positive/25 bg-gradient-to-br from-positive-soft via-white/60 to-[#12c9f0]/10",
        )}
      >
        <p className={clsx("font-mono text-[10px] font-semibold tracking-[0.12em] uppercase", demo ? "text-caution" : "text-positive")}>
          {demo ? "Mode demo" : "Mode live"}
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-2">
          {demo
            ? "Simulasi agen dengan modal fiktif $10.000: peluang, keputusan, dan posisi bukan uang sungguhan."
            : "Saldo bursa, total aset, dan harga live Indodax — uang Anda yang sebenarnya."}
        </p>
      </div>
    </aside>
  );
}

/** Top bar: on phones it carries the brand; on desktop, the page and live controls. */
export function TopNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const current = NAV.find((n) => isActive(pathname, n.href));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-30 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4 lg:px-6">
      <div
        className={clsx(
          "mx-auto flex h-14 max-w-[1360px] items-center justify-between gap-2 rounded-full px-2 sm:gap-3 sm:px-3 transition-[background-color,box-shadow,border-color] duration-200 lg:pl-4",
          scrolled ? "glass-strong" : "glass-strong lg:border-transparent lg:bg-transparent lg:shadow-none lg:backdrop-blur-none",
        )}
      >
        {/* Phones: app-style header — logo, brand and the page you are on */}
        <Link href="/" className="flex min-w-0 items-center gap-2 lg:hidden" aria-label="DWP EARN MONEY — Dashboard">
          <span className="inline-flex size-8 shrink-0 sm:size-9 items-center justify-center rounded-full bg-white shadow-[var(--shadow-raise)]">
            <BrandMark size={24} />
          </span>
          <span className="min-w-0 overflow-hidden leading-tight whitespace-nowrap">
            <BrandWordmark className="!text-[9.5px] !tracking-[0.06em] sm:!tracking-[0.14em]" />
            <span className="block truncate text-[14px] sm:text-[15px] font-medium text-ink">{current?.long ?? "Dashboard cuan"}</span>
          </span>
        </Link>
        <div className="hidden min-w-0 items-baseline gap-3 lg:flex">
          <p className="text-lg font-medium tracking-[-0.01em] text-ink">{current?.long ?? "DWP EARN MONEY"}</p>
          <p className="truncate text-xs text-ink-3">{current?.note}</p>
        </div>
        <LiveControls />
      </div>
    </header>
  );
}

/** On phones the areas move to the thumb, in a floating glass bar. */
export function MobileTabBar() {
  const pathname = usePathname();
  const demo = useMode() === "demo";
  const approvals = useAppStore((s) => (demo ? s.approvals.length : 0));
  return (
    <nav aria-label="Utama" className="fixed inset-x-2 bottom-2 z-40 pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="glass-strong grid grid-cols-6 rounded-[22px] p-1">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="relative">
              {active && (
                <motion.span layoutId="tab-active" className="absolute inset-0.5 rounded-[18px] bg-white shadow-[var(--shadow-raise)]" transition={transition.panel} />
              )}
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx("relative flex h-14 flex-col items-center justify-center gap-1 text-[10.5px]", active ? "font-medium text-accent" : "text-ink-3")}
              >
                <span className="relative">
                  <Icon className="size-[18px]" aria-hidden />
                  {item.href === "/" && approvals > 0 && (
                    <span className="absolute -top-0.5 -right-1.5 size-2 rounded-full bg-caution ring-2 ring-white" aria-label="Ada keputusan menunggu" />
                  )}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Footer() {
  const demo = useMode() === "demo";
  return (
    <footer className="mx-auto max-w-[1360px] px-3 pt-10 pb-28 sm:px-4 lg:px-6 lg:pb-8">
      <div className="glass flex flex-col gap-4 p-5 md:flex-row md:items-center md:gap-8">
        <p className="flex shrink-0 items-center gap-2.5">
          <BrandMark size={20} />
          <BrandWordmark />
        </p>
        <p className="max-w-[80ch] text-xs leading-relaxed text-ink-3">
          {demo
            ? "Mode Demo: harga, posisi, peluang, dan hasil adalah data simulasi dengan modal fiktif — bukan uang sungguhan."
            : "Mode Live: saldo dibaca dari akun bursa Anda dan dinilai dengan harga Indodax saat ini."}{" "}
          Order nyata hanya dikirim dari halaman Akun, setelah Anda setujui. Tidak ada yang di sini merupakan saran investasi; keputusan
          dan risiko tetap milik Anda.
        </p>
      </div>
    </footer>
  );
}
