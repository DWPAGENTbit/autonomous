"use client";

import clsx from "clsx";
import { Check, Palette, RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ACCENTS, DEFAULT_ACCENT, accentFrom, readAccent, setAccent, type Accent } from "@/lib/accent";

/** A palette in the top bar: the owner picks the highlight colour of the whole app. */
export function AccentPicker({ buttonClass }: { buttonClass: string }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<Accent>(DEFAULT_ACCENT);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => setNow(readAccent()), []);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const choose = (a: Accent) => {
    setAccent(a);
    setNow(a);
  };
  const preset = ACCENTS.find((p) => p.ac === now.ac);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={buttonClass}
        aria-label="Warna aksen"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Warna aksen"
      >
        <Palette className="size-3.5" aria-hidden />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Warna aksen"
            className="absolute top-full right-0 z-50 mt-3 w-[17rem] rounded-[22px] border border-glass-edge bg-[rgb(250_247_243/0.97)] p-4 shadow-[0_24px_60px_-12px_rgb(40_30_20/0.35)] backdrop-blur-xl"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "top right" }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-ink">Warna aksen</p>
              <p className="truncate text-[11px] text-ink-3">{preset ? preset.name : "Warna sendiri"}</p>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2.5">
              {ACCENTS.map((p) => {
                const on = p.ac === now.ac;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => choose(p)}
                    aria-pressed={on}
                    aria-label={p.name}
                    title={p.name}
                    className={clsx(
                      "relative inline-flex aspect-square items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95",
                      on ? "ring-2 ring-offset-2 ring-offset-[#f6f2ee]" : "",
                    )}
                    style={{ background: `linear-gradient(140deg, ${p.ac3}, ${p.ac2} 45%, ${p.ac})`, ["--tw-ring-color" as string]: p.ac }}
                  >
                    {on && <Check className="size-4 text-white drop-shadow" aria-hidden />}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-full border border-glass-edge bg-white/60 py-1.5 pr-3 pl-1.5 text-xs text-ink-2 hover:bg-white">
                <span className="relative inline-flex size-7 shrink-0 overflow-hidden rounded-full border border-line" style={{ background: now.ac }}>
                  <input
                    type="color"
                    value={now.ac}
                    onChange={(e) => choose(accentFrom(e.target.value))}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                    aria-label="Pilih warna sendiri"
                  />
                </span>
                <span className="truncate">Pilih warna sendiri</span>
              </label>
              <button
                type="button"
                onClick={() => choose(DEFAULT_ACCENT)}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-glass-edge bg-white/60 text-ink-2 hover:bg-white"
                aria-label="Kembalikan warna awal"
                title="Kembalikan warna awal"
              >
                <RotateCcw className="size-3.5" aria-hidden />
              </button>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
              Tersimpan di perangkat ini. Hijau untuk untung dan merah untuk rugi tetap sama.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
