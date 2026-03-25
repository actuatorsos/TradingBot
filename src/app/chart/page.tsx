"use client";
import { useState, useEffect, useCallback } from "react";
import CandlestickChart, { CandleData } from "@/components/CandlestickChart";
import { SpotlightCard } from "@/components/SpotlightCard";

interface MarketData {
  pair: string;
  midpoint: number;
  spread: number;
  bid: number;
  ask: number;
}

const PAIRS = ["EUR_USD", "GBP_USD", "USD_JPY", "AUD_USD", "USD_CAD", "USD_CHF"];

export default function ChartPage() {
  const [selectedPair, setSelectedPair] = useState("EUR_USD");
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch candles
      const candlesRes = await fetch(
        `/api/candles?pair=${selectedPair}&count=200`
      );
      const candlesData = await candlesRes.json();
      if (candlesData.success) {
        setCandles(candlesData.candles);
      }

      // Fetch market data
      const marketRes = await fetch("/api/market");
      const marketJson = await marketRes.json();
      if (marketJson.success && marketJson.pairs) {
        const [base, quote] = selectedPair.split("_");
        const found = marketJson.pairs.find(
          (p: any) => p.base === base && p.quote === quote
        );
        if (found) {
          setMarketData(found);
        }
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedPair]);

  // Initial load and refresh every 30 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handlePairChange = (pair: string) => {
    setSelectedPair(pair);
  };

  const formatPrice = (price: number) => {
    const decimals = selectedPair.includes("JPY") ? 2 : 4;
    return price.toFixed(decimals);
  };

  return (
    <main className="min-h-screen bg-[#050810] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold font-outfit mb-2">
              Live Charts
            </h1>
            <p className="text-apex-muted">Real-time candlestick charts for major currency pairs</p>
          </div>

          {/* Pair Selector and Market Info */}
          <div className="flex items-center justify-between flex-wrap gap-4 bg-[#0e1525] rounded-lg p-4 border border-white/5">
            <div className="flex items-center gap-3">
              <select
                value={selectedPair}
                onChange={(e) => handlePairChange(e.target.value)}
                className="px-4 py-2 bg-[#050810] text-white border border-white/10 rounded-lg font-jetbrains-mono text-sm focus:outline-none focus:border-green-500 transition"
              >
                {PAIRS.map((pair) => (
                  <option key={pair} value={pair}>
                    {pair}
                  </option>
                ))}
              </select>

              {marketData && (
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-apex-muted text-xs uppercase tracking-wide">
                      Price
                    </p>
                    <p className="text-lg font-bold font-jetbrains-mono text-green-400">
                      {formatPrice(marketData.midpoint)}
                    </p>
                  </div>

                  <div className="text-center border-l border-white/10 pl-6">
                    <p className="text-apex-muted text-xs uppercase tracking-wide">
                      Spread
                    </p>
                    <p className="text-lg font-bold font-jetbrains-mono text-blue-400">
                      {(marketData.spread * 10000).toFixed(1)} pips
                    </p>
                  </div>

                  <div className="text-center border-l border-white/10 pl-6">
                    <p className="text-apex-muted text-xs uppercase tracking-wide">
                      Bid / Ask
                    </p>
                    <p className="text-sm font-jetbrains-mono">
                      <span className="text-red-400">
                        {formatPrice(marketData.bid)}
                      </span>
                      {" / "}
                      <span className="text-green-400">
                        {formatPrice(marketData.ask)}
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="text-right">
              <p className="text-apex-muted text-xs">
                Last update: {lastUpdate.toLocaleTimeString()}
              </p>
              <p className="text-apex-muted text-xs">
                {!loading && candles.length > 0
                  ? `${candles.length} candles loaded`
                  : "Loading..."}
              </p>
            </div>
          </div>
        </div>

        {/* Chart Container */}
        <SpotlightCard className="p-0 overflow-hidden">
          {loading && candles.length === 0 ? (
            <div className="w-full h-[500px] bg-[#0e1525] flex items-center justify-center">
              <div className="text-center">
                <div className="inline-block animate-spin mb-4">
                  <div className="w-8 h-8 border-2 border-green-500/20 border-t-green-500 rounded-full" />
                </div>
                <p className="text-apex-muted">Loading chart data...</p>
              </div>
            </div>
          ) : (
            <div className="bg-[#050810] border-t border-white/5">
              <CandlestickChart
                candles={candles}
                width={1200}
                height={500}
                pair={selectedPair}
              />
            </div>
          )}
        </SpotlightCard>

        {/* Info Footer */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SpotlightCard className="p-4">
            <p className="text-apex-muted text-sm mb-2">Timeframe</p>
            <p className="text-xl font-bold font-jetbrains-mono">M5 (5 min)</p>
          </SpotlightCard>

          <SpotlightCard className="p-4">
            <p className="text-apex-muted text-sm mb-2">Candles Loaded</p>
            <p className="text-xl font-bold font-jetbrains-mono">
              {candles.length}
            </p>
          </SpotlightCard>

          <SpotlightCard className="p-4">
            <p className="text-apex-muted text-sm mb-2">Auto Refresh</p>
            <p className="text-xl font-bold font-jetbrains-mono text-green-400">
              30s
            </p>
          </SpotlightCard>
        </div>

        {/* Help Text */}
        <SpotlightCard className="p-4 bg-blue-500/5 border-blue-500/20">
          <p className="text-sm text-apex-muted">
            <span className="font-semibold text-blue-400">💡 Tip:</span> Scroll
            with mouse wheel to pan left/right. Hover over candles to see detailed
            OHLCV data. Green candles indicate bullish closes, red indicate bearish.
          </p>
        </SpotlightCard>
      </div>
    </main>
  );
}
