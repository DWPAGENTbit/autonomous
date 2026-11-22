import { cleanSettings } from "@/lib/server/bot/settings";
import { storageKind, updateState } from "@/lib/server/bot/store";
import { botView } from "@/lib/server/bot/view";
import { guard, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

/** The owner changes the bot's settings: master switch, exchanges, pairs, risk profile. */
export async function POST(req: Request) {
  const denied = await guard(req, true);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return json({ error: "Isi pengaturan tidak terbaca." }, 400);
  // The watchlist changes only through /api/bot/watchlist, which checks each market exists.
  delete body.watchlist;

  // On Vercel the bot must remember its positions between runs, so it needs real storage.
  if (body.auto === true && process.env.VERCEL === "1" && storageKind() === "memory") {
    return json({ error: "Penyimpanan bot (Supabase) belum tersambung. Jalankan supabase/dwp-bot.sql dan isi kuncinya di Vercel, lalu redeploy." }, 409);
  }

  try {
    await updateState((st) => {
      st.settings = cleanSettings({ ...body, updatedAt: Date.now() }, st.settings);
    });
    return json(await botView());
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Pengaturan gagal disimpan." }, 500);
  }
}
