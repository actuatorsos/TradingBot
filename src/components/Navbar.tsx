"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Activity, History, Crosshair, LineChart, Settings2, Zap,
  BookOpen, BarChart3, Heart, ShieldOff, Newspaper, Menu, X,
  CandlestickChart, FlaskConical, Grid3X3, Rocket,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: Activity },
  { href: "/chart", label: "Chart", icon: CandlestickChart },
  { href: "/trades", label: "Trades", icon: History },
  { href: "/positions", label: "Positions", icon: Crosshair },
  { href: "/equity", label: "Equity", icon: LineChart },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/backtest", label: "Backtest", icon: FlaskConical },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/correlation", label: "Correlation", icon: Grid3X3 },
  { href: "/health", label: "Health", icon: Heart },
  { href: "/kill-switch", label: "Kill Switch", icon: ShieldOff },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 w-full backdrop-blur-xl bg-[#050810]/80 border-b border-white/[0.04]">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-12">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-apex-accent/20 to-purple-500/20 border border-apex-accent/30 flex items-center justify-center group-hover:border-apex-accent/60 transition-colors">
              <Zap className="w-3.5 h-3.5 text-apex-accent" />
            </div>
            <span className="text-sm font-semibold text-white font-[Outfit] tracking-wide hidden sm:block">
              APEX <span className="text-apex-accent">TRADER</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              const isKillSwitch = item.href === "/kill-switch";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium font-mono
                    transition-all duration-200
                    ${active
                      ? isKillSwitch
                        ? "text-apex-red bg-apex-red/[0.08] border border-apex-red/20"
                        : "text-apex-accent bg-apex-accent/[0.08] border border-apex-accent/20"
                      : isKillSwitch
                        ? "text-apex-red/60 hover:text-apex-red hover:bg-apex-red/[0.04] border border-transparent"
                        : "text-apex-muted hover:text-white/80 hover:bg-white/[0.03] border border-transparent"
                    }
                  `}
                >
                  <item.icon className={`w-3 h-3 ${active ? (isKillSwitch ? "text-apex-red" : "text-apex-accent") : ""}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 rounded-lg text-apex-muted hover:text-white hover:bg-white/[0.03] transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-white/[0.04] bg-[#050810]/95 backdrop-blur-xl">
          <div className="px-4 py-3 grid grid-cols-3 gap-2">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              const isKillSwitch = item.href === "/kill-switch";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`
                    flex flex-col items-center gap-1 px-2 py-3 rounded-xl text-[10px] font-medium font-mono
                    transition-all duration-200
                    ${active
                      ? isKillSwitch
                        ? "text-apex-red bg-apex-red/[0.08] border border-apex-red/20"
                        : "text-apex-accent bg-apex-accent/[0.08] border border-apex-accent/20"
                      : "text-apex-muted hover:text-white/80 hover:bg-white/[0.03] border border-transparent"
                    }
                  `}
                >
                  <item.icon className={`w-4 h-4 ${active ? (isKillSwitch ? "text-apex-red" : "text-apex-accent") : ""}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
