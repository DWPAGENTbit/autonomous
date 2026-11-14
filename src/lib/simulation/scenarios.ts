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
      task: "Mengamati kondisi pasar",
      durationMs: 3400,
      complete: (c) => c.log("SCANNING", `Menganalisis ${formatNumber(universe, 0)} instrumen pasar.`),
    },
    {
      state: "ANALYZING",
      task: "Menyaring instrumen berdasarkan likuiditas dan spread",
      durationMs: 3000,
      complete: (c) =>
        c.log("FILTERING", `${passed} peluang lolos syarat likuiditas.`, {
          evidence: [
            { label: "Volume 24 jam minimum", value: "$50 jt" },
            { label: "Spread maksimum", value: "0,05%" },
            { label: "Lolos", value: `${passed} dari ${formatNumber(universe, 0)}` },
          ],
        }),
    },
    {
      state: "RESEARCHING",
      task: "Membandingkan volatilitas historis antar kandidat",
      durationMs: 3800,
      complete: (c) => {
        const r = deriveRegime(c.market);
        c.log(
          "RESEARCH",
          `Rezim: tren ${r.trend.toLowerCase()}, volatilitas ${r.volatility.toLowerCase()}, selera risiko ${r.riskAppetite.toLowerCase()}.`,
          {
            detail: r.summary,
            evidence: [
              { label: "Selera risiko", value: r.riskAppetite },
              { label: "Volatilitas", value: r.volatility },
              { label: "Likuiditas", value: r.liquidity },
              { label: "Tren", value: r.trend },
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
        task: `Memeriksa modal tersedia untuk ${inst.pair}`,
        durationMs: 2600,
        complete: (c) =>
          c.log("RISK", `${inst.pair} ditunda: modal tersedia di bawah cadangan ${MIN_CASH_SHARE * 100}%.`),
      },
    ];
  }

  // Values computed during the scenario, shared between steps.
  let setup: TradeSetup | null = null;
  let worst = { symbol: cand.symbol as MarketSymbol, corr: 0 };

  return [
    {
      state: "ANALYZING",
      task: `Mengevaluasi ${inst.pair} — ${cand.signal.toLowerCase()}`,
      durationMs: 3600,
      complete: (c) => {
        const wk = instrumentStats(c.market, cand.symbol, "1W");
        c.log(
          "ANALYSIS",
          `Sinyal ${cand.signal.toLowerCase()} ${inst.pair} terkonfirmasi: 1W ${formatSignedPct(wk.returnPct)}, volatilitas ${formatPct(wk.volatilityPct, 1)}.`,
          {
            symbol: cand.symbol,
            detail: cand.thesis,
            evidence: [
              { label: "Harga", value: formatUsd(c.market.quote(cand.symbol).price) },
              { label: "Return 1W", value: formatSignedPct(wk.returnPct) },
              { label: "Volatilitas terealisasi", value: formatPct(wk.volatilityPct, 1) },
            ],
          },
        );
      },
    },
    {
      state: "SIMULATING",
      task: `Menyimulasikan 500 jalur hasil untuk ${inst.pair}`,
      durationMs: 4200,
      complete: (c) => {
        const s = c.read();
        const cap = computeCapital(s.portfolio, s.quotes);
        setup = proposeSetup({ id: c.nextId("setup"), symbol: cand.symbol, market: c.market, equity: cap.total, cash: cap.available });
        const sim = simulateTrade(setup);
        c.log(
          "SIMULATION",
          `Simulasi ${inst.pair} selesai: tingkat menang ${Math.round(sim.winRate * 100)}%, ekspektasi ${formatR(sim.expectedR)}.`,
          {
            symbol: cand.symbol,
            evidence: [
              { label: "Jalur", value: String(sim.paths) },
              { label: "Tingkat menang", value: `${Math.round(sim.winRate * 100)}%` },
              { label: "Ekspektasi", value: formatR(sim.expectedR) },
              { label: "Jalur terburuk", value: formatR(sim.worstR) },
            ],
          },
        );
      },
    },
    {
      state: "DECIDING",
      task: `Memeriksa ${inst.pair} terhadap risiko portofolio`,
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
            ? `Posisi ditolak karena korelasi portofolio terlalu tinggi (${worst.corr.toFixed(2)} dengan ${name}).`
            : `Risiko dapat diterima: korelasi tertinggi ${worst.corr.toFixed(2)} dengan ${name}, di bawah batas ${limit.toFixed(2)}.`,
          { symbol: cand.symbol },
        );
      },
    },
    {
      state: "DECIDING",
      task: `Mencatat keputusan untuk ${inst.pair}`,
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
  const regimeFail = regime.trend === "Negatif";
  const rejected = corrFail || evFail || regimeFail;
  const outcome = rejected ? "REJECT" : oversized ? "AWAITING_APPROVAL" : "TRADE";
  const worstName = INSTRUMENTS[worst.symbol].name;

  const chain: DecisionStep[] = [
    {
      label: "Peluang",
      value: inst.pair,
      status: "neutral",
      detail: cand.thesis,
      metrics: [{ label: "Harga", value: formatUsd(ctx.market.quote(cand.symbol).price) }],
    },
    {
      label: "Rezim pasar",
      value: setup.trend,
      status: regime.trend === "Negatif" ? "fail" : "pass",
      detail: regime.summary,
      metrics: [
        { label: "Selera risiko", value: regime.riskAppetite },
        { label: "Volatilitas", value: regime.volatility },
      ],
    },
    {
      label: "Sinyal",
      value: cand.signal,
      status: "pass",
      detail: `Return 1W ${formatSignedPct(wk.returnPct)} dengan volatilitas terealisasi ${formatPct(wk.volatilityPct, 1)}.`,
      metrics: [{ label: "Return 1W", value: formatSignedPct(wk.returnPct) }],
    },
    {
      label: "Nilai harapan",
      value: formatR(ev),
      status: evFail ? "fail" : "pass",
      detail: `Probabilitas menang ${Math.round(setup.winProbability * 100)}% dengan imbal hasil ${impact.rewardR.toFixed(1)}R. Minimum kebijakan ${formatR(policy.minExpectedValueR)}.`,
      metrics: [
        { label: "Probabilitas menang", value: `${Math.round(setup.winProbability * 100)}%` },
        { label: "Imbal hasil", value: `${impact.rewardR.toFixed(1)}R` },
      ],
    },
    {
      label: "Risiko portofolio",
      value: corrFail ? `Korelasi ${worst.corr.toFixed(2)}` : "Dapat diterima",
      status: corrFail ? "fail" : "pass",
      detail: corrFail
        ? `${inst.name} berkorelasi ${worst.corr.toFixed(2)} dengan posisi ${worstName} yang sudah ada. Batas kebijakan ${policy.maxCorrelation.toFixed(2)}.`
        : `Korelasi tertinggi dengan portofolio ${worst.corr.toFixed(2)} (${worstName}). Kerugian maksimum ${formatPct(impact.maxLossPctOfEquity)} dari ekuitas.${
          exposureBreach ? ` Eksposur akan mencapai ${impact.exposureAfterPct.toFixed(0)}% — lihat ukuran posisi.` : ""
        }`,
      metrics: [
        { label: "Korelasi", value: worst.corr.toFixed(2) },
        { label: "Rugi maks.", value: formatUsd(impact.maxLoss) },
      ],
    },
  ];
  if (!rejected && oversized) {
    chain.push({
      label: "Ukuran posisi",
      value: `${impact.positionPctOfEquity.toFixed(0)}% dari ekuitas`,
      status: "neutral",
      detail: [
        sizeBreach ? `Di atas ukuran ${policy.maxPositionPctOfEquity}% yang boleh diambil agen sendiri.` : "",
        exposureBreach
          ? `Eksposur akan naik dari ${impact.exposureBeforePct.toFixed(0)}% ke ${impact.exposureAfterPct.toFixed(0)}%, di atas kebijakan ${policy.maxPortfolioExposurePct}%.`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    });
  }
  chain.push({
    label: "Keputusan",
    value: rejected ? "Tolak" : oversized ? "Minta persetujuan" : "Transaksi",
    status: rejected ? "fail" : "pass",
    detail: rejected
      ? corrFail
        ? "Menambah eksposur terkonsentrasi, bukan sumber imbal hasil baru."
        : regimeFail
          ? "Posisi beli tidak diambil selama tren umum negatif."
          : "Keunggulannya terlalu tipis untuk sepadan dengan risikonya."
      : oversized
        ? "Kriteria terpenuhi, tetapi ukurannya melebihi batas otonom."
        : "Semua syarat lolos dalam batas otonom.",
  });

  const factors = [
    `${cand.signal} berada di atas ambang historisnya (1W ${formatSignedPct(wk.returnPct)}).`,
    `Volatilitas (${formatPct(wk.volatilityPct, 1)}) masih dalam batas strategi.`,
    evFail
      ? `Nilai harapan ${formatR(ev)} di bawah minimum ${formatR(policy.minExpectedValueR)}.`
      : `Nilai harapan ${formatR(ev)} melampaui minimum ${formatR(policy.minExpectedValueR)}.`,
    corrFail
      ? `Korelasi dengan ${worstName} (${worst.corr.toFixed(2)}) melampaui batas ${policy.maxCorrelation.toFixed(2)}.`
      : `Korelasi portofolio masih dapat diterima (${worst.corr.toFixed(2)}).`,
    `Kerugian maksimum ${formatUsd(impact.maxLoss)} (${formatPct(impact.maxLossPctOfEquity)} dari ekuitas) masih dalam kebijakan risiko ${policy.maxRiskPerTradePct}%.`,
  ];
  if (!rejected && oversized) {
    factors.push(
      `Ukuran (${impact.positionPctOfEquity.toFixed(0)}% dari ekuitas${exposureBreach ? `, eksposur menjadi ${impact.exposureAfterPct.toFixed(0)}%` : ""}) di luar batas otonom, jadi agen bertanya dulu.`,
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
        ? `Ditolak: korelasi dengan ${worstName} terlalu tinggi.`
        : regimeFail
          ? "Ditolak: rezim pasar tidak mendukung posisi beli baru."
          : "Ditolak: nilai harapan di bawah minimum kebijakan."
      : oversized
        ? `${inst.pair} memenuhi kriteria strategi — ukurannya perlu persetujuan Anda.`
        : `${inst.pair} memenuhi kriteria strategi — dieksekusi dalam batas.`,
    chain,
    factors,
    confidence: setup.confidence,
    invalidation: `Batal jika ${inst.pair} diperdagangkan di bawah ${formatPrice(setup.stop, inst.decimals)} atau momentum berbalik pada penutupan 4 jam.`,
    assumptions: [
      "Probabilitas menang dari 500 jalur simulasi dan dua tahun setup sebanding.",
      "Eksekusi mengasumsikan spread saat ini. Tanpa leverage.",
    ],
    symbol: cand.symbol,
    tradeSetupId: setup.id,
  };

  ctx.emit("DECISION_CREATED", decision);
  ctx.log(
    "DECISION",
    rejected
      ? `${inst.pair} ditolak — ${corrFail ? "korelasi portofolio terlalu tinggi" : regimeFail ? "rezim tidak mendukung posisi beli" : "nilai harapan terlalu rendah"}.`
      : `${inst.pair} memenuhi kriteria strategi saat ini.`,
    { decisionId, symbol: cand.symbol },
  );

  if (rejected) return;

  if (oversized) {
    ctx.emit("APPROVAL_REQUIRED", {
      request: {
        id: ctx.nextId("apr"),
        at: ctx.now(),
        title: "Calon transaksi melebihi ukuran posisi normal.",
        reason:
          `Posisi ${inst.pair} akan menjadi ${impact.positionPctOfEquity.toFixed(0)}% dari ekuitas; agen hanya boleh mengambil hingga ${policy.maxPositionPctOfEquity}% sendiri.` +
          (exposureBreach
            ? ` Eksposur portofolio juga akan naik ke ${impact.exposureAfterPct.toFixed(0)}%, di atas kebijakan ${policy.maxPortfolioExposurePct}%.`
            : ""),
        setupId: setup.id,
        decisionId,
      },
      setup,
    });
    ctx.log("APPROVAL", `Persetujuan diminta: posisi ${inst.pair} melebihi ukuran normal.`, { decisionId, symbol: cand.symbol });
    return [
      {
        state: "WAITING_FOR_APPROVAL",
        task: `Menunggu keputusan Anda untuk ${inst.pair}`,
        durationMs: 3200,
      },
    ];
  }

  return [executionStep(setup, "dalam batas kebijakan")];
}

/** Fills a setup at the current price and records the position. */
export function executionStep(setup: TradeSetup, note: string, quantity = setup.quantity): Step {
  const inst = INSTRUMENTS[setup.symbol];
  return {
    state: "EXECUTING",
    task: `Mengeksekusi order ${inst.pair} ${note}`,
    durationMs: 2400,
    complete: (c) => {
      const fill = c.market.quote(setup.symbol).price;
      const cost = quantity * fill;
      if (cost > c.read().portfolio.cash) {
        c.log("RISK", `Order ${inst.pair} dibatalkan: modal tersedia tidak cukup.`, { symbol: setup.symbol });
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
        `Membeli ${formatNumber(quantity, quantity < 0.1 ? 4 : 2)} ${setup.symbol} di ${formatUsd(fill)}. Stop ${formatPrice(setup.stop, inst.decimals)}.`,
        {
          decisionId: setup.decisionId,
          symbol: setup.symbol,
          evidence: [
            { label: "Harga eksekusi", value: formatUsd(fill) },
            { label: "Biaya", value: formatUsd(cost) },
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
      task: `Memantau ${n} posisi terbuka`,
      durationMs: 4400,
      complete: (c) => {
        const s = c.read();
        const cap = computeCapital(s.portfolio, s.quotes);
        const exposure = (cap.deployed / cap.total) * 100;
        c.log(
          "MONITOR",
          `${cap.positions.length} posisi ditinjau. Belum terealisasi ${formatSignedUsd(cap.unrealized)}. Semua stop aman.`,
          {
            evidence: cap.positions.map((p) => ({
              label: INSTRUMENTS[p.symbol].pair,
              value: `${formatSignedUsd(p.unrealized)} · stop ${formatPrice(p.stopPrice, INSTRUMENTS[p.symbol].decimals)}`,
            })),
          },
        );
        const warnAt = s.policy.maxPortfolioExposurePct * 0.85;
        if (exposure > warnAt) {
          const message = `Eksposur ${exposure.toFixed(0)}% mendekati batas kebijakan ${s.policy.maxPortfolioExposurePct}%.`;
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
      ? `Kejar: ekspektasi ${formatUsd(ev, { whole: true })} untuk ${opp.effortHours} jam kerja.`
      : `Lewati: ekspektasi ${formatUsd(perHour, { whole: true })}/jam di bawah batas minimum.`,
    opportunityId: opp.id,
    chain: [
      { label: "Peluang", value: opp.category, status: "neutral", detail: opp.whyFound },
      { label: "Permintaan", value: "Terverifikasi", status: "pass", detail: opp.evidence[0] ? `${opp.evidence[0].label}: ${opp.evidence[0].value}.` : "Sinyal permintaan terkonfirmasi." },
      { label: "Persaingan", value: opp.competition, status: opp.competition === "Tinggi" ? "fail" : "pass", detail: opp.competitionNote },
      {
        label: "Nilai harapan",
        value: formatUsd(ev, { whole: true }),
        status: "neutral",
        detail: `${formatUsd(opp.potentialValue, { whole: true })} × probabilitas ${Math.round(opp.probability * 100)}%.`,
      },
      {
        label: "Nilai per jam",
        value: `${formatUsd(perHour, { whole: true })}/jam`,
        status: pursue ? "pass" : "fail",
        detail: `Batas minimum ${formatUsd(EV_PER_HOUR_FLOOR, { whole: true })}/jam nilai harapan.`,
      },
      { label: "Keputusan", value: pursue ? "Kejar" : "Lewati", status: pursue ? "pass" : "fail", detail: opp.nextAction },
    ],
    factors: [
      opp.whyFound,
      `Nilai harapan ${formatUsd(ev, { whole: true })} dalam ${opp.effortHours} jam kerja (${formatUsd(perHour, { whole: true })}/jam).`,
      `Persaingan ${opp.competition.toLowerCase()}: ${opp.competitionNote}`,
    ],
    confidence: Math.min(0.9, 0.45 + opp.probability * 0.5),
    invalidation: opp.risks[0] ? `Evaluasi ulang jika: ${opp.risks[0].toLowerCase()}.` : "Evaluasi ulang jika cakupan berubah.",
    assumptions: [`Probabilitas diperkirakan dari pekerjaan ${opp.category.toLowerCase()} yang sebanding.`],
  };
  ctx.emit("DECISION_CREATED", decision);
  ctx.emit("OPPORTUNITY_UPDATED", { id: opp.id, patch: { status: pursue ? "Lolos kualifikasi" : "Dilewati" } });
  ctx.log("DECISION", pursue ? `Kejar ${opp.title.toLowerCase()} — nilai harapan ${formatUsd(ev, { whole: true })}.` : `Melewatkan ${opp.title.toLowerCase()}.`, {
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
      task: "Mencari di marketplace freelance, listing B2B, dan bounty",
      durationMs: 4600,
      complete: (c) => c.log("SEARCH", `Menemukan ${leads} calon peluang otomasi B2B.`),
    },
    {
      state: "ANALYZING",
      task: `Menilai ${leads} prospek berdasarkan nilai harapan per jam`,
      durationMs: 3600,
      complete: (c) =>
        c.log("FILTERING", `${cleared} prospek lolos batas nilai harapan ${formatUsd(EV_PER_HOUR_FLOOR, { whole: true })}/jam.`),
    },
    {
      state: "RESEARCHING",
      task: `Meneliti ${template.title.toLowerCase()}`,
      durationMs: 4200,
      complete: (c) => {
        found = { ...template, discoveredAt: c.now(), status: "Diteliti" };
        c.emit("OPPORTUNITY_FOUND", found);
        c.log("SEARCH", `Peluang baru: ${template.title} — nilai harapan ${formatUsd(evOf(template), { whole: true })}.`, {
          opportunityId: template.id,
          evidence: template.evidence,
        });
      },
    },
    {
      state: "DECIDING",
      task: `Memutuskan apakah mengejar ${template.title.toLowerCase()}`,
      durationMs: 2600,
      complete: (c) => {
        if (found) businessDecision(c, found);
      },
    },
  ];
}

export function businessFollowUp(ctx: StepContext): Step[] {
  const opps = ctx.read().opportunities;
  const qualified = opps.find((o) => o.status === "Lolos kualifikasi");
  if (qualified) {
    return [
      {
        state: "EXECUTING",
        task: `Menyusun proposal untuk ${qualified.title.toLowerCase()}`,
        durationMs: 4400,
        complete: (c) => {
          c.emit("OPPORTUNITY_UPDATED", { id: qualified.id, patch: { status: "Proposal disusun" } });
          c.emit("BUSINESS_TASK_COMPLETED", { opportunityId: qualified.id, task: "Proposal disusun" });
          c.log("BUSINESS", `Proposal disusun untuk ${qualified.title}.`, { opportunityId: qualified.id });
        },
      },
    ];
  }
  const researching = opps.find((o) => o.status === "Diteliti");
  if (researching) {
    return [
      {
        state: "RESEARCHING",
        task: `Riset pelanggan: ${researching.title.toLowerCase()}`,
        durationMs: 4000,
        complete: (c) => {
          const probability = Math.min(0.9, researching.probability + 0.04);
          c.emit("OPPORTUNITY_UPDATED", { id: researching.id, patch: { probability } });
          c.log("RESEARCH", `Riset pelanggan menaikkan probabilitas menang ${researching.title.toLowerCase()} menjadi ${Math.round(probability * 100)}%.`, {
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
  return [{ state: "IDLE", task: "Siaga — siklus riset berikutnya terjadwal", durationMs: 2600 }];
}
