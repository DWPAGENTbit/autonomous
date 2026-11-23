import type { ReactNode } from "react";

/** Opening of an area page: where you are, and the one thing it answers. */
export function PageIntro({ index, area, title, children }: { index: string; area: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-[1360px] px-3 pt-4 pb-8 sm:px-4 md:pt-6 lg:px-6">
      <div className="glass relative overflow-hidden p-6 md:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full opacity-70 blur-3xl"
          style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--ac-3) 45%, transparent), color-mix(in srgb, var(--ac) 12%, transparent) 60%, transparent 72%)" }}
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

/**
 * A section as a frosted glass card, lined up with the shell's content: side margins
 * are the shell's gutter, or half the space left beside 1312px, whichever is larger.
 * Margins (not breakpoints) do the centring, so it lines up at every width, sidebar or not.
 */
export const PANEL =
  "glass mb-5 max-w-[1312px] p-5 md:p-8 mx-[max(0.75rem,calc((100%_-_1312px)/2))] sm:mx-[max(1rem,calc((100%_-_1312px)/2))] lg:mx-[max(1.5rem,calc((100%_-_1312px)/2))]";
