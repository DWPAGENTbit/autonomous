"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Observes an element's content box. Charts render to the measured width.
 * Measures synchronously before first paint so a chart never flashes at the
 * fallback width (which would overflow narrow screens).
 */
export function useElementSize<T extends HTMLElement>(fallbackWidth = 600) {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: fallbackWidth, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (width: number, height: number) =>
      setSize((prev) =>
        Math.round(prev.width) === Math.round(width) && Math.round(prev.height) === Math.round(height)
          ? prev
          : { width, height },
      );
    apply(el.clientWidth, el.clientHeight);
    const ro = new ResizeObserver(([entry]) => apply(entry.contentRect.width, entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size] as const;
}
