import type { Metadata } from "next";
import { AgentActivity } from "@/components/activity/AgentActivity";
import { CapitalOverview } from "@/components/capital/CapitalOverview";
import { PositionsLedger } from "@/components/capital/PositionsLedger";
import { DemoBanner, OnlyMode } from "@/components/mode/ModeSwitch";
import { RealDashboard } from "@/components/real/RealDashboard";
import { RiskSurface } from "@/components/capital/RiskSurface";
import { PageIntro, PANEL, SHELL } from "@/components/shared/PageIntro";
import { Reveal, SectionHeader } from "@/components/shared/primitives";

export const metadata: Metadata = { title: "Modal" };

export default function CapitalPage() {
  return (
    <>
      <OnlyMode mode="live">
        <PageIntro index="05" area="Modal" title="Di mana uang Anda berada sekarang.">
          Saldo nyata dari bursa yang terhubung, dinilai dengan harga Indodax saat ini, ditambah catatan Bibit dan Stockbit.
        </PageIntro>
        <RealDashboard showMarkets={false} />
      </OnlyMode>

      <OnlyMode mode="demo">
        <DemoBanner />
        <PageIntro index="05" area="Modal" title="Bagaimana modal dipakai, dan seberapa besar risikonya.">
          Portofolio simulasi dengan modal fiktif $10.000. Posisi bergerak mengikuti harga simulasi.
        </PageIntro>

        <section className={PANEL} aria-label="Ringkasan modal">
          <div className="border-t border-line pt-8">
            <CapitalOverview />
          </div>
        </section>

        <Reveal as="section" className={PANEL}>
          <SectionHeader index="05.1" title="Risiko" summary="Setiap ukuran dibandingkan batas kebijakan yang wajib dipatuhi agen." />
          <div className="grid grid-cols-12 gap-x-4 lg:gap-x-10 gap-y-12">
            <div className="col-span-12 lg:col-span-6">
              <RiskSurface />
            </div>
            <div className="col-span-12 lg:col-span-6">
              <p className="label mb-2 text-[10px]">Aktivitas agen terbaru</p>
              <AgentActivity limit={7} />
            </div>
          </div>
        </Reveal>

        <Reveal as="section" className={PANEL}>
          <SectionHeader index="05.2" title="Posisi" summary="Apa yang dipegang, hasilnya sejauh ini, dan apa yang berisiko jika semua stop tersentuh." />
          <PositionsLedger />
        </Reveal>
      </OnlyMode>
    </>
  );
}
