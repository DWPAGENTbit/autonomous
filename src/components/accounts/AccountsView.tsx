"use client";

import clsx from "clsx";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ManualAccount } from "@/components/accounts/ManualAccount";
import { OrderPanel } from "@/components/accounts/OrderPanel";
import { BotPanel } from "@/components/bot/BotPanel";
import { StatusDot } from "@/components/shared/primitives";
import type { Balance, BrokerStatus, StatusResponse } from "@/lib/server/brokers/types";

export const num = (v: number, max = 8) => v.toLocaleString("id-ID", { maximumFractionDigits: max });

/** A mark for real money, kept visibly distinct from the simulation badge. */
export function RealBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent-soft px-2 py-0.5 font-mono text-[10px] font-medium tracking-[0.1em] text-accent uppercase">
      <span aria-hidden className="size-1 rounded-full bg-accent" />
      Akun nyata
    </span>
  );
}

function Balances({ broker }: { broker: BrokerStatus }) {
  const [data, setData] = useState<{ balances?: Balance[]; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/broker/${broker.id}/balances`, { cache: "no-store" });
      setData(await res.json());
    } catch {
      setData({ error: "Server tidak bisa dihubungi." });
    } finally {
      setLoading(false);
    }
  }, [broker.id]);

  useEffect(() => {
    if (broker.configured) void load();
  }, [broker.configured, load]);

  if (!broker.configured) {
    return (
      <p className="text-sm text-ink-3">
        Belum terhubung. Atur <span className="font-mono text-ink-2">{broker.id.toUpperCase()}_API_KEY</span> dan{" "}
        <span className="font-mono text-ink-2">{broker.id.toUpperCase()}_API_SECRET</span> di Vercel.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="label text-[10px]">Saldo</p>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink"
          aria-label={`Muat ulang saldo ${broker.name}`}
        >
          <RefreshCw className={clsx("size-3", loading && "animate-spin")} aria-hidden /> Muat ulang
        </button>
      </div>
      {data?.error ? (
        <p role="alert" className="text-sm text-negative">
          {data.error}
        </p>
      ) : !data ? (
        <p className="text-sm text-ink-3">Memuat…</p>
      ) : data.balances?.length ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="label text-left text-[10px]">
              <th className="py-2 font-normal">Aset</th>
              <th className="py-2 text-right font-normal">Tersedia</th>
              <th className="py-2 text-right font-normal">Ditahan</th>
            </tr>
          </thead>
          <tbody className="num font-mono">
            {data.balances.map((b) => (
              <tr key={b.asset} className="border-t border-line">
                <td className="py-2 text-ink">{b.asset}</td>
                <td className="py-2 text-right text-ink">{num(b.free)}</td>
                <td className="py-2 text-right text-ink-3">{num(b.locked)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-ink-3">Tidak ada saldo.</p>
      )}
    </div>
  );
}

function ApiAccount({ broker, live }: { broker: BrokerStatus; live: boolean }) {
  return (
    <article className="rounded-[20px] border border-glass-edge bg-white/50 p-5 md:p-6">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h3 className="text-xl text-ink">{broker.name}</h3>
        <span className="inline-flex items-center gap-2 text-xs text-ink-3">
          <StatusDot tone={broker.configured ? "positive" : "muted"} />
          {broker.configured ? "API terhubung" : "Belum terhubung"}
        </span>
        <span className="label ml-auto text-[10px]">Kripto · API resmi</span>
      </header>
      <div className="grid grid-cols-12 gap-x-4 gap-y-10 lg:gap-x-8">
        <div className="col-span-12 lg:col-span-5">
          <Balances broker={broker} />
        </div>
        <div className="col-span-12 lg:col-span-7">{broker.configured && <OrderPanel broker={broker} live={live} />}</div>
      </div>
    </article>
  );
}

export function AccountsView() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/broker/status", { cache: "no-store" })
      .then(async (r) => (r.ok ? setStatus(await r.json()) : setError("Sesi berakhir. Muat ulang halaman untuk masuk lagi.")))
      .catch(() => setError("Server tidak bisa dihubungi."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = status?.brokers.filter((b) => b.enabled) ?? [];
  const off = status?.brokers.filter((b) => !b.enabled) ?? [];

  return (
    <div className="space-y-12">
      <BotPanel onBrokersChange={load} />

      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}

      <section aria-labelledby="api-accounts">
        <h2 id="api-accounts" className="label mb-2">
          Saldo &amp; order manual
        </h2>
        <p className="mb-8 max-w-[64ch] text-sm text-ink-2">
          Saldo dibaca langsung dari bursa yang aktif. Bot di atas trading sendiri; di sini Anda tetap bisa order manual kapan saja. Server
          menolak setiap order di atas batas per order, baik dari bot maupun manual.
        </p>
        <div className="space-y-5">
          {status ? active.map((b) => <ApiAccount key={b.id} broker={b} live={status.live} />) : !error && <p className="text-sm text-ink-3">Memuat…</p>}
          {off.length > 0 && (
            <p className="rounded-[16px] border border-line px-4 py-3 text-sm text-ink-3">
              Nonaktif: {off.map((b) => b.name).join(", ")}. Nyalakan di bagian &ldquo;Bursa aktif&rdquo; di atas bila ingin dipakai.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="manual-accounts">
        <h2 id="manual-accounts" className="label mb-2">
          Dicatat manual
        </h2>
        <p className="mb-8 max-w-[64ch] text-sm text-ink-2">
          Bibit dan Stockbit tidak menyediakan API untuk aplikasi pihak ketiga, jadi DWP EARN MONEY tidak bisa membaca saldo atau mengirim
          order ke sana. Lakukan transaksi di aplikasinya, lalu catat nilainya di sini agar semua aset terlihat di satu tempat.
          Catatan disimpan di browser ini saja.
        </p>
        <div className="grid grid-cols-12 gap-4 lg:gap-5">
          <div className="col-span-12 lg:col-span-6">
            <ManualAccount id="bibit" name="Bibit" kinds={["Reksa dana", "SBN", "Saham", "Deposito"]} href="https://bibit.id" />
          </div>
          <div className="col-span-12 lg:col-span-6">
            <ManualAccount id="stockbit" name="Stockbit" kinds={["Saham", "Reksa dana"]} href="https://stockbit.com" />
          </div>
        </div>
      </section>
    </div>
  );
}
