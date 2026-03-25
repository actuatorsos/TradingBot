import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "APEX TRADER AI | Trading Dashboard",
  description: "Algorithmic Forex Trading Bot - 9-Indicator Confluence Analysis",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="mesh-bg antialiased">
        {children}
      </body>
    </html>
  );
}
