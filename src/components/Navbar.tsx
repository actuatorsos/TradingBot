"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Activity, History, Crosshair, LineChart, Settings2, Zap,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: Activity },
  { href: "/trades", label: "Trades", icon: History },
  { href: "/positions", label: "Positions", icon: Crosshair },
  { href: "/equity", label: "Equity", icon: LineChart },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 w-full backdrop-blur-xl bg-[#050810]/80 border-b border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-12">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-apex-accent/20 to-purple-500/20 border border-apex-accent/30 flex items-center justify-center group-hover:border-apex-accent/60 transition-colors">
              <Zap className="w-3.5 h-3.5 text-apex-accent" />
            </div>
            <span className="text-sm font-semibold text-white font-[Outfit] tracking-wide hidden sm:block">
              APEX <span className="text-apex-accent">TRADER</span>
            </span>
          </Link>

          {/* Nav Links */}
          <div className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium font-mono
                    transition-all duration-200
                    ${active
                      ? "text-apex-accent bg-apex-accent/[0.08] border border-apex-accent/20"
                      : "text-apex-muted hover:text-white/80 hover:bg-white/[0.03] border border-transparent"
                    }
                  `}
                >
                  <item.icon className={`w-3.5 h-3.5 ${active ? "text-apex-accent" : ""}`} />
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
