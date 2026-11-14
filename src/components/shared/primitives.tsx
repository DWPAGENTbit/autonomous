"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { useAnimatedNumber } from "@/hooks/use-animated-number";
import { stagger, transition } from "@/lib/design/tokens";
import { formatSignedPct } from "@/lib/formatting/format";

// ── Section header ───────────────────────────────────────────

export function SectionHeader({
  index,
  title,
  summary,
  href,
  hrefLabel,
  aside,
  id,
}: {
  index: string;
  title: string;
  summary?: ReactNode;
  href?: string;
  hrefLabel?: string;
  aside?: ReactNode;
  id?: string;
}) {
  return (
    <header className="mb-8 grid grid-cols-12 items-end gap-x-6 gap-y-3 border-t border-line pt-5">
      <div className="col-span-12 md:col-span-7">
        <p className="label num mb-3">
          <span className="text-ink-2">{index}</span>
          <span className="mx-2 text-ink-4">—</span>
          {title}
        </p>
        {summary && (
          <h2 id={id} className="max-w-[38ch] text-2xl font-normal tracking-[-0.015em] text-ink md:text-[1.75rem] md:leading-[2.2rem]">
            {summary}
          </h2>
        )}
      </div>
      <div className="col-span-12 flex items-center gap-6 md:col-span-5 md:justify-end">
        {aside}
        {href && (
          <Link
            href={href}
            className="group inline-flex items-center gap-1 text-sm text-ink-2 transition-colors duration-150 hover:text-ink"
          >
            {hrefLabel ?? "Open"}
            <ArrowUpRight
              aria-hidden
              className="size-3.5 transition-transform duration-150 group-hover:-translate-y-px group-hover:translate-x-px"
            />
          </Link>
        )}
      </div>
    </header>
  );
}

// ── Reveal ───────────────────────────────────────────────────

/** Progressive reveal for meaningful groups only. */
export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section";
}) {
  const Comp = as === "section" ? motion.section : motion.div;
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ ...transition.scene, delay }}
    >
      {children}
    </Comp>
  );
}

export const revealGroup = {
  hidden: {},
  show: { transition: { staggerChildren: stagger.group } },
};
export const revealItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: transition.meaning },
};

// ── Numbers ──────────────────────────────────────────────────

export function AnimatedValue({
  value,
  format,
  className,
}: {
  value: number;
  format: (v: number) => string;
  className?: string;
}) {
  const v = useAnimatedNumber(value);
  return (
    <span className={clsx("num", className)} suppressHydrationWarning>
      {format(v)}
    </span>
  );
}

export function Delta({
  value,
  className,
  decimals = 2,
  format,
}: {
  value: number;
  className?: string;
  decimals?: number;
  format?: (v: number) => string;
}) {
  const tone = value > 0 ? "text-positive" : value < 0 ? "text-negative" : "text-ink-3";
  return (
    <span className={clsx("num", tone, className)} suppressHydrationWarning>
      {format ? format(value) : formatSignedPct(value, decimals)}
    </span>
  );
}

// ── Simulation marker ────────────────────────────────────────

export function SimBadge({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 border border-caution/30 bg-caution-soft px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-caution",
        className,
      )}
      title="All figures are simulated demo data. No real funds or orders."
    >
      <span aria-hidden className="size-1 rounded-full bg-caution" />
      {compact ? "Sim" : "Simulation · Demo data"}
    </span>
  );
}

// ── Buttons ──────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }
>(function Button({ variant = "secondary", size = "md", className, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={clsx(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium tracking-[0.01em] transition-[background-color,border-color,color,transform] duration-150 ease-out active:translate-y-px disabled:opacity-40",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-ink text-canvas hover:bg-ink/85",
        variant === "secondary" && "border border-line-strong bg-transparent text-ink hover:border-ink/40 hover:bg-surface",
        variant === "ghost" && "text-ink-2 hover:bg-sunken hover:text-ink",
        variant === "danger" && "border border-line-strong text-negative hover:border-negative/50 hover:bg-negative-soft",
        "rounded-sm",
        className,
      )}
      {...props}
    />
  );
});

// ── Status mark ──────────────────────────────────────────────

export function StatusDot({ tone, pulse = false }: { tone: "positive" | "negative" | "accent" | "caution" | "muted"; pulse?: boolean }) {
  const color = {
    positive: "bg-positive",
    negative: "bg-negative",
    accent: "bg-accent",
    caution: "bg-caution",
    muted: "bg-ink-4",
  }[tone];
  return (
    <span aria-hidden className="relative inline-flex size-2 shrink-0">
      {pulse && <span className={clsx("absolute inset-0 animate-breathe rounded-full opacity-60", color)} />}
      <span className={clsx("relative inline-flex size-2 rounded-full", color)} />
    </span>
  );
}
