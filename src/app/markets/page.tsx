import type { Metadata } from "next";
import { Suspense } from "react";
import { MarketsWorkspace } from "@/components/markets/MarketsWorkspace";
import { PageIntro } from "@/components/shared/PageIntro";

export const metadata: Metadata = { title: "Markets" };

export default function MarketsPage() {
  return (
    <>
      <PageIntro index="02" area="Pasar" title="Di mana agen melihat peluang, dan di mana ia melihat risiko.">
        Enam pasar yang dipantau, rezim yang terbentuk dari semuanya, dan setup persis yang akan diambil strategi. Harga adalah simulasi.
      </PageIntro>
      <Suspense fallback={null}>
        <MarketsWorkspace />
      </Suspense>
    </>
  );
}
