"use client";

import clsx from "clsx";
import Link from "next/link";
import { ArrowUpRight, Coins, Landmark, PiggyBank, RefreshCw, ShieldAlert, ShieldCheck, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BotSummaryCard } from "@/components/bot/BotPanel";
import { StatusDot } from "@/components/shared/primitives";
import { useVisibleInterval } from "@/lib/use-visible-interval";
import type { RealPortfolio } from "@/lib/server/portfolio";
import type { Ticker } from "@/lib/server/market";

// ── Formatting ───────────────────────────────────────────────

export const rupiah = (v: number) => {
  const abs = Math.abs(v);
  const digits = abs > 0 && abs < 10 ? 4 : abs < 1000 ? 2 : 0;
  return `Rp${v.toLocaleString("id-ID", { maximumFractionDigits: digits })}`;
};
const signedRupiah = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${rupiah(Math.abs(v))}`;
const signedPct = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`);
const tone = (v: number | null) => (v === null || v === 0 ? "text-ink-3" : v > 0 ? "text-positive" : "text-negative");
const amountFmt = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: v < 1 ? 8 : 4 });
const timeFmt = (t: number) => new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

// ── Data ─────────────────────────────────────────────────────

const MANUAL_KEYS = ["dwp.manual.bibit", "dwp.manual.stockbit"];

function manualTotal(): number {
  let sum = 0;
  for (const key of MANUAL_KEYS) {
    try {
      const items = JSON.parse(localStorage.getItem(key) ?? "[]") as { value?: number }[];
      sum += items.reduce((s, h) => s + (Number(h.value) || 0), 0);
    } catch {
      // Storage blocked or malformed: count nothing from it.
    }
  }
  return sum;
}

/** Real portfolio and live prices, refreshed every 30 seconds. */
export function useRealData() {
  const [portfolio, setPortfolio] = useState<RealPortfolio | null>(null);
  const [markets, setMarkets] = useState<Ticker[] | null>(null);
  const [manual, setManual] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setManual(manualTotal());
    try {
      const [p, m] = await Promise.all([fetch("/api/portfolio", { cache: "no-store" }), fetch("/api/market", { cache: "no-store" })]);
      if (p.status === 401) {
        setError("Sesi berakhir. Muat ulang halaman untuk masuk lagi.");
        return;
      }
      if (p.ok) setPortfolio(await p.json());
      if (m.ok) setMarkets(((await m.json()) as { markets: Ticker[] }).markets);
      setError(null);
    } catch {
      setError("Server tidak bisa dihubungi.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Once a minute while on screen: Indodax prices move, but this keeps Vercel usage small.
  useVisibleInterval(load, 60_000);

  return { portfolio, markets, manual, error, loading, reload: load };
}

// ── Pieces ───────────────────────────────────────────────────

export function RealBadgeLive({ at }: { at?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-positive/25 bg-positive-soft px-2 py-0.5 font-mono text-[10px] font-medium tracking-[0.1em] text-positive uppercase">
      <StatusDot tone="positive" pulse />
      Data nyata{at ? ` · ${timeFmt(at)}` : ""}
    </span>
  );
}

const DONUT = ["#0a63f2", "#12c9f0", "#0d9b63", "#f5a524", "#8b5cf6", "#94a3b8"];

function AllocationDonut({ slices }: { slices: { label: string; value: number }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = 70;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <svg width={180} height={180} viewBox="0 0 180 180" className="shrink-0" role="img" aria-label="Komposisi aset">
        <circle cx={90} cy={90} r={r} fill="none" stroke="rgba(15,40,32,0.08)" strokeWidth={22} />
        {total > 0 &&
          slices.map((s, i) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.label}
                cx={90}
                cy={90}
                r={r}
                fill="none"
                stroke={DONUT[i % DONUT.length]}
                strokeWidth={22}
                strokeDasharray={`${Math.max(len - 1.5, 0.5)} ${c}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 90 90)"
              />
            );
            offset += len;
            return el;
          })}
        <text x={90} y={86} textAnchor="middle" fontSize={22} fill="currentColor" className="text-ink">
          {slices.length}
        </text>
        <text x={90} y={106} textAnchor="middle" fontSize={11} fill="currentColor" className="text-ink-3">
          aset
        </text>
      </svg>
      <ul className="w-full space-y-1.5">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2.5 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: DONUT[i % DONUT.length] }} />
            <span className="min-w-0 flex-1 truncate text-ink-2">{s.label}</span>
            <span className="num text-ink">{total > 0 ? `${((s.value / total) * 100).toFixed(1)}%` : "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MarketBoard({ markets }: { markets: Ticker[] | null }) {
  if (!markets) return <p className="text-sm text-ink-3">Memuat harga…</p>;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {markets.map((m) => (
        <div key={m.pair} className="flex items-center gap-3 rounded-[16px] border border-glass-edge bg-white/55 p-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[10px] font-semibold text-accent">
            {m.asset.slice(0, 4)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">
              {m.asset} <span className="text-xs font-normal text-ink-3">/ IDR</span>
            </p>
            <p className="num truncate text-xs text-ink-3">{rupiah(m.last)}</p>
          </div>
          <div className="text-right">
            <p className={clsx("num text-sm font-medium", tone(m.change24hPct))}>{signedPct(m.change24hPct)}</p>
            <p className={clsx("num text-[11px]", tone(m.change7dPct))}>7 hari {signedPct(m.change7dPct)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────

/**
 * The real side of the platform: what the owner actually holds on connected
 * exchanges (plus Bibit/Stockbit as recorded), valued at live Indodax prices.
 */
export function RealDashboard({ showMarkets = true }: { showMarkets?: boolean }) {
  const { portfolio: p, markets, manual, error, loading, reload } = useRealData();
  const connected = (p?.connected.length ?? 0) > 0;
  const total = (p?.totalIdr ?? 0) + manual;
  const crypto = p ? p.totalIdr - p.cashIdr : 0;

  const slices = (() => {
    if (!p) return [];
    const list = p.holdings.filter((h) => h.valueIdr > 0).map((h) => ({ label: h.asset === "IDR" ? "Rupiah (kas)" : h.asset, value: h.valueIdr }));
    if (manual > 0) list.push({ label: "Bibit + Stockbit", value: manual });
    list.sort((a, b) => b.value - a.value);
    const head = list.slice(0, 5);
    const rest = list.slice(5).reduce((s, x) => s + x.value, 0);
    return rest > 0 ? [...head, { label: "Lainnya", value: rest }] : head;
  })();

  return (
    <section className="mx-auto max-w-[1360px] px-3 pt-4 pb-5 sm:px-4 md:pt-6 lg:px-6" aria-labelledby="real-title">
      <div className="grid grid-cols-12 gap-4 md:gap-5">
        {/* The autonomous bot: on/off and this month's result */}
        <BotSummaryCard />

        {/* Total real assets */}
        <div className="glass relative col-span-12 overflow-hidden p-6 md:p-8 xl:col-span-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-28 -right-20 size-80 rounded-full opacity-80 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(13,155,99,0.25), rgba(25,211,240,0.2) 55%, transparent 72%)" }}
          />
          <div className="relative flex flex-wrap items-center gap-2">
            <RealBadgeLive at={p?.at} />
            {p && (
              <span className={clsx("pill !py-1 text-[11px]", p.live ? "text-negative" : "text-caution")}>
                {p.live ? <ShieldAlert className="size-3" aria-hidden /> : <ShieldCheck className="size-3" aria-hidden />}
                Live trading {p.live ? "aktif" : "mode uji"}
              </span>
            )}
            <button type="button" onClick={reload} className="pill !py-1 text-[11px]" aria-label="Muat ulang data nyata">
              <RefreshCw className={clsx("size-3", loading && "animate-spin")} aria-hidden /> Muat ulang
            </button>
          </div>

          <p id="real-title" className="relative mt-5 text-sm text-ink-2">
            Total aset nyata Anda
          </p>
          <p className="num relative mt-1 text-4xl font-light tracking-[-0.04em] text-ink sm:text-5xl lg:text-6xl">
            {p || manual > 0 ? rupiah(total) : "…"}
          </p>
          {p && (
            <p className="relative mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="text-ink-3">
                24 jam{" "}
                <span className={clsx("num font-medium", tone(p.change24hIdr))}>
                  {signedRupiah(p.change24hIdr)} ({signedPct(p.change24hPct)})
                </span>
              </span>
              <span className="text-ink-3">
                7 hari{" "}
                <span className={clsx("num font-medium", tone(p.change7dIdr))}>
                  {signedRupiah(p.change7dIdr)} ({signedPct(p.change7dPct)})
                </span>
              </span>
            </p>
          )}
          <p className="relative mt-2 max-w-[62ch] text-xs text-ink-3">
            Saldo dibaca langsung dari {p?.connected.length ? p.connected.map((c) => (c === "indodax" ? "Indodax" : "Tokocrypto")).join(" & ") : "bursa"} dan
            dinilai dengan harga Indodax saat ini. Perubahan 24 jam/7 hari dihitung dari aset yang Anda pegang sekarang.
            {manual > 0 && " Bibit dan Stockbit dari catatan manual di browser ini."}
          </p>

          {(error || (p && p.errors.length > 0)) && (
            <p role="alert" className="relative mt-3 text-xs text-negative">
              {error ?? p?.errors.join(" ")}
            </p>
          )}

          {p && !connected && (
            <div className="relative mt-5 rounded-[16px] border border-caution/25 bg-caution-soft p-4 text-sm text-ink-2">
              Belum ada bursa yang terhubung. Hubungkan Indodax atau Tokocrypto di halaman{" "}
              <Link href="/akun" className="font-medium text-accent underline">
                Akun nyata
              </Link>
              .
            </div>
          )}

          <div className="relative mt-6 flex flex-wrap gap-2">
            <Link href="/akun" className="pill pill-accent !px-4 !py-2 text-sm">
              <Landmark className="size-3.5" aria-hidden /> Trading di akun nyata
            </Link>
            <Link href="/markets" className="pill !px-4 !py-2 text-sm">
              Harga pasar <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </div>

          <div className="relative mt-7 grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {[
              { k: "Kas (Rp + stablecoin)", v: p ? rupiah(p.cashIdr) : "…", icon: Wallet },
              { k: "Aset kripto", v: p ? rupiah(crypto) : "…", icon: Coins },
              { k: "Bibit + Stockbit", v: rupiah(manual), icon: PiggyBank },
              { k: "Jumlah aset", v: p ? String(p.holdings.length + (manual > 0 ? 1 : 0)) : "…", icon: Landmark },
            ].map((t) => (
              <div key={t.k} className="flex items-center gap-3 rounded-[16px] border border-glass-edge bg-white/55 p-3">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-positive-soft text-positive">
                  <t.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="num block truncate text-sm font-medium text-ink">{t.v}</span>
                  <span className="block text-[11px] leading-tight text-ink-3">{t.k}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Allocation */}
        <div className="glass col-span-12 p-6 md:col-span-6 xl:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-ink">Komposisi aset</p>
            <RealBadgeLive />
          </div>
          {slices.length > 0 ? <AllocationDonut slices={slices} /> : <p className="text-sm text-ink-3">{p ? "Belum ada aset." : "Memuat…"}</p>}
        </div>

        {/* Holdings */}
        <div className={clsx("glass col-span-12 p-6 md:col-span-6", showMarkets ? "xl:col-span-5" : "xl:col-span-12")}>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-ink">Aset yang Anda pegang</p>
            <Link href="/akun" className="pill">
              Akun <ArrowUpRight className="size-3" aria-hidden />
            </Link>
          </div>
          {p && p.holdings.length > 0 ? (
            <ul className="divide-y divide-line">
              {p.holdings.map((h) => (
                <li key={`${h.broker}-${h.asset}`} className="flex items-center gap-3 py-2.5">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[10px] font-semibold text-accent">
                    {h.asset.slice(0, 4)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">
                      {h.asset} <span className="text-xs text-ink-3">· {h.broker === "indodax" ? "Indodax" : "Tokocrypto"}</span>
                    </p>
                    <p className="num truncate text-xs text-ink-3">
                      {amountFmt(h.amount)} {h.priceIdr !== null && h.asset !== "IDR" ? `× ${rupiah(h.priceIdr)}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="num text-sm font-medium text-ink">{h.priceIdr === null ? "—" : rupiah(h.valueIdr)}</p>
                    {h.asset !== "IDR" && <p className={clsx("num text-[11px]", tone(h.change24hPct))}>{signedPct(h.change24hPct)}</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">{p ? "Belum ada saldo di bursa yang terhubung." : "Memuat…"}</p>
          )}
        </div>

        {/* Live prices */}
        {showMarkets && (
          <div className="glass col-span-12 p-6 xl:col-span-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-ink">Harga live Indodax</p>
              <span className="text-[11px] text-ink-3">Diperbarui tiap 30 detik · 24 jam & 7 hari</span>
            </div>
            <MarketBoard markets={markets} />
          </div>
        )}
      </div>
    </section>
  );
}

/** Live Indodax prices on their own, for the Markets page. */
export function LiveMarketsPanel() {
  const [markets, setMarkets] = useState<Ticker[] | null>(null);
  const [at, setAt] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);

  useVisibleInterval(async () => {
    {
      try {
        const r = await fetch("/api/market", { cache: "no-store" });
        const data = (await r.json()) as { markets?: Ticker[]; at?: number; error?: string };
        if (data.markets) {
          setMarkets(data.markets);
          setAt(data.at);
          setError(null);
        } else setError(data.error ?? "Harga tidak bisa diambil.");
      } catch {
        setError("Server tidak bisa dihubungi.");
      }
    }
  }, 60_000);

  return (
    <section className="glass mx-3 mb-5 max-w-[1312px] p-5 sm:mx-4 md:p-8 lg:mx-6 min-[1640px]:mx-auto" aria-labelledby="live-markets">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="live-markets" className="text-xl font-normal tracking-[-0.015em] text-ink md:text-2xl">
            Harga pasar nyata
          </h2>
          <p className="mt-1 text-xs text-ink-3">Langsung dari Indodax (IDR), diperbarui tiap 30 detik.</p>
        </div>
        <RealBadgeLive at={at} />
      </div>
      {error && <p className="mb-3 text-xs text-negative">{error}</p>}
      <MarketBoard markets={markets} />
    </section>
  );
}
