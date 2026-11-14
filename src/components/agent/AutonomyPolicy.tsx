"use client";

import { useAgentService } from "@/components/layout/SimulationProvider";
import { Button } from "@/components/shared/primitives";
import { formatR } from "@/lib/formatting/format";
import { useAppStore } from "@/store/app-store";

/** The limits the agent acts within. Outside them, it asks. */
export function AutonomyPolicy() {
  const policy = useAppStore((s) => s.policy);
  const running = useAppStore((s) => s.running);
  const service = useAgentService();

  const rows = [
    { label: "Risk per trade", value: `≤ ${policy.maxRiskPerTradePct}% of equity` },
    { label: "Position size", value: `≤ ${policy.maxPositionPctOfEquity}% of equity` },
    { label: "Portfolio exposure", value: `≤ ${policy.maxPortfolioExposurePct}% deployed` },
    { label: "Correlation with book", value: `≤ ${policy.maxCorrelation.toFixed(2)}` },
    { label: "Expected value", value: `≥ ${formatR(policy.minExpectedValueR)}` },
    { label: "Drawdown stop", value: `${policy.maxDrawdownPct}% from peak` },
    { label: "Leverage", value: "None" },
  ];

  return (
    <div>
      <p className="label mb-1">Mode</p>
      <p className="text-2xl font-light tracking-[-0.015em] text-ink">{running ? "Autonomous within limits" : "Paused"}</p>
      <p className="mt-2 max-w-[44ch] text-sm text-ink-2">
        Inside these limits the agent acts on its own and records why. Anything outside them waits for your approval.
      </p>
      <dl className="mt-6 border-t border-line">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[1fr_auto] gap-4 border-b border-line py-2.5 text-sm">
            <dt className="text-ink-3">{r.label}</dt>
            <dd className="num text-ink">{r.value}</dd>
          </div>
        ))}
      </dl>
      <Button className="mt-6" onClick={() => (running ? service.pause() : service.resume())}>
        {running ? "Pause the agent" : "Resume the agent"}
      </Button>
    </div>
  );
}
