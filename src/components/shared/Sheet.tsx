"use client";

import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { transition } from "@/lib/design/tokens";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Contextual side panel. Used for reasoning and evidence — information
 * the user asked for — never for interrupting them.
 */
export function Sheet({
  open,
  onClose,
  eyebrow,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const raf = requestAnimationFrame(() => panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      returnFocus.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-ink/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition.panel}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-y-0 right-0 flex w-full max-w-[480px] flex-col border-l border-line bg-canvas shadow-panel"
            initial={{ x: 32, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 32, opacity: 0 }}
            transition={transition.panel}
          >
            <div className="flex items-start justify-between gap-6 border-b border-line px-6 pt-6 pb-5 md:px-8">
              <div>
                <p className="label mb-2">{eyebrow}</p>
                <h2 id={titleId} className="text-xl font-normal tracking-[-0.01em] text-ink">
                  {title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="-mr-2 inline-flex size-9 items-center justify-center rounded-sm text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
                aria-label="Tutup panel"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
