"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BotView } from "@/lib/server/bot/view";
import type { BotSettings } from "@/lib/server/bot/types";

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

/** How often an open app nudges the bot, so it keeps working even before the schedule is set up. */
const NUDGE_MS = 120_000;

/** The bot's state for the owner, refreshed every minute; while it is on, the open app also runs a check every 2 minutes. */
export function useBot() {
  const [view, setView] = useState<BotView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastNudge = useRef(0);

  // Idle checks are stored only hourly; show the agents' newest thinking from the reply itself.
  const showFresh = useCallback((data: TickReply) => {
    if (!data.decisions?.length) return;
    setView((v) => (v ? { ...v, decisions: data.decisions!, lastTick: { at: Date.now(), by: "aplikasi", summary: data.message ?? "" } } : v));
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/bot/state", { cache: "no-store" });
      const data = (await res.json()) as BotView & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Data bot tidak bisa dibaca.");
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

  const runNow = useCallback(async () => {
    setBusy(true);
    lastNudge.current = Date.now();
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

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  // While the app is open and the bot is on, nudge it now and then.
  const auto = view?.settings.auto ?? false;
  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible" || Date.now() - lastNudge.current < NUDGE_MS) return;
      lastNudge.current = Date.now();
      void fetch("/api/bot/tick", { method: "POST" })
        .then(async (res) => {
          const data = (await res.json()) as TickReply;
          await load();
          if (res.ok) showFresh(data);
        })
        .catch(() => null);
    }, 15_000);
    return () => window.clearInterval(id);
  }, [auto, load, showFresh]);

  return { view, error, busy, load, save, runNow };
}

/** Realized result this month, and the target in the same currency. */
export function monthProgress(view: BotView) {
  const quotes = [...new Set([...Object.keys(view.month.realized), ...Object.keys(view.capital)])];
  const main = quotes.includes("IDR") ? "IDR" : (quotes[0] ?? "IDR");
  const realized = view.month.realized[main] ?? 0;
  const capital = view.capital[main] ?? 0;
  const target = (capital * view.settings.monthlyTargetPct) / 100;
  return { quote: main, realized, capital, target, ratio: target > 0 ? Math.max(0, Math.min(1, realized / target)) : 0 };
}
