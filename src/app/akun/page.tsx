import type { Metadata } from "next";
import { AccountsView } from "@/components/accounts/AccountsView";
import { LoginPanel, SetupGuide } from "@/components/accounts/AccessPanels";
import { PageIntro, SHELL } from "@/components/shared/PageIntro";
import { authConfigured, isAuthed } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Akun" };
export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const configured = authConfigured();
  const authed = configured && (await isAuthed());

  return (
    <>
      <PageIntro index="06" area="Akun nyata" title="Semua akun investasi Anda, di satu tempat.">
        Berbeda dari halaman lain, bagian ini memakai akun sungguhan. Indodax dan Tokocrypto terhubung lewat API resmi, dan setiap order
        hanya dikirim setelah Anda setujui. Bibit dan Stockbit tidak menyediakan API untuk pihak ketiga, jadi dicatat manual.
      </PageIntro>
      <section className={`${SHELL} pb-16`}>
        {!configured ? <SetupGuide /> : !authed ? <LoginPanel /> : <AccountsView />}
      </section>
    </>
  );
}
