"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { memo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { ACTIVITY_META, AGENT_STATE_META, toneText } from "@/components/agent/agent-meta";
import { transition } from "@/lib/design/tokens";
import { formatClock } from "@/lib/formatting/format";
import { useAppStore } from "@/store/app-store";
import { useUiStore } from "@/store/ui-store";
import type { ActivityEvent } from "@/types/domain";

const ROW_GRID = "grid grid-cols-[4.25rem_5.75rem_1fr_1rem] items-baseline gap-x-3";

/** The step in progress, shown above the log as the machine's "cursor". */
function InProgressRow() {
  const { status, simTime } = useAppStore(useShallow((s) => ({ status: s.status, simTime: s.simTime })));
  const meta = AGENT_STATE_META[status.state];
  const elapsed = Math.max(0, simTime - status.since);
  return (
    <div className={clsx(ROW_GRID, "relative border-b border-line py-3.5")}>
      <span className="num font-mono text-xs text-ink-3">{formatClock(status.since + elapsed)}</span>
      <span className={clsx("label", toneText[meta.tone])}>{meta.label}</span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={status.task}
          className="text-sm text-ink"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition.state}
        >
          {status.task}
          <span className="ml-0.5 inline-block animate-breathe text-ink-3" aria-hidden>
            …
          </span>
        </motion.span>
      </AnimatePresence>
      <span />
      <span className="absolute inset-x-0 -bottom-px h-px overflow-hidden" aria-hidden>
        <span className="block h-px w-1/3 animate-progress bg-gradient-to-r from-transparent via-ink/50 to-transparent" />
      </span>
    </div>
  );
}

const ActivityRow = memo(function ActivityRow({ event }: { event: ActivityEvent }) {
  const [open, setOpen] = useState(false);
  const openEvent = useUiStore((s) => s.openEvent);
  const meta = ACTIVITY_META[event.kind];
  const hasMore = Boolean(event.detail || event.evidence?.length || event.decisionId);

  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={() => (hasMore ? setOpen((o) => !o) : openEvent(event.id))}
        aria-expanded={hasMore ? open : undefined}
        className={clsx(
          ROW_GRID,
          "group w-full py-3.5 text-left transition-colors duration-150 hover:bg-sunken/60 focus-visible:bg-sunken/60",
        )}
      >
        <span className="num font-mono text-xs text-ink-3">{formatClock(event.at)}</span>
        <span className={clsx("label", toneText[meta.tone])}>{meta.label}</span>
        <span className="text-sm text-ink-2 transition-colors group-hover:text-ink">{event.message}</span>
        <ChevronRight
          aria-hidden
          className={clsx(
            "size-3.5 self-center text-ink-4 transition-transform duration-200",
            open && "rotate-90",
            !hasMore && "opacity-0 group-hover:opacity-100",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transition.panel}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-[4.25rem_5.75rem_1fr] gap-x-3 pb-4">
              <div className="col-start-3">
                {event.detail && <p className="mb-3 text-sm text-ink-2">{event.detail}</p>}
                {event.evidence && event.evidence.length > 0 && (
                  <dl className="mb-3 grid grid-cols-2 gap-x-6 gap-y-2">
                    {event.evidence.map((e) => (
                      <div key={e.label} className="min-w-0">
                        <dt className="label text-[10px]">{e.label}</dt>
                        <dd className="num truncate text-sm text-ink">{e.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <button
                  type="button"
                  onClick={() => openEvent(event.id)}
                  className="text-xs text-accent underline-offset-4 hover:underline"
                >
                  Open evidence
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

/**
 * Live activity stream. New events slide in from the top; the row above
 * the log shows the step in progress, so the stream never looks idle.
 */
export function AgentActivity({ limit = 8 }: { limit?: number }) {
  const events = useAppStore(useShallow((s) => s.activity.slice(0, limit)));

  return (
    <div role="log" aria-label="Agent activity" aria-live="off">
      <InProgressRow />
      <ul>
        <AnimatePresence initial={false}>
          {events.map((e) => (
            <motion.li
              key={e.id}
              layout="position"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={transition.meaning}
              className="overflow-hidden"
            >
              <ActivityRow event={e} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
