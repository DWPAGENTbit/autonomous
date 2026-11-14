import { brokerFrom, executeOrder, parseOrder } from "@/lib/server/brokers";
import { guard, json } from "@/lib/server/http";

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
  const result = await executeOrder(broker, input);
  return json(result, result.ok ? 200 : 422);
}
