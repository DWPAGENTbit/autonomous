"use client";

import clsx from "clsx";
import { Bot, ExternalLink, NotebookPen, Search, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { addStock, type ManualAccountId } from "@/components/accounts/manual-store";
import { OrderPanel } from "@/components/accounts/OrderPanel";
import { useBot } from "@/components/bot/bot-client";
import { RealBadgeLive, rupiah } from "@/components/real/RealDashboard";
import { PANEL } from "@/components/shared/PageIntro";
import type { StatusResponse } from "@/lib/server/brokers/types";
import type { Ticker } from "@/lib/server/market";
import type { StockQuote } from "@/lib/server/stocks";

const pct = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`);
const tone = (v: number | null) => (v === null || v === 0 ? "text-ink-3" : v > 0 ? "text-positive" : "text-negative");

interface Results {
  q: string;
  crypto: Ticker[];
  cryptoError?: string;
  stocks: StockQuote[];
}

function StockRecorder({ stock, onDone }: { stock: StockQuote; onDone: (msg: string) => void }) {
  const [account, setAccount] = useState<ManualAccountId>("stockbit");
  const [lots, setLots] = useState("1");
  const [avg, setAvg] = useState(String(stock.price));
  const n = (v: string) => Number(v.replace(/\./g, "").replace(",", "."));
  const valid = n(lots) > 0 && n(avg) > 0;
  return (
    <form
      className="mt-3 grid grid-cols-12 gap-2 rounded-[14px] border border-line bg-white/70 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        addStock(account, { ticker: stock.symbol, name: stock.name, lots: n(lots), avg: n(avg), price: stock.price });
        onDone(`${stock.symbol} ${n(lots)} lot dicatat di ${account === "stockbit" ? "Stockbit" : "Bibit"}.`);
      }}
    >
      <label className="col-span-12 sm:col-span-4">
        <span className="mb-1 block text-[11px] text-ink-3">Dibeli di</span>
        <select value={account} onChange={(e) => setAccount(e.target.value as ManualAccountId)} className="h-9 w-full rounded-[10px] border border-line-strong bg-white px-2 text-sm text-ink">
          <option value="stockbit">Stockbit</option>
          <option value="bibit">Bibit</option>
        </select>
      </label>
      <label className="col-span-5 sm:col-span-3">
        <span className="mb-1 block text-[11px] text-ink-3">Jumlah lot</span>
        <input inputMode="numeric" value={lots} onChange={(e) => setLots(e.target.value.replace(/[^0-9]/g, ""))} className="h-9 w-full rounded-[10px] border border-line-strong bg-white px-2 font-mono text-sm text-ink" />
      </label>
      <label className="col-span-7 sm:col-span-5">
        <span className="mb-1 block text-[11px] text-ink-3">Harga beli rata-rata (Rp/lembar)</span>
        <input inputMode="decimal" value={avg} onChange={(e) => setAvg(e.target.value.replace(/[^0-9.,]/g, ""))} className="h-9 w-full rounded-[10px] border border-line-strong bg-white px-2 font-mono text-sm text-ink" />
      </label>
      <p className="col-span-12 text-[11px] text-ink-3">
        1 lot = 100 lembar. Nilai sekarang: <b className="text-ink-2">{rupiah(n(lots) * 100 * stock.price || 0)}</b>. Order saham tetap dilakukan di aplikasinya —
        Bibit dan Stockbit tidak membuka API untuk aplikasi lain.
      </p>
      <div className="col-span-12">
        <button type="submit" disabled={!valid} className="pill pill-accent !px-4 !py-2 text-sm disabled:opacity-50">
          <NotebookPen className="size-3.5" aria-hidden /> Catat saham
        </button>
      </div>
    </form>
  );
}

/** Search any Indodax coin or IDX stock; trade coins by hand, put them on the bot, or record stocks. */
export function MarketSearch() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [trade, setTrade] = useState<{ pair: string; side: "buy" | "sell" } | null>(null);
  const [recording, setRecording] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const { view, busy, error, watch } = useBot();

  const loadStatus = useCallback(async () => {
    const r = await fetch("/api/broker/status", { cache: "no-store" }).catch(() => null);
    if (r?.ok) setStatus(await r.json());
  }, []);
  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const ctl = new AbortController();
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/market/search?q=${encodeURIComponent(q)}`, { cache: "no-store", signal: ctl.signal });
        if (r.ok) setData(await r.json());
      } catch {
        // Aborted by the next keystroke, or offline.
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  const indodax = status?.brokers.find((b) => b.id === "indodax");
  const botPairs = view?.settings.brokers.indodax.pairs ?? [];

  const openTrade = async (pair: string, side: "buy" | "sell") => {
    setNote(null);
    if (!indodax?.pairs.includes(pair)) {
      const ok = await watch("indodax", pair, "add");
      if (!ok) return;
      await loadStatus();
    }
    setTrade({ pair, side });
  };

  const toggleBot = async (pair: string) => {
    const on = botPairs.includes(pair);
    const ok = await watch("indodax", pair, "add", !on);
    if (ok) {
      setNote(on ? `${pair.split("_")[0].toUpperCase()} dikeluarkan dari bot.` : `${pair.split("_")[0].toUpperCase()} ditambahkan ke bot. Bot akan memantau dan trading sendiri saat mode otomatis menyala.`);
      await loadStatus();
    }
  };

  return (
    <section id="cari" className={clsx(PANEL, "scroll-mt-24")} aria-labelledby="search-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="search-title" className="text-xl font-normal tracking-[-0.015em] text-ink md:text-2xl">
            Cari koin &amp; saham
          </h2>
          <p className="mt-1 text-xs text-ink-3">Semua koin rupiah di Indodax dan saham BEI. Trading koin manual, masukkan ke bot, atau catat saham.</p>
        </div>
        <RealBadgeLive />
      </div>

      <label className="relative block">
        <span className="sr-only">Cari koin atau saham</span>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ketik kode atau nama: BTC, PEPE, Solana, BBCA, Telkom…"
          className="h-12 w-full appearance-none rounded-full border border-glass-edge bg-white/80 pr-10 pl-11 text-sm text-ink shadow-[var(--shadow-raise)] outline-none focus:border-accent/50 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} className="absolute top-1/2 right-3 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-3 hover:bg-sunken" aria-label="Hapus pencarian">
            <X className="size-4" aria-hidden />
          </button>
        )}
      </label>

      {(note || error) && <p className={clsx("mt-3 text-sm", error ? "text-negative" : "text-positive")}>{error ?? note}</p>}

      <div className="mt-5 grid grid-cols-12 gap-5">
        {/* Coins */}
        <div className="col-span-12 xl:col-span-7">
          <p className="label mb-2 text-[10px]">Kripto · Indodax {loading && "· mencari…"}</p>
          {data?.cryptoError && <p className="text-sm text-negative">{data.cryptoError}</p>}
          {data && !data.crypto.length && !data.cryptoError && <p className="text-sm text-ink-3">Tidak ada koin yang cocok.</p>}
          <ul className="space-y-2">
            {data?.crypto.map((t) => {
              const inBot = botPairs.includes(t.pair);
              const thin = t.volIdr < 1_000_000_000;
              return (
                <li key={t.pair} className="rounded-[16px] border border-glass-edge bg-white/60 p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[10px] font-semibold text-accent">{t.asset.slice(0, 4)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {t.asset} <span className="font-normal text-ink-3">· {t.name}</span>
                      </span>
                      <span className="num block text-xs text-ink-3">
                        {rupiah(t.last)} · <span className={tone(t.change24hPct)}>{pct(t.change24hPct)}</span> 24 jam
                        {thin && <span className="ml-1 rounded-full bg-caution-soft px-1.5 text-[10px] text-caution">likuiditas rendah</span>}
                      </span>
                    </span>
                    <span className="flex w-full flex-wrap gap-1.5 pl-12 sm:w-auto sm:pl-0">
                      <button type="button" disabled={busy || !indodax?.configured} onClick={() => openTrade(t.pair, "buy")} className="pill !px-3 !py-1.5 text-xs text-accent disabled:opacity-50">
                        Beli
                      </button>
                      <button type="button" disabled={busy || !indodax?.configured} onClick={() => openTrade(t.pair, "sell")} className="pill !px-3 !py-1.5 text-xs disabled:opacity-50">
                        Jual
                      </button>
                      <button
                        type="button"
                        aria-pressed={inBot}
                        disabled={busy}
                        onClick={() => toggleBot(t.pair)}
                        title={inBot ? "Keluarkan dari bot" : "Biarkan bot trading koin ini otomatis"}
                        className={clsx("pill !px-3 !py-1.5 text-xs disabled:opacity-50", inBot && "!border-positive !bg-positive !text-white")}
                      >
                        <Bot className="size-3" aria-hidden /> {inBot ? "Di bot" : "+ Bot"}
                      </button>
                    </span>
                  </div>
                  {trade?.pair === t.pair && indodax && status && (
                    <div className="mt-3 rounded-[14px] border border-line bg-white/80 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-medium text-ink">Trading manual {t.asset}/IDR</p>
                        <button type="button" onClick={() => setTrade(null)} className="inline-flex size-7 items-center justify-center rounded-full text-ink-3 hover:bg-sunken" aria-label="Tutup">
                          <X className="size-4" aria-hidden />
                        </button>
                      </div>
                      <OrderPanel broker={indodax} live={status.live} initialPair={t.pair} initialSide={trade.side} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {indodax && !indodax.configured && <p className="mt-2 text-xs text-ink-3">Hubungkan kunci API Indodax untuk trading dari sini.</p>}
        </div>

        {/* Stocks */}
        <div className="col-span-12 xl:col-span-5">
          <p className="label mb-2 text-[10px]">Saham · BEI (harga tertunda ±15 menit)</p>
          {!q ? (
            <p className="text-sm text-ink-3">Ketik kode saham (mis. BBCA, TLKM, ANTM) atau nama perusahaan.</p>
          ) : data && data.q === q && !data.stocks.length ? (
            <p className="text-sm text-ink-3">Tidak ada saham yang cocok.</p>
          ) : null}
          <ul className="space-y-2">
            {q &&
              data?.stocks.map((s) => (
                <li key={s.symbol} className="rounded-[16px] border border-glass-edge bg-white/60 p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-positive-soft font-mono text-[10px] font-semibold text-positive">{s.symbol}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{s.name}</span>
                      <span className="num block text-xs text-ink-3">
                        {rupiah(s.price)} · <span className={tone(s.changePct)}>{pct(s.changePct)}</span> hari ini
                      </span>
                    </span>
                    <span className="flex w-full gap-1.5 pl-12 sm:w-auto sm:pl-0">
                      <button type="button" onClick={() => setRecording(recording === s.symbol ? null : s.symbol)} className="pill !px-3 !py-1.5 text-xs text-accent">
                        <NotebookPen className="size-3" aria-hidden /> Catat
                      </button>
                      <a href={`https://stockbit.com/symbol/${s.symbol}`} target="_blank" rel="noopener noreferrer" className="pill !px-3 !py-1.5 text-xs">
                        Stockbit <ExternalLink className="size-3" aria-hidden />
                      </a>
                    </span>
                  </div>
                  {recording === s.symbol && (
                    <StockRecorder
                      stock={s}
                      onDone={(msg) => {
                        setRecording(null);
                        setNote(msg);
                      }}
                    />
                  )}
                </li>
              ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
