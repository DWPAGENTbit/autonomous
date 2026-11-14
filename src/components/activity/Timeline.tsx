"use client";

import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { ACTIVITY_META, AGENT_STATE_META, toneText } from "@/components/agent/agent-meta";
import { formatClock } from "@/lib/formatting/format";
import { useAppStore } from "@/store/app-store";
import { useUiStore } from "@/store/ui-store";
import type { ActivityEvent, ActivityKind } from "@/types/domain";

const ROW_HEIGHT = 64;
const OVERSCAN = 8;
const RAIL_GRID = "grid grid-cols-[4.5rem_1.5rem_1fr_auto] items-center gap-x-4 md:grid-cols-[6rem_1.5rem_1fr_auto]";

type Filter = "all" | "markets" | "business" | "risk";

const FILTERS: { key: Filter; label: string; kinds?: ActivityKind[] }[] = [
  { key: "all", label: "Everything" },
  { key: "markets", label: "Markets", kinds: ["SCANNING", "FILTERING", "ANALYSIS", "SIMULATION", "EXECUTION", "MONITOR", "RESEARCH"] },
  { key: "business", label: "Business", kinds: ["SEARCH", "BUSINESS", "RESEARCH"] },
  { key: "risk", label: "Decisions & risk", kinds: ["DECISION", "RISK", "APPROVAL"] },
];

/** Window-scroll virtualisation with fixed row height. */
function useWindowVirtual(count: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: Math.min(count, 30) });

  useEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const start = Math.max(0, Math.floor(-top / ROW_HEIGHT) - OVERSCAN);
      const visible = Math.ceil(window.innerHeight / ROW_HEIGHT) + OVERSCAN * 2;
      const end = Math.min(count, start + visible);
      setRange((r) => (r.start === start && r.end === end ? r : { start, end }));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [count]);

  return { ref, range };
}

/**
 * Full chronological record of what the agent did — its proof of work.
 * Oldest first, ending at the step in progress right now.
 */
export function Timeline() {
  const [filter, setFilter] = useState<Filter>("all");
  const activity = useAppStore((s) => s.activity);
  const status = useAppStore(useShallow((s) => ({ state: s.status.state, task: s.status.task })));
  const openEvent = useUiStore((s) => s.openEvent);

  const events = useMemo(() => {
    const kinds = FILTERS.find((f) => f.key === filter)?.kinds;
    const list = kinds ? activity.filter((e) => kinds.includes(e.kind)) : activity;
    return [...list].reverse();
  }, [activity, filter]);

  const { ref, range } = useWindowVirtual(events.length);
  const meta = AGENT_STATE_META[status.state];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Filter timeline">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="radio"
            aria-checked={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={clsx(
              "h-8 rounded-sm px-3 text-xs transition-colors duration-150",
              filter === f.key ? "bg-ink text-canvas" : "text-ink-2 hover:bg-sunken hover:text-ink",
            )}
          >
            {f.label}
          </button>
        ))}
        <span className="label num ml-auto">{events.length} events</span>
      </div>

      <div ref={ref} className="relative" style={{ height: events.length * ROW_HEIGHT }}>
        <ol aria-label="Agent timeline">
          {events.slice(range.start, range.end).map((e, k) => {
            const index = range.start + k;
            const prev = events[index - 1];
            return (
              <TimelineRow
                key={e.id}
                event={e}
                top={index * ROW_HEIGHT}
                newHour={!prev || Math.floor(prev.at / 3600) !== Math.floor(e.at / 3600)}
                onOpen={() => openEvent(e.id)}
              />
            );
          })}
        </ol>
      </div>

      <div className={`${RAIL_GRID} h-16`}>
        <span className="label pl-1 text-ink">Now</span>
        <span className="relative flex h-full items-center justify-center" aria-hidden>
          <span className="absolute top-0 h-1/2 w-px bg-line" />
          <span className="relative inline-flex size-2.5">
            <span className="absolute inset-0 animate-breathe rounded-full bg-accent" />
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-3">
          <span className={clsx("label", toneText[meta.tone])}>{meta.label}</span>
          <span className="truncate text-sm text-ink">{status.task}</span>
        </span>
      </div>
    </div>
  );
}

function TimelineRow({
  event,
  top,
  newHour,
  onOpen,
}: {
  event: ActivityEvent;
  top: number;
  newHour: boolean;
  onOpen: () => void;
}) {
  const meta = ACTIVITY_META[event.kind];
  const major = event.kind === "DECISION" || event.kind === "EXECUTION" || event.kind === "APPROVAL";
  return (
    <li className="absolute inset-x-0" style={{ top, height: ROW_HEIGHT }}>
      <button
        type="button"
        onClick={onOpen}
        className={`${RAIL_GRID} group h-full w-full text-left transition-colors duration-150 hover:bg-sunken/50`}
      >
        <span className="num pl-1 font-mono">
          {newHour ? (
            <span className="text-sm text-ink">{formatClock(event.at, false)}</span>
          ) : (
            <span className="text-xs text-ink-3">{formatClock(event.at, false)}</span>
          )}
        </span>
        <span className="relative flex h-full items-center justify-center" aria-hidden>
          <span className="absolute inset-y-0 w-px bg-line" />
          <span className={clsx("relative rounded-full ring-4 ring-canvas", major ? "size-2.5 bg-ink" : "size-1.5 bg-ink-4")} />
        </span>
        <span className="min-w-0">
          <span className={clsx("label block text-[10px]", toneText[meta.tone])}>{meta.label}</span>
          <span className={clsx("block truncate text-sm", major ? "text-ink" : "text-ink-2")}>{event.message}</span>
        </span>
        <ArrowRight aria-hidden className="mr-2 size-3.5 text-ink-4 opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    </li>
  );
}
