/**
 * The owner's accent colour. Three shades drive every highlight in the app:
 * --ac (deep: buttons, active marks), --ac-2 (middle: gradients), --ac-3 (light: glows).
 * The choice is kept on this device and applied before the page paints.
 * Money colours (green in, red out) and the logo never change with it.
 */

export interface Accent {
  ac: string;
  ac2: string;
  ac3: string;
}

export interface AccentPreset extends Accent {
  id: string;
  name: string;
}

export const ACCENTS: AccentPreset[] = [
  { id: "tosca", name: "Tosca", ac: "#127562", ac2: "#3fa58c", ac3: "#6cc9b1" },
  { id: "hijau", name: "Hijau", ac: "#15803d", ac2: "#2fa65a", ac3: "#86d99a" },
  { id: "biru", name: "Biru", ac: "#1d4ed8", ac2: "#3b82f6", ac3: "#93c5fd" },
  { id: "ungu", name: "Ungu", ac: "#6d28d9", ac2: "#8b5cf6", ac3: "#c4b5fd" },
  { id: "rose", name: "Merah muda", ac: "#be185d", ac2: "#e0457b", ac3: "#f5a3c0" },
  { id: "oranye", name: "Oranye", ac: "#c2410c", ac2: "#ea7a2e", ac3: "#f6b98a" },
  { id: "emas", name: "Emas", ac: "#a16207", ac2: "#c9971c", ac3: "#e8c96a" },
  { id: "grafit", name: "Grafit", ac: "#334155", ac2: "#64748b", ac3: "#b4bfcc" },
];

export const DEFAULT_ACCENT: Accent = ACCENTS[0];
export const ACCENT_KEY = "dwp-accent";
export const ACCENT_EVENT = "dwp-accent";

const HEX = /^#[0-9a-f]{6}$/i;

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (rgb: number[]) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const mix = (hex: string, toward: [number, number, number], t: number) => toHex(hexToRgb(hex).map((v, i) => v + (toward[i] - v) * t));

/** Any colour the owner picks becomes a full set: a readable deep shade, a middle and a light one. */
export function accentFrom(hex: string): Accent {
  if (!HEX.test(hex)) return DEFAULT_ACCENT;
  const [r, g, b] = hexToRgb(hex);
  // Too light to read white text on: darken it into the deep shade.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const ac = lum > 0.55 ? mix(hex, [0, 0, 0], Math.min(0.6, (lum - 0.45) * 1.4)) : hex.toLowerCase();
  return { ac, ac2: mix(ac, [255, 255, 255], 0.25), ac3: mix(ac, [255, 255, 255], 0.5) };
}

function valid(a: unknown): a is Accent {
  const x = a as Accent;
  return !!x && HEX.test(x.ac) && HEX.test(x.ac2) && HEX.test(x.ac3);
}

export function readAccent(): Accent {
  try {
    const a = JSON.parse(localStorage.getItem(ACCENT_KEY) ?? "null");
    if (valid(a)) return a;
  } catch {}
  return DEFAULT_ACCENT;
}

function paint(a: Accent) {
  const s = document.documentElement.style;
  s.setProperty("--ac", a.ac);
  s.setProperty("--ac-2", a.ac2);
  s.setProperty("--ac-3", a.ac3);
}

let current: (Accent & { rgb: string; rgb2: string; rgb3: string }) | null = null;

export function setAccent(a: Accent) {
  if (!valid(a)) return;
  paint(a);
  try {
    localStorage.setItem(ACCENT_KEY, JSON.stringify({ ac: a.ac, ac2: a.ac2, ac3: a.ac3 }));
  } catch {}
  current = null;
  window.dispatchEvent(new CustomEvent(ACCENT_EVENT, { detail: a }));
}

/** The accent for canvas drawing, where CSS variables can't be used. Cheap to call every frame. */
export function liveAccent() {
  if (current) return current;
  let a = DEFAULT_ACCENT;
  if (typeof document !== "undefined") {
    const s = getComputedStyle(document.documentElement);
    const read = { ac: s.getPropertyValue("--ac").trim(), ac2: s.getPropertyValue("--ac-2").trim(), ac3: s.getPropertyValue("--ac-3").trim() };
    if (valid(read)) a = read;
  }
  current = { ...a, rgb: hexToRgb(a.ac).join(","), rgb2: hexToRgb(a.ac2).join(","), rgb3: hexToRgb(a.ac3).join(",") };
  return current;
}

/**
 * Runs in <head> before the first paint, so a chosen colour never flashes the default.
 * Kept tiny and self-contained: it cannot import anything.
 */
export const ACCENT_BOOT = `try{var a=JSON.parse(localStorage.getItem("${ACCENT_KEY}")||"null"),h=/^#[0-9a-f]{6}$/i;if(a&&h.test(a.ac)&&h.test(a.ac2)&&h.test(a.ac3)){var s=document.documentElement.style;s.setProperty("--ac",a.ac);s.setProperty("--ac-2",a.ac2);s.setProperty("--ac-3",a.ac3)}}catch(e){}`;
