"use client";

import clsx from "clsx";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ACTIVITY_META, toneText } from "@/components/agent/agent-meta";
import { INSTRUMENTS } from "@/data/instruments";
import { formatClock } from "@/lib/formatting/format";
import { useAppStore } from "@/store/app-store";
import { useUiStore } from "@/store/ui-store";
import type { ActivityEvent } from "@/types/domain";

/** What happened, what supports it, and where it connects. */
export function EvidencePanel({ event }: { event: ActivityEvent }) {
  const meta = ACTIVITY_META[event.kind];
  const { openWhy, closeSheet } = useUiStore();
  const decision = useAppStore((s) => (event.decisionId ? s.decisions.find((d) => d.id === event.decisionId) : undefined));
  const opportunity = useAppStore((s) =>
    event.opportunityId ? s.opportunities.find((o) => o.id === event.opportunityId) : undefined,
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="num mb-2 font-mono text-xs text-ink-3">
          {formatClock(event.at)} · <span className={clsx("label", toneText[meta.tone])}>{meta.label}</span>
        </p>
        <p className="text-lg leading-relaxed text-ink">{event.message}</p>
        {event.detail && <p className="mt-3 text-sm leading-relaxed text-ink-2">{event.detail}</p>}
      </div>

      <section aria-labelledby="evidence-title">
        <h3 id="evidence-title" className="label mb-3">
          Evidence
        </h3>
        {event.evidence && event.evidence.length > 0 ? (
          <dl>
            {event.evidence.map((e) => (
              <div key={e.label} className="grid grid-cols-[1fr_auto] gap-4 border-b border-line py-2.5 text-sm">
                <dt className="text-ink-3">
                  {e.label}
                  {e.source && <span className="ml-2 text-xs text-ink-4">· {e.source}</span>}
                </dt>
                <dd className="num text-right text-ink">{e.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-ink-3">Langkah ini tidak mencatat bukti terstruktur. Ini bagian dari siklus rutin.</p>
        )}
      </section>

      {(decision || opportunity || event.symbol) && (
        <section aria-labelledby="related-title">
          <h3 id="related-title" className="label mb-3">
            Terhubung ke
          </h3>
          <ul className="space-y-1">
            {decision && (
              <li>
                <button
                  type="button"
                  onClick={() => openWhy(decision.id)}
                  className="group flex w-full items-center justify-between border-b border-line py-2.5 text-left text-sm text-ink hover:text-accent"
                >
                  Decision · {decision.subject}
                  <ArrowUpRight aria-hidden className="size-3.5 text-ink-4 group-hover:text-accent" />
                </button>
              </li>
            )}
            {opportunity && (
              <li>
                <Link
                  href={`/opportunities#${opportunity.id}`}
                  onClick={closeSheet}
                  className="group flex items-center justify-between border-b border-line py-2.5 text-sm text-ink hover:text-accent"
                >
                  Opportunity · {opportunity.title}
                  <ArrowUpRight aria-hidden className="size-3.5 text-ink-4 group-hover:text-accent" />
                </Link>
              </li>
            )}
            {event.symbol && (
              <li>
                <Link
                  href={`/markets?symbol=${event.symbol}`}
                  onClick={closeSheet}
                  className="group flex items-center justify-between border-b border-line py-2.5 text-sm text-ink hover:text-accent"
                >
                  Market · {INSTRUMENTS[event.symbol].pair}
                  <ArrowUpRight aria-hidden className="size-3.5 text-ink-4 group-hover:text-accent" />
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
