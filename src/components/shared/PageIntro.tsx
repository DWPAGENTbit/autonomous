import type { ReactNode } from "react";

/** Opening of an area page: where you are, and the one thing it answers. */
export function PageIntro({ index, area, title, children }: { index: string; area: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-[1360px] px-4 pt-10 pb-12 sm:px-6 md:px-10 md:pt-16 lg:px-12">
      <p className="label num mb-4">
        <span className="text-ink-2">{index}</span>
        <span className="mx-2 text-ink-4">—</span>
        {area}
      </p>
      <h1 className="max-w-[22ch] text-4xl leading-[1.08] font-light tracking-[-0.03em] text-ink md:text-5xl">{title}</h1>
      {children && <div className="mt-5 max-w-[62ch] text-base text-ink-2">{children}</div>}
    </div>
  );
}

export const SHELL = "mx-auto max-w-[1360px] px-4 sm:px-6 md:px-10 lg:px-12";
