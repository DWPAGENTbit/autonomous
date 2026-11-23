export type BrokerId = "indodax" | "tokocrypto";
export type Side = "buy" | "sell";

export interface Balance {
  asset: string;
  free: number;
  locked: number;
}

/** Buy: `amount` is in the quote currency (e.g. IDR). Sell: in the base asset (e.g. BTC). */
export interface OrderInput {
  pair: string;
  side: Side;
  amount: number;
}

export interface OrderPreview extends OrderInput {
  broker: BrokerId;
  base: string;
  quote: string;
  amountUnit: string;
  price: number | null;
  estQuoteValue: number | null;
  limit: number;
  live: boolean;
  problems: string[];
}

/** What actually traded, as reported by the exchange. */
export interface Fill {
  /** Base asset bought or sold. */
  base: number;
  /** Quote currency spent (buy) or received (sell). */
  quote: number;
  /** Fee in the quote currency, when the exchange reports it. */
  fee?: number;
}

export interface OrderResult {
  ok: boolean;
  live: boolean;
  message: string;
  orderId?: string;
  fill?: Fill;
  sent?: Record<string, string>;
}

export interface BrokerStatus {
  id: BrokerId;
  name: string;
  configured: boolean;
  /** Switched on by the owner (Indodax can run alone; Tokocrypto is optional). */
  enabled: boolean;
  pairs: string[];
  limits: Record<string, number>;
}

export interface StatusResponse {
  live: boolean;
  brokers: BrokerStatus[];
}

export class BrokerError extends Error {}

export interface BrokerAdapter {
  id: BrokerId;
  name: string;
  configured(): boolean;
  /** Splits a pair into base and quote, e.g. btc_idr → ["BTC", "IDR"]. */
  split(pair: string): [string, string];
  balances(): Promise<Balance[]>;
  price(pair: string): Promise<number | null>;
  /** The exact, unsigned parameters an order would send. */
  orderParams(input: OrderInput, clientId: string): Record<string, string>;
  place(params: Record<string, string>): Promise<{ orderId: string; fill?: Fill }>;
  /** Orders waiting on the book (e.g. limit orders placed in the exchange's own app). */
  openOrders?(): Promise<OpenOrder[]>;
}

/** An order that is not (fully) filled yet; its money or coins are locked meanwhile. */
export interface OpenOrder {
  pair: string;
  side: "buy" | "sell";
  price: number;
  /** Rupiah still waiting (buy) or coins still waiting (sell). */
  remaining: number;
  /** IDR for a buy, the coin for a sell. */
  unit: string;
  at: number;
}

/** Plain decimal string with no exponent. */
export function decimal(n: number, places = 8): string {
  return n.toFixed(places).replace(/\.?0+$/, "");
}
