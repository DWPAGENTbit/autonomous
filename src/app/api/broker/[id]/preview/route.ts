import { brokerFrom, parseOrder, previewOrder } from "@/lib/server/brokers";
import { guard, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard(req, true);
  if (denied) return denied;
  const broker = brokerFrom((await params).id);
  if (!broker) return json({ error: "Platform tidak dikenal." }, 404);
  const input = parseOrder(await req.json().catch(() => null));
  if (!input) return json({ error: "Isi order tidak lengkap." }, 400);
  return json(await previewOrder(broker, input));
}
