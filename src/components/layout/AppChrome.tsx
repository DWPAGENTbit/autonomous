"use client";

import { usePathname } from "next/navigation";
import { AgentAnnouncer } from "@/components/agent/AgentStatus";
import { ContextPanel } from "@/components/layout/ContextPanel";
import { Footer, MobileTabBar, Sidebar, TopNav } from "@/components/layout/TopNav";

/** Navigation and panels for the platform; the login page stands alone. */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const main = (
    <main id="main" tabIndex={-1} className="outline-none">
      {children}
    </main>
  );
  if (pathname === "/masuk") return main;
  return (
    <>
      <Sidebar />
      <div className="lg:pl-[5.75rem] xl:pl-[16.5rem]">
        <TopNav />
        {main}
        <Footer />
      </div>
      <MobileTabBar />
      <ContextPanel />
      <AgentAnnouncer />
    </>
  );
}
