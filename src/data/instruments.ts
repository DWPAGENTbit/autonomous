import type { Instrument, MarketSymbol } from "@/types/domain";

/**
 * Instruments the agent watches. Prices, drifts and factor loadings
 * are demo parameters for the simulation — not market data.
 */
export interface InstrumentSeed extends Instrument {
  price: number;
  /** Simulated trailing one-year return, used as drift. */
  annualReturn: number;
  /** Loadings on [global risk, crypto, US dollar] factors. */
  loadings: readonly [number, number, number];
  /** Authored recent returns (fractions) the walk is bent to hit, so the market story is coherent. */
  recent: { week: number; month: number };
}

export const INSTRUMENT_SEEDS: readonly InstrumentSeed[] = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    pair: "BTC / USDT",
    assetClass: "Crypto",
    decimals: 2,
    annualVol: 0.52,
    price: 68420.5,
    annualReturn: 0.46,
    loadings: [0.45, 0.8, -0.1],
    recent: { week: 0.031, month: 0.084 },
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    pair: "ETH / USDT",
    assetClass: "Crypto",
    decimals: 2,
    annualVol: 0.64,
    price: 3482.2,
    annualReturn: 0.31,
    loadings: [0.45, 0.85, -0.1],
    recent: { week: 0.046, month: 0.112 },
  },
  {
    symbol: "SPX",
    name: "S&P 500",
    pair: "S&P 500",
    assetClass: "Equity index",
    decimals: 2,
    annualVol: 0.15,
    price: 5842.1,
    annualReturn: 0.18,
    loadings: [0.9, 0, -0.15],
    recent: { week: 0.009, month: 0.026 },
  },
  {
    symbol: "NDX",
    name: "Nasdaq 100",
    pair: "NASDAQ 100",
    assetClass: "Equity index",
    decimals: 2,
    annualVol: 0.2,
    price: 20612.4,
    annualReturn: 0.22,
    loadings: [0.94, 0.05, -0.15],
    recent: { week: 0.012, month: 0.034 },
  },
  {
    symbol: "XAU",
    name: "Gold",
    pair: "XAU / USD",
    assetClass: "Commodity",
    decimals: 2,
    annualVol: 0.16,
    price: 2664.3,
    annualReturn: 0.27,
    loadings: [0.1, 0.05, -0.5],
    recent: { week: 0.006, month: 0.021 },
  },
  {
    symbol: "DXY",
    name: "US Dollar Index",
    pair: "USD Index",
    assetClass: "Currency",
    decimals: 2,
    annualVol: 0.07,
    price: 104.21,
    annualReturn: -0.03,
    loadings: [-0.3, 0, 0.9],
    recent: { week: -0.003, month: -0.008 },
  },
];

export const INSTRUMENTS: Record<MarketSymbol, Instrument> = Object.fromEntries(
  INSTRUMENT_SEEDS.map(({ symbol, name, pair, assetClass, decimals, annualVol }) => [
    symbol,
    { symbol, name, pair, assetClass, decimals, annualVol },
  ]),
) as Record<MarketSymbol, Instrument>;

export const SYMBOLS: readonly MarketSymbol[] = INSTRUMENT_SEEDS.map((s) => s.symbol);
