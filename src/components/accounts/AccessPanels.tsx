"use client";

import { ArrowRight, Eye, EyeOff, Lock } from "lucide-react";
import { useState } from "react";
import { AgentCore } from "@/components/agent/AgentCore";
import { BrandMark, BrandWordmark } from "@/components/brand/BrandMark";
import { Button } from "@/components/shared/primitives";

export const ENV_VARS: { name: string; note: string; required?: boolean }[] = [
  { name: "DWP_ACCESS_PASSWORD", note: "Kata sandi untuk masuk ke platform. Minimal 10 karakter; makin panjang makin aman.", required: true },
  { name: "DWP_ACCESS_USERNAME", note: "Opsional. Jika diisi, halaman masuk juga meminta nama pengguna." },
  { name: "INDODAX_API_KEY / INDODAX_API_SECRET", note: "Dari Indodax → Trade API. Izinkan view dan trade saja, jangan withdraw." },
  { name: "TOKOCRYPTO_API_KEY / TOKOCRYPTO_API_SECRET", note: "Dari Tokocrypto → Manajemen API. Izinkan baca dan trading spot saja, jangan withdraw." },
  { name: "DWP_LIVE_TRADING", note: "Kosongkan untuk mode uji (order tidak dikirim). Isi on hanya jika siap memakai uang sungguhan." },
];

function SetupSteps() {
  return (
    <div>
      <p className="label mb-3 flex items-center gap-2 text-caution">
        <Lock className="size-3" aria-hidden /> Belum diatur
      </p>
      <p className="text-sm text-ink-2">
        Platform terkunci sampai pemilik mengatur kata sandi di Vercel → proyek platform ini →
        Settings → Environment Variables, lalu redeploy.
      </p>
      <dl className="mt-5 divide-y divide-line border-y border-line">
        {ENV_VARS.map((v) => (
          <div key={v.name} className="py-2.5">
            <dt className="font-mono text-[11px] break-all text-ink">
              {v.name}
              {v.required && <span className="ml-2 text-caution">wajib</span>}
            </dt>
            <dd className="mt-0.5 text-xs leading-relaxed text-ink-3">{v.note}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const inputClass =
  "h-12 w-full rounded-[14px] border border-line-strong bg-white/80 px-4 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-accent/10";

/** The front door of the platform. */
export function LoginScreen({ configured, askUsername, next }: { configured: boolean; askUsername: boolean; next: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
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
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        window.location.assign(next);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Gagal masuk.");
      setPassword("");
    } catch {
      setError("Server tidak bisa dihubungi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh grid-cols-1 gap-4 p-3 sm:p-4 lg:grid-cols-2">
      {/* The agent, waiting behind the door. */}
      <section aria-hidden className="glass relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
        <div
          className="pointer-events-none absolute -top-32 -left-24 size-[28rem] rounded-full opacity-70 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(25,211,240,0.4), rgba(10,99,242,0.14) 55%, transparent 72%)" }}
        />
        <div className="relative flex items-center gap-3">
          <span className="inline-flex size-12 items-center justify-center rounded-[16px] bg-white shadow-[var(--shadow-raise)]">
            <BrandMark size={34} />
          </span>
          <BrandWordmark />
        </div>
        <div className="relative mx-auto w-full max-w-[460px]">
          <AgentCore maxSize={460} />
        </div>
        <p className="relative max-w-[40ch] text-sm text-ink-2">
          Tim agen yang mencari peluang cuan, memeriksa risiko, menentukan ukuran, dan mencatat alasan setiap keputusan — modal dijaga dulu, baru dikembangkan.
        </p>
      </section>

      <section className="flex items-center justify-center py-8">
        <div className="glass w-full max-w-md p-6 sm:p-9">
          <div className="mb-8 flex flex-col items-start gap-4">
            <span className="inline-flex size-16 items-center justify-center rounded-[20px] bg-white shadow-[var(--shadow-raise)]">
              <BrandMark size={46} />
            </span>
            <BrandWordmark />
          </div>
          <h1 className="text-3xl font-light tracking-[-0.03em] text-ink">Masuk ke platform</h1>
          <p className="mt-2 text-sm text-ink-3">Ruang kendali DWP EARN MONEY. Khusus pemilik; sesi berlaku 12 jam.</p>

          <div className="mt-8">
            {!configured ? (
              <SetupSteps />
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {askUsername && (
                  <div>
                    <label htmlFor="login-user" className="mb-1.5 block text-xs text-ink-2">
                      Nama pengguna
                    </label>
                    <input
                      id="login-user"
                      autoComplete="username"
                      autoCapitalize="none"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="login-password" className="mb-1.5 block text-xs text-ink-2">
                    Kata sandi
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={show ? "text" : "password"}
                      autoComplete="current-password"
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputClass} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-ink-3 hover:text-ink"
                      aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    >
                      {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                    </button>
                  </div>
                </div>
                {error && (
                  <p role="alert" className="text-xs text-negative">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  className="h-12 w-full"
                  disabled={busy || password.length === 0 || (askUsername && username.trim().length === 0)}
                >
                  {busy ? "Memeriksa…" : "Masuk"}
                  {!busy && <ArrowRight className="size-4" aria-hidden />}
                </Button>
              </form>
            )}
          </div>

          <p className="mt-10 border-t border-line pt-4 text-xs leading-relaxed text-ink-3">
            Mode Live memakai akun dan saldo nyata Anda. Bot hanya trading otomatis setelah Anda menyalakannya, dalam batas yang Anda
            atur. Mode Demo adalah simulasi. Hasil trading tidak dijamin.
          </p>
        </div>
      </section>
    </div>
  );
}
