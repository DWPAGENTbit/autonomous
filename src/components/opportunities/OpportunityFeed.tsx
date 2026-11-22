"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { AnimatedValue, StatusDot } from "@/components/shared/primitives";
import { transition } from "@/lib/design/tokens";
import { formatClock, formatHours, formatUsd } from "@/lib/formatting/format";
import { useAppStore } from "@/store/app-store";
import type { Opportunity, OpportunityStatus } from "@/types/domain";

export const STATUS_META: Record<OpportunityStatus, { tone: "accent" | "positive" | "muted" | "caution"; working: boolean }> = {
  Ditemukan: { tone: "accent", working: false },
  Diteliti: { tone: "accent", working: true },
  "Lolos kualifikasi": { tone: "positive", working: false },
  "Proposal disusun": { tone: "positive", working: false },
  Dilewati: { tone: "muted", working: false },
};

export const expectedValue = (o: Pick<Opportunity, "potentialValue" | "probability">) => o.potentialValue * o.probability;

/**
 * Opportunities as a feed of briefs, not a table. Each brief opens into
 * a working view: why it was found, the evidence, and the next action.
 */
export function OpportunityFeed({
  limit,
  filter = "active",
}: {
  limit?: number;
  filter?: "active" | "all" | "passed";
}) {
  const items = useAppStore(
    useShallow((s) => {
      const list = s.opportunities.filter((o) =>
        filter === "all" ? true : filter === "passed" ? o.status === "Dilewati" : o.status !== "Dilewati",
      );
      return limit ? list.slice(0, limit) : list;
    }),
  );
  const [openId, setOpenId] = useState<string | null>(null);

  // Deep link: /opportunities#opp-id opens and scrolls to that brief.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    setOpenId(id);
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);

  return (
    <ul className="space-y-2.5">
      <AnimatePresence initial={false}>
        {items.map((o) => (
          <motion.li
            key={o.id}
            id={o.id}
            layout="position"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={transition.scene}
            className="overflow-hidden"
          >
            <OpportunityItem opp={o} open={openId === o.id} onToggle={() => setOpenId(openId === o.id ? null : o.id)} />
          </motion.li>
        ))}
      </AnimatePresence>
      {items.length === 0 && <li className="py-10 text-sm text-ink-3">Belum ada apa-apa. Agen masih mencari.</li>}
    </ul>
  );
}

const OpportunityItem = memo(function OpportunityItem({
  opp,
  open,
  onToggle,
}: {
  opp: Opportunity;
  open: boolean;
  onToggle: () => void;
}) {
  const meta = STATUS_META[opp.status];
  const ev = expectedValue(opp);
  const passed = opp.status === "Dilewati";

  return (
    <article className={clsx("rounded-[18px] border border-glass-edge bg-white/50 px-4 transition-[opacity,background-color] duration-300 hover:bg-white/80 md:px-5", open && "bg-white/80", passed && !open && "opacity-60")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${opp.id}-detail`}
        className="group grid w-full grid-cols-12 gap-x-6 gap-y-4 py-5 text-left"
      >
        <div className="col-span-12 lg:col-span-5">
          <div className="mb-2 flex items-center gap-2">
            <StatusDot tone={meta.tone} pulse={meta.working} />
            <span className="label text-[10px]">{opp.status}</span>
          </div>
          <h3 className="text-lg leading-snug font-normal tracking-[-0.01em] text-ink transition-colors group-hover:text-accent md:text-xl">
            {opp.title}
          </h3>
          <p className="mt-1 text-xs text-ink-3">
            {opp.category} · {opp.source} · ditemukan {formatClock(opp.discoveredAt, false)}
          </p>
        </div>

        <dl className="col-span-12 grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-5 lg:col-span-7">
          <Metric label="Nilai potensial" value={formatUsd(opp.potentialValue, { whole: true })} />
          <Metric label="Perkiraan usaha" value={formatHours(opp.effortHours)} />
          <div>
            <dt className="label mb-1 text-[10px]">Probabilitas</dt>
            <dd>
              <AnimatedValue value={opp.probability * 100} format={(v) => `${Math.round(v)}%`} className="text-base text-ink" />
              <span className="mt-1.5 block h-[4px] w-full overflow-hidden rounded-full bg-line" aria-hidden>
                <motion.span
                  className="block h-full origin-left rounded-full bg-gradient-to-r from-[#3fa58c] to-accent"
                  initial={false}
                  animate={{ scaleX: opp.probability }}
                  transition={transition.scene}
                />
              </span>
            </dd>
          </div>
          <div>
            <dt className="label mb-1 text-[10px]">Nilai harapan</dt>
            <dd>
              <AnimatedValue value={ev} format={(v) => formatUsd(v, { whole: true })} className="text-base font-medium text-ink" />
            </dd>
          </div>
          <div className="flex items-start justify-between">
            <Metric label="Persaingan" value={opp.competition} />
            <Plus
              aria-hidden
              className={clsx("mt-1 size-4 shrink-0 text-ink-3 transition-transform duration-200 group-hover:text-ink", open && "rotate-45")}
            />
          </div>
        </dl>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`${opp.id}-detail`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transition.panel}
            className="overflow-hidden"
          >
            <OpportunityDetail opp={opp} />
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
});

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="label mb-1 text-[10px]">{label}</dt>
      <dd className="num truncate text-base text-ink">{value}</dd>
    </div>
  );
}

function OpportunityDetail({ opp }: { opp: Opportunity }) {
  const ev = expectedValue(opp);
  return (
    <div className="grid grid-cols-12 gap-x-6 gap-y-8 pb-10">
      <section className="col-span-12 lg:col-span-5">
        <h4 className="label mb-2">Alasan ditemukan</h4>
        <p className="text-[0.95rem] leading-relaxed text-ink">{opp.whyFound}</p>

        <h4 className="label mt-8 mb-2">Langkah berikutnya</h4>
        <p className="border-l-2 border-ink pl-3 text-[0.95rem] leading-relaxed text-ink">{opp.nextAction}</p>
      </section>

      <section className="col-span-12 sm:col-span-6 lg:col-span-4">
        <h4 className="label mb-2">Bukti</h4>
        <dl>
          {opp.evidence.map((e) => (
            <div key={e.label} className="grid grid-cols-[1fr_auto] gap-3 border-b border-line py-2 text-sm">
              <dt className="text-ink-3">
                {e.label}
                {e.source && <span className="block text-[11px] text-ink-4">{e.source}</span>}
              </dt>
              <dd className="num text-right text-ink">{e.value}</dd>
            </div>
          ))}
        </dl>

        <h4 className="label mt-8 mb-2">Risiko</h4>
        <ul className="space-y-1.5 text-sm text-ink-2">
          {opp.risks.map((r) => (
            <li key={r} className="grid grid-cols-[1rem_1fr]">
              <span className="text-negative" aria-hidden>
                –
              </span>
              {r}
            </li>
          ))}
        </ul>
      </section>

      <section className="col-span-12 space-y-6 sm:col-span-6 lg:col-span-3">
        <div>
          <h4 className="label mb-1.5">Nilai harapan</h4>
          <p className="num text-3xl font-light tracking-[-0.02em] text-ink">{formatUsd(ev, { whole: true })}</p>
          <p className="num mt-1 text-xs text-ink-3">
            {formatUsd(opp.potentialValue, { whole: true })} × {Math.round(opp.probability * 100)}% ·{" "}
            {formatUsd(ev / opp.effortHours, { whole: true })}/jam
          </p>
        </div>
        <Detail label="Persaingan" text={opp.competitionNote} />
        <Detail label="Harga" text={opp.pricing} />
        <Detail label="Pelanggan" text={opp.customer} />
        <Detail label="Perkiraan usaha" text={`${formatHours(opp.effortHours)} kerja agen dan waktu review.`} />
      </section>
    </div>
  );
}

function Detail({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <h4 className="label mb-1">{label}</h4>
      <p className="text-sm leading-relaxed text-ink-2">{text}</p>
    </div>
  );
}

/** The pipeline as one proportional bar: where opportunities sit right now. */
export function OpportunityPipeline() {
  const opps = useAppStore((s) => s.opportunities);
  const order: OpportunityStatus[] = ["Ditemukan", "Diteliti", "Lolos kualifikasi", "Proposal disusun", "Dilewati"];
  const counts = order.map((st) => ({ status: st, n: opps.filter((o) => o.status === st).length }));
  const active = opps.filter((o) => o.status !== "Dilewati");
  const totalEv = active.reduce((a, o) => a + expectedValue(o), 0);
  const total = opps.length || 1;

  return (
    <div className="grid grid-cols-12 items-end gap-x-6 gap-y-6">
      <div className="col-span-12 md:col-span-4">
        <p className="label mb-1">Nilai harapan pipeline</p>
        <AnimatedValue value={totalEv} format={(v) => formatUsd(v, { whole: true })} className="text-5xl font-light tracking-[-0.03em] text-ink" />
        <p className="mt-1 text-sm text-ink-3">
          {active.length} aktif · {opps.length - active.length} dilewati · data demo
        </p>
      </div>
      <div className="col-span-12 md:col-span-8">
        <div className="flex h-2 w-full gap-[2px]" aria-hidden>
          {counts.map(
            (c) =>
              c.n > 0 && (
                <motion.span
                  key={c.status}
                  layout
                  transition={transition.scene}
                  className={clsx(
                    "h-full",
                    c.status === "Dilewati" ? "bg-line-strong" : c.status === "Ditemukan" || c.status === "Diteliti" ? "bg-accent/50" : "bg-positive/70",
                  )}
                  style={{ flexGrow: c.n / total }}
                />
              ),
          )}
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
          {counts.map((c) => (
            <div key={c.status}>
              <dt className="label text-[10px]">{c.status}</dt>
              <dd className="num text-lg text-ink">{c.n}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
