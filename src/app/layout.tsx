import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppChrome } from "@/components/layout/AppChrome";
import { SimulationProvider } from "@/components/layout/SimulationProvider";
import { ACCENT_BOOT } from "@/lib/accent";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "DWP EARN MONEY", template: "%s · DWP EARN MONEY" },
  applicationName: "DWP EARN MONEY",
  appleWebApp: { capable: true, title: "DWP Earn", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
  description:
    "DWP EARN MONEY — platform cari cuan berbasis tim agen: temukan peluang, kelola modal, dan jaga risiko. Data agen adalah simulasi; halaman Akun terhubung ke akun nyata.",
};

export const viewport: Viewport = {
  themeColor: "#e9e3dc",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* The owner's accent colour, applied before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: ACCENT_BOOT }} />
      </head>
      <body className="min-h-dvh text-ink">
        <div aria-hidden className="app-backdrop" />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:text-canvas"
        >
          Langsung ke konten
        </a>
        <SimulationProvider>
          <AppChrome>{children}</AppChrome>
        </SimulationProvider>
      </body>
    </html>
  );
}
