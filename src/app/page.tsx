import { AgentActivity } from "@/components/activity/AgentActivity";
import { CommandHero } from "@/components/agent/CommandHero";
import { AllocationBar, CapitalLedger, EquityCurve } from "@/components/capital/CapitalOverview";
import { RiskSurface } from "@/components/capital/RiskSurface";
import { ApprovalPanel } from "@/components/decisions/ApprovalPanel";
import { DecisionIndex, FocusedDecision } from "@/components/decisions/DecisionLog";
import { MarketOverview } from "@/components/markets/MarketOverview";
import { OpportunityFeed } from "@/components/opportunities/OpportunityFeed";
import { Reveal, SectionHeader } from "@/components/shared/primitives";

const SHELL = "mx-auto max-w-[1360px] px-4 sm:px-6 md:px-10 lg:px-12";

export default function CommandCenterPage() {
  return (
    <>
      <CommandHero />

      <div id="approval" className="scroll-mt-20">
        <ApprovalPanel />
      </div>

      {/* What is it deciding, and what has it done? */}
      <Reveal as="section" className={`${SHELL} pb-24`}>
        <SectionHeader
          index="04"
          title="Decisions & activity"
          summary="How the agent reached its latest decision, and everything it did on the way."
          href="/agent"
          hrefLabel="Full timeline"
        />
        <div className="grid grid-cols-12 gap-x-4 lg:gap-x-10 gap-y-14">
          <div className="col-span-12 xl:col-span-7">
            <FocusedDecision compact />
            <div className="mt-10">
              <p className="label mb-2 text-[10px]">Recent decisions</p>
              <DecisionIndex limit={6} />
            </div>
          </div>
          <div className="col-span-12 xl:col-span-5">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="label text-[10px]">Live activity</p>
              <p className="text-xs text-ink-3">Select an event for evidence</p>
            </div>
            <AgentActivity limit={8} />
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className={`${SHELL} pb-24`}>
        <SectionHeader
          index="05"
          title="Capital"
          summary="Where the money is, and how much risk it is carrying."
          href="/capital"
          hrefLabel="Capital detail"
        />
        <div className="grid grid-cols-12 gap-x-4 lg:gap-x-10 gap-y-12">
          <div className="col-span-12 space-y-10 lg:col-span-7">
            <CapitalLedger />
            <AllocationBar />
            <EquityCurve height={180} />
          </div>
          <div className="col-span-12 lg:col-span-5">
            <RiskSurface showSectors={false} />
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className={`${SHELL} pb-24`}>
        <SectionHeader
          index="02"
          title="Market intelligence"
          summary="The environment the agent is trading in, and which markets are paying for their risk."
          href="/markets"
          hrefLabel="Markets"
        />
        <MarketOverview />
      </Reveal>

      <Reveal as="section" className={`${SHELL} pb-8`}>
        <SectionHeader
          index="03"
          title="Opportunity discovery"
          summary="Work the agent found beyond markets — scored by expected value per hour."
          href="/opportunities"
          hrefLabel="All opportunities"
        />
        <OpportunityFeed limit={4} />
      </Reveal>
    </>
  );
}
