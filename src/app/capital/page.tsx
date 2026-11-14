import type { Metadata } from "next";
import { AgentActivity } from "@/components/activity/AgentActivity";
import { CapitalOverview } from "@/components/capital/CapitalOverview";
import { PositionsLedger } from "@/components/capital/PositionsLedger";
import { RiskSurface } from "@/components/capital/RiskSurface";
import { PageIntro, SHELL } from "@/components/shared/PageIntro";
import { Reveal, SectionHeader } from "@/components/shared/primitives";

export const metadata: Metadata = { title: "Capital" };

export default function CapitalPage() {
  return (
    <>
      <PageIntro index="05" area="Capital" title="How capital is deployed, and how much risk it carries.">
        A simulated book. Positions move with simulated prices; nothing here represents real money.
      </PageIntro>

      <section className={`${SHELL} pb-24`} aria-label="Capital overview">
        <div className="border-t border-line pt-8">
          <CapitalOverview />
        </div>
      </section>

      <Reveal as="section" className={`${SHELL} pb-24`}>
        <SectionHeader index="05.1" title="Risk" summary="Every measure against the policy limit the agent must respect." />
        <div className="grid grid-cols-12 gap-x-4 lg:gap-x-10 gap-y-12">
          <div className="col-span-12 lg:col-span-6">
            <RiskSurface />
          </div>
          <div className="col-span-12 lg:col-span-6">
            <p className="label mb-2 text-[10px]">Recent agent activity</p>
            <AgentActivity limit={7} />
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className={`${SHELL} pb-8`}>
        <SectionHeader index="05.2" title="Positions" summary="What is held, what it has earned, and what is at risk if every stop is hit." />
        <PositionsLedger />
      </Reveal>
    </>
  );
}
