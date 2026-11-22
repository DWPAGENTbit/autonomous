import { BROKERS } from "./brokers";
import type { BrokerAdapter } from "./brokers/types";
import { allowedPairs, validPair } from "./bot/settings";
import type { BotSettings } from "./bot/types";
import { idrTickers } from "./market";

/** True when the market really trades on the exchange right now. */
export async function pairExists(broker: BrokerAdapter, pair: string): Promise<boolean> {
  if (!validPair(broker.id, pair)) return false;
  const [base, quote] = broker.split(pair);
  if (broker.id === "indodax" && quote === "IDR") return (await idrTickers().catch(() => new Map())).has(base);
  return (await BROKERS[broker.id].price(pair).catch(() => null)) !== null;
}

/**
 * Pairs a hand-placed order may use: the usual list, plus the pair in this order
 * when it exists on the exchange. The owner clicks every manual order and the
 * per-order cap still applies, so a coin found by search can be traded at once,
 * even before the bot's storage remembers the watchlist.
 */
export async function manualPairs(broker: BrokerAdapter, pair: string, settings: Pick<BotSettings, "watchlist">): Promise<string[]> {
  const allowed = allowedPairs(broker.id, settings);
  if (allowed.includes(pair) || !(await pairExists(broker, pair))) return allowed;
  return [...allowed, pair];
}
