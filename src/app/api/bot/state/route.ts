import { botView } from "@/lib/server/bot/view";
import { guard, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET(req: Request) {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    return json(await botView(new URL(req.url).searchParams.has("fresh")));
  } catch (e) {
    console.error("[bot] state failed", e);
    return json({ error: "Data bot tidak bisa dibaca saat ini." }, 500);
  }
}
