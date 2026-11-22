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
    <header className="mb-7 grid grid-cols-12 items-end gap-x-6 gap-y-3">
      <div className="col-span-12 md:col-span-8">
        <p className="mb-3 flex items-center gap-2">
          <span className="num inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#12c9f0] to-accent px-2 font-mono text-[10px] font-semibold text-white">
            {index}
          </span>
          <span className="text-sm font-medium text-ink">{title}</span>
        </p>
        {summary && (
          <h2 id={id} className="max-w-[46ch] text-xl font-normal tracking-[-0.015em] text-ink-2 md:text-2xl">
            {summary}
          </h2>
        )}
      </div>
      <div className="col-span-12 flex items-center gap-6 md:col-span-4 md:justify-end">
        {aside}
        {href && (
          <Link
            href={href}
            className="pill group"
          >
            {hrefLabel ?? "Buka"}
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
        "inline-flex items-center gap-1.5 rounded-full border border-caution/25 bg-caution-soft px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-caution",
        className,
      )}
      title="Semua angka adalah data demo simulasi. Tidak ada dana atau order sungguhan."
    >
      <span aria-hidden className="size-1 rounded-full bg-caution" />
      {compact ? "Sim" : "Simulasi · Data demo"}
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
        variant === "primary" && "bg-gradient-to-br from-[#12c9f0] to-accent text-white shadow-[0_6px_18px_rgb(10_99_242/0.3)] hover:brightness-105",
        variant === "secondary" && "border border-glass-edge bg-glass-strong text-ink hover:bg-white",
        variant === "ghost" && "text-ink-2 hover:bg-sunken hover:text-ink",
        variant === "danger" && "bg-negative text-white shadow-[0_6px_18px_rgb(217_67_75/0.3)] hover:brightness-105",
        "rounded-full",
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
