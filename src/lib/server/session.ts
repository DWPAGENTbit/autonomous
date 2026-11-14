/**
 * Signed session cookies with Web Crypto, so the same code runs in the
 * middleware (edge) and in route handlers (Node). The signing key is
 * derived from the access password: changing it signs everyone out.
 */
export const SESSION_COOKIE = "dwp_session";
export const SESSION_MAX_AGE = 12 * 60 * 60;
const MIN_PASSWORD = 10;
const enc = new TextEncoder();

export function accessPassword(): string | null {
  const pw = process.env.DWP_ACCESS_PASSWORD;
  return pw && pw.length >= MIN_PASSWORD ? pw : null;
}

export function accessUsername(): string | null {
  return process.env.DWP_ACCESS_USERNAME?.trim() || null;
}

async function signingKey(): Promise<CryptoKey | null> {
  const pw = accessPassword();
  if (!pw) return null;
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`dwp-session:${pw}:${process.env.DWP_SESSION_SECRET ?? ""}`));
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function sign(key: CryptoKey, payload: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSession(): Promise<string> {
  const key = await signingKey();
  if (!key) throw new Error("Access password is not configured");
  const payload = String(Date.now() + SESSION_MAX_AGE * 1000);
  return `${payload}.${await sign(key, payload)}`;
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const key = await signingKey();
  if (!key) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !(Number(payload) > Date.now())) return false;
  return equal(sig, await sign(key, payload));
}

/** Only same-site relative paths are allowed as a post-login destination. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/masuk") ? next : "/";
}
