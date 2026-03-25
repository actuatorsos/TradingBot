"use client";

import { useState, useEffect } from "react";
import { SpotlightCard } from "@/components/SpotlightCard";
import { motion } from "framer-motion";

const PAIRS = ["EUR_USD", "GBP_USD", "USD_JPY", "AUD_USD", "USD_CAD", "USD_CHF"];

export default function CorrelationPage() {
  const [correlations, setCorrelations] = useState<number[][]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    calculateCorrelations();
  }, []);

  const calculateCorrelations = () => {
    setLoading(true);

    // Simulate fetching historical data and calculating correlations
    // In production, this would fetch real market data
    setTimeout(() => {
      const baseCorrelation: number[][] = [
        [1.0, 0.92, -0.65, 0.78, -0.58, 0.42],
        [0.92, 1.0, -0.68, 0.82, -0.62, 0.45],
        [-0.65, -0.68, 1.0, -0.45, 0.88, -0.35],
        [0.78, 0.82, -0.45, 1.0, -0.52, 0.38],
        [-0.58, -0.62, 0.88, -0.52, 1.0, -0.42],
        [0.42, 0.45, -0.35, 0.38, -0.42, 1.0],
      ];
      setCorrelations(baseCorrelation);
      setLoading(false);
    }, 800);
  };

  const getColorForCorrelation = (value: number): string => {
    if (value > 0.7) return "bg-green-900";
    if (value > 0.4) return "bg-green-800";
    if (value > 0.1) return "bg-green-700";
    if (value >= -0.1) return "bg-gray-700";
    if (value >= -0.4) return "bg-red-700";
    if (value >= -0.7) return "bg-red-800";
    return "bg-red-900";
  };

  const getTextColorForCorrelation = (value: number): string => {
    if (Math.abs(value) > 0.6) return "text-white font-semibold";
    return "text-gray-200";
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1
            className="text-4xl font-bold mb-2 tracking-tight"
            style={{ fontFamily: "Outfit, sans-serif" }}
          >
            Correlation Matrix
          </h1>
          <p className="text-gray-400">
            Analyze how currency pairs move together for portfolio diversification
          </p>
        </motion.div>

        <SpotlightCard className="p-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-400">Calculating correlations...</p>
              </div>
            </div>
          ) : (
            <div>
              {/* Heatmap */}
              <div className="overflow-x-auto mb-8">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="w-32 h-20"></th>
                      {PAIRS.map((pair) => (
                        <th
                          key={pair}
                          className="w-24 h-20 text-xs font-semibold text-gray-300 transform -rotate-45 origin-center"
                        >
                          <div className="flex items-center justify-center h-full">
                            <span className="whitespace-nowrap">{pair}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PAIRS.map((rowPair, rowIdx) => (
                      <tr key={rowPair}>
                        <td className="px-4 py-2 font-semibold text-sm text-right pr-6">
                          {rowPair}
                        </td>
                        {PAIRS.map((colPair, colIdx) => {
                          const value = correlations[rowIdx]?.[colIdx] ?? 0;
                          return (
                            <td
                              key={`${rowIdx}-${colIdx}`}
                              className={`w-24 h-24 border border-gray-800 ${getColorForCorrelation(
                                value
                              )} flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity`}
                              title={`${rowPair} vs ${colPair}: ${value.toFixed(2)}`}
                            >
                              <span
                                className={`text-sm font-mono ${getTextColorForCorrelation(
                                  value
                                )}`}
                              >
                                {value.toFixed(2)}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="border-t border-gray-800 pt-8">
                <h3 className="text-lg font-semibold mb-4">Color Scale</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-green-900 border border-gray-700 rounded"></div>
                    <span className="text-sm text-gray-300">Strongly Positive (&gt;0.7)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-green-700 border border-gray-700 rounded"></div>
                    <span className="text-sm text-gray-300">Moderately Positive (0.1-0.4)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-gray-700 border border-gray-700 rounded"></div>
                    <span className="text-sm text-gray-300">Near Zero (-0.1 to 0.1)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-red-800 border border-gray-700 rounded"></div>
                    <span className="text-sm text-gray-300">Strongly Negative (&lt;-0.7)</span>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="border-t border-gray-800 mt-8 pt-8">
                <h3 className="text-lg font-semibold mb-4">Diversification Insights</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                  <div>
                    <p className="font-semibold text-green-400 mb-2">Strong Positive (&gt;0.7):</p>
                    <p>
                      Pairs that move together. Good for correlated hedging strategies, but
                      limited diversification benefit.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-red-400 mb-2">Strong Negative (&lt;-0.7):</p>
                    <p>
                      Inverse relationship. Excellent for diversification and risk reduction.
                      Ideal for hedging strategies.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-300 mb-2">Near Zero (-0.1 to 0.1):</p>
                    <p>
                      Minimal relationship. Good for portfolio diversification as they move
                      independently.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-blue-400 mb-2">Moderate (0.4-0.7):</p>
                    <p>
                      Some co-movement. Balanced approach with partial diversification benefit
                      and strategic alignment.
                    </p>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="border-t border-gray-800 mt-8 pt-8">
                <h3 className="text-lg font-semibold mb-4">Portfolio Building Tips</h3>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex gap-3">
                    <span className="text-green-400 font-bold">•</span>
                    <span>Mix high positive correlations (trend following) with negative correlations (hedging)</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-green-400 font-bold">•</span>
                    <span>Select pairs with correlations near zero for maximum diversification</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-green-400 font-bold">•</span>
                    <span>Monitor correlation changes during market regime shifts</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-green-400 font-bold">•</span>
                    <span>High correlations breakdown during financial crises; adjust allocations accordingly</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </SpotlightCard>
      </div>
    </div>
  );
}
