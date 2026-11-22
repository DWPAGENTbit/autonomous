import { brokerFrom, pairsFor } from "@/lib/server/brokers";
import { validPair } from "@/lib/server/bot/settings";
import { updateState } from "@/lib/server/bot/store";
import { botView } from "@/lib/server/bot/view";
import { guard, json } from "@/lib/server/http";
import { pairExists } from "@/lib/server/pairs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

/**
 * The owner adds a market found by search, so it can be traded by hand and,
 * if they choose, by the bot. Removing it also takes it off the bot's list.
 */
export async function POST(req: Request) {
  const denied = await guard(req, true);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { broker?: string; pair?: string; action?: string; bot?: unknown } | null;
  const broker = brokerFrom(body?.broker ?? "");
  const pair = body?.pair ?? "";
  if (!broker || !validPair(broker.id, pair) || (body?.action !== "add" && body?.action !== "remove")) {
    return json({ error: "Isi permintaan tidak lengkap." }, 400);
  }

  if (body.action === "add") {
    // Only markets that really exist on the exchange.
    const [base, quote] = broker.split(pair);
    if (!(await pairExists(broker, pair))) return json({ error: `${base}/${quote} tidak ditemukan di ${broker.name}.` }, 404);
  }

  try {
    await updateState((st) => {
      const s = st.settings;
      const watch = new Set(s.watchlist[broker.id]);
      const bot = new Set(s.brokers[broker.id].pairs);
      if (body.action === "add") {
        if (!pairsFor(broker.id).includes(pair)) watch.add(pair);
        if (body.bot === true) bot.add(pair);
        if (body.bot === false) bot.delete(pair);
      } else {
        watch.delete(pair);
        bot.delete(pair);
      }
      s.watchlist[broker.id] = [...watch].slice(-60);
      s.brokers[broker.id] = { ...s.brokers[broker.id], pairs: [...bot] };
      s.updatedAt = Date.now();
    });
    return json(await botView());
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Gagal menyimpan." }, 500);
  }
}
