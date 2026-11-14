"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { AGENT_STATE_META, toneText } from "@/components/agent/agent-meta";
import { useAgentService } from "@/components/layout/SimulationProvider";
import { SimBadge, StatusDot } from "@/components/shared/primitives";
import { transition } from "@/lib/design/tokens";
import { formatClock } from "@/lib/formatting/format";
import { useAppStore } from "@/store/app-store";

export const NAV = [
  { href: "/", index: "01", label: "Command", long: "Command Center" },
  { href: "/markets", index: "02", label: "Markets", long: "Markets" },
  { href: "/opportunities", index: "03", label: "Opportunities", long: "Opportunities" },
  { href: "/agent", index: "04", label: "Agent", long: "Agent" },
  { href: "/capital", index: "05", label: "Capital", long: "Capital" },
] as const;

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

function LiveStatus() {
  const { state, simTime, approvals, running } = useAppStore(
    useShallow((s) => ({ state: s.status.state, simTime: s.simTime, approvals: s.approvals.length, running: s.running })),
  );
  const service = useAgentService();
  const meta = AGENT_STATE_META[state];

  return (
    <div className="flex items-center gap-4">
      {approvals > 0 && (
        <Link href="/#approval" className="hidden items-center gap-2 text-xs text-caution hover:underline md:inline-flex">
          <StatusDot tone="caution" pulse />
          {approvals} awaiting you
        </Link>
      )}
      <span className="hidden items-center gap-2 sm:inline-flex" aria-hidden>
        <StatusDot tone={running ? meta.tone : "muted"} pulse={running && state !== "IDLE"} />
        <span className={clsx("label min-w-[5.5rem]", running ? toneText[meta.tone] : "text-ink-3")}>{running ? meta.label : "Paused"}</span>
      </span>
      <span className="num font-mono text-xs text-ink-3" aria-label={`Simulated time ${formatClock(simTime)}`}>
        {formatClock(simTime)}
      </span>
      <button
        type="button"
        onClick={() => (running ? service.pause() : service.resume())}
        className="inline-flex size-8 items-center justify-center rounded-sm text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
        aria-label={running ? "Pause the agent" : "Resume the agent"}
        title={running ? "Pause the agent" : "Resume the agent"}
      >
        {running ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
      </button>
    </div>
  );
}

/** Compact, integrated navigation. The agent's state is always in view. */
export function TopNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={clsx(
        "sticky top-0 z-40 border-b bg-canvas/95 backdrop-blur-[2px] transition-colors duration-200",
        scrolled ? "border-line" : "border-transparent",
      )}
    >
      <div className="mx-auto flex h-14 max-w-[1360px] items-center justify-between gap-6 px-4 sm:px-6 md:px-10 lg:px-12">
        <Link href="/" className="flex items-baseline gap-3" aria-label="Autonomous — Command Center">
          <span className="text-[13px] font-semibold tracking-[0.28em] text-ink">AUTONOMOUS</span>
          <span className="hidden xl:inline">
            <SimBadge />
          </span>
          <span className="xl:hidden">
            <SimBadge compact />
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href} className="relative">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "flex h-14 items-center gap-1.5 px-3 text-sm transition-colors duration-150",
                      active ? "text-ink" : "text-ink-3 hover:text-ink",
                    )}
                  >
                    <span className="num font-mono text-[10px] text-ink-4">{item.index}</span>
                    {item.label}
                  </Link>
                  {active && <motion.span layoutId="nav-active" className="absolute inset-x-3 bottom-0 h-px bg-ink" transition={transition.panel} />}
                </li>
              );
            })}
          </ul>
        </nav>

        <LiveStatus />
      </div>
    </header>
  );
}

/** On phones the areas move to the thumb. */
export function MobileTabBar() {
  const pathname = usePathname();
  const approvals = useAppStore((s) => s.approvals.length);
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-[2px] lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx("relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px]", active ? "text-ink" : "text-ink-3")}
              >
                {active && <motion.span layoutId="tab-active" className="absolute inset-x-4 top-0 h-px bg-ink" transition={transition.panel} />}
                <span className="num font-mono text-[10px] text-ink-4">{item.index}</span>
                <span className="relative">
                  {item.label}
                  {item.href === "/" && approvals > 0 && (
                    <span className="absolute -top-0.5 -right-2.5 size-1.5 rounded-full bg-caution" aria-label="Decision waiting" />
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto max-w-[1360px] px-4 pt-16 pb-28 sm:px-6 md:px-10 lg:px-12 lg:pb-16">
      <div className="grid grid-cols-12 gap-6 border-t border-line pt-6">
        <p className="col-span-12 text-[13px] font-semibold tracking-[0.28em] text-ink md:col-span-4">AUTONOMOUS</p>
        <p className="col-span-12 max-w-[72ch] text-xs leading-relaxed text-ink-3 md:col-span-8">
          This is a simulation prototype. Every price, position, opportunity and result on this page is generated demo data from a
          deterministic simulation. No real funds, accounts, marketplaces or orders are connected, and nothing here is investment advice.
        </p>
      </div>
    </footer>
  );
}
