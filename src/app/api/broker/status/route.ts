import { status } from "@/lib/server/brokers";
import { allowedPairs } from "@/lib/server/bot/settings";
import { SETTINGS_MAX_AGE, loadState } from "@/lib/server/bot/store";
import { guard, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await guard(req);
  if (denied) return denied;
  const { state } = await loadState(SETTINGS_MAX_AGE);
  const b = state.settings.brokers;
  const s = state.settings;
  return json(
    status({ indodax: b.indodax.enabled, tokocrypto: b.tokocrypto.enabled }, { indodax: allowedPairs("indodax", s), tokocrypto: allowedPairs("tokocrypto", s) }),
  );
}
