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
    { label: "Risiko per transaksi", value: `≤ ${policy.maxRiskPerTradePct}% dari ekuitas` },
    { label: "Ukuran posisi", value: `≤ ${policy.maxPositionPctOfEquity}% dari ekuitas` },
    { label: "Eksposur portofolio", value: `≤ ${policy.maxPortfolioExposurePct}% terpakai` },
    { label: "Korelasi dengan portofolio", value: `≤ ${policy.maxCorrelation.toFixed(2)}` },
    { label: "Nilai harapan", value: `≥ ${formatR(policy.minExpectedValueR)}` },
    { label: "Batas drawdown", value: `${policy.maxDrawdownPct}% dari puncak` },
    { label: "Leverage", value: "Tidak ada" },
  ];

  return (
    <div>
      <p className="label mb-1">Mode</p>
      <p className="text-2xl font-light tracking-[-0.015em] text-ink">{running ? "Otonom dalam batas" : "Dijeda"}</p>
      <p className="mt-2 max-w-[44ch] text-sm text-ink-2">
        Di dalam batas ini agen bertindak sendiri dan mencatat alasannya. Apa pun di luar batas menunggu persetujuan Anda.
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
        {running ? "Jeda agen" : "Lanjutkan agen"}
      </Button>
    </div>
  );
}
