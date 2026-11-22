// Built once per deployment and served from Vercel's cache: no function runs for it.
export const dynamic = "force-static";

/** The deployed version, so an app left open on a phone can tell it is out of date. */
export function GET() {
  return Response.json({ build: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" });
}
