import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { accessPassword, accessUsername, SESSION_COOKIE, verifySession } from "./session";

export { createSession, SESSION_COOKIE, SESSION_MAX_AGE } from "./session";

export function authConfigured(): boolean {
  return accessPassword() !== null;
}

function same(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

/** Checks the password, and the username when the owner has set one. */
export function checkCredentials(username: string, password: string): boolean {
  const pw = accessPassword();
  if (!pw) return false;
  const user = accessUsername();
  const userOk = user ? same(username.trim().toLowerCase(), user.toLowerCase()) : true;
  const pwOk = same(password, pw);
  return userOk && pwOk;
}

export async function isAuthed(): Promise<boolean> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/** Rejects cross-site posts: the request must come from this site. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
