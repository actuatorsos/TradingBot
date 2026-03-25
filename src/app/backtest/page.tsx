"use client";

import { useState } from "react";
import { SpotlightCard } from "@/components/SpotlightCard";
import { motion } from "framer-motion";

const PERIODS = [
  { value: "1W", label: "1 Week" },
  { value: "1M", label: "1 Month" },
  { value: "3M", label: "3 Months" },
  { value: "6M", label: "6 Months" },
];

const PAIRS = [
  "EUR_USD",
  "GBP_USD",
  "USD_JPY",
  "AUD_USD",
  "USD_CAD",
  "USD_CHF",
];

export default function BacktestPage() {
  const [pair, setPair] = useState("EUR_USD");
  const [period, setPeriod] = useState("1M");
  const [slPips, setSlPips] = useState(15);
  const [tpPips, setTpPips] = useState(25);
  const [confidence, setConfidence] = useState(72);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const [equity, setEquity] = useState<any[]>([]);

  const runBacktest = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pair,
          period,
          sl_pips: slPips,
          tp_pips: tpPips,
          min_confidence: confidence,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setResult(data.result);
        setTrades(data.trades);
        setEquity(data.equity);
      }
    } catch (error) {
      console.error("Backtest error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Simple sparkline SVG
  const generateSparkline = () => {
    if (!equity || equity.length < 2) return "";
    const minBalance = Math.min(...equity.map((e) => e.balance));
    const maxBalance = Math.max(...equity.map((e) => e.balance));
    const range = maxBalance - minBalance || 1;
    const width = 300;
    const height = 80;

    const points = equity.map((e, i) => {
      const x = (i / (equity.length - 1)) * width;
      const y = height - ((e.balance - minBalance) / range) * (height - 10) - 5;
      return `${x},${y}`;
    });

    return `M ${points.join(" L ")}`;
  };

  const metricsGrid = result ? [
    { label: "Win Rate", value: `${result.win_rate}%` },
    { label: "Total P&L", value: `$${result.total_pnl}` },
    { label: "Profit Factor", value: result.profit_factor },
    { label: "Sharpe Ratio", value: result.sharpe_ratio || "N/A" },
    { label: "Max Drawdown", value: `${result.max_drawdown_pct}%` },
    { label: "Return", value: `${result.return_pct}%` },
  ] : [];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <motion.h1
          className="text-4xl font-bold mb-2 tracking-tight"
          style={{ fontFamily: "Outfit, sans-serif" }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Strategy Backtester
        </motion.h1>
        <p className="text-gray-400 mb-8">Test your trading strategy on historical data</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Configuration */}
          <SpotlightCard className="lg:col-span-1 p-6">
            <h2 className="text-xl font-semibold mb-6">Configuration</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Pair</label>
                <select
                  value={pair}
                  onChange={(e) => setPair(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                >
                  {PAIRS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">Period</label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                >
                  {PERIODS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">Stop Loss (pips)</label>
                <input
                  type="number"
                  value={slPips}
                  onChange={(e) => setSlPips(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                  min="5"
                  max="100"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">Take Profit (pips)</label>
                <input
                  type="number"
                  value={tpPips}
                  onChange={(e) => setTpPips(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                  min="5"
                  max="200"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">Min Confidence (%)</label>
                <input
                  type="number"
                  value={confidence}
                  onChange={(e) => setConfidence(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                  min="50"
                  max="100"
                />
              </div>

              <button
                onClick={runBacktest}
                disabled={loading}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded font-semibold transition-colors"
              >
                {loading ? "Running..." : "Run Backtest"}
              </button>
            </div>
          </SpotlightCard>

          {/* Results */}
          <div className="lg:col-span-2 space-y-8">
            {/* Equity Curve */}
            {equity.length > 0 && (
              <SpotlightCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">Equity Curve</h2>
                <svg width="100%" height="100" viewBox="0 0 300 80" className="w-full">
                  <path
                    d={generateSparkline()}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                    className="text-blue-500"
                  />
                  <path
                    d={generateSparkline()}
                    fill="url(#gradient)"
                    opacity="0.1"
                    vectorEffect="non-scaling-stroke"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="transparent" />
                    </linearGradient>
                  </defs>
                </svg>
              </SpotlightCard>
            )}

            {/* Metrics Grid */}
            {result && (
              <SpotlightCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">Key Metrics</h2>
                <div className="grid grid-cols-2 gap-4">
                  {metricsGrid.map((metric) => (
                    <div key={metric.label} className="bg-gray-800 rounded p-4">
                      <p className="text-sm text-gray-400">{metric.label}</p>
                      <p
                        className="text-2xl font-bold text-blue-400 mt-1"
                        style={{ fontFamily: "JetBrains Mono, monospace" }}
                      >
                        {metric.value}
                      </p>
                    </div>
                  ))}
                </div>
              </SpotlightCard>
            )}

            {/* Trade List */}
            {trades.length > 0 && (
              <SpotlightCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">Recent Trades (Last 10)</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="px-2 py-2 text-left text-gray-400">#</th>
                        <th className="px-2 py-2 text-left text-gray-400">Dir</th>
                        <th className="px-2 py-2 text-right text-gray-400">Entry</th>
                        <th className="px-2 py-2 text-right text-gray-400">Exit</th>
                        <th className="px-2 py-2 text-right text-gray-400">P&L</th>
                        <th className="px-2 py-2 text-right text-gray-400">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.slice(-10).map((trade) => (
                        <tr key={trade.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                          <td className="px-2 py-2">{trade.id}</td>
                          <td className="px-2 py-2">
                            <span
                              className={`font-semibold ${
                                trade.direction === "BUY" ? "text-green-400" : "text-red-400"
                              }`}
                            >
                              {trade.direction}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right">{trade.entry.toFixed(5)}</td>
                          <td className="px-2 py-2 text-right">{trade.exit.toFixed(5)}</td>
                          <td
                            className={`px-2 py-2 text-right font-semibold ${
                              trade.pnl >= 0 ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            ${trade.pnl}
                          </td>
                          <td className="px-2 py-2 text-right text-gray-400 text-xs">
                            {trade.status === "tp" ? "TP" : "SL"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SpotlightCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
