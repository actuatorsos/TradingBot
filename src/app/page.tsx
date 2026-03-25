"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";

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

interface MarketData {
  success: boolean;
  main: SpotRate | null;
  pairs: SpotRate[];
}

interface SignalData {
  success: boolean;
  signal: Signal;
  indicator_details: IndicatorDetail[];
  current_rate: SpotRate;
}

interface StatusData {
  success: boolean;
  status: string;
  version: string;
  config: {
    pair: string;
    timeframe: string;
    min_confidence: number;
    indicators: number;
    strategy: string;
  };
  risk: {
    daily_drawdown_limit: string;
    risk_per_trade: string;
    max_consecutive_losses: number;
    circuit_breaker: string;
  };
}

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

  const directionColor =
    signal?.direction === "BUY"
      ? "text-apex-green"
      : signal?.direction === "SELL"
      ? "text-apex-red"
      : "text-apex-amber";

  const directionBg =
    signal?.direction === "BUY"
      ? "glow-green"
      : signal?.direction === "SELL"
      ? "glow-red"
      : "glow-amber";

  return (
    <div className="relative z-10 min-h-screen p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* ── Header ── */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-apex-accent/20 to-apex-green/20 border border-apex-accent/30 flex items-center justify-center">
              <Zap className="w-6 h-6 text-apex-accent" />
            </div>
            <div className="absolute -top-1 -right-1 live-dot" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              APEX TRADER
              <span className="text-apex-accent ml-2 font-mono text-lg">AI</span>
            </h1>
            <p className="text-sm text-apex-muted font-mono">
              9-Indicator Confluence Engine
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4 md:mt-0">
          <div className="flex items-center gap-2 text-sm">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-apex-green" />
            ) : (
              <WifiOff className="w-4 h-4 text-apex-red" />
            )}
            <span className={isConnected ? "text-apex-green" : "text-apex-red"}>
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-apex-border bg-apex-surface/50 hover:bg-apex-card text-sm text-apex-muted hover:text-white transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {lastUpdate && (
            <span className="text-xs text-apex-muted font-mono">
              <Clock className="w-3 h-3 inline mr-1" />
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </header>

      {/* ── Main Signal Card ── */}
      <div className={`rounded-2xl border border-apex-border bg-apex-card/80 backdrop-blur-sm p-6 md:p-8 mb-6 ${directionBg} animate-slide-up`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div
              className={`w-20 h-20 rounded-2xl flex items-center justify-center ${
                signal?.direction === "BUY"
                  ? "bg-apex-green/10 border border-apex-green/30"
                  : signal?.direction === "SELL"
                  ? "bg-apex-red/10 border border-apex-red/30"
                  : "bg-apex-amber/10 border border-apex-amber/30"
              }`}
            >
              {signal?.direction === "BUY" ? (
                <ArrowUpRight className="w-10 h-10 text-apex-green" />
              ) : signal?.direction === "SELL" ? (
                <ArrowDownRight className="w-10 h-10 text-apex-red" />
              ) : (
                <Minus className="w-10 h-10 text-apex-amber" />
              )}
            </div>
            <div>
              <div className="text-sm text-apex-muted uppercase tracking-widest mb-1">
                Current Signal
              </div>
              <div className={`text-4xl font-bold tracking-tight ${directionColor}`}>
                {signal?.direction || "---"}
              </div>
              <div className="text-sm text-apex-muted mt-1 font-mono">
                {status?.config.pair?.replace("_", "/") || "EUR/USD"} &middot;{" "}
                {status?.config.timeframe || "M5"}
              </div>
            </div>
          </div>

          {/* Confidence Gauge */}
          <div className="flex-1 max-w-md">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-apex-muted">Confluence Score</span>
              <span className={`text-2xl font-bold font-mono ${directionColor}`}>
                {signal?.confidence?.toFixed(1) || "0.0"}%
              </span>
            </div>
            <div className="h-3 rounded-full bg-apex-surface overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                  signal?.direction === "BUY"
                    ? "bg-gradient-to-r from-apex-green/60 to-apex-green"
                    : signal?.direction === "SELL"
                    ? "bg-gradient-to-r from-apex-red/60 to-apex-red"
                    : "bg-gradient-to-r from-apex-amber/60 to-apex-amber"
                }`}
                style={{ width: `${signal?.confidence || 0}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-apex-muted font-mono">0%</span>
              <span className="text-[10px] text-apex-amber font-mono">72% MIN</span>
              <span className="text-[10px] text-apex-muted font-mono">100%</span>
            </div>
          </div>

          {/* Trade Levels */}
          {signal && signal.direction !== "HOLD" && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="px-4 py-3 rounded-xl bg-apex-surface/80 border border-apex-border">
                <div className="text-[10px] text-apex-muted uppercase tracking-wider">
                  Entry
                </div>
                <div className="text-sm font-mono font-semibold text-white mt-1">
                  {signal.entry_price.toFixed(5)}
                </div>
              </div>
              <div className="px-4 py-3 rounded-xl bg-apex-red/5 border border-apex-red/20">
                <div className="text-[10px] text-apex-red uppercase tracking-wider">
                  Stop Loss
                </div>
                <div className="text-sm font-mono font-semibold text-apex-red mt-1">
                  {signal.stop_loss.toFixed(5)}
                </div>
              </div>
              <div className="px-4 py-3 rounded-xl bg-apex-green/5 border border-apex-green/20">
                <div className="text-[10px] text-apex-green uppercase tracking-wider">
                  Take Profit
                </div>
                <div className="text-sm font-mono font-semibold text-apex-green mt-1">
                  {signal.take_profit.toFixed(5)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Signal Reasons */}
        {signal && signal.reasons.length > 0 && (
          <div className="mt-6 pt-5 border-t border-white/5">
            <div className="text-xs text-apex-muted uppercase tracking-widest mb-3">
              Signal Reasons
            </div>
            <div className="flex flex-wrap gap-2">
              {signal.reasons.map((reason, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                    signal.direction === "BUY"
                      ? "bg-apex-green/10 text-apex-green border border-apex-green/20"
                      : signal.direction === "SELL"
                      ? "bg-apex-red/10 text-apex-red border border-apex-red/20"
                      : "bg-apex-amber/10 text-apex-amber border border-apex-amber/20"
                  }`}
                >
                  <ChevronRight className="w-3 h-3" />
                  {reason}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Grid: Indicators + Market ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* 9 Indicators Panel */}
        <div className="lg:col-span-2 rounded-2xl border border-apex-border bg-apex-card/60 backdrop-blur-sm p-6 animate-slide-up stagger-2">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-5 h-5 text-apex-accent" />
            <h2 className="text-lg font-semibold text-white">
              9-Indicator Analysis
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {indicators.map((ind, i) => (
              <div
                key={ind.name}
                className={`rounded-xl border bg-apex-surface/50 p-4 card-hover stagger-${i + 1} ${
                  ind.signal === "bullish"
                    ? "border-apex-green/20"
                    : ind.signal === "bearish"
                    ? "border-apex-red/20"
                    : "border-apex-border"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-apex-muted font-medium">
                    {ind.name}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wider ${
                      ind.signal === "bullish"
                        ? "bg-apex-green/10 text-apex-green"
                        : ind.signal === "bearish"
                        ? "bg-apex-red/10 text-apex-red"
                        : "bg-white/5 text-apex-muted"
                    }`}
                  >
                    {ind.signal}
                  </span>
                </div>
                <div className="text-xl font-mono font-semibold text-white mb-3">
                  {typeof ind.value === "number"
                    ? ind.value.toFixed(ind.value > 10 ? 1 : 5)
                    : ind.value}
                </div>
                <div className="indicator-bar">
                  <div
                    className={`indicator-fill ${
                      ind.signal === "bullish"
                        ? "bg-apex-green"
                        : ind.signal === "bearish"
                        ? "bg-apex-red"
                        : "bg-apex-muted"
                    }`}
                    style={{ width: `${ind.contribution}%` }}
                  />
                </div>
                <div className="text-[10px] text-apex-muted mt-1 font-mono">
                  Weight: {ind.weight}x &middot; {ind.contribution.toFixed(1)}%
                  contribution
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Rates + Risk */}
        <div className="space-y-6">
          {/* Live Rate */}
          {mainRate && (
            <div className="rounded-2xl border border-apex-border bg-apex-card/60 backdrop-blur-sm p-6 glow-cyan animate-slide-up stagger-3">
              <div className="flex items-center gap-3 mb-4">
                <Activity className="w-5 h-5 text-apex-accent" />
                <h2 className="text-lg font-semibold text-white">Live Rate</h2>
              </div>
              <div className="text-center py-4">
                <div className="text-xs text-apex-muted uppercase tracking-widest mb-2">
                  {mainRate.base}/{mainRate.quote}
                </div>
                <div className="text-4xl font-mono font-bold text-white mb-4">
                  {mainRate.midpoint.toFixed(5)}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-[10px] text-apex-muted uppercase">Bid</div>
                    <div className="text-sm font-mono text-apex-green">
                      {mainRate.bid.toFixed(5)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-apex-muted uppercase">Ask</div>
                    <div className="text-sm font-mono text-apex-red">
                      {mainRate.ask.toFixed(5)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-apex-muted uppercase">
                      Spread
                    </div>
                    <div className="text-sm font-mono text-apex-amber">
                      {mainRate.spread.toFixed(1)}p
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Risk Management */}
          <div className="rounded-2xl border border-apex-border bg-apex-card/60 backdrop-blur-sm p-6 animate-slide-up stagger-4">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-apex-accent" />
              <h2 className="text-lg font-semibold text-white">Risk Controls</h2>
            </div>
            <div className="space-y-4">
              {[
                {
                  label: "Daily Drawdown Limit",
                  value: status?.risk.daily_drawdown_limit || "5%",
                  icon: AlertTriangle,
                  color: "text-apex-amber",
                },
                {
                  label: "Risk Per Trade",
                  value: status?.risk.risk_per_trade || "1%",
                  icon: Target,
                  color: "text-apex-accent",
                },
                {
                  label: "Max Consecutive Losses",
                  value: String(status?.risk.max_consecutive_losses || 5),
                  icon: Shield,
                  color: "text-apex-red",
                },
                {
                  label: "Circuit Breaker",
                  value: status?.risk.circuit_breaker || "active",
                  icon: Zap,
                  color: "text-apex-green",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <item.icon className={`w-4 h-4 ${item.color}`} />
                    <span className="text-sm text-apex-muted">{item.label}</span>
                  </div>
                  <span className="text-sm font-mono font-medium text-white">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* System Status */}
          <div className="rounded-2xl border border-apex-border bg-apex-card/60 backdrop-blur-sm p-6 animate-slide-up stagger-5">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-5 h-5 text-apex-accent" />
              <h2 className="text-lg font-semibold text-white">System</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-apex-muted">Status</span>
                <span className="text-apex-green font-mono">
                  {status?.status || "---"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-apex-muted">Mode</span>
                <span className="text-apex-accent font-mono">Monitoring</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-apex-muted">Strategy</span>
                <span className="text-white font-mono text-xs">Confluence</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-apex-muted">Version</span>
                <span className="text-apex-muted font-mono">
                  {status?.version || "1.0.0"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Forex Pairs Grid ── */}
      {pairs.length > 0 && (
        <div className="rounded-2xl border border-apex-border bg-apex-card/60 backdrop-blur-sm p-6 animate-slide-up stagger-6">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-5 h-5 text-apex-accent" />
            <h2 className="text-lg font-semibold text-white">
              Forex Rates Overview
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {pairs.map((pair) => (
              <div
                key={`${pair.base}${pair.quote}`}
                className="rounded-xl border border-apex-border bg-apex-surface/50 p-4 card-hover text-center"
              >
                <div className="text-xs text-apex-muted font-mono mb-2">
                  {pair.base}/{pair.quote}
                </div>
                <div className="text-lg font-mono font-semibold text-white">
                  {pair.midpoint.toFixed(pair.quote === "JPY" ? 3 : 5)}
                </div>
                <div className="text-[10px] text-apex-amber font-mono mt-1">
                  {pair.spread.toFixed(1)}p spread
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="mt-8 text-center text-xs text-apex-muted/50 font-mono pb-4">
        APEX TRADER AI v{status?.version || "1.0.0"} &middot; Multi-Indicator
        Confluence Engine &middot; Data via OANDA Exchange Rates API
      </footer>
    </div>
  );
}
