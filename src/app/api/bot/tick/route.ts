import { isAuthed, sameOrigin } from "@/lib/server/auth";
import { runTick } from "@/lib/server/bot/engine";
import { cronAuthorized } from "@/lib/server/bot/view";
import { json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";
export const maxDuration = 60;

/**
 * One autonomous check. Called by the schedule (Bearer CRON_SECRET) or by the
 * signed-in owner's open app. The schedule gets only a short answer, because its
 * logs may be public; the owner gets the agents' full reasoning.
 */
async function handle(req: Request, write: boolean) {
  if (cronAuthorized(req)) {
    try {
      const r = await runTick("jadwal");
      return json({ ok: true, ran: r.ran, actions: r.actions });
    } catch (e) {
      console.error("[bot] scheduled tick failed", e);
      return json({ ok: false }, 500);
    }
  }
  if (!(await isAuthed())) return json({ error: "Tidak diizinkan." }, 401);
  if (write && !sameOrigin(req)) return json({ error: "Permintaan ditolak." }, 403);
  try {
    return json({ ok: true, ...(await runTick("aplikasi")) });
  } catch (e) {
    console.error("[bot] tick failed", e);
    return json({ ok: false, error: e instanceof Error ? e.message : "Bot gagal berjalan." }, 500);
  }
}

export const GET = (req: Request) => handle(req, false);
export const POST = (req: Request) => handle(req, true);
