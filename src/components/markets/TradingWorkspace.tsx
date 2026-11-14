"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { INSTRUMENTS } from "@/data/instruments";
import { useAgentService } from "@/components/layout/SimulationProvider";
import { LivePrice } from "@/components/markets/InstrumentTape";
import { Button, SimBadge } from "@/components/shared/primitives";
import { useCapital } from "@/hooks/use-derived";
import { proposeSetup } from "@/lib/analytics/setup";
import { stagger, transition } from "@/lib/design/tokens";
import { formatPct, formatPrice, formatR, formatSignedPct, formatUsd } from "@/lib/formatting/format";
import { expectedValueR, setupImpact } from "@/lib/risk/risk";
import { market } from "@/lib/simulation/initial-state";
import { useAppStore } from "@/store/app-store";
import type { MarketSymbol, SimulationResult, TradeSetup } from "@/types/domain";

const SLOW_EVERY = 5;

/**
 * Execution workspace for one instrument: the setup the strategy would
 * take, its risk on the book, and — when the agent has asked — the controls
 * to approve it.
 */
export function TradingWorkspace({ symbol }: { symbol: MarketSymbol }) {
  const inst = INSTRUMENTS[symbol];
  const capital = useCapital();
  const policy = useAppStore((s) => s.policy);
  const slow = useAppStore((s) => Math.floor(s.marketVersion / SLOW_EVERY));
  const pendingSel = useAppStore(
    useShallow((s) => {
      const req = s.approvals.find((a) => s.setups[a.setupId]?.symbol === symbol);
      return { request: req, setup: req ? s.setups[req.setupId] : undefined };
    }),
  );
  const pending = pendingSel.request && pendingSel.setup ? { request: pendingSel.request, setup: pendingSel.setup } : null;
  const service = useAgentService();
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);

  const watchSetup = useMemo(
    () => proposeSetup({ id: `watch-${symbol}`, symbol, market, equity: capital.total, cash: capital.available }),
    // Re-proposed every few ticks; the setup should not flicker with each price.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [symbol, slow, capital.positions.length],
  );
  const setup: TradeSetup = pending?.setup ?? watchSetup;
  const impact = useMemo(() => setupImpact(market, capital, setup), [capital, setup]);
  const ev = expectedValueR(setup);
  const held = capital.positions.some((p) => p.symbol === symbol);

  const simulate = async () => {
    setRunning(true);
    setResult(null);
    const r = await service.simulate(setup);
    // A short beat so the user sees that work happened.
    setTimeout(() => {
      setResult(r);
      setRunning(false);
    }, 450);
  };

  const fields: { label: string; value: React.ReactNode; tone?: string }[] = [
    { label: "Tren", value: setup.trend, tone: setup.trend === "Bullish" ? "text-positive" : setup.trend === "Bearish" ? "text-negative" : undefined },
    { label: "Sinyal", value: setup.signal },
    { label: "Masuk", value: formatPrice(setup.entry, inst.decimals) },
    { label: "Stop", value: formatPrice(setup.stop, inst.decimals), tone: "text-negative" },
    { label: "Target", value: formatPrice(setup.target, inst.decimals), tone: "text-positive" },
    { label: "Risiko", value: `${formatPct(impact.maxLossPctOfEquity)} dari ekuitas` },
    { label: "Nilai harapan", value: formatR(ev), tone: ev >= policy.minExpectedValueR ? "text-positive" : "text-negative" },
    { label: "Keyakinan", value: `${Math.round(setup.confidence * 100)}%` },
  ];

  return (
    <div className="grid grid-cols-12 gap-x-6 gap-y-10">
      <div className="col-span-12 lg:col-span-5">
        <div className="mb-1 flex items-center gap-3">
          <p className="label">Instrumen</p>
          <SimBadge compact />
        </div>
        <p className="text-3xl font-light tracking-[-0.02em] text-ink">{inst.pair}</p>
        <p className="mt-1 text-4xl font-light tracking-[-0.025em] text-ink md:text-5xl">
          <LivePrice symbol={symbol} />
        </p>
        <p className="mt-3 text-sm text-ink-2">
          {pending ? (
            <span className="text-caution">Agen meminta persetujuan Anda untuk setup ini.</span>
          ) : held ? (
            "Sudah dipegang. Agen memantau posisi yang ada."
          ) : (
            "Memantau. Jika setup ini terpicu dalam batas kebijakan, agen mengeksekusinya sendiri."
          )}
        </p>

        <TradeLadder setup={setup} decimals={inst.decimals} maxLoss={impact.maxLoss} exposureAfter={impact.exposureAfterPct} />
      </div>

      <div className="col-span-12 lg:col-span-7">
        <dl className="grid grid-cols-2 border-t border-line sm:grid-cols-4">
          {fields.map((f) => (
            <div key={f.label} className="border-b border-line py-4 pr-4">
              <dt className="label mb-1 text-[10px]">{f.label}</dt>
              <dd className={clsx("num text-lg tracking-[-0.01em]", f.tone ?? "text-ink")}>{f.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={simulate} disabled={running} aria-describedby="simulate-hint">
            {running ? "Menyimulasikan…" : "Simulasikan"}
          </Button>
          <Button variant="primary" disabled={!pending} onClick={() => pending && service.approve(pending.request.id)}>
            Setujui
          </Button>
          <Button variant="danger" disabled={!pending} onClick={() => pending && service.reject(pending.request.id)}>
            Tolak
          </Button>
          <span id="simulate-hint" className="text-xs text-ink-3">
            {pending ? "Persetujuan mengirim order simulasi." : "Setujui dan tolak aktif saat agen bertanya."}
          </span>
        </div>

        <AnimatePresence mode="wait">
          {running && (
            <motion.div
              key="running"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-8 h-px w-full overflow-hidden bg-line"
            >
              <span className="block h-px w-1/3 animate-progress bg-ink" />
            </motion.div>
          )}
          {result && !running && (
            <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={transition.meaning}>
              <OutcomeDistribution result={result} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Stop, entry, target and the live price on one line: risk and reward as distance. */
function TradeLadder({
  setup,
  decimals,
  maxLoss,
  exposureAfter,
}: {
  setup: TradeSetup;
  decimals: number;
  maxLoss: number;
  exposureAfter: number;
}) {
  const price = useAppStore((s) => s.quotes[setup.symbol].price);
  const [hover, setHover] = useState(false);
  const lo = setup.stop - (setup.target - setup.stop) * 0.08;
  const hi = setup.target + (setup.target - setup.stop) * 0.08;
  const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const fromEntry = ((price - setup.entry) / setup.entry) * 100;

  return (
    <div
      className="mt-10"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      tabIndex={0}
      aria-label={`Trade plan: stop ${formatPrice(setup.stop, decimals)}, entry ${formatPrice(setup.entry, decimals)}, target ${formatPrice(setup.target, decimals)}. Maximum loss ${formatUsd(maxLoss)}.`}
    >
      <div className="relative h-14">
        <div className="absolute top-6 h-[3px] bg-negative/35" style={{ left: pos(setup.stop), width: `calc(${pos(setup.entry)} - ${pos(setup.stop)})` }} />
        <div className="absolute top-6 h-[3px] bg-positive/35" style={{ left: pos(setup.entry), width: `calc(${pos(setup.target)} - ${pos(setup.entry)})` }} />
        {[
          { v: setup.stop, label: "Stop", cls: "bg-negative" },
          { v: setup.entry, label: "Masuk", cls: "bg-ink" },
          { v: setup.target, label: "Target", cls: "bg-positive" },
        ].map((m) => (
          <div key={m.label} className="absolute top-0 -translate-x-1/2 text-center" style={{ left: pos(m.v) }}>
            <span className="label block text-[9px]">{m.label}</span>
            <span className={clsx("mx-auto mt-1 block h-4 w-px", m.cls)} />
          </div>
        ))}
        <motion.div
          className="absolute top-[18px] -translate-x-1/2"
          animate={{ left: pos(Math.min(Math.max(price, lo), hi)) }}
          transition={transition.meaning}
        >
          <span className="block size-2.5 rotate-45 border border-ink bg-canvas" />
        </motion.div>
      </div>
      <div className="flex justify-between text-xs text-ink-3">
        <span className="num">−1.0R</span>
        <span className="num">
          Price vs entry <span className={fromEntry >= 0 ? "text-positive" : "text-negative"}>{formatSignedPct(fromEntry)}</span>
        </span>
        <span className="num">+{((setup.target - setup.entry) / (setup.entry - setup.stop)).toFixed(1)}R</span>
      </div>
      <motion.p
        initial={false}
        animate={{ opacity: hover ? 1 : 0, y: hover ? 0 : -2 }}
        transition={transition.state}
        className="mt-3 text-xs text-ink-2"
        aria-hidden={!hover}
      >
        Jika kena stop, portofolio rugi {formatUsd(maxLoss)}. Jika dieksekusi, eksposur menjadi {exposureAfter.toFixed(0)}% dari ekuitas.
      </motion.p>
    </div>
  );
}

function OutcomeDistribution({ result }: { result: SimulationResult }) {
  const max = Math.max(...result.buckets.map((b) => b.count));
  return (
    <div className="mt-8 border-t border-line pt-6">
      <div className="mb-5 flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <p className="label">Outcome of {result.paths} simulated paths</p>
        <p className="text-sm text-ink-2">
          Win rate <span className="num text-ink">{Math.round(result.winRate * 100)}%</span>
        </p>
        <p className="text-sm text-ink-2">
          Expected <span className="num text-ink">{formatR(result.expectedR)}</span>
        </p>
        <p className="text-sm text-ink-2">
          Worst path <span className="num text-negative">{formatR(result.worstR)}</span>
        </p>
      </div>
      <motion.div
        className="flex h-28 items-end gap-1"
        role="img"
        aria-label={`Sebaran hasil: tingkat menang ${Math.round(result.winRate * 100)} persen, ekspektasi ${formatR(result.expectedR)}`}
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: stagger.tight } } }}
      >
        {result.buckets.map((b) => (
          <div key={b.r} className="flex h-full flex-1 flex-col justify-end">
            <motion.div
              className={clsx("origin-bottom", b.r < 0 ? "bg-negative/55" : b.r === 0 ? "bg-ink-4" : "bg-positive/60")}
              style={{ height: `${(b.count / max) * 100}%` }}
              variants={{ hidden: { scaleY: 0 }, show: { scaleY: 1, transition: transition.meaning } }}
              title={`${b.r >= 0 ? "+" : ""}${b.r.toFixed(1)}R: ${b.count} paths`}
            />
          </div>
        ))}
      </motion.div>
      <div className="mt-2 flex gap-1">
        {result.buckets.map((b) => (
          <span key={b.r} className="num flex-1 text-center font-mono text-[10px] text-ink-3">
            {Number.isInteger(b.r) ? `${b.r > 0 ? "+" : ""}${b.r}R` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
