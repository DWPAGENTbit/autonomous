import type { Metadata } from "next";
import { Suspense } from "react";
import { MarketsWorkspace } from "@/components/markets/MarketsWorkspace";
import { LiveMarketsPanel } from "@/components/real/RealDashboard";
import { PageIntro } from "@/components/shared/PageIntro";

export const metadata: Metadata = { title: "Pasar" };

export default function MarketsPage() {
  return (
    <>
      <PageIntro index="02" area="Pasar" title="Harga nyata dari Indodax, lalu cara agen membaca pasar.">
        Bagian pertama adalah harga live sungguhan. Di bawahnya, ruang latihan strategi agen dengan enam pasar simulasi — rezim, korelasi,
        dan setup yang akan diambil — sebagai data demo.
      </PageIntro>
      <LiveMarketsPanel />
      <Suspense fallback={null}>
        <MarketsWorkspace />
      </Suspense>
    </>
  );
}
