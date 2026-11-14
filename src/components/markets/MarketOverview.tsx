"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { InstrumentTape } from "@/components/markets/InstrumentTape";
import { MarketRegime } from "@/components/markets/MarketRegime";
import { ReturnVolatilityMap } from "@/components/markets/ReturnVolatilityMap";
import { TimeframeSwitch } from "@/components/markets/TimeframeSwitch";
import { useMarketStats } from "@/hooks/use-derived";
import { useAppStore } from "@/store/app-store";
import type { MarketSymbol, Timeframe } from "@/types/domain";

/** Command Center view of markets: regime, the risk/return space, and the tape. */
export function MarketOverview() {
  const [tf, setTf] = useState<Timeframe>("1M");
  const stats = useMarketStats(tf);
  const held = useAppStore((s) => s.portfolio.positions.map((p) => p.symbol).join());
  const router = useRouter();

  return (
    <div className="space-y-12">
      <MarketRegime />
      <div className="grid grid-cols-12 gap-x-6 gap-y-12">
        <div className="col-span-12 lg:col-span-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="label text-[10px]">Return vs. volatility · filled = held</p>
            <TimeframeSwitch value={tf} onChange={setTf} />
          </div>
          <ReturnVolatilityMap
            stats={stats}
            held={held.split(",") as MarketSymbol[]}
            timeframeLabel={tf}
            onSelect={(s) => router.push(`/markets?symbol=${s}`)}
          />
        </div>
        <div className="col-span-12 lg:col-span-5">
          <InstrumentTape />
        </div>
      </div>
    </div>
  );
}
