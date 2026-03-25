"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Calendar,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  BarChart3,
  Filter,
} from "lucide-react";

interface Trade {
  id: string;
  pair: string;
  direction: "BUY" | "SELL";
  entry_price: number;
  exit_price: number;
  pnl: number;
  open_time: string;
  close_time: string;
  confidence?: number;
  reason?: string;
  status: string;
}

interface Stats {
  total_trades: number;
  win_rate: number;
  avg_win: number;
  avg_loss: number;
  best_trade: number;
  worst_trade: number;
  avg_duration_minutes: number;
}

const SpotlightCard = ({ children }: { children: React.ReactNode }) => (
  <div className="relative group">
    <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg blur opacity-0 group-hover:opacity-100 transition duration-300" />
    <div className="relative bg-gradient-to-br from-[#0e1525] to-[#050810] border border-cyan-500/20 rounded-lg p-4 backdrop-blur-sm">
      {children}
    </div>
  </div>
);

export default function Journal() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);

  // Filter state
  const [filterPair, setFilterPair] = useState<string>("all");
  const [filterDirection, setFilterDirection] = useState<string>("all");
  const [filterResult, setFilterResult] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const res = await fetch("/api/trades");
        const data = await res.json();

        if (data.success) {
          const closedTrades = data.trades.filter(
            (t: Trade) => t.status === "closed" && t.pnl !== undefined
          );
          setTrades(closedTrades);
          setIsDemo(data.demo_mode);

          // Calculate stats
          const wins = closedTrades.filter((t: Trade) => t.pnl > 0);
          const losses = closedTrades.filter((t: Trade) => t.pnl <= 0);

          const avgWin =
            wins.length > 0
              ? wins.reduce((s: number, t: Trade) => s + t.pnl, 0) / wins.length
              : 0;
          const avgLoss =
            losses.length > 0
              ? Math.abs(
                  losses.reduce((s: number, t: Trade) => s + t.pnl, 0) /
                    losses.length
                )
              : 0;

          const durations = closedTrades
            .filter((t: Trade) => t.open_time && t.close_time)
            .map(
              (t: Trade) =>
                (new Date(t.close_time).getTime() -
                  new Date(t.open_time).getTime()) /
                60000
            );
          const avgDuration =
            durations.length > 0
              ? durations.reduce((s: number, d: number) => s + d, 0) /
                durations.length
              : 0;

          setStats({
            total_trades: closedTrades.length,
            win_rate:
              closedTrades.length > 0
                ? (wins.length / closedTrades.length) * 100
                : 0,
            avg_win: avgWin,
            avg_loss: avgLoss,
            best_trade:
              closedTrades.length > 0
                ? Math.max(...closedTrades.map((t: Trade) => t.pnl))
                : 0,
            worst_trade:
              closedTrades.length > 0
                ? Math.min(...closedTrades.map((t: Trade) => t.pnl))
                : 0,
            avg_duration_minutes: avgDuration,
          });
        }
      } catch (error) {
        console.error("Failed to fetch trades:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrades();
  }, []);

  const filteredTrades = trades.filter((t) => {
    if (filterPair !== "all" && t.pair !== filterPair) return false;
    if (filterDirection !== "all" && t.direction !== filterDirection) return false;
    if (filterResult === "win" && t.pnl <= 0) return false;
    if (filterResult === "loss" && t.pnl > 0) return false;

    if (startDate) {
      const tradeDate = t.open_time.split("T")[0];
      if (tradeDate < startDate) return false;
    }
    if (endDate) {
      const tradeDate = t.open_time.split("T")[0];
      if (tradeDate > endDate) return false;
    }

    return true;
  });

  const pairs = Array.from(new Set(trades.map((t) => t.pair))).sort();

  const tradesByDay: Record<string, Trade[]> = {};
  filteredTrades.forEach((t) => {
    const day = t.open_time.split("T")[0];
    if (!tradesByDay[day]) tradesByDay[day] = [];
    tradesByDay[day].push(t);
  });

  const sortedDays = Object.keys(tradesByDay).sort().reverse();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-cyan-400">Loading trades...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050810] text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-4xl font-bold mb-2"
              style={{ fontFamily: "Outfit, sans-serif" }}
            >
              Trade Journal
            </h1>
            <p className="text-cyan-400/70">Review and analyze your trading history</p>
          </div>
          {isDemo && (
            <div className="px-4 py-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-yellow-400 text-sm font-medium">
              DEMO
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <SpotlightCard>
            <div className="text-sm text-cyan-400/70">Total Trades</div>
            <div
              className="text-2xl font-bold text-cyan-400"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              {stats.total_trades}
            </div>
          </SpotlightCard>

          <SpotlightCard>
            <div className="text-sm text-cyan-400/70">Win Rate</div>
            <div
              className="text-2xl font-bold text-cyan-400"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              {stats.win_rate.toFixed(1)}%
            </div>
          </SpotlightCard>

          <SpotlightCard>
            <div className="text-sm text-cyan-400/70">Avg Win</div>
            <div
              className="text-2xl font-bold text-green-400"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              +{stats.avg_win.toFixed(2)}
            </div>
          </SpotlightCard>

          <SpotlightCard>
            <div className="text-sm text-cyan-400/70">Avg Loss</div>
            <div
              className="text-2xl font-bold text-red-400"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              -{stats.avg_loss.toFixed(2)}
            </div>
          </SpotlightCard>

          <SpotlightCard>
            <div className="text-sm text-cyan-400/70">Best Trade</div>
            <div
              className="text-2xl font-bold text-green-400"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              +{stats.best_trade.toFixed(2)}
            </div>
          </SpotlightCard>

          <SpotlightCard>
            <div className="text-sm text-cyan-400/70">Worst Trade</div>
            <div
              className="text-2xl font-bold text-red-400"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              {stats.worst_trade.toFixed(2)}
            </div>
          </SpotlightCard>

          <SpotlightCard>
            <div className="text-sm text-cyan-400/70">Avg Duration</div>
            <div
              className="text-2xl font-bold text-cyan-400"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              {Math.floor(stats.avg_duration_minutes)}m
            </div>
          </SpotlightCard>

          <SpotlightCard>
            <div className="text-sm text-cyan-400/70">Profit Factor</div>
            <div
              className="text-2xl font-bold text-cyan-400"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              {(stats.avg_win * (stats.win_rate / 100)) /
                (stats.avg_loss * (1 - stats.win_rate / 100)) >
              0
                ? (
                    (stats.avg_win * (stats.win_rate / 100)) /
                    (stats.avg_loss * (1 - stats.win_rate / 100))
                  ).toFixed(2)
                : "0.00"}
            </div>
          </SpotlightCard>
        </div>
      )}

      {/* Filters */}
      <div className="mb-8 p-4 bg-[#0e1525]/50 border border-cyan-500/10 rounded-lg">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-cyan-400">Filters</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <select
            value={filterPair}
            onChange={(e) => setFilterPair(e.target.value)}
            className="bg-[#1a2340] border border-cyan-500/20 rounded px-3 py-2 text-sm text-white"
          >
            <option value="all">All Pairs</option>
            {pairs.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={filterDirection}
            onChange={(e) => setFilterDirection(e.target.value)}
            className="bg-[#1a2340] border border-cyan-500/20 rounded px-3 py-2 text-sm text-white"
          >
            <option value="all">All Directions</option>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>

          <select
            value={filterResult}
            onChange={(e) => setFilterResult(e.target.value)}
            className="bg-[#1a2340] border border-cyan-500/20 rounded px-3 py-2 text-sm text-white"
          >
            <option value="all">All Results</option>
            <option value="win">Wins Only</option>
            <option value="loss">Losses Only</option>
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-[#1a2340] border border-cyan-500/20 rounded px-3 py-2 text-sm text-white"
            placeholder="Start Date"
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-[#1a2340] border border-cyan-500/20 rounded px-3 py-2 text-sm text-white"
            placeholder="End Date"
          />
        </div>
      </div>

      {/* Trades by Day */}
      <div className="space-y-6">
        {sortedDays.length === 0 ? (
          <div className="text-center py-12 text-cyan-400/50">
            No trades found
          </div>
        ) : (
          sortedDays.map((day) => {
            const dayTrades = tradesByDay[day];
            const dayWins = dayTrades.filter((t) => t.pnl > 0).length;
            const dayPnl = dayTrades.reduce((s, t) => s + t.pnl, 0);

            return (
              <div key={day}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-cyan-400" />
                    <h3
                      className="text-lg font-semibold"
                      style={{ fontFamily: "Outfit, sans-serif" }}
                    >
                      {new Date(day).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </h3>
                    <span className="text-sm text-cyan-400/50">
                      {dayTrades.length} trade{dayTrades.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-sm text-cyan-400/70">{dayWins}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-sm text-cyan-400/70">
                        {dayTrades.length - dayWins}
                      </span>
                    </div>
                    <div
                      className={`text-sm font-medium ${
                        dayPnl > 0 ? "text-green-400" : "text-red-400"
                      }`}
                      style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                      {dayPnl > 0 ? "+" : ""}
                      {dayPnl.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {dayTrades.map((trade) => {
                    const isWin = trade.pnl > 0;
                    const duration =
                      (new Date(trade.close_time).getTime() -
                        new Date(trade.open_time).getTime()) /
                      60000;

                    return (
                      <div key={trade.id}>
                        <button
                          onClick={() =>
                            setExpandedTrade(
                              expandedTrade === trade.id ? null : trade.id
                            )
                          }
                          className="w-full"
                        >
                          <SpotlightCard>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4 flex-1">
                                <div
                                  className={`w-3 h-3 rounded-full ${
                                    isWin ? "bg-green-500" : "bg-red-500"
                                  }`}
                                />
                                <div className="text-left">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="font-mono font-semibold"
                                      style={{
                                        fontFamily:
                                          "JetBrains Mono, monospace",
                                      }}
                                    >
                                      {trade.pair}
                                    </span>
                                    <span
                                      className={`text-xs px-2 py-1 rounded ${
                                        trade.direction === "BUY"
                                          ? "bg-green-500/20 text-green-400"
                                          : "bg-red-500/20 text-red-400"
                                      }`}
                                    >
                                      {trade.direction}
                                    </span>
                                  </div>
                                  <div className="text-xs text-cyan-400/50 mt-1">
                                    {new Date(trade.open_time).toLocaleTimeString()}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <div
                                  className={`text-lg font-bold ${
                                    isWin ? "text-green-400" : "text-red-400"
                                  }`}
                                  style={{
                                    fontFamily: "JetBrains Mono, monospace",
                                  }}
                                >
                                  {isWin ? "+" : ""}
                                  {trade.pnl.toFixed(2)}
                                </div>
                                <div className="text-xs text-cyan-400/50 mt-1">
                                  {duration.toFixed(0)}m
                                </div>
                              </div>

                              <ChevronDown
                                className={`w-5 h-5 text-cyan-400 ml-4 transition ${
                                  expandedTrade === trade.id
                                    ? "rotate-180"
                                    : ""
                                }`}
                              />
                            </div>
                          </SpotlightCard>
                        </button>

                        {expandedTrade === trade.id && (
                          <div className="mt-3 p-4 bg-[#0e1525]/50 border border-cyan-500/10 rounded-lg space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-xs text-cyan-400/50">
                                  Entry Price
                                </div>
                                <div
                                  className="font-mono text-white"
                                  style={{
                                    fontFamily: "JetBrains Mono, monospace",
                                  }}
                                >
                                  {trade.entry_price.toFixed(5)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-cyan-400/50">
                                  Exit Price
                                </div>
                                <div
                                  className="font-mono text-white"
                                  style={{
                                    fontFamily: "JetBrains Mono, monospace",
                                  }}
                                >
                                  {trade.exit_price.toFixed(5)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-cyan-400/50">
                                  Confidence
                                </div>
                                <div className="text-white">
                                  {trade.confidence
                                    ? `${(trade.confidence * 100).toFixed(0)}%`
                                    : "N/A"}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-cyan-400/50">
                                  Duration
                                </div>
                                <div className="text-white">
                                  {Math.floor(duration)}m{" "}
                                  {Math.floor((duration % 1) * 60)}s
                                </div>
                              </div>
                            </div>

                            {trade.reason && (
                              <div>
                                <div className="text-xs text-cyan-400/50 mb-1">
                                  Reason
                                </div>
                                <div className="text-sm text-cyan-400/70">
                                  {trade.reason}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Nav */}
      <div className="mt-12 flex justify-center gap-4">
        <Link
          href="/dashboard"
          className="px-4 py-2 text-cyan-400 hover:text-cyan-300 transition"
        >
          ← Back
        </Link>
      </div>
    </div>
  );
}
