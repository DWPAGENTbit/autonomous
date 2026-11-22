import type { Metadata } from "next";
import { Suspense } from "react";
import { MarketsWorkspace } from "@/components/markets/MarketsWorkspace";
import { DemoBanner, OnlyMode } from "@/components/mode/ModeSwitch";
import { MarketSearch } from "@/components/real/MarketSearch";
import { LiveMarketsPanel } from "@/components/real/RealDashboard";
import { PageIntro } from "@/components/shared/PageIntro";

export const metadata: Metadata = { title: "Pasar" };

export default function MarketsPage() {
  return (
    <>
      <OnlyMode mode="live">
        <PageIntro index="02" area="Pasar" title="Cari, trading manual, atau serahkan ke bot.">
          Semua koin rupiah di Indodax dan saham BEI dengan harga nyata. Beli dan jual koin langsung dari sini, masukkan ke bot otomatis,
          atau catat saham yang Anda beli di Stockbit dan Bibit.
        </PageIntro>
        <MarketSearch />
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
