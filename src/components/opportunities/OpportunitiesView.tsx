"use client";

import clsx from "clsx";
import { useState } from "react";
import { OpportunityFeed, OpportunityPipeline } from "@/components/opportunities/OpportunityFeed";
import { PANEL, SHELL } from "@/components/shared/PageIntro";

const FILTERS = [
  { key: "active", label: "Aktif" },
  { key: "all", label: "Semua" },
  { key: "passed", label: "Dilewati" },
] as const;

export function OpportunitiesView() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("active");
  return (
    <>
      <section className={PANEL} aria-label="Pipeline">
        <OpportunityPipeline />
      </section>
      <section className={PANEL} aria-label="Daftar peluang">
        <div className="mb-4 flex items-center gap-1" role="radiogroup" aria-label="Saring peluang">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="radio"
              aria-checked={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={clsx(
                "h-8 rounded-sm px-3 text-xs transition-colors duration-150",
                filter === f.key ? "bg-accent text-white" : "text-ink-2 hover:bg-sunken hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <OpportunityFeed filter={filter} />
      </section>
    </>
  );
}
