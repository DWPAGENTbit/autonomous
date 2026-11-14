"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/shared/primitives";

export const ENV_VARS: { name: string; note: string; required?: boolean }[] = [
  { name: "DWP_ACCESS_PASSWORD", note: "Kata sandi untuk membuka halaman ini. Minimal 10 karakter; makin panjang makin aman.", required: true },
  { name: "INDODAX_API_KEY / INDODAX_API_SECRET", note: "Dari Indodax → Pengaturan → Trade API. Izinkan view dan trade saja, jangan withdraw." },
  { name: "TOKOCRYPTO_API_KEY / TOKOCRYPTO_API_SECRET", note: "Dari Tokocrypto → Manajemen API. Izinkan baca dan trading spot saja, jangan withdraw." },
  { name: "DWP_LIVE_TRADING", note: "Biarkan kosong untuk mode uji (order tidak dikirim). Isi on hanya jika siap memakai uang sungguhan." },
  { name: "DWP_MAX_ORDER_IDR / DWP_MAX_ORDER_USDT", note: "Batas nilai per order. Bawaan: 500000 IDR dan 30 USDT." },
];

/** Shown until the owner has set an access password on the server. */
export function SetupGuide() {
  return (
    <div className="border-t border-line pt-8">
      <div className="grid grid-cols-12 gap-x-6 gap-y-8">
        <div className="col-span-12 lg:col-span-4">
          <p className="label mb-3">Belum diatur</p>
          <p className="max-w-[38ch] text-xl leading-snug text-ink">Halaman ini terkunci sampai kata sandi akses diatur di Vercel.</p>
          <p className="mt-4 max-w-[44ch] text-sm text-ink-2">
            Kunci API dan kata sandi disimpan sebagai Environment Variables di Vercel, bukan di kode. Situs ini publik, jadi tanpa
            kata sandi siapa pun bisa membuka akun Anda.
          </p>
        </div>
        <ol className="col-span-12 space-y-5 lg:col-span-8">
          <li className="text-sm text-ink-2">
            <span className="num mr-2 font-mono text-ink-4">1</span>
            Buka Vercel → proyek <span className="font-mono text-ink">autonomous</span> → Settings → Environment Variables.
          </li>
          <li className="text-sm text-ink-2">
            <span className="num mr-2 font-mono text-ink-4">2</span>
            Tambahkan variabel berikut untuk lingkungan Production:
            <dl className="mt-4 divide-y divide-line border-y border-line">
              {ENV_VARS.map((v) => (
                <div key={v.name} className="grid grid-cols-12 gap-x-4 gap-y-1 py-3">
                  <dt className="col-span-12 font-mono text-xs break-all text-ink md:col-span-5">
                    {v.name}
                    {v.required && <span className="ml-2 text-caution">wajib</span>}
                  </dt>
                  <dd className="col-span-12 text-xs leading-relaxed text-ink-3 md:col-span-7">{v.note}</dd>
                </div>
              ))}
            </dl>
          </li>
          <li className="text-sm text-ink-2">
            <span className="num mr-2 font-mono text-ink-4">3</span>
            Redeploy proyek, lalu buka halaman ini lagi.
          </li>
        </ol>
      </div>
    </div>
  );
}

export function LoginPanel() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setPassword("");
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Gagal masuk.");
    } catch {
      setError("Server tidak bisa dihubungi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-sm border-t border-line pt-8">
      <p className="label mb-3 flex items-center gap-2">
        <Lock className="size-3" aria-hidden /> Terkunci
      </p>
      <label htmlFor="access-password" className="mb-2 block text-sm text-ink-2">
        Kata sandi akses
      </label>
      <input
        id="access-password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="h-10 w-full rounded-sm border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-ink/50"
      />
      {error && (
        <p role="alert" className="mt-2 text-xs text-negative">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" className="mt-4" disabled={busy || password.length === 0}>
        {busy ? "Memeriksa…" : "Masuk"}
      </Button>
    </form>
  );
}
