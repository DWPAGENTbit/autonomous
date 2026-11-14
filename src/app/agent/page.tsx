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
      <PageIntro index="04" area="Agent" title="What the agent did, why, and what it will do next.">
        Its current step, the limits it works within, every decision with its reasons, and a full record of activity.
      </PageIntro>

      <section className={`${SHELL} pb-24`} aria-label="Agent state">
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
        <SectionHeader index="04.1" title="Decisions" summary="Each decision as a chain of gates. Open any gate, or ask why." />
        <div className="grid grid-cols-12 gap-x-4 lg:gap-x-10 gap-y-12">
          <div className="col-span-12 xl:col-span-8">
            <FocusedDecision />
          </div>
          <div className="col-span-12 xl:col-span-4">
            <p className="label mb-2 text-[10px]">All decisions today</p>
            <DecisionIndex limit={14} />
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className={`${SHELL} pb-8`}>
        <SectionHeader index="04.2" title="Timeline" summary="Proof of work: every step the agent took this session, in order." />
        <Timeline />
      </Reveal>
    </>
  );
}
