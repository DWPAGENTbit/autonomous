import { status } from "@/lib/server/brokers";
import { loadState } from "@/lib/server/bot/store";
import { guard, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await guard(req);
  if (denied) return denied;
  const { state } = await loadState(20_000);
  const b = state.settings.brokers;
  return json(status({ indodax: b.indodax.enabled, tokocrypto: b.tokocrypto.enabled }));
}
