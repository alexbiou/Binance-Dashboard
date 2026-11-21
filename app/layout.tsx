import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { MarketProvider } from "@/components/providers/market-provider";

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex", display: "swap" });

export const metadata: Metadata = {
  title: { default: "DashboardBinance", template: "%s | DashboardBinance" },
  description: "Cryptocurrency market monitoring and analytics built on Binance public market data. Read-only; no trading.",
};

export const viewport: Viewport = { themeColor: "#131517" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plex.variable}>
      <body>
        <MarketProvider>
          <AppShell>{children}</AppShell>
        </MarketProvider>
      </body>
    </html>
  );
}
