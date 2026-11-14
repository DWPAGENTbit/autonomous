"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { INSTRUMENTS } from "@/data/instruments";
import { LivePrice } from "@/components/markets/InstrumentTape";
import { Delta } from "@/components/shared/primitives";
import { useCapital } from "@/hooks/use-derived";
import { transition } from "@/lib/design/tokens";
import { formatClock, formatNumber, formatPct, formatPrice, formatSignedUsd, formatUsd } from "@/lib/formatting/format";
import { useUiStore } from "@/store/ui-store";

/** Open positions, each with the risk it carries and the decision behind it. */
export function PositionsLedger() {
  const c = useCapital();
  const openWhy = useUiStore((s) => s.openWhy);

  return (
    <>
    <ul className="md:hidden" aria-label="Open positions (simulated)">
      {c.positions.map((p) => {
        const inst = INSTRUMENTS[p.symbol];
        return (
          <li key={p.id} className="border-b border-line py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-ink">{inst.pair}</p>
                <p className="num text-xs text-ink-3">
                  {formatNumber(p.quantity, p.quantity < 0.1 ? 4 : 2)} @ {formatPrice(p.entryPrice, inst.decimals)} · opened {formatClock(p.openedAt, false)}
                </p>
              </div>
              <div className="text-right">
                <span className={clsx("num block text-sm", p.unrealized >= 0 ? "text-positive" : "text-negative")}>{formatSignedUsd(p.unrealized)}</span>
                <Delta value={p.unrealizedPct} className="block text-xs" />
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-x-4 text-xs">
              <div>
                <dt className="label text-[9px]">Price</dt>
                <dd><LivePrice symbol={p.symbol} className="text-ink" /></dd>
              </div>
              <div>
                <dt className="label text-[9px]">Value · weight</dt>
                <dd className="num text-ink">{formatUsd(p.marketValue)} · {formatPct(p.weightPct, 0)}</dd>
              </div>
              <div className="text-right">
                <dt className="label text-[9px]">At risk</dt>
                <dd className="num text-ink-2">{formatUsd(p.riskToStop)}</dd>
              </div>
            </dl>
            {p.decisionId && (
              <button type="button" onClick={() => openWhy(p.decisionId!)} className="mt-2 text-xs text-accent underline-offset-4 hover:underline">
                Why this position?
              </button>
            )}
          </li>
        );
      })}
    </ul>
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[720px] text-left">
        <caption className="sr-only">Open positions (simulated)</caption>
        <thead>
          <tr className="label border-b border-line text-[10px]">
            <th scope="col" className="py-2 font-medium">Position</th>
            <th scope="col" className="py-2 text-right font-medium">Entry</th>
            <th scope="col" className="py-2 text-right font-medium">Price</th>
            <th scope="col" className="py-2 text-right font-medium">Value</th>
            <th scope="col" className="py-2 text-right font-medium">Unrealized</th>
            <th scope="col" className="py-2 text-right font-medium">Weight</th>
            <th scope="col" className="py-2 text-right font-medium">At risk to stop</th>
            <th scope="col" className="py-2 font-medium"><span className="sr-only">Reasoning</span></th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {c.positions.map((p) => {
              const inst = INSTRUMENTS[p.symbol];
              return (
                <motion.tr
                  key={p.id}
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={transition.meaning}
                  className="group border-b border-line text-sm transition-colors hover:bg-sunken/50"
                >
                  <td className="py-4">
                    <span className="block text-ink">{inst.pair}</span>
                    <span className="num block text-xs text-ink-3">
                      {formatNumber(p.quantity, p.quantity < 0.1 ? 4 : 2)} · opened {formatClock(p.openedAt, false)}
                    </span>
                  </td>
                  <td className="num py-4 text-right text-ink-2">{formatPrice(p.entryPrice, inst.decimals)}</td>
                  <td className="py-4 text-right">
                    <LivePrice symbol={p.symbol} />
                  </td>
                  <td className="num py-4 text-right text-ink">{formatUsd(p.marketValue)}</td>
                  <td className="py-4 text-right">
                    <span className={clsx("num block", p.unrealized >= 0 ? "text-positive" : "text-negative")}>{formatSignedUsd(p.unrealized)}</span>
                    <Delta value={p.unrealizedPct} className="block text-xs" />
                  </td>
                  <td className="num py-4 text-right text-ink-2">{formatPct(p.weightPct, 1)}</td>
                  <td className="py-4 text-right">
                    <span className="num block text-ink-2">{formatUsd(p.riskToStop)}</span>
                    <span className="num block text-xs text-ink-3">stop {formatPrice(p.stopPrice, inst.decimals)}</span>
                  </td>
                  <td className="py-4 pl-4 text-right">
                    {p.decisionId ? (
                      <button type="button" onClick={() => openWhy(p.decisionId!)} className="text-xs text-accent underline-offset-4 hover:underline">
                        Why?
                      </button>
                    ) : (
                      <span className="text-xs text-ink-4">Prior session</span>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
    </>
  );
}
