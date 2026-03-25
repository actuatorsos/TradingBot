"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Shield,
  Zap,
  BarChart3,
  RefreshCw,
  Wifi,
  WifiOff,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Clock,
  Target,
  AlertTriangle,
  ChevronRight,
  Settings2,
  Radio,
} from "lucide-react";
import Link from "next/link";

/* ─── Interfaces ─── */
interface SpotRate {
  base: string;
  quote: string;
  bid: number;
  ask: number;
  midpoint: number;
  spread: number;
  timestamp: string;
}
interface Signal {
  direction: "BUY" | "SELL" | "HOLD";
  confidence: number;
  reasons: string[];
  indicators: Record<string, number | boolean>;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  timestamp: string;
}
interface IndicatorDetail {
  name: string;
  value: number | string;
  signal: "bullish" | "bearish" | "neutral";
  weight: number;
  contribution: number;
}
interface MarketData { success: boolean; main: SpotRate | null; pairs: SpotRate[]; }
interface SignalData { success: boolean; signal: Signal; indicator_details: IndicatorDetail[]; current_rate: SpotRate; }
interface StatusData {
  success: boolean; status: string; version: string;
  config: { pair: string; timeframe: string; min_confidence: number; indicators: number; strategy: string; };
  risk: { daily_drawdown_limit: string; risk_per_trade: string; max_consecutive_losses: number; circuit_breaker: string; };
}

/* ─── Spotlight Card Component ─── */
function SpotlightCard({ children, className = "", glowClass = "" }: {
  children: React.ReactNode; className?: string; glowClass?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    cardRef.current.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    cardRef.current.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };
  return (
    <div ref={cardRef} onMouseMove={handleMouseMove}
      className={`spotlight-card ${glowClass} ${className}`}>
      <div className="glass-sheen absolute inset-0 rounded-[16px] pointer-events-none" />
      {children}
    </div>
  );
}

/* ─── Confidence Ring SVG ─── */
function ConfidenceRing({ value, color }: { value: number; color: string }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="confidence-ring" style={{ "--size": "130px" } as React.CSSProperties}>
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} stroke="rgba(30,41,59,0.5)" />
        <circle cx="60" cy="60" r={r} stroke={color}
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold font-mono text-white">{value.toFixed(1)}%</span>
        <span className="text-[9px] uppercase tracking-widest text-apex-muted mt-0.5">Confluence</span>
      </div>
    </div>
  );
}

/* ─── Animated Number ─── */
function AnimatedPrice({ value, decimals = 5 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(value.toFixed(decimals));
  useEffect(() => { setDisplay(value.toFixed(decimals)); }, [value, decimals]);
  return <span className="animate-count inline-block" key={display}>{display}</span>;
}

/* ═══════ MAIN DASHBOARD ═══════ */
export default function Dashboard() {
  const [market, setMarket] = useState<MarketData | null>(null);
  const [signalData, setSignalData] = useState<SignalData | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [marketRes, signalRes, statusRes] = await Promise.all([
        fetch("/api/market").then((r) => r.json()).catch(() => null),
        fetch("/api/signals").then((r) => r.json()).catch(() => null),
        fetch("/api/status").then((r) => r.json()).catch(() => null),
      ]);
      setMarket(marketRes);
      setSignalData(signalRes);
      setStatus(statusRes);
      setIsConnected(true);
      setLastUpdate(new Date());
    } catch {
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const signal = signalData?.signal;
  const indicators = signalData?.indicator_details || [];
  const mainRate = market?.main;
  const pairs = market?.pairs || [];

  const accentColor = signal?.direction === "BUY" ? "#00e676" : signal?.direction === "SELL" ? "#ff1744" : "#ffab00";
  const directionColor = signal?.direction === "BUY" ? "text-apex-green" : signal?.direction === "SELL" ? "text-apex-red" : "text-apex-amber";
  const glowClass = signal?.direction === "BUY" ? "glow-green" : signal?.direction === "SELL" ? "glow-red" : "glow-amber";
  const pulseClass = signal?.direction === "BUY" ? "signal-pulse-green" : signal?.direction === "SELL" ? "signal-pulse-red" : "signal-pulse-amber";

  /* ── Loading State ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-apex-card border border-apex-border flex items-center justify-center animate-pulse">
            <Zap className="w-8 h-8 text-apex-accent" />
          </div>
          <div className="text-lg font-semibold text-white mb-1">APEX TRADER AI</div>
          <div className="text-sm text-apex-muted font-mono">Initializing confluence engine...</div>
          <div className="mt-4 w-48 h-1 mx-auto rounded-full overflow-hidden bg-apex-surface">
            <div className="h-full w-1/2 bg-apex-accent rounded-full shimmer" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 min-h-screen p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* ═══════ HEADER ═══════ */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-apex-accent/20 to-apex-accent/5 border border-apex-accent/20 flex items-center justify-center backdrop-blur-sm">
              <Zap className="w-5 h-5 text-apex-accent" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 live-dot" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              APEX TRADER
              <span className="text-apex-accent font-mono text-sm font-semibold px-2 py-0.5 rounded-md bg-apex-accent/10 border border-apex-accent/20">AI</span>
            </h1>
            <p className="text-xs text-apex-muted font-mono mt-0.5">9-Indicator Confluence Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-apex-surface/60 border border-apex-border/50">
            {isConnected ? <Wifi className="w-3.5 h-3.5 text-apex-green" /> : <WifiOff className="w-3.5 h-3.5 text-apex-red" />}
            <span className={`text-xs font-medium ${isConnected ? "text-apex-green" : "text-apex-red"}`}>
              {isConnected ? "Live" : "Offline"}
            </span>
          </div>
          <Link href="/settings" className="btn-glass">
            <Settings2 className="w-3.5 h-3.5" /> Settings
          </Link>
          <button onClick={fetchData} className="btn-glass">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          {lastUpdate && (
            <span className="text-[11px] text-apex-muted font-mono hidden md:inline-flex items-center gap-1">
              <Clock className="w-3 h-3" /> {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </header>

      {/* ═══════ HERO SIGNAL CARD ═══════ */}
      <SpotlightCard className={`p-6 md:p-8 mb-6 animate-slide-up ${glowClass}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          {/* Left: Signal direction + info */}
          <div className="flex items-center gap-6">
            <div className={`w-[72px] h-[72px] rounded-2xl flex items-center justify-center ${pulseClass} ${
              signal?.direction === "BUY" ? "bg-apex-green/10 border border-apex-green/30"
                : signal?.direction === "SELL" ? "bg-apex-red/10 border border-apex-red/30"
                : "bg-apex-amber/10 border border-apex-amber/30"
            }`}>
              {signal?.direction === "BUY" ? <ArrowUpRight className="w-9 h-9 text-apex-green" />
                : signal?.direction === "SELL" ? <ArrowDownRight className="w-9 h-9 text-apex-red" />
                : <Minus className="w-9 h-9 text-apex-amber" />}
            </div>
            <div>
              <div className="text-[10px] text-apex-muted uppercase tracking-[0.2em] mb-1 flex items-center gap-2">
                <Radio className="w-3 h-3" /> Current Signal
              </div>
              <div className={`text-4xl font-bold tracking-tight ${directionColor}`}>
                {signal?.direction || "---"}
              </div>
              <div className="text-xs text-apex-muted mt-1.5 font-mono flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-white/5">{status?.config.pair?.replace("_", "/") || "EUR/USD"}</span>
                <span className="text-apex-muted-soft">&middot;</span>
                <span>{status?.config.timeframe || "M5"}</span>
              </div>
            </div>
          </div>

          {/* Center: Confidence Ring */}
          <div className="flex items-center justify-center">
            <ConfidenceRing value={signal?.confidence || 0} color={accentColor} />
          </div>

          {/* Right: Trade Levels */}
          {signal && signal.direction !== "HOLD" ? (
            <div className="grid grid-cols-3 gap-3 text-center min-w-[280px]">
              <div className="px-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
                <div className="text-[9px] text-apex-muted uppercase tracking-[0.15em] mb-1">Entry</div>
                <div className="text-sm font-mono font-semibold text-white">
                  <AnimatedPrice value={signal.entry_price} />
                </div>
              </div>
              <div className="px-4 py-3.5 rounded-xl bg-apex-red/[0.04] border border-apex-red/[0.15]">
                <div className="text-[9px] text-apex-red/80 uppercase tracking-[0.15em] mb-1">Stop Loss</div>
                <div className="text-sm font-mono font-semibold text-apex-red">
                  <AnimatedPrice value={signal.stop_loss} />
                </div>
              </div>
              <div className="px-4 py-3.5 rounded-xl bg-apex-green/[0.04] border border-apex-green/[0.15]">
                <div className="text-[9px] text-apex-green/80 uppercase tracking-[0.15em] mb-1">Take Profit</div>
                <div className="text-sm font-mono font-semibold text-apex-green">
                  <AnimatedPrice value={signal.take_profit} />
                </div>
              </div>
            </div>
          ) : (
            <div className="min-w-[280px] text-center px-6 py-8 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <Minus className="w-6 h-6 text-apex-muted mx-auto mb-2" />
              <div className="text-xs text-apex-muted">No active trade levels</div>
            </div>
          )}
        </div>

        {/* Signal Reasons */}
        {signal && signal.reasons.length > 0 && (
          <div className="mt-6 pt-5 border-t border-white/[0.04]">
            <div className="text-[10px] text-apex-muted uppercase tracking-[0.2em] mb-3">Signal Reasons</div>
            <div className="flex flex-wrap gap-2">
              {signal.reasons.map((reason, i) => (
                <span key={i} className={`reason-chip ${
                  signal.direction === "BUY" ? "bg-apex-green/[0.08] text-apex-green border border-apex-green/[0.15]"
                    : signal.direction === "SELL" ? "bg-apex-red/[0.08] text-apex-red border border-apex-red/[0.15]"
                    : "bg-apex-amber/[0.08] text-apex-amber border border-apex-amber/[0.15]"
                }`}>
                  <ChevronRight className="w-3 h-3 opacity-60" /> {reason}
                </span>
              ))}
            </div>
          </div>
        )}
      </SpotlightCard>

      {/* ═══════ BENTO GRID ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6">

        {/* ── 9 Indicators Panel (spans 8 cols) ── */}
        <SpotlightCard className="lg:col-span-8 p-6 animate-slide-up stagger-2">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-apex-accent/10 border border-apex-accent/20 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-apex-accent" />
              </div>
              <h2 className="text-base font-semibold text-white">9-Indicator Analysis</h2>
            </div>
            <div className="text-[10px] font-mono text-apex-muted px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.05]">
              {indicators.filter(i => i.signal === "bullish").length}B / {indicators.filter(i => i.signal === "bearish").length}S / {indicators.filter(i => i.signal === "neutral").length}N
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {indicators.map((ind, i) => {
              const isBull = ind.signal === "bullish";
              const isBear = ind.signal === "bearish";
              return (
                <div key={ind.name}
                  className={`rounded-xl border p-4 transition-all duration-300 hover:translate-y-[-1px] stagger-${i + 1} ${
                    isBull ? "border-apex-green/[0.15] bg-apex-green/[0.03] hover:border-apex-green/[0.3]"
                      : isBear ? "border-apex-red/[0.15] bg-apex-red/[0.03] hover:border-apex-red/[0.3]"
                      : "border-white/[0.05] bg-white/[0.02] hover:border-white/[0.1]"
                  }`}>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] text-apex-muted font-medium">{ind.name}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wider font-medium ${
                      isBull ? "bg-apex-green/10 text-apex-green"
                        : isBear ? "bg-apex-red/10 text-apex-red"
                        : "bg-white/5 text-apex-muted"
                    }`}>{ind.signal}</span>
                  </div>
                  <div className="text-lg font-mono font-semibold text-white mb-2.5">
                    {typeof ind.value === "number"
                      ? ind.value.toFixed(ind.value > 10 ? 1 : 5)
                      : ind.value}
                  </div>
                  <div className="indicator-bar">
                    <div className={`indicator-fill ${
                      isBull ? "bg-apex-green" : isBear ? "bg-apex-red" : "bg-apex-muted/50"
                    }`} style={{ width: `${ind.contribution}%` }} />
                  </div>
                  <div className="text-[9px] text-apex-muted mt-1.5 font-mono">
                    {ind.weight}x weight &middot; {ind.contribution.toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
        </SpotlightCard>

        {/* ── Right Column (spans 4 cols) ── */}
        <div className="lg:col-span-4 space-y-5">

          {/* Live Rate Card */}
          <SpotlightCard className="p-6 animate-slide-up stagger-3" glowClass="glow-cyan">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-apex-accent/10 border border-apex-accent/20 flex items-center justify-center">
                <Activity className="w-4 h-4 text-apex-accent" />
              </div>
              <h2 className="text-base font-semibold text-white">Live Rate</h2>
            </div>
            {mainRate ? (
              <div className="text-center">
                <div className="text-[10px] text-apex-muted uppercase tracking-[0.2em] mb-2 font-mono">
                  {mainRate.base}/{mainRate.quote}
                </div>
                <div className="text-3xl font-mono font-bold text-white mb-5">
                  <AnimatedPrice value={mainRate.midpoint} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="py-2.5 px-3 rounded-lg bg-apex-green/[0.04] border border-apex-green/[0.1]">
                    <div className="text-[8px] text-apex-green/70 uppercase tracking-wider mb-1">Bid</div>
                    <div className="text-xs font-mono font-medium text-apex-green">{mainRate.bid.toFixed(5)}</div>
                  </div>
                  <div className="py-2.5 px-3 rounded-lg bg-apex-red/[0.04] border border-apex-red/[0.1]">
                    <div className="text-[8px] text-apex-red/70 uppercase tracking-wider mb-1">Ask</div>
                    <div className="text-xs font-mono font-medium text-apex-red">{mainRate.ask.toFixed(5)}</div>
                  </div>
                  <div className="py-2.5 px-3 rounded-lg bg-apex-amber/[0.04] border border-apex-amber/[0.1]">
                    <div className="text-[8px] text-apex-amber/70 uppercase tracking-wider mb-1">Spread</div>
                    <div className="text-xs font-mono font-medium text-apex-amber">{mainRate.spread.toFixed(1)}p</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="shimmer w-32 h-8 rounded-lg mx-auto mb-3" />
                <div className="shimmer w-24 h-4 rounded mx-auto" />
              </div>
            )}
          </SpotlightCard>

          {/* Risk Management */}
          <SpotlightCard className="p-6 animate-slide-up stagger-4">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-apex-accent/10 border border-apex-accent/20 flex items-center justify-center">
                <Shield className="w-4 h-4 text-apex-accent" />
              </div>
              <h2 className="text-base font-semibold text-white">Risk Controls</h2>
            </div>
            <div className="space-y-3">
              {[
                { label: "Daily Drawdown", value: status?.risk.daily_drawdown_limit || "5%", icon: AlertTriangle, color: "text-apex-amber", bg: "bg-apex-amber" },
                { label: "Risk Per Trade", value: status?.risk.risk_per_trade || "1%", icon: Target, color: "text-apex-accent", bg: "bg-apex-accent" },
                { label: "Max Consec. Losses", value: String(status?.risk.max_consecutive_losses || 5), icon: Shield, color: "text-apex-red", bg: "bg-apex-red" },
                { label: "Circuit Breaker", value: status?.risk.circuit_breaker || "active", icon: Zap, color: "text-apex-green", bg: "bg-apex-green" },
              ].map((item) => (
                <div key={item.label}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${item.bg}`} />
                    <span className="text-xs text-apex-muted">{item.label}</span>
                  </div>
                  <span className={`text-xs font-mono font-semibold ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </SpotlightCard>

          {/* System Status */}
          <SpotlightCard className="p-6 animate-slide-up stagger-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-apex-accent/10 border border-apex-accent/20 flex items-center justify-center">
                <Zap className="w-4 h-4 text-apex-accent" />
              </div>
              <h2 className="text-base font-semibold text-white">System</h2>
            </div>
            <div className="space-y-2.5">
              {[
                { label: "Status", value: status?.status || "---", color: "text-apex-green" },
                { label: "Mode", value: "Monitoring", color: "text-apex-accent" },
                { label: "Strategy", value: "Confluence", color: "text-white" },
                { label: "Version", value: status?.version || "1.0.0", color: "text-apex-muted" },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center text-xs">
                  <span className="text-apex-muted">{item.label}</span>
                  <span className={`font-mono font-medium ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </SpotlightCard>
        </div>
      </div>

      {/* ═══════ FOREX PAIRS GRID ═══════ */}
      {pairs.length > 0 && (
        <SpotlightCard className="p-6 animate-slide-up stagger-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-apex-accent/10 border border-apex-accent/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-apex-accent" />
              </div>
              <h2 className="text-base font-semibold text-white">Forex Rates</h2>
            </div>
            <span className="text-[10px] text-apex-muted font-mono">{pairs.length} pairs</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {pairs.map((pair) => (
              <div key={`${pair.base}${pair.quote}`} className="pair-card text-center">
                <div className="text-[10px] text-apex-muted font-mono mb-2 uppercase tracking-wider">
                  {pair.base}/{pair.quote}
                </div>
                <div className="text-base font-mono font-bold text-white mb-1">
                  {pair.midpoint.toFixed(pair.quote === "JPY" ? 3 : 5)}
                </div>
                <div className="text-[9px] text-apex-amber/80 font-mono">
                  {pair.spread.toFixed(1)}p spread
                </div>
              </div>
            ))}
          </div>
        </SpotlightCard>
      )}

      {/* ═══════ FOOTER ═══════ */}
      <footer className="mt-6 text-center text-[10px] text-apex-muted/40 font-mono pb-4 tracking-wider">
        APEX TRADER AI v{status?.version || "1.0.0"} &middot; 9-Indicator Confluence Engine &middot; Live Forex Data
      </footer>
    </div>
  );
}
