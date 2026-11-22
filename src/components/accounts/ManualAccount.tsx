"use client";

import Link from "next/link";
import { ExternalLink, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { loadManual, MANUAL_EVENT, type ManualHolding as Holding, saveManual, SHARES_PER_LOT, today } from "@/components/accounts/manual-store";
import { Button } from "@/components/shared/primitives";

const rupiah = (v: number) => `Rp${v.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;

/**
 * An account without a third-party API. The owner trades in the app and
 * records holdings here, so everything is visible in one place.
 */
export function ManualAccount({ id, name, kinds, href }: { id: string; name: string; kinds: string[]; href: string }) {
  const [items, setItems] = useState<Holding[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [asset, setAsset] = useState("");
  const [kind, setKind] = useState(kinds[0]);
  const [value, setValue] = useState("");

  // Re-read when a stock is recorded from the search, or in another tab.
  useEffect(() => {
    const read = () => setItems(loadManual(id));
    read();
    const onChange = (e: Event) => (e as CustomEvent).detail === id && read();
    window.addEventListener(MANUAL_EVENT, onChange);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(MANUAL_EVENT, onChange);
      window.removeEventListener("storage", read);
    };
  }, [id]);

  // Stocks with a code follow the live price; their stored value is kept up to date.
  const tickers = items.map((h) => h.ticker).filter(Boolean).join(",");
  useEffect(() => {
    if (!tickers) return;
    fetch(`/api/market/stocks?symbols=${tickers}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { quotes?: { symbol: string; price: number }[] } | null) => {
        if (!d?.quotes?.length) return;
        const map = Object.fromEntries(d.quotes.map((q) => [q.symbol, q.price]));
        setPrices(map);
        const current = loadManual(id);
        const next = current.map((h) => (h.ticker && map[h.ticker] && h.lots ? { ...h, value: h.lots * SHARES_PER_LOT * map[h.ticker] } : h));
        if (next.some((h, i) => h.value !== current[i].value)) {
          saveManual(id, next);
        }
      })
      .catch(() => null);
  }, [tickers, id]);

  const update = (next: Holding[]) => {
    setItems(next);
    saveManual(id, next);
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const v = Number(value.replace(/\./g, "").replace(",", "."));
    if (!asset.trim() || !(v > 0)) return;
    const existing = items.find((h) => h.name.toLowerCase() === asset.trim().toLowerCase() && h.kind === kind);
    update(
      existing
        ? items.map((h) => (h === existing ? { ...h, value: v, updated: today() } : h))
        : [...items, { id: `${Date.now()}`, name: asset.trim(), kind, value: v, updated: today() }],
    );
    setAsset("");
    setValue("");
  };

  const total = items.reduce((s, h) => s + h.value, 0);

  return (
    <article className="h-full rounded-[20px] border border-glass-edge bg-white/50 p-5 md:p-6">
      <header className="mb-5 flex flex-wrap items-baseline gap-3">
        <h3 className="text-xl text-ink">{name}</h3>
        <span className="label text-[10px]">Manual · tanpa API</span>
        <a href={href} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink">
          Buka {name} <ExternalLink className="size-3" aria-hidden />
        </a>
      </header>

      <p className="label mb-1 text-[10px]">Total tercatat</p>
      <p className="num mb-5 text-3xl font-light tracking-[-0.03em] text-ink">{rupiah(total)}</p>

      {items.length > 0 ? (
        <ul className="mb-6 divide-y divide-line border-y border-line">
          {items.map((h) => (
            <li key={h.id} className="flex items-center gap-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate text-ink">{h.name}</p>
                {h.ticker && h.lots ? (
                  <p className="num text-xs text-ink-3">
                    {h.lots} lot · rata-rata {rupiah(h.avg ?? 0)}
                    {prices[h.ticker] && h.avg ? (
                      <span className={prices[h.ticker] >= h.avg ? "text-positive" : "text-negative"}>
                        {" "}
                        · sekarang {rupiah(prices[h.ticker])} ({prices[h.ticker] >= h.avg ? "+" : ""}
                        {(((prices[h.ticker] - h.avg) / h.avg) * 100).toFixed(1)}%)
                      </span>
                    ) : null}
                  </p>
                ) : (
                  <p className="text-xs text-ink-3">
                    {h.kind} · diperbarui {h.updated}
                  </p>
                )}
              </div>
              <span className="num font-mono text-ink">{rupiah(h.value)}</span>
              <button
                type="button"
                onClick={() => update(items.filter((x) => x.id !== h.id))}
                className="inline-flex size-7 items-center justify-center rounded-sm text-ink-4 hover:bg-sunken hover:text-ink"
                aria-label={`Hapus ${h.name}`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-6 text-sm text-ink-3">Belum ada catatan.</p>
      )}

      {kinds.includes("Saham") && (
        <Link href="/markets#cari" className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
          <Search className="size-3.5" aria-hidden /> Cari saham &amp; catat per lot dengan harga live
        </Link>
      )}

      <form onSubmit={add} className="grid grid-cols-12 gap-2">
        <input
          value={asset}
          onChange={(e) => setAsset(e.target.value)}
          placeholder={kinds[0] === "Saham" ? "Kode saham, mis. BBCA" : "Nama produk"}
          aria-label="Nama aset"
          className="col-span-12 h-10 rounded-sm border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-ink/50 sm:col-span-5"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          aria-label="Jenis aset"
          className="col-span-5 min-w-0 h-10 rounded-sm border border-line-strong bg-surface px-2 text-sm text-ink sm:col-span-3"
        >
          {kinds.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9.,]/g, ""))}
          placeholder="Nilai (Rp)"
          aria-label="Nilai saat ini dalam rupiah"
          className="col-span-7 min-w-0 h-10 rounded-sm border border-line-strong bg-surface px-3 font-mono text-sm text-ink outline-none focus:border-ink/50 sm:col-span-4"
        />
        <Button type="submit" size="sm" className="col-span-12 sm:col-span-4" disabled={!asset.trim() || !value}>
          Catat nilai
        </Button>
      </form>
    </article>
  );
}
