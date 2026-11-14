"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { INSTRUMENTS, SYMBOLS } from "@/data/instruments";
import { CorrelationMatrix } from "@/components/markets/CorrelationMatrix";
import { InstrumentTape, LivePrice } from "@/components/markets/InstrumentTape";
import { MarketRegime } from "@/components/markets/MarketRegime";
import { PerformanceChart } from "@/components/markets/PerformanceChart";
import { ReturnVolatilityMap } from "@/components/markets/ReturnVolatilityMap";
import { TimeframeSwitch } from "@/components/markets/TimeframeSwitch";
import { TradingWorkspace } from "@/components/markets/TradingWorkspace";
import { SHELL } from "@/components/shared/PageIntro";
import { Delta, Reveal, SectionHeader } from "@/components/shared/primitives";
import { useMarketStats, useSeries } from "@/hooks/use-derived";
import { extent } from "@/lib/analytics/series";
import { formatPct, formatPrice } from "@/lib/formatting/format";
import { TIMEFRAME_HOURS } from "@/lib/simulation/market";
import { useAppStore } from "@/store/app-store";
import type { MarketSymbol, Timeframe } from "@/types/domain";

const spanHours = (tf: Timeframe) => (tf === "1D" ? 24 : TIMEFRAME_HOURS[tf]);

export function MarketsWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const fromUrl = params.get("symbol") as MarketSymbol | null;
  const symbol: MarketSymbol = fromUrl && SYMBOLS.includes(fromUrl) ? fromUrl : "ETH";
  const [tf, setTf] = useState<Timeframe>("1M");

  const select = useCallback(
    (s: MarketSymbol) => router.replace(`${pathname}?symbol=${s}`, { scroll: false }),
    [router, pathname],
  );

  const inst = INSTRUMENTS[symbol];
  const series = useSeries(symbol, tf);
  const stats = useMarketStats(tf);
  const st = stats.find((s) => s.symbol === symbol)!;
  const [lo, hi] = useMemo(() => extent(series), [series]);
  const held = useAppStore((s) => s.portfolio.positions.map((p) => p.symbol).join());
  const limit = useAppStore((s) => s.policy.maxCorrelation);
  const format = useCallback((v: number) => formatPrice(v, inst.decimals), [inst.decimals]);

  return (
    <>
      <section className={`${SHELL} pb-20`} aria-label="Rezim pasar">
        <MarketRegime />
      </section>

      <section className={`${SHELL} pb-24`} aria-labelledby="chart-title">
        <div className="grid grid-cols-12 gap-x-4 lg:gap-x-10 gap-y-12 border-t border-line pt-6">
          <div className="col-span-12 lg:col-span-8">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="label mb-1">{inst.assetClass}</p>
                <h2 id="chart-title" className="text-2xl font-normal tracking-[-0.015em] text-ink">
                  {inst.pair}
                </h2>
                <p className="mt-1 text-4xl font-light tracking-[-0.025em] text-ink">
                  <LivePrice symbol={symbol} />
                </p>
              </div>
              <dl className="flex flex-wrap gap-x-8 gap-y-2">
                <div>
                  <dt className="label text-[10px]">Return · {tf}</dt>
                  <dd className="text-lg">
                    <Delta value={st.returnPct} />
                  </dd>
                </div>
                <div>
                  <dt className="label text-[10px]">Volatilitas</dt>
                  <dd className="num text-lg text-ink">{formatPct(st.volatilityPct, 1)}</dd>
                </div>
                <div>
                  <dt className="label text-[10px]">Rentang</dt>
                  <dd className="num text-lg text-ink">
                    {formatPrice(lo, inst.decimals)} – {formatPrice(hi, inst.decimals)}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="mb-2 flex justify-end">
              <TimeframeSwitch value={tf} onChange={setTf} />
            </div>
            <PerformanceChart
              values={series}
              spanHours={spanHours(tf)}
              formatValue={format}
              height={340}
              ariaLabel={`${inst.pair} price over ${tf}`}
            />
            <p className="mt-2 text-xs text-ink-3">Garis putus-putus menandai harga pembukaan periode. Gunakan tombol panah pada grafik untuk nilai pastinya.</p>
          </div>
          <div className="col-span-12 lg:col-span-4">
            <p className="label mb-3 text-[10px]">Pilih instrumen</p>
            <InstrumentTape selected={symbol} onSelect={select} compact />
          </div>
        </div>
      </section>

      <Reveal as="section" className={`${SHELL} pb-24`}>
        <SectionHeader
          index="02.1"
          title="Eksekusi"
          summary={`Setup yang akan diambil strategi pada ${inst.pair} sekarang, dan dampaknya ke portofolio.`}
        />
        <TradingWorkspace symbol={symbol} />
      </Reveal>

      <Reveal as="section" className={`${SHELL} pb-8`}>
        <SectionHeader
          index="02.2"
          title="Hubungan"
          summary="Pasar mana yang sepadan dengan risikonya, dan mana yang bergerak bersama."
          aside={<TimeframeSwitch value={tf} onChange={setTf} label="Rentang waktu untuk return dan volatilitas" />}
        />
        <div className="grid grid-cols-12 gap-x-4 lg:gap-x-10 gap-y-12">
          <div className="col-span-12 lg:col-span-7">
            <p className="label mb-3 text-[10px]">Return vs. volatility · {tf} · filled = held</p>
            <ReturnVolatilityMap stats={stats} held={held.split(",") as MarketSymbol[]} timeframeLabel={tf} onSelect={select} height={340} />
          </div>
          <div className="col-span-12 lg:col-span-5">
            <p className="label mb-3 text-[10px]">Korelasi · 90 hari, return per jam</p>
            <CorrelationMatrix limit={limit} />
          </div>
        </div>
      </Reveal>
    </>
  );
}
