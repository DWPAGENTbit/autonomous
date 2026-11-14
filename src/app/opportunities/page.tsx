import type { Metadata } from "next";
import { OpportunitiesView } from "@/components/opportunities/OpportunitiesView";
import { PageIntro } from "@/components/shared/PageIntro";

export const metadata: Metadata = { title: "Peluang" };

export default function OpportunitiesPage() {
  return (
    <>
      <PageIntro index="03" area="Peluang" title="Pekerjaan yang layak dikerjakan, ditemukan dan diberi harga oleh agen.">
        Lowongan freelance, kebutuhan B2B, bounty, dan inefisiensi pasar — masing-masing dinilai dari nilai harapan per jam. Peluang
        adalah data demo.
      </PageIntro>
      <OpportunitiesView />
    </>
  );
}
