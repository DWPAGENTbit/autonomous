import { guard, json } from "@/lib/server/http";
import { topMarkets } from "@/lib/server/portfolio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

/** Live Indodax prices for the most-traded IDR markets. */
export async function GET(req: Request) {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    return json({ at: Date.now(), markets: await topMarkets(12) });
  } catch {
    return json({ error: "Harga pasar Indodax tidak bisa diambil saat ini." }, 502);
  }
}
