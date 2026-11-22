import type { ReactNode } from "react";

/** Opening of an area page: where you are, and the one thing it answers. */
export function PageIntro({ index, area, title, children }: { index: string; area: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-[1360px] px-3 pt-4 pb-8 sm:px-4 md:pt-6 lg:px-6">
      <div className="glass relative overflow-hidden p-6 md:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full opacity-70 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(25,211,240,0.45), rgba(10,99,242,0.12) 60%, transparent 72%)" }}
        />
        <p className="pill relative mb-5 !py-1 font-mono !text-[10px] tracking-[0.1em] uppercase">
          <span className="text-accent">{index}</span>
          <span className="text-ink-4">/</span>
          {area}
        </p>
        <h1 className="relative max-w-[22ch] text-3xl leading-[1.1] font-light tracking-[-0.03em] text-ink sm:text-4xl md:text-5xl">{title}</h1>
        {children && <div className="relative mt-5 max-w-[62ch] text-base text-ink-2">{children}</div>}
      </div>
    </div>
  );
}

export const SHELL = "mx-auto max-w-[1360px] px-3 sm:px-4 lg:px-6";

/** A section as a frosted glass card, with the same side margins as the shell. */
export const PANEL = "glass mx-3 mb-5 max-w-[1312px] p-5 sm:mx-4 md:p-8 lg:mx-6 min-[1640px]:mx-auto";
