import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { cleanSettings, emptyState } from "./settings";
import type { BotState } from "./types";

/**
 * The bot's memory: settings, positions, journal and monthly results, as one JSON
 * document in a private Vercel Blob store. Writes are conditional on the ETag that
 * was read, so two runs can never silently overwrite each other.
 * Without a store (local development) it lives in this process only.
 */
const PATH = "dwp-bot/state.json";
const JOURNAL_MAX = 150;

export type StorageKind = "blob" | "memory";

/**
 * Vercel Hobby allows 10,000 Blob reads and 2,000 writes a month. Callers that only
 * need settings (exchanges on/off, watchlist) take a copy up to 5 minutes old; the
 * bot panel takes one up to 2 minutes old. The bot's own runs always read fresh.
 */
export const SETTINGS_MAX_AGE = 5 * 60_000;
export const VIEW_MAX_AGE = 2 * 60_000;
export const storageKind = (): StorageKind => (process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "memory");

export interface Snapshot {
  state: BotState;
  /** ETag of the stored document; null when nothing is stored yet. */
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
    lock: r.lock ?? null,
  };
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Reads the state. Read-only callers may take a copy up to `maxAgeMs` old. */
export async function loadState(maxAgeMs = 0): Promise<Snapshot> {
  if (storageKind() === "memory") return { state: clone(shared.__dwpBotMemory ?? emptyState()), etag: null };
  if (maxAgeMs > 0 && cache && Date.now() - cache.at < maxAgeMs) return { state: clone(cache.state), etag: cache.etag };

  const res = await get(PATH, { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) {
    cache = { state: emptyState(), etag: null, at: Date.now() };
    return { state: emptyState(), etag: null };
  }
  const state = normalize(JSON.parse(await new Response(res.stream).text()));
  cache = { state, etag: res.blob.etag, at: Date.now() };
  return { state: clone(state), etag: res.blob.etag };
}

/** Writes the state if nobody changed it since `etag` was read. Returns the new snapshot, or null on a conflict. */
export async function saveState(state: BotState, etag: string | null): Promise<Snapshot | null> {
  state.journal = state.journal.slice(0, JOURNAL_MAX);
  if (storageKind() === "memory") {
    shared.__dwpBotMemory = clone(state);
    return { state, etag: null };
  }
  try {
    const res = await put(PATH, JSON.stringify(state), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
      ...(etag ? { ifMatch: etag } : {}),
    });
    cache = { state: clone(state), etag: res.etag, at: Date.now() };
    return { state, etag: res.etag };
  } catch (e) {
    if (e instanceof BlobPreconditionFailedError) {
      cache = null;
      return null;
    }
    throw e;
  }
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
