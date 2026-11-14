import { createHmac } from "node:crypto";
import { BrokerError, decimal, type Balance, type BrokerAdapter, type OrderInput } from "./types";

/** Indodax private REST API (POST https://indodax.com/tapi), HMAC-SHA512 signed. */
const TAPI = "https://indodax.com/tapi";

function creds() {
  const key = process.env.INDODAX_API_KEY;
  const secret = process.env.INDODAX_API_SECRET;
  if (!key || !secret) throw new BrokerError("Kunci API Indodax belum diatur di server.");
  return { key, secret };
}

async function tapi(params: Record<string, string>): Promise<Record<string, unknown>> {
  const { key, secret } = creds();
  const body = new URLSearchParams({ ...params, timestamp: String(Date.now()), recvWindow: "5000" }).toString();
  const sign = createHmac("sha512", secret).update(body).digest("hex");
  const res = await fetch(TAPI, {
    method: "POST",
    headers: { Key: key, Sign: sign, "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { success?: number; error?: string; return?: Record<string, unknown> } | null;
  if (!json || json.success !== 1 || !json.return) throw new BrokerError(json?.error ?? `Indodax membalas HTTP ${res.status}.`);
  return json.return;
}

export const indodax: BrokerAdapter = {
  id: "indodax",
  name: "Indodax",
  configured: () => Boolean(process.env.INDODAX_API_KEY && process.env.INDODAX_API_SECRET),

  split(pair) {
    const [base = "", quote = ""] = pair.split("_");
    return [base.toUpperCase(), quote.toUpperCase()];
  },

  async balances() {
    const r = await tapi({ method: "getInfo" });
    const free = (r.balance ?? {}) as Record<string, string | number>;
    const hold = (r.balance_hold ?? {}) as Record<string, string | number>;
    const out: Balance[] = [];
    for (const a of new Set([...Object.keys(free), ...Object.keys(hold)])) {
      const f = Number(free[a] ?? 0);
      const l = Number(hold[a] ?? 0);
      if (f > 0 || l > 0) out.push({ asset: a.toUpperCase(), free: f, locked: l });
    }
    return out.sort((x, y) => (x.asset === "IDR" ? -1 : y.asset === "IDR" ? 1 : x.asset.localeCompare(y.asset)));
  },

  async price(pair) {
    try {
      const res = await fetch(`https://indodax.com/api/ticker/${pair.replace("_", "")}`, { cache: "no-store" });
      const json = (await res.json()) as { ticker?: { last?: string } };
      const last = Number(json.ticker?.last);
      return Number.isFinite(last) && last > 0 ? last : null;
    } catch {
      return null;
    }
  },

  orderParams(input: OrderInput, clientId: string) {
    const [base] = input.pair.split("_");
    const params: Record<string, string> = {
      method: "trade",
      pair: input.pair,
      type: input.side,
      order_type: "market",
      client_order_id: clientId,
    };
    // Market buys are sized in rupiah; sells in the coin.
    if (input.side === "buy") params.idr = String(Math.floor(input.amount));
    else params[base] = decimal(input.amount);
    return params;
  },

  async place(params) {
    const r = await tapi(params);
    return { orderId: String(r.order_id ?? "") };
  },
};
