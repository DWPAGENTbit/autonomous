import { guard, json } from "@/lib/server/http";
import { stockQuotes } from "@/lib/server/stocks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

/** Delayed prices for the owner's recorded stocks, e.g. ?symbols=BBCA,TLKM */
export async function GET(req: Request) {
  const denied = await guard(req);
  if (denied) return denied;
  const symbols = (new URL(req.url).searchParams.get("symbols") ?? "").split(",").filter(Boolean);
  return json({ at: Date.now(), quotes: await stockQuotes(symbols) });
}
