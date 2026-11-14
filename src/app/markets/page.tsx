import type { Metadata } from "next";
import { Suspense } from "react";
import { MarketsWorkspace } from "@/components/markets/MarketsWorkspace";
import { PageIntro } from "@/components/shared/PageIntro";

export const metadata: Metadata = { title: "Markets" };

export default function MarketsPage() {
  return (
    <>
      <PageIntro index="02" area="Markets" title="Where the agent sees opportunity, and where it sees risk.">
        Six watched markets, the regime they add up to, and the exact setup the strategy would take. Prices are simulated.
      </PageIntro>
      <Suspense fallback={null}>
        <MarketsWorkspace />
      </Suspense>
    </>
  );
}
