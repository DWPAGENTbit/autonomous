import type { SimTime } from "@/types/domain";

const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const groupFormatters = new Map<number, Intl.NumberFormat>();
function grouped(decimals: number): Intl.NumberFormat {
  let f = groupFormatters.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    groupFormatters.set(decimals, f);
  }
  return f;
}

export function formatUsd(value: number, opts: { whole?: boolean } = {}): string {
  return opts.whole ? usd0.format(value) : usd2.format(value);
}

export function formatSignedUsd(value: number, opts: { whole?: boolean } = {}): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatUsd(Math.abs(value), opts)}`;
}

export function formatNumber(value: number, decimals = 2): string {
  return grouped(decimals).format(value);
}

export function formatPrice(value: number, decimals: number): string {
  return grouped(decimals).format(value);
}

export function formatPct(value: number, decimals = 2): string {
  return `${grouped(decimals).format(value)}%`;
}

export function formatSignedPct(value: number, decimals = 2): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${grouped(decimals).format(Math.abs(value))}%`;
}

export function formatR(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(1)}R`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Formats simulated time without Date, so server and client agree. */
export function formatClock(at: SimTime, withSeconds = true): string {
  const s = Math.floor(at) % 86400;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return withSeconds ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(h)}:${pad(m)}`;
}

export function greetingFor(at: SimTime): string {
  const h = Math.floor(at / 3600);
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function formatHours(hours: number): string {
  return `${hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)} hours`;
}

export function titleCase(state: string): string {
  return state
    .toLowerCase()
    .split("_")
    .map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
