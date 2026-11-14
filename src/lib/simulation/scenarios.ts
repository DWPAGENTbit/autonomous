import { DISCOVERABLE_OPPORTUNITIES } from "@/data/opportunities";
import { INSTRUMENTS } from "@/data/instruments";
import { STRATEGY, type StrategyProfile } from "@/data/strategy";
import { correlationBetween, deriveRegime, instrumentStats } from "@/lib/analytics/markets";
import { simulateTrade } from "@/lib/analytics/monte-carlo";
import { computeCapital } from "@/lib/analytics/portfolio";
import { proposeSetup } from "@/lib/analytics/setup";
import type { EventBus } from "@/lib/events/bus";
import {
  formatNumber,
  formatPct,
  formatPrice,
  formatR,
  formatSignedPct,
  formatSignedUsd,
  formatUsd,
} from "@/lib/formatting/format";
import { expectedValueR, setupImpact } from "@/lib/risk/risk";
import type { AppState } from "@/lib/simulation/initial-state";
import type { MarketModel } from "@/lib/simulation/market";
import type { Rng } from "@/lib/simulation/prng";
import type {
  ActivityEvent,
  ActivityKind,
  AgentState,
  Decision,
  DecisionStep,
  MarketSymbol,
  Opportunity,
  SimTime,
  TradeSetup,
} from "@/types/domain";

export interface StepContext {
  now(): SimTime;
  market: MarketModel;
  rng: Rng;
  read(): AppState;
  emit: EventBus["emit"];
  nextId(prefix: string): string;
  log(kind: ActivityKind, message: string, extra?: Partial<Omit<ActivityEvent, "id" | "at" | "kind" | "message">>): void;
}

export interface Step {
  state: AgentState;
  task: string;
  durationMs: number;
  /** Runs when the step finishes. May return follow-up steps to run next. */
  complete?: (ctx: StepContext) => Step[] | void;
}

/** Hourly expected-value floor for business work. */
const EV_PER_HOUR_FLOOR = 40;
const MIN_CASH_SHARE = 0.05;

// ── Markets ──────────────────────────────────────────────────

export function marketScan(ctx: StepContext): Step[] {
  const universe = 1284 + Math.floor(ctx.rng.range(-14, 22));
  const passed = 22 + Math.floor(ctx.rng.range(0, 9));
  return [
    {
      state: "OBSERVING",
      task: "Observing market conditions",
      durationMs: 3400,
      complete: (c) => c.log("SCANNING", `Analyzing ${formatNumber(universe, 0)} market instruments.`),
    },
    {
      state: "ANALYZING",
      task: "Filtering instruments by liquidity and spread",
      durationMs: 3000,
      complete: (c) =>
        c.log("FILTERING", `${passed} opportunities passed liquidity requirements.`, {
          evidence: [
            { label: "Minimum 24h volume", value: "$50M" },
            { label: "Maximum spread", value: "0.05%" },
            { label: "Passed", value: `${passed} of ${formatNumber(universe, 0)}` },
          ],
        }),
    },
    {
      state: "RESEARCHING",
      task: "Comparing historical volatility across candidates",
      durationMs: 3800,
      complete: (c) => {
        const r = deriveRegime(c.market);
        c.log(
          "RESEARCH",
          `Regime: ${r.trend.toLowerCase()} trend, ${r.volatility.toLowerCase()} volatility, ${r.riskAppetite.toLowerCase()} risk appetite.`,
          {
            detail: r.summary,
            evidence: [
              { label: "Risk appetite", value: r.riskAppetite },
              { label: "Volatility", value: r.volatility },
              { label: "Liquidity", value: r.liquidity },
              { label: "Trend", value: r.trend },
            ],
          },
        );
      },
    },
  ];
}

export function tradeCandidate(ctx: StepContext, symbol: MarketSymbol): Step[] {
  const cand = { symbol, ...STRATEGY[symbol] };
  const inst = INSTRUMENTS[cand.symbol];
  const state = ctx.read();
  const alreadyPending = state.approvals.some((a) => state.setups[a.setupId]?.symbol === cand.symbol);
  if (alreadyPending) return monitorPositions(ctx);

  const capital0 = computeCapital(state.portfolio, state.quotes);
  if (capital0.available < capital0.total * MIN_CASH_SHARE) {
    return [
      {
        state: "DECIDING",
        task: `Checking available capital for ${inst.pair}`,
        durationMs: 2600,
        complete: (c) =>
          c.log("RISK", `${inst.pair} deferred: available capital is below the ${MIN_CASH_SHARE * 100}% reserve.`),
      },
    ];
  }

  // Values computed during the scenario, shared between steps.
  let setup: TradeSetup | null = null;
  let worst = { symbol: cand.symbol as MarketSymbol, corr: 0 };

  return [
    {
      state: "ANALYZING",
      task: `Evaluating ${inst.pair} — ${cand.signal.toLowerCase()}`,
      durationMs: 3600,
      complete: (c) => {
        const wk = instrumentStats(c.market, cand.symbol, "1W");
        c.log(
          "ANALYSIS",
          `${inst.pair} ${cand.signal.toLowerCase()} signal confirmed: 1W ${formatSignedPct(wk.returnPct)}, volatility ${formatPct(wk.volatilityPct, 1)}.`,
          {
            symbol: cand.symbol,
            detail: cand.thesis,
            evidence: [
              { label: "Price", value: formatUsd(c.market.quote(cand.symbol).price) },
              { label: "1W return", value: formatSignedPct(wk.returnPct) },
              { label: "Realised volatility", value: formatPct(wk.volatilityPct, 1) },
            ],
          },
        );
      },
    },
    {
      state: "SIMULATING",
      task: `Simulating 500 outcome paths for ${inst.pair}`,
      durationMs: 4200,
      complete: (c) => {
        const s = c.read();
        const cap = computeCapital(s.portfolio, s.quotes);
        setup = proposeSetup({ id: c.nextId("setup"), symbol: cand.symbol, market: c.market, equity: cap.total, cash: cap.available });
        const sim = simulateTrade(setup);
        c.log(
          "SIMULATION",
          `Simulation complete for ${inst.pair}: ${Math.round(sim.winRate * 100)}% win rate, expected ${formatR(sim.expectedR)}.`,
          {
            symbol: cand.symbol,
            evidence: [
              { label: "Paths", value: String(sim.paths) },
              { label: "Win rate", value: `${Math.round(sim.winRate * 100)}%` },
              { label: "Expected", value: formatR(sim.expectedR) },
              { label: "Worst path", value: formatR(sim.worstR) },
            ],
          },
        );
      },
    },
    {
      state: "DECIDING",
      task: `Checking ${inst.pair} against portfolio risk`,
      durationMs: 3200,
      complete: (c) => {
        const s = c.read();
        const cap = computeCapital(s.portfolio, s.quotes);
        worst = cap.positions
          .map((p) => ({ symbol: p.symbol, corr: correlationBetween(c.market, cand.symbol, p.symbol) }))
          .reduce((a, b) => (b.corr > a.corr ? b : a), { symbol: cand.symbol, corr: 0 });
        const limit = s.policy.maxCorrelation;
        const name = INSTRUMENTS[worst.symbol].name;
        c.log(
          "RISK",
          worst.corr > limit
            ? `Position rejected because portfolio correlation is too high (${worst.corr.toFixed(2)} with ${name}).`
            : `Risk acceptable: highest correlation ${worst.corr.toFixed(2)} with ${name}, below the ${limit.toFixed(2)} limit.`,
          { symbol: cand.symbol },
        );
      },
    },
    {
      state: "DECIDING",
      task: `Recording decision for ${inst.pair}`,
      durationMs: 1800,
      complete: (c) => (setup ? recordTradeDecision(c, cand, setup, worst) : undefined),
    },
  ];
}

function recordTradeDecision(
  ctx: StepContext,
  cand: StrategyProfile & { symbol: MarketSymbol },
  baseSetup: TradeSetup,
  worst: { symbol: MarketSymbol; corr: number },
): Step[] | void {
  const inst = INSTRUMENTS[cand.symbol];
  const s = ctx.read();
  const policy = s.policy;
  const cap = computeCapital(s.portfolio, s.quotes);
  const decisionId = ctx.nextId("dec");
  const setup: TradeSetup = { ...baseSetup, decisionId };
  const impact = setupImpact(ctx.market, cap, setup);
  const ev = expectedValueR(setup);
  const regime = deriveRegime(ctx.market);
  const wk = instrumentStats(ctx.market, cand.symbol, "1W");

  const corrFail = worst.corr > policy.maxCorrelation;
  const evFail = ev < policy.minExpectedValueR;
  const sizeBreach = impact.positionPctOfEquity > policy.maxPositionPctOfEquity;
  const exposureBreach = impact.exposureAfterPct > policy.maxPortfolioExposurePct;
  const oversized = sizeBreach || exposureBreach;
  const regimeFail = regime.trend === "Negative";
  const rejected = corrFail || evFail || regimeFail;
  const outcome = rejected ? "REJECT" : oversized ? "AWAITING_APPROVAL" : "TRADE";
  const worstName = INSTRUMENTS[worst.symbol].name;

  const chain: DecisionStep[] = [
    {
      label: "Opportunity",
      value: inst.pair,
      status: "neutral",
      detail: cand.thesis,
      metrics: [{ label: "Price", value: formatUsd(ctx.market.quote(cand.symbol).price) }],
    },
    {
      label: "Market regime",
      value: setup.trend,
      status: regime.trend === "Negative" ? "fail" : "pass",
      detail: regime.summary,
      metrics: [
        { label: "Risk appetite", value: regime.riskAppetite },
        { label: "Volatility", value: regime.volatility },
      ],
    },
    {
      label: "Signal",
      value: cand.signal,
      status: "pass",
      detail: `1W return ${formatSignedPct(wk.returnPct)} with ${formatPct(wk.volatilityPct, 1)} realised volatility.`,
      metrics: [{ label: "1W return", value: formatSignedPct(wk.returnPct) }],
    },
    {
      label: "Expected value",
      value: formatR(ev),
      status: evFail ? "fail" : "pass",
      detail: `${Math.round(setup.winProbability * 100)}% win probability at ${impact.rewardR.toFixed(1)}R reward. Policy minimum is ${formatR(policy.minExpectedValueR)}.`,
      metrics: [
        { label: "Win probability", value: `${Math.round(setup.winProbability * 100)}%` },
        { label: "Reward", value: `${impact.rewardR.toFixed(1)}R` },
      ],
    },
    {
      label: "Portfolio risk",
      value: corrFail ? `Correlation ${worst.corr.toFixed(2)}` : "Acceptable",
      status: corrFail ? "fail" : "pass",
      detail: corrFail
        ? `${inst.name} correlates ${worst.corr.toFixed(2)} with the existing ${worstName} position. Policy limit is ${policy.maxCorrelation.toFixed(2)}.`
        : `Highest correlation with the book is ${worst.corr.toFixed(2)} (${worstName}). Maximum loss is ${formatPct(impact.maxLossPctOfEquity)} of equity.${
          exposureBreach ? ` Exposure would reach ${impact.exposureAfterPct.toFixed(0)}% — see position size.` : ""
        }`,
      metrics: [
        { label: "Correlation", value: worst.corr.toFixed(2) },
        { label: "Max loss", value: formatUsd(impact.maxLoss) },
      ],
    },
  ];
  if (!rejected && oversized) {
    chain.push({
      label: "Position size",
      value: `${impact.positionPctOfEquity.toFixed(0)}% of equity`,
      status: "neutral",
      detail: [
        sizeBreach ? `Above the ${policy.maxPositionPctOfEquity}% size the agent may take on its own.` : "",
        exposureBreach
          ? `Exposure would rise from ${impact.exposureBeforePct.toFixed(0)}% to ${impact.exposureAfterPct.toFixed(0)}%, above the ${policy.maxPortfolioExposurePct}% policy.`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    });
  }
  chain.push({
    label: "Decision",
    value: rejected ? "Reject" : oversized ? "Ask for approval" : "Trade",
    status: rejected ? "fail" : "pass",
    detail: rejected
      ? corrFail
        ? "Adds concentrated exposure rather than a new source of return."
        : regimeFail
          ? "Long setups are not taken while the broad trend is negative."
          : "Edge is too thin to justify the risk."
      : oversized
        ? "Criteria met, but size exceeds the autonomous limit."
        : "All gates passed within autonomous limits.",
  });

  const factors = [
    `${cand.signal} is above its historical threshold (1W ${formatSignedPct(wk.returnPct)}).`,
    `Volatility (${formatPct(wk.volatilityPct, 1)}) remains within strategy limits.`,
    evFail
      ? `Expected value ${formatR(ev)} is below the ${formatR(policy.minExpectedValueR)} minimum.`
      : `Expected value ${formatR(ev)} exceeds the ${formatR(policy.minExpectedValueR)} minimum.`,
    corrFail
      ? `Correlation with ${worstName} (${worst.corr.toFixed(2)}) exceeds the ${policy.maxCorrelation.toFixed(2)} limit.`
      : `Portfolio correlation remains acceptable (${worst.corr.toFixed(2)}).`,
    `Maximum loss ${formatUsd(impact.maxLoss)} (${formatPct(impact.maxLossPctOfEquity)} of equity) is within the ${policy.maxRiskPerTradePct}% risk policy.`,
  ];
  if (!rejected && oversized) {
    factors.push(
      `Size (${impact.positionPctOfEquity.toFixed(0)}% of equity${exposureBreach ? `, exposure to ${impact.exposureAfterPct.toFixed(0)}%` : ""}) is outside autonomous limits, so the agent asks first.`,
    );
  }

  const decision: Decision = {
    id: decisionId,
    at: ctx.now(),
    domain: "MARKETS",
    subject: inst.pair,
    outcome,
    headline: rejected
      ? corrFail
        ? `Rejected: correlation with ${worstName} is too high.`
        : regimeFail
          ? "Rejected: market regime does not support new longs."
          : "Rejected: expected value below policy minimum."
      : oversized
        ? `${inst.pair} meets strategy criteria — size needs your approval.`
        : `${inst.pair} meets strategy criteria — executing within limits.`,
    chain,
    factors,
    confidence: setup.confidence,
    invalidation: `Invalid if ${inst.pair} trades below ${formatPrice(setup.stop, inst.decimals)} or momentum reverses on the 4-hour close.`,
    assumptions: [
      "Win probability from 500 simulated paths and two years of comparable setups.",
      "Fills assume the current spread. No leverage.",
    ],
    symbol: cand.symbol,
    tradeSetupId: setup.id,
  };

  ctx.emit("DECISION_CREATED", decision);
  ctx.log(
    "DECISION",
    rejected
      ? `${inst.pair} rejected — ${corrFail ? "portfolio correlation too high" : regimeFail ? "regime does not support longs" : "expected value too low"}.`
      : `${inst.pair} meets current strategy criteria.`,
    { decisionId, symbol: cand.symbol },
  );

  if (rejected) return;

  if (oversized) {
    ctx.emit("APPROVAL_REQUIRED", {
      request: {
        id: ctx.nextId("apr"),
        at: ctx.now(),
        title: "Potential trade exceeds normal position size.",
        reason:
          `The ${inst.pair} position would be ${impact.positionPctOfEquity.toFixed(0)}% of equity; the agent may take up to ${policy.maxPositionPctOfEquity}% on its own.` +
          (exposureBreach
            ? ` It would also lift portfolio exposure to ${impact.exposureAfterPct.toFixed(0)}%, above the ${policy.maxPortfolioExposurePct}% policy.`
            : ""),
        setupId: setup.id,
        decisionId,
      },
      setup,
    });
    ctx.log("APPROVAL", `Approval requested: ${inst.pair} position exceeds normal size.`, { decisionId, symbol: cand.symbol });
    return [
      {
        state: "WAITING_FOR_APPROVAL",
        task: `Waiting for your decision on ${inst.pair}`,
        durationMs: 3200,
      },
    ];
  }

  return [executionStep(setup, "within policy limits")];
}

/** Fills a setup at the current price and records the position. */
export function executionStep(setup: TradeSetup, note: string, quantity = setup.quantity): Step {
  const inst = INSTRUMENTS[setup.symbol];
  return {
    state: "EXECUTING",
    task: `Executing ${inst.pair} order ${note}`,
    durationMs: 2400,
    complete: (c) => {
      const fill = c.market.quote(setup.symbol).price;
      const cost = quantity * fill;
      if (cost > c.read().portfolio.cash) {
        c.log("RISK", `${inst.pair} order cancelled: insufficient available capital.`, { symbol: setup.symbol });
        return;
      }
      c.emit("TRADE_EXECUTED", {
        position: {
          id: c.nextId("pos"),
          symbol: setup.symbol,
          quantity,
          entryPrice: fill,
          stopPrice: setup.stop,
          targetPrice: setup.target,
          openedAt: c.now(),
          decisionId: setup.decisionId,
        },
        cost,
      });
      c.log(
        "EXECUTION",
        `Bought ${formatNumber(quantity, quantity < 0.1 ? 4 : 2)} ${setup.symbol} at ${formatUsd(fill)}. Stop ${formatPrice(setup.stop, inst.decimals)}.`,
        {
          decisionId: setup.decisionId,
          symbol: setup.symbol,
          evidence: [
            { label: "Fill", value: formatUsd(fill) },
            { label: "Cost", value: formatUsd(cost) },
            { label: "Target", value: formatUsd(setup.target) },
          ],
        },
      );
    },
  };
}

// ── Portfolio ────────────────────────────────────────────────

export function monitorPositions(ctx: StepContext): Step[] {
  const n = ctx.read().portfolio.positions.length;
  return [
    {
      state: "MONITORING",
      task: `Monitoring ${n} open position${n === 1 ? "" : "s"}`,
      durationMs: 4400,
      complete: (c) => {
        const s = c.read();
        const cap = computeCapital(s.portfolio, s.quotes);
        const exposure = (cap.deployed / cap.total) * 100;
        c.log(
          "MONITOR",
          `${cap.positions.length} positions reviewed. Unrealized ${formatSignedUsd(cap.unrealized)}. All stops intact.`,
          {
            evidence: cap.positions.map((p) => ({
              label: INSTRUMENTS[p.symbol].pair,
              value: `${formatSignedUsd(p.unrealized)} · stop ${formatPrice(p.stopPrice, INSTRUMENTS[p.symbol].decimals)}`,
            })),
          },
        );
        const warnAt = s.policy.maxPortfolioExposurePct * 0.85;
        if (exposure > warnAt) {
          const message = `Exposure ${exposure.toFixed(0)}% is approaching the ${s.policy.maxPortfolioExposurePct}% policy limit.`;
          c.emit("RISK_WARNING", { message, at: c.now() });
          c.log("RISK", message);
        }
      },
    },
  ];
}

// ── Business ─────────────────────────────────────────────────

const evOf = (o: Pick<Opportunity, "potentialValue" | "probability">) => o.potentialValue * o.probability;

function businessDecision(ctx: StepContext, opp: Opportunity): void {
  const ev = evOf(opp);
  const perHour = ev / opp.effortHours;
  const pursue = perHour >= EV_PER_HOUR_FLOOR;
  const id = ctx.nextId("dec");
  const decision: Decision = {
    id,
    at: ctx.now(),
    domain: "BUSINESS",
    subject: opp.title,
    outcome: pursue ? "PURSUE" : "PASS",
    headline: pursue
      ? `Pursue: ${formatUsd(ev, { whole: true })} expected for ${opp.effortHours} hours.`
      : `Pass: expected ${formatUsd(perHour, { whole: true })}/hour is below the floor.`,
    opportunityId: opp.id,
    chain: [
      { label: "Opportunity", value: opp.category, status: "neutral", detail: opp.whyFound },
      { label: "Demand", value: "Verified", status: "pass", detail: opp.evidence[0] ? `${opp.evidence[0].label}: ${opp.evidence[0].value}.` : "Demand signal confirmed." },
      { label: "Competition", value: opp.competition, status: opp.competition === "High" ? "fail" : "pass", detail: opp.competitionNote },
      {
        label: "Expected value",
        value: formatUsd(ev, { whole: true }),
        status: "neutral",
        detail: `${formatUsd(opp.potentialValue, { whole: true })} × ${Math.round(opp.probability * 100)}% probability.`,
      },
      {
        label: "Value per hour",
        value: `${formatUsd(perHour, { whole: true })}/h`,
        status: pursue ? "pass" : "fail",
        detail: `Floor is ${formatUsd(EV_PER_HOUR_FLOOR, { whole: true })}/hour of expected value.`,
      },
      { label: "Decision", value: pursue ? "Pursue" : "Pass", status: pursue ? "pass" : "fail", detail: opp.nextAction },
    ],
    factors: [
      opp.whyFound,
      `Expected value ${formatUsd(ev, { whole: true })} over ${opp.effortHours} hours (${formatUsd(perHour, { whole: true })}/hour).`,
      `Competition is ${opp.competition.toLowerCase()}: ${opp.competitionNote}`,
    ],
    confidence: Math.min(0.9, 0.45 + opp.probability * 0.5),
    invalidation: opp.risks[0] ? `Re-evaluate if: ${opp.risks[0].toLowerCase()}.` : "Re-evaluate if scope changes.",
    assumptions: [`Probability estimated from comparable ${opp.category.toLowerCase()} work.`],
  };
  ctx.emit("DECISION_CREATED", decision);
  ctx.emit("OPPORTUNITY_UPDATED", { id: opp.id, patch: { status: pursue ? "Qualified" : "Passed" } });
  ctx.log("DECISION", pursue ? `Pursue ${opp.title.toLowerCase()} — expected value ${formatUsd(ev, { whole: true })}.` : `Passed on ${opp.title.toLowerCase()}.`, {
    decisionId: id,
    opportunityId: opp.id,
  });
}

export function businessDiscovery(ctx: StepContext, poolIndex: number): Step[] {
  const template = DISCOVERABLE_OPPORTUNITIES[poolIndex];
  if (!template) return businessFollowUp(ctx);
  const leads = 9 + Math.floor(ctx.rng.range(0, 9));
  const cleared = 2 + Math.floor(ctx.rng.range(0, 3));
  let found: Opportunity | null = null;

  return [
    {
      state: "RESEARCHING",
      task: "Searching freelance marketplaces, B2B listings and bounties",
      durationMs: 4600,
      complete: (c) => c.log("SEARCH", `Found ${leads} potential B2B automation opportunities.`),
    },
    {
      state: "ANALYZING",
      task: `Scoring ${leads} leads by expected value per hour`,
      durationMs: 3600,
      complete: (c) =>
        c.log("FILTERING", `${cleared} leads cleared the ${formatUsd(EV_PER_HOUR_FLOOR, { whole: true })}/hour expected-value floor.`),
    },
    {
      state: "RESEARCHING",
      task: `Researching ${template.title.toLowerCase()}`,
      durationMs: 4200,
      complete: (c) => {
        found = { ...template, discoveredAt: c.now(), status: "Researching" };
        c.emit("OPPORTUNITY_FOUND", found);
        c.log("SEARCH", `New opportunity: ${template.title} — expected value ${formatUsd(evOf(template), { whole: true })}.`, {
          opportunityId: template.id,
          evidence: template.evidence,
        });
      },
    },
    {
      state: "DECIDING",
      task: `Deciding whether to pursue ${template.title.toLowerCase()}`,
      durationMs: 2600,
      complete: (c) => {
        if (found) businessDecision(c, found);
      },
    },
  ];
}

export function businessFollowUp(ctx: StepContext): Step[] {
  const opps = ctx.read().opportunities;
  const qualified = opps.find((o) => o.status === "Qualified");
  if (qualified) {
    return [
      {
        state: "EXECUTING",
        task: `Drafting proposal for ${qualified.title.toLowerCase()}`,
        durationMs: 4400,
        complete: (c) => {
          c.emit("OPPORTUNITY_UPDATED", { id: qualified.id, patch: { status: "Proposal drafted" } });
          c.emit("BUSINESS_TASK_COMPLETED", { opportunityId: qualified.id, task: "Proposal drafted" });
          c.log("BUSINESS", `Proposal drafted for ${qualified.title}.`, { opportunityId: qualified.id });
        },
      },
    ];
  }
  const researching = opps.find((o) => o.status === "Researching");
  if (researching) {
    return [
      {
        state: "RESEARCHING",
        task: `Customer research: ${researching.title.toLowerCase()}`,
        durationMs: 4000,
        complete: (c) => {
          const probability = Math.min(0.9, researching.probability + 0.04);
          c.emit("OPPORTUNITY_UPDATED", { id: researching.id, patch: { probability } });
          c.log("RESEARCH", `Customer research raised win probability for ${researching.title.toLowerCase()} to ${Math.round(probability * 100)}%.`, {
            opportunityId: researching.id,
          });
          businessDecision(c, { ...researching, probability });
        },
      },
    ];
  }
  return monitorPositions(ctx);
}

export function idle(): Step[] {
  return [{ state: "IDLE", task: "Idle — next research cycle scheduled", durationMs: 2600 }];
}
