import { brokerFrom } from "@/lib/server/brokers";
import { BrokerError } from "@/lib/server/brokers/types";
import { guard, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Indonesian exchanges: run close to them.
export const preferredRegion = "sin1";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard(req);
  if (denied) return denied;
  const broker = brokerFrom((await params).id);
  if (!broker) return json({ error: "Platform tidak dikenal." }, 404);
  if (!broker.configured()) return json({ error: `Kunci API ${broker.name} belum diatur.` }, 409);
  try {
    return json({ balances: await broker.balances() });
  } catch (e) {
    return json({ error: e instanceof BrokerError ? e.message : `${broker.name} tidak bisa dihubungi.` }, 502);
  }
}
