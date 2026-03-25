"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Activity, TrendingUp, TrendingDown, Shield, Zap, BarChart3,
  RefreshCw, Wifi, WifiOff, ArrowUpRight, ArrowDownRight, Minus,
  Clock, Target, AlertTriangle, ChevronRight, Settings2, Radio,
  Globe, Sun, Moon, Sunrise,
} from "lucide-react";
import Link from "next/link";

/* ═══════ INTERFACES ═══════ */
interface SpotRate { base: string; quote: string; bid: number; ask: number; midpoint: number; spread: number; timestamp: string; }
interface Signal { direction: "BUY" | "SELL" | "HOLD"; confidence: number; reasons: string[]; indicators: Record<string, number | boolean>; entry_price: number; stop_loss: number; take_profit: number; timestamp: string; }
interface IndicatorDetail { name: string; value: number | string; signal: "bullish" | "bearish" | "neutral"; weight: number; contribution: number; }
interface MarketData { success: boolean; main: SpotRate | null; pairs: SpotRate[]; }
interface SignalData { success: boolean; signal: Signal; indicator_details: IndicatorDetail[]; current_rate: SpotRate; }
interface StatusData { success: boolean; status: string; version: string; config: { pair: string; timeframe: string; min_confidence: number; indicators: number; strategy: string; }; risk: { daily_drawdown_limit: string; risk_per_trade: string; max_consecutive_losses: number; circuit_breaker: string; }; }

/* ═══════ SPARKLINE COMPONENT ═══════ */
function Sparkline({ data, color, width = 100, height = 32 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * (height - 4) - 2,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaD = `${pathD} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={`grad-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#grad-${color.replace("#","")})`} className="sparkline-area" />
      <path d={pathD} stroke={color} className="sparkline-path" />
      <circle cx={points[points.length-1].x} cy={points[points.length-1].y} r="2.5" fill={color} opacity="0.8" />
    </svg>
  );
}

/* ═══════ SPOTLIGHT CARD ═══════ */
function SpotlightCard({ children, className = "", glowClass = "" }: { children: React.ReactNode; className?: string; glowClass?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--mouse-x", `${e.clientX - r.left}px`);
    ref.current.style.setProperty("--mouse-y", `${e.clientY - r.top}px`);
  };
  return (
    <div ref={ref} onMouseMove={onMove} className={`spotlight-card ${glowClass} ${className}`}>
      <div className="glass-sheen absolute inset-0 rounded-[16px] pointer-events-none" />
      {children}
    </div>
  );
}

/* ═══════ CONFIDENCE RING ═══════ */
function ConfidenceRing({ value, color }: { value: number; color: string }) {
  const r = 52, circ = 2 * Math.PI * r, offset = circ - (value / 100) * circ;
  return (
    <div className="confidence-ring" style={{ "--size": "140px" } as React.CSSProperties}>
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} stroke="rgba(26,35,64,0.6)" />
        <circle cx="60" cy="60" r={r} stroke={color} strokeDasharray={circ} strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 8px ${color}50)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold font-mono text-white" style={{ textShadow: `0 0 20px ${color}30` }}>{value.toFixed(1)}<span className="text-lg">%</span></span>
        <span className="text-[8px] uppercase tracking-[0.25em] text-apex-muted mt-0.5">Confluence</span>
      </div>
    </div>
  );
}

/* ═══════ MARKET SESSION INDICATOR ═══════ */
function MarketSessions() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  const utcH = now.getUTCHours();
  const sessions = [
    { name: "Sydney", icon: Sunrise, open: 21, close: 6, color: "#a855f7" },
    { name: "Tokyo", icon: Sun, open: 0, close: 9, color: "#ff1744" },
    { name: "London", icon: Globe, open: 7, close: 16, color: "#00f0ff" },
    { name: "New York", icon: Moon, open: 13, close: 22, color: "#00e676" },
  ];
  return (
    <div className="flex items-center gap-1">
      {sessions.map(s => {
        const active = s.open < s.close ? (utcH >= s.open && utcH < s.close) : (utcH >= s.open || utcH < s.close);
        return (
          <div key={s.name} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
            active ? "bg-white/[0.06] border border-white/[0.1]" : "opacity-40"
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${active ? "session-active" : ""}`} style={{ background: active ? s.color : "#3a4a6a" }} />
            <span className={active ? "text-white" : "text-apex-muted"}>{s.name}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════ ANIMATED PRICE ═══════ */
function AnimatedPrice({ value, decimals = 5 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(value.toFixed(decimals));
  useEffect(() => { setDisplay(value.toFixed(decimals)); }, [value, decimals]);
  return <span className="animate-count inline-block" key={display}>{display}</span>;
}

/* ═══════════════════════════════════════════
   MAIN DASHBOARD
   ═══════════════════════════════════════════ */
export default function Dashboard() {
  const [market, setMarket] = useState<MarketData | null>(null);
  const [signalData, setSignalData] = useState<SignalData | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [time, setTime] = useState(new Date());

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  const fetchData = useCallback(async () => {
    try {
      const [mRes, sRes, stRes] = await Promise.all([
        fetch("/api/market").then(r => r.json()).catch(() => null),
        fetch("/api/signals").then(r => r.json()).catch(() => null),
        fetch("/api/status").then(r => r.json()).catch(() => null),
      ]);
      setMarket(mRes); setSignalData(sRes); setStatus(stRes);
      setIsConnected(true); setLastUpdate(new Date());
    } catch { setIsConnected(false); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 15000); return () => clearInterval(i); }, [fetchData]);

  const signal = signalData?.signal;
  const indicators = signalData?.indicator_details || [];
  const mainRate = market?.main;
  const pairs = market?.pairs || [];

  const accentColor = signal?.direction === "BUY" ? "#00e676" : signal?.direction === "SELL" ? "#ff1744" : "#ffab00";
  const dirColor = signal?.direction === "BUY" ? "text-apex-green" : signal?.direction === "SELL" ? "text-apex-red" : "text-apex-amber";
  const glowCls = signal?.direction === "BUY" ? "glow-green" : signal?.direction === "SELL" ? "glow-red" : "glow-amber";
  const pulseCls = signal?.direction === "BUY" ? "signal-pulse-green" : signal?.direction === "SELL" ? "signal-pulse-red" : "signal-pulse-amber";
  const bullCount = indicators.filter(i => i.signal === "bullish").length;
  const bearCount = indicators.filter(i => i.signal === "bearish").length;

  /* Loading */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <div className="orb orb-1 top-[10%] left-[20%]" />
        <div className="orb orb-2 bottom-[20%] right-[15%]" />
        <div className="text-center relative z-10">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-apex-card border border-apex-border flex items-center justify-center animate-pulse">
            <Zap className="w-8 h-8 text-apex-accent" />
          </div>
          <div className="text-xl font-bold text-white mb-1 font-[Outfit]">APEX TRADER AI</div>
          <div className="text-sm text-apex-muted font-mono">Initializing confluence engine...</div>
          <div className="mt-5 w-52 h-1 mx-auto rounded-full overflow-hidden bg-apex-surface">
            <div className="h-full w-1/3 bg-gradient-to-r from-apex-accent to-purple-500 rounded-full shimmer" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 min-h-screen">
      {/* Floating orbs */}
      <div className="orb orb-1 top-[5%] left-[10%]" />
      <div className="orb orb-2 top-[40%] right-[5%]" />
      <div className="orb orb-3 bottom-[10%] left-[30%]" />

      {/* ═══════ TICKER BAR ═══════ */}
      {pairs.length > 0 && (
        <div className="w-full overflow-hidden border-b border-white/[0.04] bg-black/20 backdrop-blur-sm">
          <div className="ticker-track py-2">
            {[...pairs, ...pairs].map((p, i) => (
              <div key={`${p.base}${p.quote}-${i}`} className="flex items-center gap-3 px-6 whitespace-nowrap">
                <span className="text-[11px] font-mono text-white/70">{p.base}/{p.quote}</span>
                <span className="text-[11px] font-mono font-semibold text-white">{p.midpoint.toFixed(p.quote === "JPY" ? 3 : 5)}</span>
                <span className="text-[9px] font-mono text-apex-amber/70">{p.spread.toFixed(1)}p</span>
                <div className="w-px h-3 bg-white/[0.06]" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
        {/* ═══════ HEADER ═══════ */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-apex-accent/25 to-purple-500/15 border border-apex-accent/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-apex-accent" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 live-dot" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 font-[Outfit]">
                APEX TRADER
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-gradient-to-r from-apex-accent/15 to-purple-500/15 border border-apex-accent/20 text-apex-accent">AI</span>
              </h1>
              <p className="text-[10px] text-apex-muted font-mono mt-0.5">9-Indicator Confluence Engine</p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3 mt-4 md:mt-0">
            <MarketSessions />
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                {isConnected ? <Wifi className="w-3.5 h-3.5 text-apex-green" /> : <WifiOff className="w-3.5 h-3.5 text-apex-red" />}
                <span className={`text-[10px] font-semibold ${isConnected ? "text-apex-green" : "text-apex-red"}`}>
                  {isConnected ? "LIVE" : "OFFLINE"}
                </span>
              </div>
              <Link href="/settings" className="btn-glass"><Settings2 className="w-3.5 h-3.5" /> Settings</Link>
              <button onClick={fetchData} className="btn-glass"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /></button>
              <span className="text-[11px] text-apex-muted font-mono hidden md:inline-flex items-center gap-1 tabular-nums">
                <Clock className="w-3 h-3" />{time.toLocaleTimeString()}
              </span>
            </div>
          </div>
        </header>

        {/* ═══════ HERO SIGNAL ═══════ */}
        <SpotlightCard className={`p-6 md:p-8 mb-5 animate-slide-up border-gradient ${glowCls}`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className={`w-[76px] h-[76px] rounded-2xl flex items-center justify-center ${pulseCls} ${
                signal?.direction === "BUY" ? "bg-apex-green/10 border-2 border-apex-green/30"
                  : signal?.direction === "SELL" ? "bg-apex-red/10 border-2 border-apex-red/30"
                  : "bg-apex-amber/10 border-2 border-apex-amber/30"
              }`}>
                {signal?.direction === "BUY" ? <ArrowUpRight className="w-10 h-10 text-apex-green" />
                  : signal?.direction === "SELL" ? <ArrowDownRight className="w-10 h-10 text-apex-red" />
                  : <Minus className="w-10 h-10 text-apex-amber" />}
              </div>
              <div>
                <div className="text-[10px] text-apex-muted uppercase tracking-[0.25em] mb-1 flex items-center gap-2">
                  <Radio className="w-3 h-3" /> Active Signal
                </div>
                <div className={`text-5xl font-bold tracking-tight font-[Outfit] ${dirColor}`} style={{ textShadow: `0 0 40px ${accentColor}25` }}>
                  {signal?.direction || "---"}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-white/80">{status?.config.pair?.replace("_","/") || "EUR/USD"}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-white/60">{status?.config.timeframe || "M5"}</span>
                  <span className="text-[10px] font-mono text-apex-green">{bullCount}B</span>
                  <span className="text-[10px] font-mono text-apex-muted">/</span>
                  <span className="text-[10px] font-mono text-apex-red">{bearCount}S</span>
                </div>
              </div>
            </div>

            <ConfidenceRing value={signal?.confidence || 0} color={accentColor} />

            {signal && signal.direction !== "HOLD" ? (
              <div className="grid grid-cols-3 gap-3 text-center min-w-[300px]">
                {[
                  { label: "Entry", value: signal.entry_price, cls: "bg-white/[0.03] border-white/[0.06]", text: "text-white" },
                  { label: "Stop Loss", value: signal.stop_loss, cls: "bg-apex-red/[0.04] border-apex-red/[0.12]", text: "text-apex-red" },
                  { label: "Take Profit", value: signal.take_profit, cls: "bg-apex-green/[0.04] border-apex-green/[0.12]", text: "text-apex-green" },
                ].map(l => (
                  <div key={l.label} className={`px-4 py-4 rounded-xl border ${l.cls}`}>
                    <div className={`text-[8px] uppercase tracking-[0.2em] mb-1.5 opacity-70 ${l.text}`}>{l.label}</div>
                    <div className={`text-sm font-mono font-bold ${l.text}`}><AnimatedPrice value={l.value} /></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="min-w-[300px] text-center px-6 py-10 rounded-xl bg-white/[0.015] border border-white/[0.04] border-dashed">
                <Minus className="w-5 h-5 text-apex-muted mx-auto mb-2 opacity-50" />
                <div className="text-[11px] text-apex-muted">Awaiting trade signal</div>
              </div>
            )}
          </div>

          {signal && signal.reasons.length > 0 && (
            <div className="mt-6 pt-5 border-t border-white/[0.04]">
              <div className="text-[9px] text-apex-muted uppercase tracking-[0.25em] mb-3">Signal Reasons</div>
              <div className="flex flex-wrap gap-2">
                {signal.reasons.map((r, i) => (
                  <span key={i} className={`reason-chip ${
                    signal.direction === "BUY" ? "bg-apex-green/[0.07] text-apex-green border border-apex-green/[0.12]"
                      : signal.direction === "SELL" ? "bg-apex-red/[0.07] text-apex-red border border-apex-red/[0.12]"
                      : "bg-apex-amber/[0.07] text-apex-amber border border-apex-amber/[0.12]"
                  }`}><ChevronRight className="w-3 h-3 opacity-50" />{r}</span>
                ))}
              </div>
            </div>
          )}
        </SpotlightCard>

        {/* ═══════ BENTO GRID ═══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-5">

          {/* 9 INDICATORS */}
          <SpotlightCard className="lg:col-span-8 p-6 animate-slide-up stagger-2">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-apex-accent/15 to-purple-500/10 border border-apex-accent/20 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-apex-accent" />
                </div>
                <h2 className="text-base font-semibold text-white font-[Outfit]">9-Indicator Analysis</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {indicators.map((ind, i) => (
                    <div key={i} className={`w-2 h-2 rounded-sm ${
                      ind.signal === "bullish" ? "bg-apex-green" : ind.signal === "bearish" ? "bg-apex-red" : "bg-apex-muted/30"
                    }`} title={ind.name} />
                  ))}
                </div>
                <span className="text-[10px] font-mono text-apex-muted ml-1">{bullCount}B/{bearCount}S</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {indicators.map((ind, i) => {
                const bull = ind.signal === "bullish", bear = ind.signal === "bearish";
                return (
                  <div key={ind.name} className={`rounded-xl border p-4 transition-all duration-300 hover:translate-y-[-2px] hover:shadow-lg stagger-${i+1} ${
                    bull ? "border-apex-green/[0.15] bg-apex-green/[0.025] hover:border-apex-green/[0.3] hover:shadow-apex-green/5"
                      : bear ? "border-apex-red/[0.15] bg-apex-red/[0.025] hover:border-apex-red/[0.3] hover:shadow-apex-red/5"
                      : "border-white/[0.05] bg-white/[0.015] hover:border-white/[0.12]"
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-apex-muted font-medium">{ind.name}</span>
                      <span className={`text-[8px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wider font-bold ${
                        bull ? "bg-apex-green/15 text-apex-green" : bear ? "bg-apex-red/15 text-apex-red" : "bg-white/5 text-apex-muted"
                      }`}>{ind.signal}</span>
                    </div>
                    <div className="text-xl font-mono font-bold text-white mb-2">
                      {typeof ind.value === "number" ? ind.value.toFixed(ind.value > 10 ? 1 : 5) : ind.value}
                    </div>
                    <div className="indicator-bar mb-1.5">
                      <div className={`indicator-fill ${bull ? "bg-apex-green" : bear ? "bg-apex-red" : "bg-apex-muted/40"}`}
                        style={{ width: `${ind.contribution}%` }} />
                    </div>
                    <div className="flex justify-between text-[8px] text-apex-muted font-mono">
                      <span>{ind.weight}x weight</span>
                      <span>{ind.contribution.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </SpotlightCard>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-4 space-y-5">

            {/* Live Rate with Sparkline */}
            <SpotlightCard className="p-6 animate-slide-up stagger-3" glowClass="glow-cyan">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-apex-accent/15 to-purple-500/10 border border-apex-accent/20 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-apex-accent" />
                </div>
                <h2 className="text-base font-semibold text-white font-[Outfit]">Live Rate</h2>
              </div>
              {mainRate ? (
                <div className="text-center">
                  <div className="text-[10px] text-apex-muted uppercase tracking-[0.25em] mb-1 font-mono">{mainRate.base}/{mainRate.quote}</div>
                  <div className="text-4xl font-mono font-bold text-white mb-2" style={{ textShadow: "0 0 30px rgba(0,240,255,0.15)" }}>
                    <AnimatedPrice value={mainRate.midpoint} />
                  </div>
                  {/* Sparkline */}
                  <SparklineForRate rate={mainRate.midpoint} />
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {[
                      { label: "Bid", val: mainRate.bid.toFixed(5), cls: "text-apex-green", bg: "bg-apex-green" },
                      { label: "Ask", val: mainRate.ask.toFixed(5), cls: "text-apex-red", bg: "bg-apex-red" },
                      { label: "Spread", val: `${mainRate.spread.toFixed(1)}p`, cls: "text-apex-amber", bg: "bg-apex-amber" },
                    ].map(x => (
                      <div key={x.label} className={`py-2.5 px-2 rounded-lg ${x.bg}/[0.04] border ${x.bg}/[0.1]`}>
                        <div className={`text-[7px] uppercase tracking-wider mb-1 opacity-60 ${x.cls}`}>{x.label}</div>
                        <div className={`text-[11px] font-mono font-semibold ${x.cls}`}>{x.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8"><div className="shimmer w-32 h-8 rounded-lg mx-auto mb-3" /><div className="shimmer w-24 h-4 rounded mx-auto" /></div>
              )}
            </SpotlightCard>

            {/* Risk Controls */}
            <SpotlightCard className="p-6 animate-slide-up stagger-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-apex-red/15 to-apex-amber/10 border border-apex-red/20 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-apex-red" />
                </div>
                <h2 className="text-base font-semibold text-white font-[Outfit]">Risk Controls</h2>
              </div>
              <div className="space-y-2">
                {[
                  { label: "Daily Drawdown", value: status?.risk.daily_drawdown_limit || "5%", color: "bg-apex-amber", text: "text-apex-amber" },
                  { label: "Risk Per Trade", value: status?.risk.risk_per_trade || "1%", color: "bg-apex-accent", text: "text-apex-accent" },
                  { label: "Consec. Losses", value: String(status?.risk.max_consecutive_losses || 5), color: "bg-apex-red", text: "text-apex-red" },
                  { label: "Circuit Breaker", value: status?.risk.circuit_breaker || "active", color: "bg-apex-green", text: "text-apex-green" },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-all">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                      <span className="text-[11px] text-apex-muted">{item.label}</span>
                    </div>
                    <span className={`text-[11px] font-mono font-bold ${item.text}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </SpotlightCard>

            {/* System Status */}
            <SpotlightCard className="p-6 animate-slide-up stagger-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-apex-accent/15 to-apex-green/10 border border-apex-accent/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-apex-accent" />
                </div>
                <h2 className="text-base font-semibold text-white font-[Outfit]">System</h2>
              </div>
              <div className="space-y-2">
                {[
                  { label: "Status", value: status?.status || "---", color: "text-apex-green" },
                  { label: "Mode", value: "Monitoring", color: "text-apex-accent" },
                  { label: "Strategy", value: "Confluence", color: "text-white" },
                  { label: "Version", value: status?.version || "1.0.0", color: "text-apex-muted" },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center text-[11px]">
                    <span className="text-apex-muted">{item.label}</span>
                    <span className={`font-mono font-semibold ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </SpotlightCard>
          </div>
        </div>

        {/* ═══════ FOREX PAIRS WITH SPARKLINES ═══════ */}
        {pairs.length > 0 && (
          <SpotlightCard className="p-6 animate-slide-up stagger-6 mb-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-apex-accent/15 to-purple-500/10 border border-apex-accent/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-apex-accent" />
                </div>
                <h2 className="text-base font-semibold text-white font-[Outfit]">Forex Rates</h2>
              </div>
              <span className="text-[10px] text-apex-muted font-mono">{pairs.length} pairs &middot; 15s refresh</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {pairs.map((p, idx) => (
                <PairCardWithSparkline key={`${p.base}${p.quote}`} pair={p} idx={idx} />
              ))}
            </div>
          </SpotlightCard>
        )}

        {/* ═══════ INDICATOR HEATMAP ═══════ */}
        {indicators.length > 0 && (
          <SpotlightCard className="p-6 animate-slide-up stagger-7 mb-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/15 to-apex-accent/10 border border-purple-500/20 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                </div>
                <h2 className="text-base font-semibold text-white font-[Outfit]">Signal Heatmap</h2>
              </div>
              <div className="flex items-center gap-4 text-[9px] font-mono text-apex-muted">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-apex-green/50" /> Bullish</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-apex-red/50" /> Bearish</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white/10" /> Neutral</span>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
              {indicators.map((ind) => {
                const bull = ind.signal === "bullish", bear = ind.signal === "bearish";
                const intensity = ind.contribution / 100;
                const bg = bull ? `rgba(0,230,118,${0.08 + intensity * 0.25})` : bear ? `rgba(255,23,68,${0.08 + intensity * 0.25})` : `rgba(255,255,255,${0.02 + intensity * 0.05})`;
                return (
                  <div key={ind.name} className="heat-cell" style={{ background: bg }}>
                    <div className="text-[9px] text-white/60 font-medium mb-1 truncate">{ind.name.split(" ")[0]}</div>
                    <div className={`text-sm font-mono font-bold ${bull ? "text-apex-green" : bear ? "text-apex-red" : "text-white/50"}`}>
                      {ind.contribution.toFixed(0)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </SpotlightCard>
        )}

        {/* ═══════ FOOTER ═══════ */}
        <footer className="mt-4 text-center text-[9px] text-apex-muted/30 font-mono pb-4 tracking-[0.15em]">
          APEX TRADER AI v{status?.version || "1.0.0"} &middot; 9-Indicator Confluence Engine &middot; Live Forex Data
        </footer>
      </div>
    </div>
  );
}

/* ═══════ PAIR CARD WITH SPARKLINE ═══════ */
function PairCardWithSparkline({ pair, idx }: { pair: SpotRate; idx: number }) {
  const sparkData = useSparkData(pair.midpoint, idx + 1);
  const trend = sparkData[sparkData.length-1] >= sparkData[0];
  const color = trend ? "#00e676" : "#ff1744";
  return (
    <div className="pair-card text-center">
      <div className="text-[9px] text-apex-muted font-mono mb-1 uppercase tracking-[0.15em]">{pair.base}/{pair.quote}</div>
      <div className="text-lg font-mono font-bold text-white mb-2">{pair.midpoint.toFixed(pair.quote === "JPY" ? 3 : 5)}</div>
      <div className="flex justify-center mb-2">
        <Sparkline data={sparkData} color={color} width={90} height={28} />
      </div>
      <div className="text-[8px] text-apex-amber/70 font-mono">{pair.spread.toFixed(1)}p spread</div>
    </div>
  );
}

/* Helper: sparkline data for the live rate card */
function SparklineForRate({ rate }: { rate: number }) {
  const data = useSparkData(rate, 42);
  return (
    <div className="flex justify-center my-2">
      <Sparkline data={data} color="#00f0ff" width={180} height={40} />
    </div>
  );
}

function useSparkData(base: number, seed: number) {
  return useMemo(() => {
    const pts: number[] = [];
    let v = base;
    for (let i = 0; i < 24; i++) {
      v += (Math.sin(seed * 13.7 + i * 0.8) * 0.0003) + (Math.cos(seed * 7.3 + i * 1.2) * 0.0002);
      pts.push(v);
    }
    return pts;
  }, [base, seed]);
}
