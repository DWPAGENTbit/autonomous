import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AgentAnnouncer } from "@/components/agent/AgentStatus";
import { ContextPanel } from "@/components/layout/ContextPanel";
import { SimulationProvider } from "@/components/layout/SimulationProvider";
import { Footer, MobileTabBar, TopNav } from "@/components/layout/TopNav";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Autonomous", template: "%s · Autonomous" },
  description: "An intelligent economic operating system. Simulation prototype with demo data.",
};

export const viewport: Viewport = {
  themeColor: "#f7f7f5",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-canvas text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:text-canvas"
        >
          Skip to content
        </a>
        <SimulationProvider>
          <TopNav />
          <main id="main" tabIndex={-1} className="outline-none">
            {children}
          </main>
          <Footer />
          <MobileTabBar />
          <ContextPanel />
          <AgentAnnouncer />
        </SimulationProvider>
      </body>
    </html>
  );
}
