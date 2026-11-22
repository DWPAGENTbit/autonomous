"use client";

/** Holdings recorded by hand for accounts without an API (Bibit, Stockbit). Kept in this browser. */
export interface ManualHolding {
  id: string;
  name: string;
  kind: string;
  /** Last known value in rupiah. For stocks with a code it follows the live price. */
  value: number;
  updated: string;
  /** IDX code, e.g. "BBCA", when this is a listed stock. */
  ticker?: string;
  lots?: number;
  /** Average buy price per share. */
  avg?: number;
}

export type ManualAccountId = "bibit" | "stockbit";
export const MANUAL_EVENT = "dwp-manual-change";
export const SHARES_PER_LOT = 100;

const keyOf = (id: string) => `dwp.manual.${id}`;
export const today = () => new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

export function loadManual(id: string): ManualHolding[] {
  try {
    const raw = localStorage.getItem(keyOf(id));
    return raw ? (JSON.parse(raw) as ManualHolding[]) : [];
  } catch {
    return [];
  }
}

export function saveManual(id: string, items: ManualHolding[]) {
  try {
    localStorage.setItem(keyOf(id), JSON.stringify(items));
  } catch {
    // Storage blocked: the list still works for this visit.
  }
  window.dispatchEvent(new CustomEvent(MANUAL_EVENT, { detail: id }));
}

/** Records (or tops up) a stock bought in Bibit or Stockbit, valued at the current price. */
export function addStock(account: ManualAccountId, s: { ticker: string; name: string; lots: number; avg: number; price: number }) {
  const items = loadManual(account);
  const existing = items.find((h) => h.ticker === s.ticker);
  let next: ManualHolding[];
  if (existing) {
    const lots = (existing.lots ?? 0) + s.lots;
    const avg = ((existing.avg ?? s.avg) * (existing.lots ?? 0) + s.avg * s.lots) / lots;
    next = items.map((h) => (h === existing ? { ...h, lots, avg, value: lots * SHARES_PER_LOT * s.price, updated: today() } : h));
  } else {
    next = [
      ...items,
      { id: `${Date.now()}`, name: s.ticker, kind: "Saham", ticker: s.ticker, lots: s.lots, avg: s.avg, value: s.lots * SHARES_PER_LOT * s.price, updated: today() },
    ];
  }
  saveManual(account, next);
}
