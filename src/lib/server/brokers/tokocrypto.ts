import { createHmac } from "node:crypto";
import { BrokerError, decimal, type BrokerAdapter, type OrderInput } from "./types";

/** Tokocrypto Open API (https://www.tokocrypto.com/open/v1), HMAC-SHA256 signed. */
const BASE = "https://www.tokocrypto.com";

function creds() {
  const key = process.env.TOKOCRYPTO_API_KEY;
  const secret = process.env.TOKOCRYPTO_API_SECRET;
  if (!key || !secret) throw new BrokerError("Kunci API Tokocrypto belum diatur di server.");
  return { key, secret };
}

async function signed(method: "GET" | "POST", path: string, params: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const { key, secret } = creds();
  const qs = new URLSearchParams({ ...params, timestamp: String(Date.now()), recvWindow: "5000" }).toString();
  const full = `${qs}&signature=${createHmac("sha256", secret).update(qs).digest("hex")}`;
  const res = await fetch(method === "GET" ? `${BASE}${path}?${full}` : `${BASE}${path}`, {
    method,
    headers: { "X-MBX-APIKEY": key, ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: method === "POST" ? full : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { code?: number; msg?: string; message?: string; data?: Record<string, unknown> } | null;
  if (!json || json.code !== 0 || !json.data) throw new BrokerError(json?.msg ?? json?.message ?? `Tokocrypto membalas HTTP ${res.status}.`);
  return json.data;
}

export const tokocrypto: BrokerAdapter = {
  id: "tokocrypto",
  name: "Tokocrypto",
  configured: () => Boolean(process.env.TOKOCRYPTO_API_KEY && process.env.TOKOCRYPTO_API_SECRET),

  split(pair) {
    const [base = "", quote = ""] = pair.split("_");
    return [base.toUpperCase(), quote.toUpperCase()];
  },

  async balances() {
    const data = await signed("GET", "/open/v1/account/spot");
    const assets = (data.accountAssets ?? []) as { asset: string; free: string; locked: string }[];
    return assets
      .map((a) => ({ asset: a.asset.toUpperCase(), free: Number(a.free), locked: Number(a.locked) }))
      .filter((a) => a.free > 0 || a.locked > 0)
      .sort((x, y) => x.asset.localeCompare(y.asset));
  },

  async price(pair) {
    // Best effort, from market data for main symbols. Without a price, orders are refused.
    try {
      const res = await fetch(`https://www.tokocrypto.site/api/v3/ticker/price?symbol=${pair.replace("_", "")}`, { cache: "no-store" });
      const json = (await res.json()) as { price?: string };
      const p = Number(json.price);
      return Number.isFinite(p) && p > 0 ? p : null;
    } catch {
      return null;
    }
  },

  orderParams(input: OrderInput, clientId: string) {
    const params: Record<string, string> = {
      symbol: input.pair,
      side: input.side === "buy" ? "0" : "1",
      type: "2", // MARKET
      clientId,
    };
    if (input.side === "buy") params.quoteOrderQty = decimal(input.amount, 2);
    else params.quantity = decimal(input.amount);
    return params;
  },

  async place(params) {
    const data = await signed("POST", "/open/v1/orders", params);
    const base = Number(data.executedQty);
    const quote = Number(data.executedQuoteQty);
    const fill = base > 0 && quote > 0 ? { base, quote } : undefined;
    return { orderId: String(data.orderId ?? ""), fill };
  },
};
