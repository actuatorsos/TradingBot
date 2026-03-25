"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  BarChart3,
  Clock,
  Award,
  Activity,
} from "lucide-react";

interface AnalyticsData {
  success: boolean;
  demo_mode: boolean;
  metrics: {
    total_trades: number;
    win_rate: number;
    total_pnl: number;
    avg_win: number;
    avg_loss: number;
    profit_factor: number;
    sharpe_ratio: number;
    sortino_ratio: number;
    calmar_ratio: number;
    max_drawdown_pct: number;
    expectancy: number;
    recovery_factor: number;
    max_win_streak: number;
    max_loss_streak: number;
    avg_duration_minutes: number;
    best_trade: number;
    worst_trade: number;
  };
  monthly: Array<{ month: string; pnl: number; trades: number; wins: number }>;
  distribution: Array<{ range: string; count: number }>;
}

const SpotlightCard = ({ children }: { children: React.ReactNode }) => (
  <div className="relative group">
    <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg blur opacity-0 group-hover:opacity-100 transition duration-300" />
    <div className="relative bg-gradient-to-br from-[#0e1525] to-[#050810] border border-cyan-500/20 rounded-lg p-4 backdrop-blur-sm">
      {children}
    </div>
  </div>
);

const CircularGauge = ({ value, max = 100 }: { value: number; max?: number }) => {
  const percentage = (value / max) * 100;
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-24 h-24">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#0e1525"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#00f0ff"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div
            className="text-sm font-bold text-cyan-400"
            style={{ fontFamily: "JetBrains Mono, monospace" }}
          >
            {percentage.toFixed(0)}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch("/api/analytics");
        const analyticsData = await res.json();
        setData(analyticsData);
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-cyan-400">Loading analytics...</div>
      </div>
    );
  }

  const { metrics, monthly, distribution } = data;
  const maxDistribution = Math.max(...distribution.map((d) => d.count), 1);

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
              Performance Analytics
            </h1>
            <p className="text-cyan-400/70">Deep dive into your trading metrics</p>
          </div>
          {data.demo_mode && (
            <div className="px-4 py-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-yellow-400 text-sm font-medium">
              DEMO
            </div>
          )}
        </div>
      </div>

      {/* Metrics Grid (2x4) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Win Rate */}
        <SpotlightCard>
          <div className="text-center">
            <div className="text-xs text-cyan-400/70 mb-3">Win Rate</div>
            <CircularGauge value={metrics.win_rate} max={100} />
            <div className="mt-3 text-xs text-cyan-400/50">
              {metrics.total_trades} trades
            </div>
          </div>
        </SpotlightCard>

        {/* Profit Factor */}
        <SpotlightCard>
          <div className="text-center">
            <div className="text-xs text-cyan-400/70 mb-3">Profit Factor</div>
            <div
              className="text-3xl font-bold text-cyan-400"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              {isFinite(metrics.profit_factor)
                ? metrics.profit_factor.toFixed(2)
                : "N/A"}
            </div>
            <div className="mt-3 text-xs text-cyan-400/50">
              Avg Win / Loss Ratio
            </div>
          </div>
        </SpotlightCard>

        {/* Sharpe Ratio */}
        <SpotlightCard>
          <div className="text-center">
            <div className="text-xs text-cyan-400/70 mb-3">Sharpe Ratio</div>
            <div
              className="text-3xl font-bold text-cyan-400"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              {metrics.sharpe_ratio.toFixed(2)}
            </div>
            <div className="mt-3 text-xs text-cyan-400/50">Risk-adjusted return</div>
          </div>
        </SpotlightCard>

        {/* Sortino Ratio */}
        <SpotlightCard>
          <div className="text-center">
            <div className="text-xs text-cyan-400/70 mb-3">Sortino Ratio</div>
            <div
              className="text-3xl font-bold text-cyan-400"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              {metrics.sortino_ratio.toFixed(2)}
            </div>
            <div className="mt-3 text-xs text-cyan-400/50">Downside risk only</div>
          </div>
        </SpotlightCard>

        {/* Max Drawdown */}
        <SpotlightCard>
          <div className="text-center">
            <div className="text-xs text-cyan-400/70 mb-3">Max Drawdown</div>
            <div
              className="text-3xl font-bold text-red-400"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              -{metrics.max_drawdown_pct.toFixed(2)}%
            </div>
            <div className="mt-3 text-xs text-cyan-400/50">Peak to trough</div>
          </div>
        </SpotlightCard>

        {/* Avg Trade Duration */}
        <SpotlightCard>
          <div className="text-center">
            <div className="text-xs text-cyan-400/70 mb-3">Avg Duration</div>
            <div
              className="text-3xl font-bold text-cyan-400"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              {metrics.avg_duration_minutes.toFixed(0)}m
            </div>
            <div className="mt-3 text-xs text-cyan-400/50">Minutes per trade</div>
          </div>
        </SpotlightCard>

        {/* Expectancy */}
        <SpotlightCard>
          <div className="text-center">
            <div className="text-xs text-cyan-400/70 mb-3">Expectancy</div>
            <div
              className={`text-3xl font-bold ${
                metrics.expectancy > 0 ? "text-green-400" : "text-red-400"
              }`}
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              {metrics.expectancy > 0 ? "+" : ""}
              {metrics.expectancy.toFixed(2)}
            </div>
            <div className="mt-3 text-xs text-cyan-400/50">Per trade average</div>
          </div>
        </SpotlightCard>

        {/* Recovery Factor */}
        <SpotlightCard>
          <div className="text-center">
            <div className="text-xs text-cyan-400/70 mb-3">Recovery Factor</div>
            <div
              className="text-3xl font-bold text-cyan-400"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              {metrics.recovery_factor.toFixed(2)}
            </div>
            <div className="mt-3 text-xs text-cyan-400/50">Profit vs drawdown</div>
          </div>
        </SpotlightCard>
      </div>

      {/* Streaks and Best/Worst */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SpotlightCard>
          <div className="text-xs text-cyan-400/70 mb-2">Best Trade</div>
          <div
            className="text-2xl font-bold text-green-400"
            style={{ fontFamily: "JetBrains Mono, monospace" }}
          >
            +{metrics.best_trade.toFixed(2)}
          </div>
        </SpotlightCard>

        <SpotlightCard>
          <div className="text-xs text-cyan-400/70 mb-2">Worst Trade</div>
          <div
            className="text-2xl font-bold text-red-400"
            style={{ fontFamily: "JetBrains Mono, monospace" }}
          >
            {metrics.worst_trade.toFixed(2)}
          </div>
        </SpotlightCard>

        <SpotlightCard>
          <div className="text-xs text-cyan-400/70 mb-2">Max Win Streak</div>
          <div
            className="text-2xl font-bold text-green-400"
            style={{ fontFamily: "JetBrains Mono, monospace" }}
          >
            {metrics.max_win_streak}
          </div>
        </SpotlightCard>

        <SpotlightCard>
          <div className="text-xs text-cyan-400/70 mb-2">Max Loss Streak</div>
          <div
            className="text-2xl font-bold text-red-400"
            style={{ fontFamily: "JetBrains Mono, monospace" }}
          >
            {metrics.max_loss_streak}
          </div>
        </SpotlightCard>
      </div>

      {/* Monthly P&L */}
      <div className="mb-8">
        <h2
          className="text-xl font-semibold mb-4"
          style={{ fontFamily: "Outfit, sans-serif" }}
        >
          Monthly P&L Breakdown
        </h2>
        <SpotlightCard>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {monthly.length === 0 ? (
              <div className="col-span-full text-center py-8 text-cyan-400/50">
                No monthly data
              </div>
            ) : (
              monthly.map((m) => {
                const isPositive = m.pnl > 0;
                return (
                  <div
                    key={m.month}
                    className={`p-3 rounded text-center ${
                      isPositive
                        ? "bg-green-500/10 border border-green-500/20"
                        : "bg-red-500/10 border border-red-500/20"
                    }`}
                  >
                    <div className="text-xs text-cyan-400/70 mb-2">{m.month}</div>
                    <div
                      className={`text-sm font-bold ${
                        isPositive ? "text-green-400" : "text-red-400"
                      }`}
                      style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                      {isPositive ? "+" : ""}
                      {m.pnl.toFixed(2)}
                    </div>
                    <div className="text-xs text-cyan-400/50 mt-1">
                      {m.trades}t {m.wins}w
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SpotlightCard>
      </div>

      {/* Win/Loss Distribution */}
      <div className="mb-8">
        <h2
          className="text-xl font-semibold mb-4"
          style={{ fontFamily: "Outfit, sans-serif" }}
        >
          P&L Distribution
        </h2>
        <SpotlightCard>
          <div className="space-y-3">
            {distribution.map((bin) => (
              <div key={bin.range}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-cyan-400/70">{bin.range}</div>
                  <div
                    className="text-sm font-mono text-cyan-400"
                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                  >
                    {bin.count}
                  </div>
                </div>
                <div className="h-6 bg-[#0e1525] rounded overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded transition"
                    style={{
                      width: `${(bin.count / maxDistribution) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </SpotlightCard>
      </div>

      {/* Duration vs P&L Scatter */}
      <div className="mb-8">
        <h2
          className="text-xl font-semibold mb-4"
          style={{ fontFamily: "Outfit, sans-serif" }}
        >
          Quick Stats
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <SpotlightCard>
            <div className="text-xs text-cyan-400/70 mb-2">Total P&L</div>
            <div
              className={`text-2xl font-bold ${
                metrics.total_pnl > 0 ? "text-green-400" : "text-red-400"
              }`}
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              {metrics.total_pnl > 0 ? "+" : ""}
              {metrics.total_pnl.toFixed(2)}
            </div>
          </SpotlightCard>

          <SpotlightCard>
            <div className="text-xs text-cyan-400/70 mb-2">Avg Win</div>
            <div
              className="text-2xl font-bold text-green-400"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              +{metrics.avg_win.toFixed(2)}
            </div>
          </SpotlightCard>

          <SpotlightCard>
            <div className="text-xs text-cyan-400/70 mb-2">Avg Loss</div>
            <div
              className="text-2xl font-bold text-red-400"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              -{metrics.avg_loss.toFixed(2)}
            </div>
          </SpotlightCard>

          <SpotlightCard>
            <div className="text-xs text-cyan-400/70 mb-2">Calmar Ratio</div>
            <div
              className="text-2xl font-bold text-cyan-400"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              {metrics.calmar_ratio.toFixed(2)}
            </div>
          </SpotlightCard>

          <SpotlightCard>
            <div className="text-xs text-cyan-400/70 mb-2">Total Trades</div>
            <div
              className="text-2xl font-bold text-cyan-400"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              {metrics.total_trades}
            </div>
          </SpotlightCard>

          <SpotlightCard>
            <div className="text-xs text-cyan-400/70 mb-2">Win/Loss Ratio</div>
            <div
              className="text-2xl font-bold text-cyan-400"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              {metrics.avg_win > 0 && metrics.avg_loss > 0
                ? (metrics.avg_win / metrics.avg_loss).toFixed(2)
                : "N/A"}
            </div>
          </SpotlightCard>
        </div>
      </div>

      {/* Footer Nav */}
      <div className="mt-12 flex justify-center gap-4">
        <Link
          href="/dashboard"
          className="px-4 py-2 text-cyan-400 hover:text-cyan-300 transition"
        >
          ← Back
        </Link>
        <Link
          href="/journal"
          className="px-4 py-2 text-cyan-400 hover:text-cyan-300 transition"
        >
          Trade Journal →
        </Link>
      </div>
    </div>
  );
}
