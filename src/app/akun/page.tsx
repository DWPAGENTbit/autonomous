import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountsView } from "@/components/accounts/AccountsView";
import { OnlyMode } from "@/components/mode/ModeSwitch";
import { PageIntro, SHELL } from "@/components/shared/PageIntro";
import { isAuthed } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Akun" };
export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  // The middleware already guards this; checked again because it touches real accounts.
  if (!(await isAuthed())) redirect("/masuk?next=%2Fakun");

  return (
    <>
      <PageIntro index="06" area="Akun nyata" title="Semua akun investasi Anda, di satu tempat.">
        Bagian ini memakai akun sungguhan. Indodax (dan Tokocrypto bila Anda aktifkan) terhubung lewat API resmi. Nyalakan mode
        otomatis agar tim agen trading sendiri di dalam batas risiko, atau order manual kapan saja. Bibit dan Stockbit dicatat manual.
      </PageIntro>
      <OnlyMode mode="demo">
        <div className={`${SHELL} pb-4`}>
          <p className="rounded-[18px] border border-positive/25 bg-positive-soft px-4 py-3 text-xs text-ink-2">
            <span className="font-mono text-[10px] font-semibold tracking-[0.12em] text-positive uppercase">Selalu nyata · </span>
            Halaman ini tetap memakai akun sungguhan, juga saat mode Demo aktif.
          </p>
        </div>
      </OnlyMode>
      <div className={`${SHELL} pb-5`}>
        <AccountsView />
      </div>
    </>
  );
}
