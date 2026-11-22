/** Coins pegged to a currency. Their price barely moves, so the bot never buys them; it only sells what it already holds. */
export const STABLECOINS = new Set(["USDT", "USDC", "BUSD", "FDUSD", "TUSD", "DAI", "USDP", "BIDR", "IDRT"]);

/** True when the pair's coin (the part before "_") is a stablecoin, e.g. usdt_idr. */
export const isStablePair = (pair: string) => STABLECOINS.has((pair.split("_")[0] ?? "").toUpperCase());
