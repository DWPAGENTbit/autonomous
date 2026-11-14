import type { Metadata } from "next";
import { Timeline } from "@/components/activity/Timeline";
import { AgentPipeline, AgentStatus } from "@/components/agent/AgentStatus";
import { AutonomyPolicy } from "@/components/agent/AutonomyPolicy";
import { DecisionIndex, FocusedDecision } from "@/components/decisions/DecisionLog";
import { PageIntro, SHELL } from "@/components/shared/PageIntro";
import { Reveal, SectionHeader } from "@/components/shared/primitives";

export const metadata: Metadata = { title: "Agent" };

export default function AgentPage() {
  return (
    <>
      <PageIntro index="04" area="Agen" title="Apa yang dilakukan agen, alasannya, dan langkah berikutnya.">
        Langkah saat ini, batas kerjanya, setiap keputusan beserta alasannya, dan catatan aktivitas lengkap.
      </PageIntro>

      <section className={`${SHELL} pb-24`} aria-label="Status agen">
        <div className="grid grid-cols-12 gap-x-4 lg:gap-x-10 gap-y-12 border-t border-line pt-8">
          <div className="col-span-12 lg:col-span-7">
            <AgentStatus glyphSize={220} />
            <div className="mt-12">
              <AgentPipeline />
            </div>
          </div>
          <div className="col-span-12 lg:col-span-5 lg:pl-6">
            <AutonomyPolicy />
          </div>
        </div>
      </section>

      <Reveal as="section" className={`${SHELL} pb-24`}>
        <SectionHeader index="04.1" title="Keputusan" summary="Setiap keputusan sebagai rantai syarat. Buka syarat mana pun, atau tanyakan alasannya." />
        <div className="grid grid-cols-12 gap-x-4 lg:gap-x-10 gap-y-12">
          <div className="col-span-12 xl:col-span-8">
            <FocusedDecision />
          </div>
          <div className="col-span-12 xl:col-span-4">
            <p className="label mb-2 text-[10px]">Semua keputusan hari ini</p>
            <DecisionIndex limit={14} />
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className={`${SHELL} pb-8`}>
        <SectionHeader index="04.2" title="Linimasa" summary="Bukti kerja: setiap langkah agen di sesi ini, berurutan." />
        <Timeline />
      </Reveal>
    </>
  );
}
