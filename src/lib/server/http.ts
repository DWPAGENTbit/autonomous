import { NextResponse } from "next/server";
import { isAuthed, sameOrigin } from "./auth";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

/** Every broker route: signed-in owner only; writes must come from this site. */
export async function guard(req: Request, write = false): Promise<NextResponse | null> {
  if (!(await isAuthed())) return json({ error: "Silakan masuk dulu." }, 401);
  if (write && !sameOrigin(req)) return json({ error: "Permintaan ditolak." }, 403);
  return null;
}
