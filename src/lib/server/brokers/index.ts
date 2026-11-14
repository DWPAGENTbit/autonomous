import { randomUUID } from "node:crypto";
import { indodax } from "./indodax";
import { tokocrypto } from "./tokocrypto";
import {
  BrokerError,
  type BrokerAdapter,
  type BrokerId,
  type OrderInput,
  type OrderPreview,
  type OrderResult,
  type StatusResponse,
} from "./types";

export const BROKERS: Record<BrokerId, BrokerAdapter> = { indodax, tokocrypto };

const DEFAULT_PAIRS: Record<BrokerId, string> = {
  indodax: "btc_idr,eth_idr,usdt_idr",
  tokocrypto: "BTC_USDT,ETH_USDT",
};

/** Real orders are sent only when the owner sets DWP_LIVE_TRADING=on. */
export const liveTrading = () => process.env.DWP_LIVE_TRADING === "on";

export function pairsFor(id: BrokerId): string[] {
  const env = process.env[id === "indodax" ? "DWP_PAIRS_INDODAX" : "DWP_PAIRS_TOKOCRYPTO"];
  return (env || DEFAULT_PAIRS[id])
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Hard cap per order, in the pair's quote currency. */
export function limitFor(quote: string): number {
  const raw = quote === "IDR" ? process.env.DWP_MAX_ORDER_IDR : process.env.DWP_MAX_ORDER_USDT;
  const fallback = quote === "IDR" ? 500_000 : 30;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function brokerFrom(id: string): BrokerAdapter | null {
  return id === "indodax" || id === "tokocrypto" ? BROKERS[id] : null;
}

export function status(): StatusResponse {
  return {
    live: liveTrading(),
    brokers: Object.values(BROKERS).map((b) => {
      const pairs = pairsFor(b.id);
      const quotes = [...new Set(pairs.map((p) => b.split(p)[1]))];
      return { id: b.id, name: b.name, configured: b.configured(), pairs, limits: Object.fromEntries(quotes.map((q) => [q, limitFor(q)])) };
    }),
  };
}

export function parseOrder(body: unknown): OrderInput | null {
  const b = body as Partial<OrderInput> | null;
  if (!b || typeof b.pair !== "string" || (b.side !== "buy" && b.side !== "sell")) return null;
  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { pair: b.pair, side: b.side, amount };
}

export async function previewOrder(broker: BrokerAdapter, input: OrderInput): Promise<OrderPreview> {
  const problems: string[] = [];
  if (!broker.configured()) problems.push(`Kunci API ${broker.name} belum diatur.`);
  if (!pairsFor(broker.id).includes(input.pair)) problems.push(`Pasangan ${input.pair} tidak ada di daftar yang diizinkan.`);
  const [base, quote] = broker.split(input.pair);
  const price = await broker.price(input.pair);
  const estQuoteValue = input.side === "buy" ? input.amount : price ? input.amount * price : null;
  const limit = limitFor(quote);
  if (estQuoteValue === null) problems.push("Harga terkini tidak bisa diambil, jadi nilai order tidak bisa dicek terhadap batas.");
  else if (estQuoteValue > limit) problems.push(`Nilai order melebihi batas per order (${limit.toLocaleString("id-ID")} ${quote}).`);
  return { ...input, broker: broker.id, base, quote, amountUnit: input.side === "buy" ? quote : base, price, estQuoteValue, limit, live: liveTrading(), problems };
}

export async function executeOrder(broker: BrokerAdapter, input: OrderInput): Promise<OrderResult> {
  const preview = await previewOrder(broker, input);
  if (preview.problems.length) return { ok: false, live: preview.live, message: preview.problems.join(" ") };
  const params = broker.orderParams(input, `dwp-${randomUUID().slice(0, 18)}`);

  if (!preview.live) {
    return {
      ok: true,
      live: false,
      message: "Mode uji: order tidak dikirim ke bursa. Atur DWP_LIVE_TRADING=on di Vercel untuk mengirim order sungguhan.",
      sent: params,
    };
  }

  console.info(`[order] ${broker.id} ${input.side} ${input.pair} ${input.amount} ${preview.amountUnit}`);
  try {
    const { orderId } = await broker.place(params);
    return { ok: true, live: true, orderId, message: `Order terkirim ke ${broker.name}.`, sent: params };
  } catch (e) {
    const msg = e instanceof BrokerError ? e.message : "Bursa tidak bisa dihubungi.";
    console.warn(`[order] ${broker.id} failed: ${msg}`);
    return { ok: false, live: true, message: msg, sent: params };
  }
}
