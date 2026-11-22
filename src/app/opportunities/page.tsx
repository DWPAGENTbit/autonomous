import type { Metadata } from "next";
import { DemoBanner, DemoOnlyNotice, OnlyMode } from "@/components/mode/ModeSwitch";
import { OpportunitiesView } from "@/components/opportunities/OpportunitiesView";
import { PageIntro } from "@/components/shared/PageIntro";

export const metadata: Metadata = { title: "Peluang" };

export default function OpportunitiesPage() {
  return (
    <>
      <OnlyMode mode="live">
        <PageIntro index="03" area="Peluang" title="Peluang cuan di luar pasar." />
        <DemoOnlyNotice title="Belum ada sumber peluang nyata yang terhubung.">
          <p>
            Lowongan freelance, kebutuhan B2B, dan bounty di platform ini masih dibuat oleh simulasi agen. Supaya tidak tertukar dengan
            uang sungguhan, peluang hanya tampil di mode Demo.
          </p>
        </DemoOnlyNotice>
      </OnlyMode>

      <OnlyMode mode="demo">
        <DemoBanner />
        <PageIntro index="03" area="Peluang" title="Pekerjaan yang layak dikerjakan, ditemukan dan diberi harga oleh agen.">
          Lowongan freelance, kebutuhan B2B, bounty, dan inefisiensi pasar — masing-masing dinilai dari nilai harapan per jam.
        </PageIntro>
        <OpportunitiesView />
      </OnlyMode>
    </>
  );
}
