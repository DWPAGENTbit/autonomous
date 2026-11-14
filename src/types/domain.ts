/**
 * Domain model for AUTONOMOUS.
 * Every type here is a product concept, not a UI concern.
 */

/** Seconds since midnight on the simulated trading day. */
export type SimTime = number;

// ── Agent ────────────────────────────────────────────────────

export type AgentState =
  | "IDLE"
  | "OBSERVING"
  | "RESEARCHING"
  | "ANALYZING"
  | "SIMULATING"
  | "DECIDING"
  | "EXECUTING"
  | "MONITORING"
  | "WAITING_FOR_APPROVAL";

export interface AgentStatus {
  state: AgentState;
  /** Human-readable description of the current task. */
  task: string;
  /** What the agent will do once the current task completes. */
  next: string;
  since: SimTime;
  /** Expected duration of the current step in ms, used for progress display. */
  stepDurationMs: number;
}

export type AutonomyMode = "SUPERVISED" | "AUTONOMOUS_WITHIN_LIMITS" | "PAUSED";

export interface AutonomyPolicy {
  mode: AutonomyMode;
  maxRiskPerTradePct: number;
  maxPortfolioExposurePct: number;
  maxPositionPctOfEquity: number;
  maxCorrelation: number;
  maxDrawdownPct: number;
  minExpectedValueR: number;
}

// ── Activity ─────────────────────────────────────────────────

export type ActivityKind =
  | "SCANNING"
  | "FILTERING"
  | "RESEARCH"
  | "ANALYSIS"
  | "SIMULATION"
  | "DECISION"
  | "RISK"
  | "SEARCH"
  | "EXECUTION"
  | "APPROVAL"
  | "BUSINESS"
  | "MONITOR";

export interface Evidence {
  label: string;
  value: string;
  source?: string;
}

export interface ActivityEvent {
  id: string;
  at: SimTime;
  kind: ActivityKind;
  message: string;
  detail?: string;
  evidence?: Evidence[];
  decisionId?: string;
  opportunityId?: string;
  symbol?: MarketSymbol;
}

// ── Markets ──────────────────────────────────────────────────

export type MarketSymbol = "BTC" | "ETH" | "SPX" | "NDX" | "XAU" | "DXY";

export type AssetClass = "Crypto" | "Equity index" | "Commodity" | "Currency";

export interface Instrument {
  symbol: MarketSymbol;
  name: string;
  pair: string;
  assetClass: AssetClass;
  decimals: number;
  /** Annualised volatility used by the simulation. */
  annualVol: number;
}

export interface Quote {
  symbol: MarketSymbol;
  price: number;
  /** Price 24 hours ago (simulated). */
  dayOpen: number;
  /** Direction of the most recent tick. */
  tick: -1 | 0 | 1;
}

export type Timeframe = "1D" | "1W" | "1M" | "3M" | "1Y";

export type RegimeLevel = "Low" | "Moderate" | "Elevated" | "High";
export type TrendLevel = "Negative" | "Neutral" | "Positive";
export type LiquidityLevel = "Thin" | "Adequate" | "Healthy";

export interface MarketRegime {
  riskAppetite: RegimeLevel;
  volatility: RegimeLevel;
  liquidity: LiquidityLevel;
  trend: TrendLevel;
  /** One-sentence interpretation for the user. */
  summary: string;
}

export interface InstrumentStats {
  symbol: MarketSymbol;
  returnPct: number;
  /** Annualised realised volatility over the window, in percent. */
  volatilityPct: number;
  aboveTrend: boolean;
}

// ── Portfolio & risk ─────────────────────────────────────────

export interface Position {
  id: string;
  symbol: MarketSymbol;
  quantity: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  openedAt: SimTime;
  /** Decision that opened the position. */
  decisionId?: string;
}

export interface PortfolioState {
  cash: number;
  positions: Position[];
  realizedPnl: number;
  monthStartEquity: number;
  peakEquity: number;
  /** Daily equity closes for the trailing 30 days (simulated). */
  equityHistory: number[];
}

export type RiskStatus = "LOW" | "MODERATE" | "ELEVATED";

export interface RiskMetric {
  key: "exposure" | "correlation" | "drawdown" | "volatility" | "leverage" | "liquidity";
  label: string;
  /** Normalised 0–1 for the meter. */
  level: number;
  /** Normalised 0–1 policy limit marker, if any. */
  limit?: number;
  display: string;
  context: string;
  /** Higher is better (liquidity), rather than higher is riskier. */
  inverted?: boolean;
}

export interface RiskState {
  status: RiskStatus;
  metrics: RiskMetric[];
  sectorExposure: { assetClass: AssetClass; pct: number }[];
}

// ── Decisions ────────────────────────────────────────────────

export type StepStatus = "pass" | "fail" | "neutral";

export interface DecisionStep {
  label: string;
  value: string;
  status: StepStatus;
  detail: string;
  metrics?: Evidence[];
}

export type DecisionOutcome = "TRADE" | "REJECT" | "PURSUE" | "PASS" | "AWAITING_APPROVAL";

export interface Decision {
  id: string;
  at: SimTime;
  domain: "MARKETS" | "BUSINESS";
  subject: string;
  outcome: DecisionOutcome;
  headline: string;
  chain: DecisionStep[];
  factors: string[];
  confidence: number;
  invalidation: string;
  assumptions: string[];
  symbol?: MarketSymbol;
  opportunityId?: string;
  tradeSetupId?: string;
}

// ── Trading ──────────────────────────────────────────────────

export type Trend = "Bullish" | "Bearish" | "Range";

export interface TradeSetup {
  id: string;
  symbol: MarketSymbol;
  side: "LONG" | "SHORT";
  trend: Trend;
  signal: string;
  entry: number;
  stop: number;
  target: number;
  quantity: number;
  /** Probability of reaching target before stop, 0–1. */
  winProbability: number;
  confidence: number;
  decisionId: string;
}

export interface SimulationResult {
  paths: number;
  winRate: number;
  expectedR: number;
  /** Histogram of R outcomes. */
  buckets: { r: number; count: number }[];
  worstR: number;
}

// ── Approval ─────────────────────────────────────────────────

export interface ApprovalRequest {
  id: string;
  at: SimTime;
  title: string;
  reason: string;
  setupId: string;
  decisionId: string;
}

// ── Opportunities ────────────────────────────────────────────

export type OpportunityStatus =
  | "Discovered"
  | "Researching"
  | "Qualified"
  | "Proposal drafted"
  | "Passed";

export type CompetitionLevel = "Low" | "Moderate" | "High";

export type OpportunityCategory =
  | "B2B automation"
  | "Freelance"
  | "Software"
  | "Digital product"
  | "Bounty"
  | "Market inefficiency";

export interface Opportunity {
  id: string;
  title: string;
  category: OpportunityCategory;
  source: string;
  discoveredAt: SimTime;
  potentialValue: number;
  effortHours: number;
  probability: number;
  competition: CompetitionLevel;
  status: OpportunityStatus;
  whyFound: string;
  evidence: Evidence[];
  competitionNote: string;
  pricing: string;
  customer: string;
  risks: string[];
  nextAction: string;
}

// ── Events ───────────────────────────────────────────────────

export interface EventMap {
  AGENT_STATE_CHANGED: AgentStatus;
  ACTIVITY_LOGGED: ActivityEvent;
  MARKET_UPDATED: { quotes: Quote[]; at: SimTime };
  OPPORTUNITY_FOUND: Opportunity;
  OPPORTUNITY_UPDATED: { id: string; patch: Partial<Opportunity> };
  DECISION_CREATED: Decision;
  DECISION_RESOLVED: { id: string; outcome: DecisionOutcome };
  RISK_WARNING: { message: string; at: SimTime };
  APPROVAL_REQUIRED: { request: ApprovalRequest; setup: TradeSetup };
  APPROVAL_RESOLVED: { id: string; resolution: "APPROVED" | "REJECTED" | "EXPIRED" };
  TRADE_EXECUTED: { position: Position; cost: number };
  TRADE_CLOSED: { positionId: string; exitPrice: number; pnl: number };
  BUSINESS_TASK_COMPLETED: { opportunityId: string; task: string };
  CLOCK_TICK: { at: SimTime };
  ENGINE_STATE: { running: boolean };
}

export type EventType = keyof EventMap;
