"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { INSTRUMENTS } from "@/data/instruments";
import { PerformanceChart } from "@/components/markets/PerformanceChart";
import { AnimatedValue, Delta, SimBadge } from "@/components/shared/primitives";
import { useCapital } from "@/hooks/use-derived";
import { transition } from "@/lib/design/tokens";
import { formatPct, formatSignedUsd, formatUsd } from "@/lib/formatting/format";
import { useAppStore } from "@/store/app-store";

const LEDGER_HINTS = {
  available: "Kas yang belum dipakai untuk posisi apa pun.",
  deployed: "Nilai pasar posisi terbuka.",
  unrealized: "Untung atau rugi berjalan pada harga saat ini.",
  realized: "Untung atau rugi yang sudah ditutup bulan ini.",
  drawdown: "Jarak di bawah puncak ekuitas.",
} as const;

/** Capital as a ledger: one headline number, then its parts. */
export function CapitalLedger() {
  const c = useCapital();
  const [hint, setHint] = useState<keyof typeof LEDGER_HINTS | null>(null);

  const items: { key: keyof typeof LEDGER_HINTS; label: string; value: number; format: (v: number) => string; tone?: string }[] = [
    { key: "available", label: "Tersedia", value: c.available, format: (v) => formatUsd(v) },
    { key: "deployed", label: "Terpakai", value: c.deployed, format: (v) => formatUsd(v) },
    {
      key: "unrealized",
      label: "Belum terealisasi",
      value: c.unrealized,
      format: (v) => formatSignedUsd(v),
      tone: c.unrealized >= 0 ? "text-positive" : "text-negative",
    },
    { key: "realized", label: "Terealisasi", value: c.realized, format: (v) => formatSignedUsd(v), tone: c.realized >= 0 ? "text-positive" : "text-negative" },
    { key: "drawdown", label: "Drawdown", value: c.drawdownPct, format: (v) => formatPct(v, 1) },
  ];

  return (
    <div>
      <dl className="grid grid-cols-2 border-t border-line sm:grid-cols-3 lg:grid-cols-5">
        {items.map((it, i) => (
          <div
            key={it.key}
            className={clsx("border-b border-line py-4 pr-4 lg:border-b-0", i > 0 && "lg:border-l lg:pl-5")}
            onPointerEnter={() => setHint(it.key)}
            onPointerLeave={() => setHint(null)}
          >
            <dt className="label mb-1 text-[10px]">{it.label}</dt>
            <dd>
              <AnimatedValue value={it.value} format={it.format} className={clsx("text-xl tracking-[-0.01em]", it.tone ?? "text-ink")} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 h-5 text-xs text-ink-3" aria-live="off">
        {hint ? LEDGER_HINTS[hint] : ""}
      </p>
    </div>
  );
}

/** Deployed capital by position, and what remains available. */
export function AllocationBar() {
  const c = useCapital();
  const [focus, setFocus] = useState<string | null>(null);
  const segments = [
    ...c.positions.map((p) => ({ id: p.id, label: INSTRUMENTS[p.symbol].pair, value: p.marketValue, held: true })),
    { id: "cash", label: "Tersedia", value: c.available, held: false },
  ];
  const focused = segments.find((s) => s.id === focus);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="label text-[10px]">Alokasi</p>
        <p className="num text-xs text-ink-3">
          {focused
            ? `${focused.label} · ${formatUsd(focused.value, { whole: true })} · ${formatPct((focused.value / c.total) * 100, 1)}`
            : `${formatPct((c.deployed / c.total) * 100, 1)} deployed`}
        </p>
      </div>
      <div className="flex h-3 w-full gap-[2px]" role="img" aria-label={`Allocation: ${segments.map((s) => `${s.label} ${formatPct((s.value / c.total) * 100, 0)}`).join(", ")}`}>
        {segments.map((s, i) => (
          <motion.span
            key={s.id}
            layout
            transition={transition.scene}
            onPointerEnter={() => setFocus(s.id)}
            onPointerLeave={() => setFocus(null)}
            className={clsx(
              "h-full transition-opacity duration-150",
              s.held ? (i % 2 === 0 ? "bg-accent" : "bg-[#12c9f0]") : "bg-[repeating-linear-gradient(135deg,var(--color-line-strong)_0_1px,transparent_1px_5px)]",
              focus && focus !== s.id && "opacity-35",
            )}
            style={{ flexGrow: s.value }}
          />
        ))}
      </div>
    </div>
  );
}

/** Simulated 30-day equity, ending at live equity. */
export function EquityCurve({ height = 220 }: { height?: number }) {
  const c = useCapital();
  const history = useAppStore((s) => s.portfolio.equityHistory);
  const series = useMemo(() => [...history.slice(0, -1), c.total], [history, c.total]);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="label text-[10px]">Ekuitas · 30 hari</p>
        <p className="text-xs text-ink-3">Garis putus-putus: awal bulan</p>
      </div>
      <PerformanceChart
        values={series}
        spanHours={30 * 24}
        formatValue={(v) => formatUsd(v, { whole: true })}
        height={height}
        ariaLabel="Ekuitas simulasi selama 30 hari"
      />
    </div>
  );
}

/** Headline equity with month-to-date change and the equity curve. */
export function CapitalOverview({ chartHeight = 220 }: { chartHeight?: number }) {
  const c = useCapital();

  return (
    <div className="grid grid-cols-12 gap-x-6 gap-y-10">
      <div className="col-span-12 lg:col-span-5">
        <div className="mb-2 flex items-center gap-3">
          <p className="label">Total modal</p>
          <SimBadge compact />
        </div>
        <AnimatedValue value={c.total} format={(v) => formatUsd(v)} className="block text-5xl font-light tracking-[-0.035em] text-ink md:text-6xl" />
        <p className="mt-2 text-sm text-ink-2">
          <Delta value={c.monthPnl} format={(v) => formatSignedUsd(v)} /> · <Delta value={c.monthReturnPct} /> bulan ini
        </p>
        <div className="mt-10">
          <AllocationBar />
        </div>
      </div>
      <div className="col-span-12 lg:col-span-7">
        <EquityCurve height={chartHeight} />
      </div>
      <div className="col-span-12">
        <CapitalLedger />
      </div>
    </div>
  );
}
