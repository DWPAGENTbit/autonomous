"use client";

import { PANEL, SHELL } from "@/components/shared/PageIntro";
import { BotAgentsLive } from "./BotPanel";
import { useBot } from "./bot-client";
import { LiveTerminal } from "./LiveTerminal";

/** The Agen page in Live mode: the terminal on top, then every pair's full reasoning and the journal. */
export function LiveAgents() {
  const { view, error } = useBot();
  if (!view)
    return (
      <div className={`${SHELL} pb-5`}>
        <p className="glass p-6 text-sm text-ink-3">{error ?? "Memuat tim agen…"}</p>
      </div>
    );
  return (
    <>
      <section className={`${SHELL} pb-5`} aria-label="Terminal agen">
        <LiveTerminal view={view} />
      </section>
      <section className={PANEL} aria-label="Pikiran dan jurnal tim agen">
        <BotAgentsLive view={view} />
      </section>
    </>
  );
}
