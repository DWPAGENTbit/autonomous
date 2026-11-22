import { guard, json } from "@/lib/server/http";
import { realPortfolio } from "@/lib/server/portfolio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Indonesian exchanges: run close to them.
export const preferredRegion = "sin1";

/** The owner's real holdings across connected exchanges, valued in IDR. */
export async function GET(req: Request) {
  const denied = await guard(req);
  if (denied) return denied;
  return json(await realPortfolio());
}
