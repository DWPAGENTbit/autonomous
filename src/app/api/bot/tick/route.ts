import { isAuthed, sameOrigin } from "@/lib/server/auth";
import { SCHEDULE, runTick } from "@/lib/server/bot/engine";
import { scheduleAuthorized } from "@/lib/server/bot/store";
import { cronAuthorized } from "@/lib/server/bot/view";
import { json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";
export const maxDuration = 60;

/**
 * One autonomous check. Called every 15 minutes by the schedule in Supabase (its own
 * key, checked by the database), once a day by Vercel Cron as a backup (CRON_SECRET),
 * or by the signed-in owner. Schedules get only a short answer; the owner gets the
 * agents' full reasoning.
 */
async function handle(req: Request, write: boolean) {
  const by = cronAuthorized(req) ? "jadwal harian" : (await scheduleAuthorized(req)) ? SCHEDULE : null;
  if (by) {
    try {
      const r = await runTick(by);
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
