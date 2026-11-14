"use client";

import { EvidencePanel } from "@/components/activity/EvidencePanel";
import { WhyPanel } from "@/components/decisions/WhyPanel";
import { Sheet } from "@/components/shared/Sheet";
import { formatClock } from "@/lib/formatting/format";
import { useAppStore } from "@/store/app-store";
import { useUiStore } from "@/store/ui-store";

/** One contextual panel for the whole app: reasoning or evidence on demand. */
export function ContextPanel() {
  const sheet = useUiStore((s) => s.sheet);
  const close = useUiStore((s) => s.closeSheet);
  const decision = useAppStore((s) =>
    sheet?.kind === "why" ? s.decisions.find((d) => d.id === sheet.decisionId) : undefined,
  );
  const event = useAppStore((s) => (sheet?.kind === "event" ? s.activity.find((e) => e.id === sheet.eventId) : undefined));

  const open = Boolean(decision || event);
  const eyebrow = decision ? `Reasoning · ${formatClock(decision.at)}` : "Evidence";
  const title = decision ? `Why: ${decision.subject}` : event ? "What happened" : "";

  return (
    <Sheet open={open} onClose={close} eyebrow={eyebrow} title={title}>
      {decision && <WhyPanel decision={decision} />}
      {!decision && event && <EvidencePanel event={event} />}
    </Sheet>
  );
}
