import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountsView } from "@/components/accounts/AccountsView";
import { PageIntro, PANEL, SHELL } from "@/components/shared/PageIntro";
import { isAuthed } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Akun" };
export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  // The middleware already guards this; checked again because it touches real accounts.
  if (!(await isAuthed())) redirect("/masuk?next=%2Fakun");

  return (
    <>
      <PageIntro index="06" area="Akun nyata" title="Semua akun investasi Anda, di satu tempat.">
        Berbeda dari halaman lain, bagian ini memakai akun sungguhan. Indodax dan Tokocrypto terhubung lewat API resmi, dan setiap order
        hanya dikirim setelah Anda setujui. Bibit dan Stockbit tidak menyediakan API untuk pihak ketiga, jadi dicatat manual.
      </PageIntro>
      <section className={PANEL}>
        <AccountsView />
      </section>
    </>
  );
}
