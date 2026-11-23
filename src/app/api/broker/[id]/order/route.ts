import { brokerFrom, executeOrder, parseOrder } from "@/lib/server/brokers";
import { syncNow } from "@/lib/server/bot/engine";
import { SETTINGS_MAX_AGE, loadState } from "@/lib/server/bot/store";
import { guard, json } from "@/lib/server/http";
import { manualPairs } from "@/lib/server/pairs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

/** Sends an order only with the owner's explicit approval in the request. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard(req, true);
  if (denied) return denied;
  const broker = brokerFrom((await params).id);
  if (!broker) return json({ error: "Platform tidak dikenal." }, 404);
  const body = (await req.json().catch(() => null)) as { approve?: unknown } | null;
  if (body?.approve !== true) return json({ error: "Order butuh persetujuan Anda." }, 400);
  const input = parseOrder(body);
  if (!input) return json({ error: "Isi order tidak lengkap." }, 400);
  const { state } = await loadState(SETTINGS_MAX_AGE);
  const result = await executeOrder(broker, input, await manualPairs(broker, input.pair, state.settings));
  // A hand-placed sell may take coins the bot was holding: update its records now, not at the next check.
  if (result.ok && result.live) await syncNow().catch(() => null);
  return json(result, result.ok ? 200 : 422);
}
