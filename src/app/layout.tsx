import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#00f0ff",
};

export const metadata: Metadata = {
  title: "APEX TRADER AI | Trading Dashboard",
  description: "Algorithmic Forex Trading Bot - 9-Indicator Confluence Analysis",
  icons: { icon: "/favicon.svg" },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Apex Trader AI",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="mesh-bg antialiased">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
