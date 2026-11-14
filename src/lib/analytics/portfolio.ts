import { pctChange } from "@/lib/analytics/series";
import type { MarketSymbol, PortfolioState, Position, Quote } from "@/types/domain";

export type QuoteMap = Record<MarketSymbol, Quote>;

export interface ValuedPosition extends Position {
  price: number;
  marketValue: number;
  unrealized: number;
  unrealizedPct: number;
  /** Share of total equity, percent. */
  weightPct: number;
  /** Dollars lost if the stop is hit. */
  riskToStop: number;
}

export interface CapitalSnapshot {
  total: number;
  available: number;
  deployed: number;
  unrealized: number;
  realized: number;
  drawdownPct: number;
  monthPnl: number;
  monthReturnPct: number;
  positions: ValuedPosition[];
}

export function valuePositions(positions: readonly Position[], quotes: QuoteMap, total: number): ValuedPosition[] {
  return positions.map((p) => {
    const price = quotes[p.symbol].price;
    const marketValue = p.quantity * price;
    const unrealized = p.quantity * (price - p.entryPrice);
    return {
      ...p,
      price,
      marketValue,
      unrealized,
      unrealizedPct: pctChange(p.entryPrice, price),
      weightPct: total > 0 ? (marketValue / total) * 100 : 0,
      riskToStop: Math.max(0, p.quantity * (price - p.stopPrice)),
    };
  });
}

export function computeCapital(portfolio: PortfolioState, quotes: QuoteMap): CapitalSnapshot {
  const deployed = portfolio.positions.reduce((acc, p) => acc + p.quantity * quotes[p.symbol].price, 0);
  const total = portfolio.cash + deployed;
  const positions = valuePositions(portfolio.positions, quotes, total);
  const unrealized = positions.reduce((acc, p) => acc + p.unrealized, 0);
  const peak = Math.max(portfolio.peakEquity, total);
  return {
    total,
    available: portfolio.cash,
    deployed,
    unrealized,
    realized: portfolio.realizedPnl,
    drawdownPct: peak > 0 ? ((peak - total) / peak) * 100 : 0,
    monthPnl: total - portfolio.monthStartEquity,
    monthReturnPct: pctChange(portfolio.monthStartEquity, total),
    positions,
  };
}
