import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Single-owner access gate for the real-account area. The owner sets
 * DWP_ACCESS_PASSWORD in Vercel; sessions are HMAC-signed cookies derived
 * from it, so changing the password signs everyone out.
 */
export const SESSION_COOKIE = "dwp_session";
export const SESSION_MAX_AGE = 12 * 60 * 60;
const MIN_PASSWORD = 10;

function password(): string | null {
  const pw = process.env.DWP_ACCESS_PASSWORD;
  return pw && pw.length >= MIN_PASSWORD ? pw : null;
}

function signingKey(): Buffer | null {
  const pw = password();
  if (!pw) return null;
  return createHash("sha256").update(`dwp-session:${pw}:${process.env.DWP_SESSION_SECRET ?? ""}`).digest();
}

export function authConfigured(): boolean {
  return password() !== null;
}

export function checkPassword(input: string): boolean {
  const pw = password();
  if (!pw) return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(pw).digest();
  return timingSafeEqual(a, b);
}

export function createSession(): string {
  const key = signingKey();
  if (!key) throw new Error("Access password is not configured");
  const payload = String(Date.now() + SESSION_MAX_AGE * 1000);
  return `${payload}.${createHmac("sha256", key).update(payload).digest("hex")}`;
}

export function verifySession(token: string | undefined): boolean {
  const key = signingKey();
  if (!key || !token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = createHmac("sha256", key).update(payload).digest("hex");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  return Number(payload) > Date.now();
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
