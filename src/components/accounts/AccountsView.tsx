"use client";

import clsx from "clsx";
import { CheckCircle2, Circle, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ManualAccount } from "@/components/accounts/ManualAccount";
import { OrderPanel } from "@/components/accounts/OrderPanel";
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

/** Live trading at a glance: which mode is on, and what is still needed to go live. */
function LiveTradingStatus({ status }: { status: StatusResponse }) {
  const steps = [
    ...status.brokers.map((b) => ({
      done: b.configured,
      label: `API ${b.name} terhubung`,
      hint: b.configured ? "Kunci API terbaca di server." : `Isi ${b.id.toUpperCase()}_API_KEY dan ${b.id.toUpperCase()}_API_SECRET di Vercel.`,
    })),
    {
      done: status.live,
      label: "Order sungguhan dinyalakan",
      hint: status.live ? "DWP_LIVE_TRADING = on." : "Isi DWP_LIVE_TRADING = on di Vercel, lalu redeploy. Kosongkan untuk kembali ke mode uji.",
    },
  ];
  const Icon = status.live ? ShieldAlert : ShieldCheck;
  return (
    <section
      aria-label="Status live trading"
      className={clsx(
        "overflow-hidden rounded-[22px] border p-5 md:p-7",
        status.live ? "border-negative/25 bg-negative-soft" : "border-caution/25 bg-caution-soft",
      )}
    >
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-5">
          <div className="flex items-center gap-3">
            <span
              className={clsx(
                "inline-flex size-11 items-center justify-center rounded-[14px] text-white",
                status.live ? "bg-negative shadow-[0_8px_20px_rgb(217_67_75/0.35)]" : "bg-caution shadow-[0_8px_20px_rgb(183_119_11/0.3)]",
              )}
            >
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <p className="flex items-center gap-2 text-lg font-medium text-ink">
                Live trading: {status.live ? "AKTIF" : "mode uji"}
                <StatusDot tone={status.live ? "negative" : "caution"} pulse={status.live} />
              </p>
              <RealBadge />
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink-2">
            {status.live
              ? "Order yang Anda setujui di bawah dikirim ke bursa dengan uang sungguhan, dibatasi nilai maksimum per order."
              : "Order dicek lengkap tetapi tidak dikirim ke bursa. Aman untuk mencoba alurnya sebelum memakai uang sungguhan."}
          </p>
          <p className="mt-2 text-xs text-ink-3">
            Pengaturan ada di Vercel → proyek platform ini → Settings → Environment Variables. Setelah mengubahnya, redeploy.
          </p>
        </div>
        <ol className="col-span-12 space-y-2 lg:col-span-7">
          {steps.map((st, i) => (
            <li key={st.label} className="flex items-start gap-3 rounded-[16px] border border-glass-edge bg-white/65 p-3.5">
              {st.done ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-positive" aria-hidden />
              ) : (
                <Circle className="mt-0.5 size-5 shrink-0 text-ink-4" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  <span className="mr-1.5 font-mono text-[11px] text-ink-4">{i + 1}.</span>
                  {st.label}
                  <span className="sr-only">{st.done ? " (selesai)" : " (belum)"}</span>
                </p>
                <p className="mt-0.5 text-xs break-words text-ink-3">{st.hint}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function AccountsView() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/broker/status", { cache: "no-store" })
      .then(async (r) => (r.ok ? setStatus(await r.json()) : setError("Sesi berakhir. Muat ulang halaman untuk masuk lagi.")))
      .catch(() => setError("Server tidak bisa dihubungi."));
  }, []);

  return (
    <div className="space-y-12">
      {status && <LiveTradingStatus status={status} />}

      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}

      <section aria-labelledby="api-accounts">
        <h2 id="api-accounts" className="label mb-2">
          Terhubung otomatis
        </h2>
        <p className="mb-8 max-w-[64ch] text-sm text-ink-2">
          Saldo dibaca langsung dari bursa. Order hanya dikirim setelah Anda meninjau dan menyetujuinya, dan server menolak order di
          atas batas per order. Sinyal agen di halaman lain adalah simulasi dan tidak pernah dipakai untuk order sungguhan.
        </p>
        <div className="space-y-5">
          {status ? status.brokers.map((b) => <ApiAccount key={b.id} broker={b} live={status.live} />) : !error && <p className="text-sm text-ink-3">Memuat…</p>}
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
