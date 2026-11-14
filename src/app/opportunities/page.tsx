import type { Metadata } from "next";
import { OpportunitiesView } from "@/components/opportunities/OpportunitiesView";
import { PageIntro } from "@/components/shared/PageIntro";

export const metadata: Metadata = { title: "Opportunities" };

export default function OpportunitiesPage() {
  return (
    <>
      <PageIntro index="03" area="Opportunities" title="Work worth doing, found and priced by the agent.">
        Freelance listings, B2B demand, bounties and market inefficiencies — each scored by expected value per hour. Opportunities are
        demo data.
      </PageIntro>
      <OpportunitiesView />
    </>
  );
}
