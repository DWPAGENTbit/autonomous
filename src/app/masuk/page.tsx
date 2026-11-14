import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginScreen } from "@/components/accounts/AccessPanels";
import { authConfigured, isAuthed } from "@/lib/server/auth";
import { accessUsername, safeNext } from "@/lib/server/session";

export const metadata: Metadata = { title: "Masuk" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await isAuthed()) redirect(next);
  return <LoginScreen configured={authConfigured()} askUsername={accessUsername() !== null} next={next} />;
}
