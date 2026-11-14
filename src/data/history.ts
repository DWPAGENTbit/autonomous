import type { ActivityEvent, Decision } from "@/types/domain";

const t = (h: number, m: number, s = 0) => h * 3600 + m * 60 + s;

/**
 * Decisions made earlier in the session — the agent's record of reasoning.
 * Factors are concise and inspectable; no hidden chain-of-thought.
 */
export const SEED_DECISIONS: readonly Decision[] = [
  {
    id: "dec-sol-reject",
    at: t(9, 4),
    domain: "MARKETS",
    subject: "SOL / USDT",
    outcome: "REJECT",
    headline: "Rejected: expected value is below the policy minimum.",
    chain: [
      {
        label: "Opportunity",
        value: "SOL / USDT",
        status: "neutral",
        detail: "Breakout above a 20-day range on rising volume.",
        metrics: [{ label: "Range high", value: "$148.20" }],
      },
      {
        label: "Market regime",
        value: "Risk-on",
        status: "pass",
        detail: "Crypto breadth is positive; 4 of 5 majors trade above trend.",
      },
      {
        label: "Signal",
        value: "Breakout",
        status: "pass",
        detail: "Close above range high with volume 1.3× the 20-day average.",
        metrics: [{ label: "Volume ratio", value: "1.3×" }],
      },
      {
        label: "Expected value",
        value: "+0.5R",
        status: "fail",
        detail:
          "Breakouts on volume below 1.5× returned only +0.5R across 41 historical setups. Policy minimum is +0.8R.",
        metrics: [
          { label: "Sample", value: "41 setups" },
          { label: "Policy minimum", value: "+0.8R" },
        ],
      },
      {
        label: "Portfolio risk",
        value: "Not evaluated",
        status: "neutral",
        detail: "Skipped: the setup failed an earlier gate.",
      },
      {
        label: "Decision",
        value: "Reject",
        status: "fail",
        detail: "Weak volume confirmation makes the edge too thin to trade.",
      },
    ],
    factors: [
      "Regime and breakout signal were both acceptable.",
      "Volume confirmation (1.3×) was below the 1.5× level where this signal has worked.",
      "Expected value of +0.5R is under the +0.8R policy minimum.",
    ],
    confidence: 0.77,
    invalidation: "Re-evaluate if volume exceeds 1.5× the 20-day average on a close above $148.20.",
    assumptions: ["Expected value from 41 comparable breakouts over two years."],
  },
  {
    id: "dec-doc-pursue",
    at: t(9, 18),
    domain: "BUSINESS",
    subject: "AI document automation",
    outcome: "PURSUE",
    headline: "Pursue: strong capability fit with a repeat buyer.",
    opportunityId: "opp-doc-automation",
    chain: [
      {
        label: "Opportunity",
        value: "Document automation",
        status: "neutral",
        detail: "Invoice and bill-of-lading extraction for a freight broker.",
      },
      {
        label: "Demand",
        value: "Verified",
        status: "pass",
        detail: "Client has hired 31 times; budget stated in listing.",
      },
      {
        label: "Capability fit",
        value: "4 of 5",
        status: "pass",
        detail: "Existing pipeline covers extraction, validation, export and review queue.",
      },
      {
        label: "Expected value",
        value: "$286",
        status: "pass",
        detail: "$420 × 68% probability of award.",
        metrics: [
          { label: "Value", value: "$420" },
          { label: "Probability", value: "68%" },
        ],
      },
      {
        label: "Effort",
        value: "5.5 hours",
        status: "pass",
        detail: "Effective rate ~$52/hour on expected value.",
      },
      {
        label: "Decision",
        value: "Pursue",
        status: "pass",
        detail: "Draft proposal with a demo on the client's sample.",
      },
    ],
    factors: [
      "Repeat buyer with $48k of verified spend.",
      "Existing pipeline already covers 4 of 5 requirements.",
      "Expected value of $286 for 5.5 hours clears the $40/hour floor.",
    ],
    confidence: 0.68,
    invalidation: "Drop if the client requires direct TMS API integration within the fixed price.",
    assumptions: ["Award probability based on 14 comparable jobs in 90 days."],
  },
];

/** Proof of work: everything the agent did this morning, in order. */
export const SEED_ACTIVITY: readonly ActivityEvent[] = [
  { id: "a-01", at: t(8, 42, 4), kind: "SCANNING", message: "Morning market scan started across 1,284 instruments." },
  { id: "a-02", at: t(8, 44, 31), kind: "FILTERING", message: "38 instruments passed liquidity and spread requirements." },
  {
    id: "a-03",
    at: t(8, 47, 12),
    kind: "SEARCH",
    message: "Discovered document automation listing on Upwork.",
    opportunityId: "opp-doc-automation",
    evidence: [{ label: "Client spend", value: "$48k", source: "Upwork" }],
  },
  { id: "a-04", at: t(8, 51, 40), kind: "SIMULATION", message: "Backtest complete: breakout strategy, 90 days, 62 setups, +1.4R mean." },
  {
    id: "a-05",
    at: t(8, 55, 2),
    kind: "SEARCH",
    message: "Search interest for onboarding templates up 34% over 90 days.",
    opportunityId: "opp-notion-templates",
  },
  { id: "a-06", at: t(9, 1, 18), kind: "RISK", message: "Risk check: SOL / USDT expected value +0.5R, below the +0.8R minimum.", decisionId: "dec-sol-reject" },
  {
    id: "a-07",
    at: t(9, 4, 6),
    kind: "DECISION",
    message: "SOL / USDT rejected — expected value below policy minimum.",
    decisionId: "dec-sol-reject",
  },
  {
    id: "a-08",
    at: t(9, 12, 44),
    kind: "BUSINESS",
    message: "Direct invite received: Shopify margin reporting.",
    opportunityId: "opp-shopify-reporting",
  },
  { id: "a-09", at: t(9, 16, 20), kind: "RESEARCH", message: "Customer research: freight broker hiring history and reviews.", opportunityId: "opp-doc-automation" },
  {
    id: "a-10",
    at: t(9, 18, 2),
    kind: "DECISION",
    message: "Pursue document automation — expected value $286.",
    decisionId: "dec-doc-pursue",
  },
  {
    id: "a-11",
    at: t(9, 19, 37),
    kind: "SEARCH",
    message: "Found public bounty: CSV streaming parser fix ($150).",
    opportunityId: "opp-api-bounty",
  },
  { id: "a-12", at: t(9, 23, 9), kind: "BUSINESS", message: "Proposal drafted for document automation.", opportunityId: "opp-doc-automation" },
  {
    id: "a-13",
    at: t(9, 26, 51),
    kind: "ANALYSIS",
    message: "ETH funding-rate divergence detected across venues.",
    opportunityId: "opp-funding-spread",
  },
  {
    id: "a-14",
    at: t(9, 29, 15),
    kind: "RISK",
    message: "Funding spread passed: two-venue counterparty risk outside policy.",
    opportunityId: "opp-funding-spread",
  },
  { id: "a-15", at: t(9, 34, 40), kind: "MONITOR", message: "Positions reviewed. All stops intact; no adjustments needed." },
  { id: "a-16", at: t(9, 38, 22), kind: "RESEARCH", message: "Comparing historical volatility across major crypto pairs." },
];
