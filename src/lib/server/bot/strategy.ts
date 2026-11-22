import type { AgentStep, Position, StrategyParams } from "./types";

/**
 * "Beli saat turun, jual saat untung": buy small slices on dips, add more only after
 * further drops, and sell the whole bot position once it is above its average price
 * by the take-profit margin, after fees. Pure function: same input, same decision.
 */

export interface MarketView {
  price: number;
  change24hPct: number | null;
  high24h: number | null;
  low24h: number | null;
}

export interface DecideInput {
  base: string;
  quote: string;
  market: MarketView;
  position: Position | null;
  /** Quote currency the bot may still spend on this exchange. */
  freeQuote: number;
  /** Coins of this base that are free on the exchange. */
  freeBase: number;
  /** Bot cost already in coins on this exchange (all its pairs). */
  investedQuote: number;
  params: StrategyParams;
  minOrder: number;
  /** Per-order hard cap from the server (DWP_MAX_ORDER_*). */
  maxOrder: number;
  feePct: number;
  buysToday: number;
  /** Realized losses today on this exchange, as a positive number. */
  lossToday: number;
  now: number;
}

export type Decision =
  | { action: "buy"; quote: number; steps: AgentStep[] }
  | { action: "sell"; qty: number; why: "untung" | "batas-rugi"; steps: AgentStep[] }
  | { action: "hold"; steps: AgentStep[] };

const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
const money = (v: number, quote: string) =>
  quote === "IDR" ? `Rp${Math.round(v).toLocaleString("id-ID")}` : `${v.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${quote}`;

export function decide(i: DecideInput): Decision {
  const { market: m, params: p, quote, base } = i;
  const steps: AgentStep[] = [];
  const say = (agent: AgentStep["agent"], text: string) => steps.push({ agent, text });

  const rangePos = m.high24h && m.low24h && m.high24h > m.low24h ? (m.price - m.low24h) / (m.high24h - m.low24h) : null;
  say(
    "Pemindai",
    `${base}/${quote} ${money(m.price, quote)}${m.change24hPct === null ? "" : ` · 24 jam ${pct(m.change24hPct)}`}${
      rangePos === null ? "" : ` · posisi di rentang harian ${Math.round(rangePos * 100)}%`
    }.`,
  );

  // 1) Something to sell?
  const pos = i.position && i.position.qty > 0 ? i.position : null;
  if (pos) {
    const avg = pos.cost / pos.qty;
    const netPct = ((m.price * (1 - i.feePct / 100) - avg) / avg) * 100;
    say("Analis", `Bot memegang ${pos.qty.toPrecision(6)} ${base}, rata-rata ${money(avg, quote)}. Hasil bersih jika dijual sekarang ${pct(netPct)}.`);
    const qty = Math.min(pos.qty, i.freeBase);
    const value = qty * m.price;
    const wantsProfit = netPct >= p.takeProfitPct;
    const wantsStop = p.stopLossPct > 0 && netPct <= -p.stopLossPct;
    if (wantsProfit || wantsStop) {
      if (value < i.minOrder) {
        say("Risiko", `Nilainya ${money(value, quote)}, di bawah minimum order ${money(i.minOrder, quote)}. Ditahan dulu.`);
      } else {
        say(
          "Risiko",
          wantsProfit
            ? `Target untung ${pct(p.takeProfitPct)} tercapai. Ambil untung.`
            : `Turun melewati batas rugi ${pct(-p.stopLossPct)}. Keluar untuk membatasi kerugian.`,
        );
        say("Eksekutor", `Jual ${qty.toPrecision(6)} ${base} (± ${money(value, quote)}).`);
        return { action: "sell", qty, why: wantsProfit ? "untung" : "batas-rugi", steps };
      }
    }
  }

  // 2) Buy?
  const capital = i.freeQuote + i.investedQuote;
  const hold = (agent: AgentStep["agent"], text: string): Decision => {
    say(agent, text);
    return { action: "hold", steps };
  };

  if (i.lossToday > 0 && i.lossToday >= (capital * p.dailyLossPct) / 100) {
    return hold("Risiko", `Rugi hari ini ${money(i.lossToday, quote)} sudah mencapai batas harian ${p.dailyLossPct}%. Tidak membeli lagi hari ini.`);
  }
  if (i.buysToday >= p.maxBuysPerDay) {
    return hold("Risiko", `Sudah ${i.buysToday} kali beli ${base} hari ini (batas ${p.maxBuysPerDay}).`);
  }
  if (pos && i.now - pos.lastBuyAt < p.cooldownMin * 60_000) {
    const left = Math.ceil((p.cooldownMin * 60_000 - (i.now - pos.lastBuyAt)) / 60_000);
    return hold("Risiko", `Jeda antar-beli: ${left} menit lagi.`);
  }
  if (m.change24hPct !== null && m.change24hPct <= -p.crashGuardPct) {
    return hold("Risiko", `Harga jatuh ${pct(m.change24hPct)} dalam 24 jam. Tunggu pasar tenang dulu.`);
  }

  let signal = "";
  if (pos) {
    const target = pos.lastBuyPrice * (1 - p.stepPct / 100);
    if (m.price <= target) signal = `Harga ${pct(((m.price - pos.lastBuyPrice) / pos.lastBuyPrice) * 100)} dari beli terakhir. Tambah sedikit untuk menurunkan rata-rata.`;
    else return hold("Analis", `Menunggu harga turun ke ${money(target, quote)} (−${p.stepPct}% dari beli terakhir) untuk menambah, atau naik untuk ambil untung.`);
  } else {
    const dip = m.change24hPct !== null && m.change24hPct <= -p.entryDipPct;
    const nearLow = rangePos !== null && rangePos <= 0.25;
    if (dip) signal = `Turun ${pct(m.change24hPct!)} dalam 24 jam — titik masuk.`;
    else if (nearLow) signal = "Dekat harga terendah 24 jam — titik masuk.";
    else return hold("Analis", `Belum ada titik masuk: menunggu turun ${p.entryDipPct}% dalam 24 jam atau mendekati harga terendah harian.`);
  }
  say("Analis", signal);

  const room = (capital * p.maxAllocPct) / 100 - i.investedQuote;
  let size = Math.max((capital * p.buyPct) / 100, i.minOrder);
  size = Math.floor(Math.min(size, i.maxOrder, room, i.freeQuote) * 100) / 100;
  if (size < i.minOrder) {
    if (i.freeQuote < i.minOrder) return hold("Risiko", `Saldo ${quote} ${money(i.freeQuote, quote)} kurang dari minimum order ${money(i.minOrder, quote)}.`);
    return hold("Risiko", `Ruang alokasi tersisa ${money(Math.max(room, 0), quote)} (batas ${p.maxAllocPct}% modal), kurang dari minimum order.`);
  }
  say("Risiko", `Beli ${money(size, quote)} — modal kerja ${money(capital, quote)}, di koin setelah ini ${Math.round(((i.investedQuote + size) / capital) * 100)}% (batas ${p.maxAllocPct}%).`);
  say("Eksekutor", `Beli ${base} senilai ${money(size, quote)} dengan harga pasar.`);
  return { action: "buy", quote: size, steps };
}
