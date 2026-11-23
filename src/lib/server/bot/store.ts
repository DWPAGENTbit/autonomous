import { cleanSettings, emptyState } from "./settings";
import type { BotState } from "./types";

/**
 * The bot's memory: settings, positions, journal and monthly results, as one JSON
 * row in the owner's Supabase project (see supabase/dwp-bot.sql).
 *
 * The row lives in a private schema. This app reaches it only through two database
 * functions that check DWP_DB_TOKEN, called with the project's publishable key, so
 * no Supabase secret key is needed anywhere. Each write carries the version that was
 * read, so two runs can never silently overwrite each other.
 * Without Supabase settings (local development) it lives in this process only.
 */
const JOURNAL_MAX = 150;

export type StorageKind = "supabase" | "memory";

function database() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const token = process.env.DWP_DB_TOKEN?.trim();
  if (!url || !key || !token || token.length < 32) return null;
  return { url, key, token, row: process.env.DWP_BOT_ROW?.trim() || "main" };
}

export const storageKind = (): StorageKind => (database() ? "supabase" : "memory");

/**
 * Every read is a Vercel function call plus Supabase traffic. Callers that only need
 * settings (exchanges on/off, watchlist) take a copy up to 5 minutes old; the bot
 * panel takes one up to 2 minutes old. The bot's own runs always read fresh.
 */
export const SETTINGS_MAX_AGE = 5 * 60_000;
export const VIEW_MAX_AGE = 2 * 60_000;

export interface Snapshot {
  state: BotState;
  /** Version of the stored row; null when nothing is stored yet. */
  etag: string | null;
}

// One copy per server process, shared by every route (dev bundles each route separately).
const shared = globalThis as typeof globalThis & { __dwpBotMemory?: BotState | null };
let cache: (Snapshot & { at: number }) | null = null;

function normalize(raw: unknown): BotState {
  const base = emptyState();
  const r = (raw ?? {}) as Partial<BotState>;
  return {
    version: 1,
    settings: cleanSettings(r.settings, base.settings),
    positions: r.positions && typeof r.positions === "object" ? r.positions : {},
    journal: Array.isArray(r.journal) ? r.journal.slice(0, JOURNAL_MAX) : [],
    months: r.months && typeof r.months === "object" ? r.months : {},
    decisions: r.decisions && typeof r.decisions === "object" ? r.decisions : {},
    lastTick: r.lastTick ?? null,
    lastScheduledAt: typeof r.lastScheduledAt === "number" ? r.lastScheduledAt : null,
    scan: r.scan && Array.isArray(r.scan.pairs) ? r.scan : null,
    lock: r.lock ?? null,
  };
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Calls one of the bot's database functions. */
async function rpc<T>(fn: "dwp_bot_read" | "dwp_bot_write" | "dwp_bot_schedule_ok", args: Record<string, unknown>): Promise<T> {
  const db = database();
  if (!db) throw new Error("Penyimpanan bot belum diatur.");
  const headers: Record<string, string> = { apikey: db.key, "Content-Type": "application/json" };
  // Legacy anon keys are JWTs and also go in Authorization; new publishable keys must not.
  if (db.key.startsWith("eyJ")) headers.Authorization = `Bearer ${db.key}`;
  const res = await fetch(`${db.url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_token: db.token, ...args }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    console.error(`[bot] ${fn} failed`, res.status, detail);
    throw new Error(
      res.status === 401 || res.status === 403
        ? "Penyimpanan bot menolak akses. Periksa DWP_DB_TOKEN dan kunci Supabase."
        : res.status === 404
          ? "Fungsi penyimpanan bot belum dibuat di Supabase (jalankan supabase/dwp-bot.sql)."
          : `Penyimpanan bot sedang bermasalah (${res.status}).`,
    );
  }
  return (await res.json()) as T;
}

/** Reads the state. Read-only callers may take a copy up to `maxAgeMs` old. */
export async function loadState(maxAgeMs = 0): Promise<Snapshot> {
  if (storageKind() === "memory") return { state: clone(shared.__dwpBotMemory ?? emptyState()), etag: null };
  if (maxAgeMs > 0 && cache && Date.now() - cache.at < maxAgeMs) return { state: clone(cache.state), etag: cache.etag };

  const rows = await rpc<{ state: unknown; version: number }[]>("dwp_bot_read", { p_id: database()!.row });
  const row = rows[0];
  const state = row ? normalize(row.state) : emptyState();
  const etag = row ? String(row.version) : null;
  cache = { state, etag, at: Date.now() };
  return { state: clone(state), etag };
}

/** Writes the state if nobody changed it since `etag` was read. Returns the new snapshot, or null on a conflict. */
export async function saveState(state: BotState, etag: string | null): Promise<Snapshot | null> {
  state.journal = state.journal.slice(0, JOURNAL_MAX);
  if (storageKind() === "memory") {
    shared.__dwpBotMemory = clone(state);
    return { state, etag: null };
  }
  const version = await rpc<number | null>("dwp_bot_write", { p_id: database()!.row, p_state: state, p_version: etag === null ? null : Number(etag) });
  if (version === null) {
    cache = null;
    return null;
  }
  const tag = String(version);
  cache = { state: clone(state), etag: tag, at: Date.now() };
  return { state, etag: tag };
}

/**
 * True when the request comes from the 15-minute schedule in Supabase. The database
 * made its own random key for the job and checks it here, so it never leaves Supabase.
 */
export async function scheduleAuthorized(req: Request): Promise<boolean> {
  const key = req.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!key || !database()) return false;
  return rpc<boolean>("dwp_bot_schedule_ok", { p_secret: key }).catch(() => false);
}

/** Applies `change` to the latest state and saves it, retrying on conflicts. */
export async function updateState(change: (s: BotState) => void, tries = 4): Promise<Snapshot> {
  for (let i = 0; i < tries; i++) {
    const { state, etag } = await loadState();
    change(state);
    const saved = await saveState(state, etag);
    if (saved) return saved;
  }
  throw new Error("Penyimpanan bot sedang sibuk. Coba lagi sebentar.");
}
