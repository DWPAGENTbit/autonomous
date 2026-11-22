"use client";

import { useCallback, useState } from "react";
import type { BotView } from "@/lib/server/bot/view";
import type { AgentName, BotSettings } from "@/lib/server/bot/types";
import { useVisibleInterval } from "@/lib/use-visible-interval";

export type { BotView };

export const money = (v: number, quote: string) =>
  quote === "IDR"
    ? `Rp${v.toLocaleString("id-ID", { maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 })}`
    : `${v.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${quote}`;
export const signedMoney = (v: number, quote: string) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${money(Math.abs(v), quote)}`;
export const quoteOf = (pair: string) => (pair.split("_")[1] ?? "").toUpperCase();
export const baseOf = (pair: string) => (pair.split("_")[0] ?? "").toUpperCase();
export const timeOf = (t: number) => new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
export const dateTimeOf = (t: number) =>
  new Date(t).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

interface TickReply {
  error?: string;
  message?: string;
  decisions?: BotView["decisions"];
}

/**
 * How often an open app re-reads the bot. The schedule runs the bot every 15 minutes,
 * so reading more often shows nothing new and only spends Vercel and Supabase quota.
 */
const REFRESH_MS = 5 * 60_000;

/** Newest settings this app has seen; a read older than this asks the server for a fresh copy. */
let newestSettingsAt = 0;
const remember = (v: BotView) => {
  newestSettingsAt = Math.max(newestSettingsAt, v.settings.updatedAt ?? 0);
};

/** The bot's state for the owner. The bot itself runs on the server schedule, not from this app. */
export function useBot() {
  const [view, setView] = useState<BotView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Idle checks are stored only hourly; show the agents' newest thinking from the reply itself.
  const showFresh = useCallback((data: TickReply) => {
    if (!data.decisions?.length) return;
    setView((v) => (v ? { ...v, decisions: data.decisions!, lastTick: { at: Date.now(), by: "aplikasi", summary: data.message ?? "" } } : v));
  }, []);

  const load = useCallback(async () => {
    try {
      const read = async (fresh: boolean) => {
        const res = await fetch(fresh ? "/api/bot/state?fresh=1" : "/api/bot/state", { cache: "no-store" });
        const data = (await res.json()) as BotView & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Data bot tidak bisa dibaca.");
        return data;
      };
      let data = await read(false);
      if ((data.settings.updatedAt ?? 0) < newestSettingsAt) data = await read(true);
      remember(data);
      setView(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Server tidak bisa dihubungi.");
    }
  }, []);

  const save = useCallback(async (patch: Partial<BotSettings>) => {
    setBusy(true);
    try {
      const res = await fetch("/api/bot/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as BotView & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Pengaturan gagal disimpan.");
      remember(data);
      setView(data);
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pengaturan gagal disimpan.");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  /** Add or remove a market found by search; `bot` also puts it on (or takes it off) the bot's list. */
  const watch = useCallback(async (broker: string, pair: string, action: "add" | "remove", bot?: boolean) => {
    setBusy(true);
    try {
      const res = await fetch("/api/bot/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broker, pair, action, bot }),
      });
      const data = (await res.json()) as BotView & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan.");
      remember(data);
      setView(data);
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan.");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const runNow = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/bot/tick", { method: "POST" });
      const data = (await res.json()) as TickReply;
      if (!res.ok) throw new Error(data.error ?? "Bot gagal berjalan.");
      await load();
      showFresh(data);
      return data.message ?? null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bot gagal berjalan.");
      return null;
    } finally {
      setBusy(false);
    }
  }, [load, showFresh]);

  useVisibleInterval(load, REFRESH_MS);

  return { view, error, busy, load, save, runNow, watch };
}

/** Realized result this month, and the target in the same currency. */
export function monthProgress(view: BotView) {
  const quotes = [...new Set([...Object.keys(view.month.realized), ...Object.keys(view.capital)])];
  const main = quotes.includes("IDR") ? "IDR" : (quotes[0] ?? "IDR");
  const realized = view.month.realized[main] ?? 0;
  const capital = view.capital[main] ?? 0;
  // An amount the owner typed wins over the percentage of working capital.
  const fixed = main === "IDR" ? (view.settings.monthlyTargetAmount ?? 0) : 0;
  const target = fixed > 0 ? fixed : (capital * view.settings.monthlyTargetPct) / 100;
  /** What the target means as a monthly return on the working capital, in %. */
  const targetPct = capital > 0 ? (target / capital) * 100 : null;
  return { quote: main, realized, capital, target, targetPct, fixed: fixed > 0, ratio: target > 0 ? Math.max(0, Math.min(1, realized / target)) : 0 };
}

/** Text colour per agent, the same in every list of agent steps. */
export const AGENT_TONE: Record<AgentName, string> = {
  Pemindai: "text-accent",
  Analis: "text-[#7c3aed]",
  Risiko: "text-caution",
  Eksekutor: "text-positive",
};

/**
 * When the working capital is too small for even one order: the bot may put only
 * maxAllocPct% of it into coins, and that part must reach the exchange's minimum order.
 */
export function capitalShort(view: BotView) {
  const p = monthProgress(view);
  const min = view.minOrder[p.quote] ?? 0;
  const alloc = view.settings.params.maxAllocPct / 100;
  if (!view.settings.auto || p.capital <= 0 || alloc <= 0 || p.capital * alloc >= min) return null;
  return { quote: p.quote, capital: p.capital, min, need: Math.ceil(min / alloc) };
}

/** What the bot holds in one quote currency: market value, cost, and result if sold now after fees. */
export function botHoldings(view: BotView, quote: string) {
  const mine = view.positions.filter((p) => quoteOf(p.pair) === quote);
  return {
    count: mine.length,
    value: mine.reduce((s, p) => s + (p.value ?? p.cost), 0),
    cost: mine.reduce((s, p) => s + p.cost, 0),
    unrealized: mine.reduce((s, p) => s + (p.netPct !== null ? (p.cost * p.netPct) / 100 : 0), 0),
  };
}

/** Orders the bot actually placed this calendar month. */
export function ordersThisMonth(view: BotView) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return view.journal.filter((j) => j.ok && j.action !== "error" && j.at >= start).length;
}
