"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowUpRight, ArrowDownRight, Clock, Target, TrendingUp,
  History, ArrowLeft, Activity, RefreshCw,
} from "lucide-react";
import Link from "next/link";

/* ═══════ INTERFACES ═══════ */
interface Trade {
  id: string;
  pair: string;
  direction: "BUY" | "SELL";
  entry_price: number;
  exit_price: number;
  lot_size: number;
  stop_loss: number;
  take_profit: number;
  confidence: number;
  open_time: string;
  close_time: string;
  pnl_pips: number;
  pnl_dollars: number;
  status: "closed" | "stopped_out" | "take_profit";
  reasons: string[];
}

interface Stats {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  profit_factor: number;
  total_pnl: number;
  avg_pnl_per_trade: number;
  best_trade: number;
  worst_trade: number;
  avg_holding_minutes: number;
}

interface TradesResponse {
  success: boolean;
  demo_mode: boolean;
  trades: Trade[];
  stats: Stats;
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

/* ═══════ FORMAT UTILITIES ═══════ */
function formatPrice(value: number, decimals = 5): string {
  return value.toFixed(decimals);
}

function formatPnL(value: number, isPips: boolean = false): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(isPips ? 0 : 2)}${isPips ? "p" : "$"}`;
}

function formatDuration(openTime: string, closeTime: string): string {
  const open = new Date(openTime).getTime();
  const close = new Date(closeTime).getTime();
  const minutes = Math.floor((close - open) / 1000 / 60);

  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

/* ═══════ STAT CARD ═══════ */
function StatCard({
  icon: Icon,
  label,
  value,
  unit = "",
  color = "text-apex-accent",
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
        <div className={`w-4 h-4 ${color}`}>{Icon}</div>
      </div>
      <div className="min-w-0">
        <div className="text-[10px] text-apex-muted uppercase tracking-[0.15em]">{label}</div>
        <div className="flex items-baseline gap-1">
          <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
          {unit && <div className="text-xs text-apex-muted">{unit}</div>}
          {trend && (
            <div className={`text-xs ml-1 ${trend === "up" ? "text-apex-green" : trend === "down" ? "text-apex-red" : "text-apex-muted"}`}>
              {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════ MAIN TRADES PAGE ═══════ */
export default function TradesPage() {
  const [data, setData] = useState<TradesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchTrades = useCallback(async () => {
    try {
      const res = await fetch("/api/trades");
      const json = await res.json();
      if (json.success) {
        setData(json);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error("Failed to fetch trades:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrades();
    const interval = setInterval(fetchTrades, 30000);
    return () => clearInterval(interval);
  }, [fetchTrades]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <div className="orb orb-1 top-[10%] left-[20%]" />
        <div className="orb orb-2 bottom-[20%] right-[15%]" />
        <div className="text-center relative z-10">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-apex-card border border-apex-border flex items-center justify-center animate-pulse">
            <History className="w-8 h-8 text-apex-accent" />
          </div>
          <div className="text-xl font-bold text-white mb-1 font-[Outfit]">TRADE HISTORY</div>
          <div className="text-sm text-apex-muted font-mono">Loading trade data...</div>
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const trades = data?.trades || [];
  const isDemo = data?.demo_mode;

  return (
    <div className="relative z-10 min-h-screen">
      {/* Floating orbs */}
      <div className="orb orb-1 top-[5%] left-[10%]" />
      <div className="orb orb-2 top-[40%] right-[5%]" />
      <div className="orb orb-3 bottom-[10%] left-[30%]" />

      <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">

        {/* ═══════ HEADER ═══════ */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 animate-slide-up">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors">
              <ArrowLeft className="w-5 h-5 text-apex-muted hover:text-white" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3 font-[Outfit]">
                <History className="w-6 h-6 text-apex-accent" />
                TRADE HISTORY
                {isDemo && (
                  <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-apex-amber/15 text-apex-amber border border-apex-amber/30">
                    DEMO
                  </span>
                )}
              </h1>
              <p className="text-[10px] text-apex-muted font-mono mt-0.5">
                {trades.length} total trades • Last updated {lastUpdate ? lastUpdate.toLocaleTimeString() : "---"}
              </p>
            </div>
          </div>
          <button
            onClick={fetchTrades}
            className="mt-4 md:mt-0 btn-glass"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </header>

        {/* ═══════ SUMMARY STATS ═══════ */}
        {stats && (
          <SpotlightCard className="p-6 md:p-8 mb-6 animate-slide-up glow-cyan border-gradient stagger-1">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              <StatCard
                icon={<Activity className="w-4 h-4" />}
                label="Total Trades"
                value={stats.total_trades}
              />
              <StatCard
                icon={<TrendingUp className="w-4 h-4" />}
                label="Win Rate"
                value={`${(stats.win_rate * 100).toFixed(1)}%`}
                color={stats.win_rate >= 0.5 ? "text-apex-green" : "text-apex-red"}
                trend={stats.win_rate >= 0.5 ? "up" : "down"}
              />
              <StatCard
                icon={<Target className="w-4 h-4" />}
                label="Profit Factor"
                value={stats.profit_factor.toFixed(2)}
                color={stats.profit_factor > 1 ? "text-apex-green" : "text-apex-red"}
              />
              <StatCard
                icon={<ArrowUpRight className="w-4 h-4" />}
                label="Total P&L"
                value={formatPnL(stats.total_pnl, false)}
                color={stats.total_pnl >= 0 ? "text-apex-green" : "text-apex-red"}
              />
              <StatCard
                icon={<Clock className="w-4 h-4" />}
                label="Avg. Hold"
                value={stats.avg_holding_minutes.toFixed(0)}
                unit="min"
              />
            </div>

            {/* Secondary stats */}
            <div className="mt-6 pt-6 border-t border-white/[0.06] grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-[9px] text-apex-muted uppercase tracking-[0.15em] mb-1">Wins / Losses</div>
                <div className="flex items-center gap-2">
                  <span className="text-apex-green font-mono font-semibold">{stats.winning_trades}</span>
                  <span className="text-apex-muted">/</span>
                  <span className="text-apex-red font-mono font-semibold">{stats.losing_trades}</span>
                </div>
              </div>
              <div>
                <div className="text-[9px] text-apex-muted uppercase tracking-[0.15em] mb-1">Avg. P&L</div>
                <div className={`font-mono font-semibold ${stats.avg_pnl_per_trade >= 0 ? "text-apex-green" : "text-apex-red"}`}>
                  {formatPnL(stats.avg_pnl_per_trade, false)}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-apex-muted uppercase tracking-[0.15em] mb-1">Best Trade</div>
                <div className="text-apex-green font-mono font-semibold">
                  {formatPnL(stats.best_trade, false)}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-apex-muted uppercase tracking-[0.15em] mb-1">Worst Trade</div>
                <div className="text-apex-red font-mono font-semibold">
                  {formatPnL(stats.worst_trade, false)}
                </div>
              </div>
            </div>
          </SpotlightCard>
        )}

        {/* ═══════ TRADES TABLE ═══════ */}
        <SpotlightCard className="overflow-hidden animate-slide-up stagger-2 border-gradient">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="px-6 py-4 text-left font-semibold text-apex-muted uppercase tracking-[0.1em]">Pair</th>
                  <th className="px-4 py-4 text-left font-semibold text-apex-muted uppercase tracking-[0.1em]">Direction</th>
                  <th className="px-4 py-4 text-left font-semibold text-apex-muted uppercase tracking-[0.1em]">Entry</th>
                  <th className="px-4 py-4 text-left font-semibold text-apex-muted uppercase tracking-[0.1em]">Exit</th>
                  <th className="px-4 py-4 text-left font-semibold text-apex-muted uppercase tracking-[0.1em]">P&L (pips)</th>
                  <th className="px-4 py-4 text-left font-semibold text-apex-muted uppercase tracking-[0.1em]">P&L ($)</th>
                  <th className="px-4 py-4 text-left font-semibold text-apex-muted uppercase tracking-[0.1em]">Conf.</th>
                  <th className="px-4 py-4 text-left font-semibold text-apex-muted uppercase tracking-[0.1em]">Open Time</th>
                  <th className="px-4 py-4 text-left font-semibold text-apex-muted uppercase tracking-[0.1em]">Duration</th>
                  <th className="px-4 py-4 text-left font-semibold text-apex-muted uppercase tracking-[0.1em]">Status</th>
                </tr>
              </thead>
              <tbody>
                {trades.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <History className="w-8 h-8 text-apex-muted opacity-40" />
                        <div className="text-apex-muted">No trades yet</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  trades.map((trade, idx) => {
                    const isProfitable = trade.pnl_dollars >= 0;
                    const openTime = new Date(trade.open_time);
                    const closeTime = new Date(trade.close_time);

                    return (
                      <tr
                        key={trade.id}
                        className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors stagger-"
                        style={{ "--stagger-delay": `${0.05 + (idx % 5) * 0.05}s` } as React.CSSProperties}
                      >
                        {/* Pair */}
                        <td className="px-6 py-4 font-mono font-bold text-white">
                          {trade.pair}
                        </td>

                        {/* Direction */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            {trade.direction === "BUY" ? (
                              <>
                                <ArrowUpRight className="w-3.5 h-3.5 text-apex-green" />
                                <span className="font-mono font-semibold text-apex-green">BUY</span>
                              </>
                            ) : (
                              <>
                                <ArrowDownRight className="w-3.5 h-3.5 text-apex-red" />
                                <span className="font-mono font-semibold text-apex-red">SELL</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Entry Price */}
                        <td className="px-4 py-4 font-mono text-white">
                          {formatPrice(trade.entry_price)}
                        </td>

                        {/* Exit Price */}
                        <td className="px-4 py-4 font-mono text-white">
                          {formatPrice(trade.exit_price)}
                        </td>

                        {/* P&L Pips */}
                        <td className={`px-4 py-4 font-mono font-semibold ${isProfitable ? "text-apex-green" : "text-apex-red"}`}>
                          {formatPnL(trade.pnl_pips, true)}
                        </td>

                        {/* P&L Dollars */}
                        <td className={`px-4 py-4 font-mono font-semibold ${isProfitable ? "text-apex-green" : "text-apex-red"}`}>
                          {formatPnL(trade.pnl_dollars)}
                        </td>

                        {/* Confidence */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-1.5 rounded bg-white/[0.06] overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-apex-amber to-apex-accent"
                                style={{ width: `${Math.max(20, trade.confidence * 100)}%` }}
                              />
                            </div>
                            <span className="font-mono text-[10px] text-apex-amber">
                              {(trade.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </td>

                        {/* Open Time */}
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-0.5">
                            <div className="font-mono text-white">{formatTime(trade.open_time)}</div>
                            <div className="text-[9px] text-apex-muted">{formatDate(trade.open_time)}</div>
                          </div>
                        </td>

                        {/* Duration */}
                        <td className="px-4 py-4 font-mono text-white">
                          {formatDuration(trade.open_time, trade.close_time)}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4">
                          <span className={`text-[10px] font-mono font-semibold px-2 py-1 rounded border ${
                            trade.status === "take_profit"
                              ? "bg-apex-green/[0.08] text-apex-green border-apex-green/[0.2]"
                              : trade.status === "stopped_out"
                              ? "bg-apex-red/[0.08] text-apex-red border-apex-red/[0.2]"
                              : "bg-apex-muted/[0.08] text-apex-muted border-apex-muted/[0.2]"
                          }`}>
                            {trade.status === "take_profit" ? "TP" : trade.status === "stopped_out" ? "SL" : "CLOSED"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </SpotlightCard>

        {/* ═══════ FOOTER ═══════ */}
        <div className="mt-6 text-center text-[10px] text-apex-muted animate-fade-in">
          <p>Trade history updates every 30 seconds • Last refreshed: {lastUpdate?.toLocaleTimeString()}</p>
        </div>
      </div>
    </div>
  );
}
