"use client";

import clsx from "clsx";
import { useState } from "react";
import { num } from "@/components/accounts/AccountsView";
import { Button } from "@/components/shared/primitives";
import type { BrokerStatus, OrderPreview, OrderResult, Side } from "@/lib/server/brokers/types";

const split = (pair: string) => pair.split("_").map((s) => s.toUpperCase()) as [string, string];

/**
 * Review, then approve. Nothing is sent until the owner has seen the
 * server-checked preview and ticked the approval box.
 */
export function OrderPanel({ broker, live }: { broker: BrokerStatus; live: boolean }) {
  const [pair, setPair] = useState(broker.pairs[0] ?? "");
  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");
  const [preview, setPreview] = useState<OrderPreview | null>(null);
  const [approved, setApproved] = useState(false);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [base, quote] = split(pair);
  const unit = side === "buy" ? quote : base;
  const reset = () => {
    setPreview(null);
    setApproved(false);
    setResult(null);
    setError(null);
  };

  const post = async <T,>(path: string, extra: Record<string, unknown> = {}): Promise<T | null> => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/broker/${broker.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pair, side, amount: Number(amount.replace(",", ".")), ...extra }),
      });
      const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
      if (!data || (data.error && !("ok" in data))) {
        setError(data?.error ?? "Permintaan gagal.");
        return null;
      }
      return data;
    } catch {
      setError("Server tidak bisa dihubungi.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const review = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();
    setPreview(await post<OrderPreview>("preview"));
  };

  const send = async () => {
    const r = await post<OrderResult>("order", { approve: true });
    if (r) {
      setResult(r);
      setApproved(false);
    }
  };

  const amountValid = Number(amount.replace(",", ".")) > 0;
  const canSend = preview && preview.problems.length === 0 && approved && !busy && !result;

  return (
    <div>
      <p className="label mb-3 text-[10px]">Order baru · market</p>
      <form onSubmit={review} className="grid grid-cols-12 gap-3">
        <label className="col-span-12 sm:col-span-4">
          <span className="mb-1 block text-xs text-ink-3">Pasangan</span>
          <select
            value={pair}
            onChange={(e) => {
              setPair(e.target.value);
              reset();
            }}
            className="h-10 w-full rounded-sm border border-line-strong bg-surface px-2 font-mono text-sm text-ink"
          >
            {broker.pairs.map((p) => (
              <option key={p} value={p}>
                {split(p).join("/")}
              </option>
            ))}
          </select>
        </label>
        <div className="col-span-12 sm:col-span-4">
          <span className="mb-1 block text-xs text-ink-3">Arah</span>
          <div className="grid h-10 grid-cols-2 rounded-sm border border-line-strong p-0.5" role="radiogroup" aria-label="Arah order">
            {(["buy", "sell"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={side === s}
                onClick={() => {
                  setSide(s);
                  reset();
                }}
                className={clsx("rounded-[3px] text-sm transition-colors", side === s ? "bg-ink text-canvas" : "text-ink-2 hover:text-ink")}
              >
                {s === "buy" ? "Beli" : "Jual"}
              </button>
            ))}
          </div>
        </div>
        <label className="col-span-12 sm:col-span-4">
          <span className="mb-1 block text-xs text-ink-3">Jumlah ({unit})</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(/[^0-9.,]/g, ""));
              reset();
            }}
            placeholder={side === "buy" ? (quote === "IDR" ? "100000" : "10") : "0.001"}
            className="h-10 w-full rounded-sm border border-line-strong bg-surface px-3 font-mono text-sm text-ink outline-none focus:border-ink/50"
          />
        </label>
        <div className="col-span-12 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!amountValid || busy}>
            {busy && !preview ? "Memeriksa…" : "Tinjau order"}
          </Button>
          <span className="text-xs text-ink-3">
            Batas per order: {num(broker.limits[quote] ?? 0)} {quote}
          </span>
        </div>
      </form>

      {error && (
        <p role="alert" className="mt-4 text-sm text-negative">
          {error}
        </p>
      )}

      {preview && (
        <div className="mt-6 border border-line bg-surface p-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="label text-[10px]">Order</dt>
              <dd className="text-ink">
                {preview.side === "buy" ? "Beli" : "Jual"} {preview.base} dengan {num(preview.amount)} {preview.amountUnit}
              </dd>
            </div>
            <div>
              <dt className="label text-[10px]">Harga terkini</dt>
              <dd className="num font-mono text-ink">{preview.price ? `${num(preview.price)} ${preview.quote}` : "Tidak tersedia"}</dd>
            </div>
            <div>
              <dt className="label text-[10px]">Perkiraan nilai</dt>
              <dd className="num font-mono text-ink">
                {preview.estQuoteValue !== null ? `${num(preview.estQuoteValue, 2)} ${preview.quote}` : "—"}
              </dd>
            </div>
            <div>
              <dt className="label text-[10px]">Mode</dt>
              <dd className={preview.live ? "text-negative" : "text-caution"}>{preview.live ? "Uang sungguhan" : "Uji, tidak dikirim"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-3">
            Order market terisi di harga pasar saat itu, yang bisa berbeda dari harga di atas. Biaya bursa berlaku.
          </p>

          {preview.problems.length > 0 ? (
            <ul role="alert" className="mt-4 space-y-1 text-sm text-negative">
              {preview.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            !result && (
              <div className="mt-4 space-y-3 border-t border-line pt-4">
                <label className="flex items-start gap-2.5 text-sm text-ink">
                  <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} className="mt-0.5 size-4 accent-ink" />
                  <span>
                    {live
                      ? `Saya menyetujui order ini dan paham bahwa ini memakai uang sungguhan di ${broker.name}.`
                      : "Saya menyetujui order uji ini."}
                  </span>
                </label>
                <Button variant={live ? "danger" : "primary"} disabled={!canSend} onClick={send}>
                  {busy ? "Mengirim…" : live ? "Setujui & kirim order" : "Setujui & jalankan uji"}
                </Button>
              </div>
            )
          )}
        </div>
      )}

      {result && (
        <div role="status" className={clsx("mt-4 border-l-2 pl-3 text-sm", result.ok ? "border-positive text-ink" : "border-negative text-negative")}>
          <p>{result.message}</p>
          {result.orderId && <p className="mt-1 font-mono text-xs text-ink-3">ID order: {result.orderId}</p>}
          {result.sent && !result.live && (
            <p className="mt-1 font-mono text-xs break-all text-ink-3">
              Yang akan dikirim: {Object.entries(result.sent).map(([k, v]) => `${k}=${v}`).join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
