import type { Metadata } from "next";
import { Suspense } from "react";
import { MarketsWorkspace } from "@/components/markets/MarketsWorkspace";
import { DemoBanner, OnlyMode } from "@/components/mode/ModeSwitch";
import { LiveMarketsPanel } from "@/components/real/RealDashboard";
import { PageIntro } from "@/components/shared/PageIntro";

export const metadata: Metadata = { title: "Pasar" };

export default function MarketsPage() {
  return (
    <>
      <OnlyMode mode="live">
        <PageIntro index="02" area="Pasar" title="Harga pasar nyata, langsung dari Indodax.">
          Harga rupiah untuk kripto utama, diperbarui tiap 30 detik, lengkap dengan perubahan 24 jam dan 7 hari.
        </PageIntro>
        <LiveMarketsPanel />
      </OnlyMode>

      <OnlyMode mode="demo">
        <DemoBanner />
        <PageIntro index="02" area="Pasar" title="Bagaimana agen membaca pasar.">
          Ruang latihan strategi agen dengan enam pasar simulasi — rezim, korelasi, dan setup yang akan diambil.
        </PageIntro>
        <Suspense fallback={null}>
          <MarketsWorkspace />
        </Suspense>
      </OnlyMode>
    </>
  );
}
