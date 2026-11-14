"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useMemo, useState } from "react";
import { INSTRUMENTS } from "@/data/instruments";
import { useCapital, usePendingApproval } from "@/hooks/use-derived";
import { useAgentService } from "@/components/layout/SimulationProvider";
import { Button, SimBadge } from "@/components/shared/primitives";
import { transition } from "@/lib/design/tokens";
import { formatClock, formatNumber, formatPct, formatR, formatSignedUsd, formatUsd } from "@/lib/formatting/format";
import { setupImpact } from "@/lib/risk/risk";
import { market } from "@/lib/simulation/initial-state";
import { useAppStore } from "@/store/app-store";
import { useUiStore } from "@/store/ui-store";

const CONFIRM_WINDOW_MS = 4000;
const SIZE_STEPS = [0.25, 0.5, 0.68, 0.75, 1] as const;

/**
 * A calm, persistent request for a human decision. It sits in the page
 * rather than interrupting it, and approval takes two deliberate steps.
 */
export function ApprovalPanel() {
  const { request, setup } = usePendingApproval();
  return (
    <AnimatePresence initial={false}>
      {request && setup && (
        <motion.section
          key={request.id}
          aria-labelledby="approval-title"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={transition.scene}
          className="overflow-hidden"
        >
          <ApprovalBody requestId={request.id} />
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function ApprovalBody({ requestId }: { requestId: string }) {
  const { request, setup } = usePendingApproval();
  const capital = useCapital();
  const policy = useAppStore((s) => s.policy);
  const service = useAgentService();
  const openWhy = useUiStore((s) => s.openWhy);
  const sliderId = useId();

  const [modifying, setModifying] = useState(false);
  const [fraction, setFraction] = useState(1);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), CONFIRM_WINDOW_MS);
    return () => clearTimeout(t);
  }, [confirming]);

  const quantity = setup ? Math.floor(setup.quantity * fraction * 10000) / 10000 : 0;
  const impact = useMemo(
    () => (setup ? setupImpact(market, capital, setup, quantity) : null),
    // Recompute on size change or as equity moves; correlation is stable within a session.
    [setup, quantity, capital],
  );

  if (!request || !setup || !impact || request.id !== requestId) return null;
  const inst = INSTRUMENTS[setup.symbol];
  const exposureBreach = impact.exposureAfterPct > policy.maxPortfolioExposurePct;
  const sizeOk = impact.positionPctOfEquity <= policy.maxPositionPctOfEquity;

  const approve = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    service.approve(request.id, fraction === 1 ? undefined : quantity);
  };

  return (
    <div className="relative mb-14 border-y border-caution/30 bg-caution-soft/50">
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-caution" />
      <div className="mx-auto grid max-w-[1360px] grid-cols-12 gap-x-6 gap-y-8 px-4 py-8 sm:px-6 md:px-10 lg:px-12">
        <div className="col-span-12 lg:col-span-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <p className="label text-caution">Agent needs your decision</p>
            <span className="num font-mono text-xs text-ink-3">{formatClock(request.at)}</span>
            <SimBadge compact />
          </div>
          <h2 id="approval-title" className="text-2xl font-normal tracking-[-0.015em] text-ink md:text-[1.75rem] md:leading-tight">
            “{request.title}”
          </h2>
          <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-ink-2">{request.reason}</p>
          <button
            type="button"
            onClick={() => openWhy(request.decisionId)}
            className="mt-4 text-sm text-accent underline-offset-4 hover:underline"
          >
            See why the agent wants this trade
          </button>
        </div>

        <div className="col-span-12 lg:col-span-7">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-4">
            <Figure label="Expected return" value={formatSignedUsd(impact.expectedReturn)} sub={formatR(impact.expectedValueR)} tone="positive" />
            <Figure
              label="Maximum loss"
              value={formatSignedUsd(-impact.maxLoss)}
              sub={`${formatPct(impact.maxLossPctOfEquity)} of equity`}
              tone="negative"
            />
            <Figure
              label="Position"
              value={`${formatNumber(quantity, quantity < 0.1 ? 4 : 2)} ${setup.symbol}`}
              sub={`${formatUsd(impact.positionValue, { whole: true })} · ${impact.positionPctOfEquity.toFixed(0)}% of equity`}
            />
            <Figure
              label="Risk impact"
              value={`${impact.exposureBeforePct.toFixed(0)}% → ${impact.exposureAfterPct.toFixed(0)}%`}
              sub={exposureBreach ? `Above ${policy.maxPortfolioExposurePct}% exposure policy` : "Portfolio exposure"}
              tone={exposureBreach ? "caution" : undefined}
            />
          </dl>

          <AnimatePresence initial={false}>
            {modifying && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={transition.panel}
                className="overflow-hidden"
              >
                <div className="mt-7 border-t border-caution/20 pt-5">
                  <label htmlFor={sliderId} className="label mb-3 flex items-center justify-between">
                    <span>Position size</span>
                    <span className={clsx("num", sizeOk ? "text-positive" : "text-ink-2")}>
                      {Math.round(fraction * 100)}% of proposed{sizeOk ? " · within autonomous limit" : ""}
                    </span>
                  </label>
                  <input
                    id={sliderId}
                    type="range"
                    min={0}
                    max={SIZE_STEPS.length - 1}
                    step={1}
                    value={SIZE_STEPS.indexOf(fraction as (typeof SIZE_STEPS)[number])}
                    onChange={(e) => {
                      setFraction(SIZE_STEPS[Number(e.target.value)]);
                      setConfirming(false);
                    }}
                    aria-valuetext={`${Math.round(fraction * 100)} percent of proposed size`}
                    className="w-full accent-[var(--color-ink)]"
                  />
                  <div className="num mt-1 flex justify-between font-mono text-[10px] text-ink-3">
                    {SIZE_STEPS.map((s) => (
                      <span key={s}>{Math.round(s * 100)}%</span>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              onClick={approve}
              aria-live="polite"
              className={clsx("min-w-[9.5rem]", confirming && "bg-positive hover:bg-positive/90")}
            >
              {confirming ? "Confirm approval" : fraction === 1 ? "Approve" : `Approve ${Math.round(fraction * 100)}%`}
            </Button>
            <Button
              onClick={() => {
                setModifying((m) => !m);
                setConfirming(false);
              }}
              aria-expanded={modifying}
            >
              {modifying ? "Done" : "Modify"}
            </Button>
            <Button variant="danger" onClick={() => service.reject(request.id)}>
              Reject
            </Button>
            <AnimatePresence>
              {confirming && (
                <motion.span
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={transition.state}
                  className="text-xs text-ink-3"
                >
                  Press again to send the simulated order for {inst.pair}.
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "positive" | "negative" | "caution";
}) {
  return (
    <div className="min-w-0">
      <dt className="label mb-1.5 text-[10px]">{label}</dt>
      <dd>
        <span
          className={clsx(
            "num block text-xl tracking-[-0.01em]",
            tone === "positive" && "text-positive",
            tone === "negative" && "text-negative",
            tone === "caution" && "text-caution",
            !tone && "text-ink",
          )}
        >
          {value}
        </span>
        <span className="mt-0.5 block text-xs text-ink-3">{sub}</span>
      </dd>
    </div>
  );
}
