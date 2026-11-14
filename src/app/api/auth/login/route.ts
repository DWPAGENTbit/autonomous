import { authConfigured, checkPassword, createSession, sameOrigin, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/server/auth";
import { json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Permintaan ditolak." }, 403);
  if (!authConfigured()) return json({ error: "Kata sandi akses belum diatur di server." }, 503);
  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  const input = typeof body?.password === "string" ? body.password : "";
  if (!checkPassword(input)) {
    // Slow down guessing.
    await new Promise((r) => setTimeout(r, 800));
    return json({ error: "Kata sandi salah." }, 401);
  }
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, createSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
