"use client";

import { ExternalLink, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/shared/primitives";

interface Holding {
  id: string;
  name: string;
  kind: string;
  value: number;
  updated: string;
}

const rupiah = (v: number) => `Rp${v.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;

function load(key: string): Holding[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Holding[]) : [];
  } catch {
    return [];
  }
}

function save(key: string, items: Holding[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Storage blocked: the list still works for this visit.
  }
}

/**
 * An account without a third-party API. The owner trades in the app and
 * records holdings here, so everything is visible in one place.
 */
export function ManualAccount({ id, name, kinds, href }: { id: string; name: string; kinds: string[]; href: string }) {
  const key = `dwp.manual.${id}`;
  const [items, setItems] = useState<Holding[]>([]);
  const [asset, setAsset] = useState("");
  const [kind, setKind] = useState(kinds[0]);
  const [value, setValue] = useState("");

  useEffect(() => setItems(load(key)), [key]);

  const update = (next: Holding[]) => {
    setItems(next);
    save(key, next);
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const v = Number(value.replace(/\./g, "").replace(",", "."));
    if (!asset.trim() || !(v > 0)) return;
    const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    const existing = items.find((h) => h.name.toLowerCase() === asset.trim().toLowerCase() && h.kind === kind);
    update(
      existing
        ? items.map((h) => (h === existing ? { ...h, value: v, updated: today } : h))
        : [...items, { id: `${Date.now()}`, name: asset.trim(), kind, value: v, updated: today }],
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
                <p className="text-xs text-ink-3">
                  {h.kind} · diperbarui {h.updated}
                </p>
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
