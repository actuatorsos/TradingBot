'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Shield,
  Home,
} from 'lucide-react';

interface Position {
  id: string;
  pair: string;
  direction: 'BUY' | 'SELL';
  entry_price: number;
  current_price: number;
  lot_size: number;
  stop_loss: number;
  take_profit: number;
  confidence: number;
  open_time: string;
  unrealized_pnl: number;
  unrealized_pips: number;
  duration_minutes: number;
  sl_distance_pips: number;
  tp_distance_pips: number;
}

interface ApiResponse {
  success: boolean;
  demo_mode: boolean;
  positions: Position[];
  summary: {
    total_positions: number;
    total_unrealized_pnl: number;
    pairs: string[];
    net_direction: number;
  };
}

interface MousePosition {
  x: number;
  y: number;
}

const SpotlightCard = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const [mousePosition, setMousePosition] = useState<MousePosition>({ x: 0, y: 0 });
  const [isMouseOver, setIsMouseOver] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsMouseOver(true)}
      onMouseLeave={() => setIsMouseOver(false)}
      className={`relative ${className}`}
      style={{
        background: isMouseOver
          ? `radial-gradient(600px at ${mousePosition.x}px ${mousePosition.y}px, rgba(0, 240, 255, 0.1), transparent 80%)`
          : 'transparent',
      }}
    >
      {children}
    </div>
  );
};

const ConfidenceRing = ({ confidence }: { confidence: number }) => {
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (confidence / 100) * circumference;

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="absolute" width="96" height="96" viewBox="0 0 96 96">
        <circle
          cx="48"
          cy="48"
          r="45"
          fill="none"
          stroke="#1a2340"
          strokeWidth="2"
        />
        <circle
          cx="48"
          cy="48"
          r="45"
          fill="none"
          stroke="#00f0ff"
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          transform="rotate(-90 48 48)"
        />
      </svg>
      <div className="text-center">
        <div className="text-lg font-bold text-[#00f0ff] font-['JetBrains_Mono']">
          {Math.round(confidence)}%
        </div>
        <div className="text-xs text-gray-400 uppercase tracking-wider">Conf</div>
      </div>
    </div>
  );
};

const ProgressBar = ({
  entry,
  current,
  sl,
  tp,
  direction,
}: {
  entry: number;
  current: number;
  sl: number;
  tp: number;
  direction: 'BUY' | 'SELL';
}) => {
  let progress = 0;

  if (direction === 'BUY') {
    progress = ((current - entry) / (tp - entry)) * 100;
  } else {
    progress = ((entry - current) / (entry - sl)) * 100;
  }

  progress = Math.max(0, Math.min(100, progress));

  return (
    <div className="space-y-2">
      <div className="relative h-2 bg-[#1a2340] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#00f0ff] to-[#a855f7] rounded-full"
          style={{
            width: `${progress}%`,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400 font-['JetBrains_Mono']">
        <span>{progress.toFixed(1)}%</span>
        <span>{direction === 'BUY' ? 'To TP' : 'To SL'}</span>
      </div>
    </div>
  );
};

export default function PositionsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = async () => {
    try {
      const response = await fetch('/api/positions');
      if (!response.ok) throw new Error('Failed to fetch positions');
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();

    // Refresh every 10 seconds
    const interval = setInterval(fetchPositions, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#00f0ff] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading positions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#ff1744] mb-4">{error}</p>
          <button
            onClick={fetchPositions}
            className="px-4 py-2 bg-[#00f0ff] text-black rounded font-semibold hover:bg-[#00d4e6] transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { positions, summary } = data;
  const hasPositions = positions.length > 0;

  return (
    <div className="min-h-screen bg-[#050810]">
      {/* Header */}
      <div className="border-b border-[#1a2340] bg-[#0e1525]/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-gray-400 hover:text-[#00f0ff] transition p-2 -ml-2"
              title="Back to Home"
            >
              <Home size={20} />
            </Link>
            <h1 className="text-2xl font-bold text-white font-['Outfit']">
              Open Positions
            </h1>
            {data.demo_mode && (
              <span className="px-2 py-1 bg-[#a855f7]/20 border border-[#a855f7] text-[#a855f7] text-xs font-semibold rounded uppercase">
                DEMO
              </span>
            )}
          </div>
          <div className="text-sm text-gray-400">
            Updated {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Bar */}
        {hasPositions && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Total Positions */}
            <div className="bg-[#0e1525] border border-[#1a2340] rounded-lg p-4">
              <div className="text-gray-400 text-sm uppercase tracking-wider font-['Outfit']">
                Total Positions
              </div>
              <div className="text-3xl font-bold text-white font-['JetBrains_Mono'] mt-2">
                {summary.total_positions}
              </div>
            </div>

            {/* Total P&L */}
            <div className="bg-[#0e1525] border border-[#1a2340] rounded-lg p-4">
              <div className="text-gray-400 text-sm uppercase tracking-wider font-['Outfit']">
                Total P&L
              </div>
              <div
                className={`text-3xl font-bold font-['JetBrains_Mono'] mt-2 ${
                  summary.total_unrealized_pnl >= 0
                    ? 'text-[#00e676]'
                    : 'text-[#ff1744]'
                }`}
              >
                ${summary.total_unrealized_pnl.toFixed(2)}
              </div>
            </div>

            {/* Pairs */}
            <div className="bg-[#0e1525] border border-[#1a2340] rounded-lg p-4">
              <div className="text-gray-400 text-sm uppercase tracking-wider font-['Outfit']">
                Pairs Traded
              </div>
              <div className="text-white mt-2 space-y-1">
                {summary.pairs.slice(0, 3).map((pair) => (
                  <div
                    key={pair}
                    className="text-sm font-['JetBrains_Mono'] text-[#00f0ff]"
                  >
                    {pair}
                  </div>
                ))}
                {summary.pairs.length > 3 && (
                  <div className="text-xs text-gray-500">
                    +{summary.pairs.length - 3} more
                  </div>
                )}
              </div>
            </div>

            {/* Net Direction */}
            <div className="bg-[#0e1525] border border-[#1a2340] rounded-lg p-4">
              <div className="text-gray-400 text-sm uppercase tracking-wider font-['Outfit']">
                Net Direction
              </div>
              <div className="flex items-center gap-2 mt-2">
                {summary.net_direction > 0 ? (
                  <>
                    <ArrowUp size={24} className="text-[#00e676]" />
                    <span className="text-2xl font-bold text-[#00e676] font-['JetBrains_Mono']">
                      {Math.round(summary.net_direction)}
                    </span>
                  </>
                ) : summary.net_direction < 0 ? (
                  <>
                    <ArrowDown size={24} className="text-[#ff1744]" />
                    <span className="text-2xl font-bold text-[#ff1744] font-['JetBrains_Mono']">
                      {Math.round(Math.abs(summary.net_direction))}
                    </span>
                  </>
                ) : (
                  <span className="text-2xl font-bold text-gray-400 font-['JetBrains_Mono']">
                    Neutral
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Positions Grid */}
        {hasPositions ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {positions.map((position, index) => {
              const isProfit = position.unrealized_pnl >= 0;
              const isBuy = position.direction === 'BUY';

              return (
                <SpotlightCard key={position.id}>
                  <div
                    className="bg-[#0e1525] border border-[#1a2340] rounded-lg p-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <div className="text-2xl font-bold text-white font-['Outfit'] mb-1">
                          {position.pair}
                        </div>
                        <div className="flex items-center gap-2">
                          {isBuy ? (
                            <>
                              <ArrowUp
                                size={16}
                                className="text-[#00e676]"
                              />
                              <span className="text-[#00e676] text-sm font-semibold">
                                BUY
                              </span>
                            </>
                          ) : (
                            <>
                              <ArrowDown
                                size={16}
                                className="text-[#ff1744]"
                              />
                              <span className="text-[#ff1744] text-sm font-semibold">
                                SELL
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <ConfidenceRing confidence={position.confidence} />
                    </div>

                    {/* Price Info */}
                    <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-[#1a2340]">
                      <div>
                        <div className="text-gray-400 text-xs uppercase tracking-wider font-['Outfit']">
                          Entry
                        </div>
                        <div className="text-lg font-bold text-white font-['JetBrains_Mono'] mt-1">
                          {position.entry_price.toFixed(5)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs uppercase tracking-wider font-['Outfit']">
                          Current
                        </div>
                        <div className="text-lg font-bold text-[#00f0ff] font-['JetBrains_Mono'] mt-1">
                          {position.current_price.toFixed(5)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs uppercase tracking-wider font-['Outfit']">
                          Pips
                        </div>
                        <div
                          className={`text-lg font-bold font-['JetBrains_Mono'] mt-1 ${
                            isProfit ? 'text-[#00e676]' : 'text-[#ff1744]'
                          }`}
                        >
                          {isProfit ? '+' : ''}
                          {position.unrealized_pips.toFixed(1)}
                        </div>
                      </div>
                    </div>

                    {/* P&L */}
                    <div className="mb-6">
                      <div className="text-gray-400 text-xs uppercase tracking-wider font-['Outfit'] mb-2">
                        Unrealized P&L
                      </div>
                      <div
                        className={`text-3xl font-bold font-['JetBrains_Mono'] ${
                          isProfit ? 'text-[#00e676]' : 'text-[#ff1744]'
                        }`}
                      >
                        {isProfit ? '+' : ''} ${position.unrealized_pnl.toFixed(2)}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-6">
                      <ProgressBar
                        entry={position.entry_price}
                        current={position.current_price}
                        sl={position.stop_loss}
                        tp={position.take_profit}
                        direction={position.direction}
                      />
                    </div>

                    {/* SL/TP Info */}
                    <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-[#1a2340]">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Shield size={14} className="text-[#ff1744]" />
                          <span className="text-gray-400 text-xs uppercase tracking-wider font-['Outfit']">
                            Stop Loss
                          </span>
                        </div>
                        <div className="text-white font-['JetBrains_Mono']">
                          {position.stop_loss.toFixed(5)}
                        </div>
                        <div className="text-xs text-gray-500 font-['JetBrains_Mono']">
                          {position.sl_distance_pips.toFixed(1)} pips
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Target size={14} className="text-[#00e676]" />
                          <span className="text-gray-400 text-xs uppercase tracking-wider font-['Outfit']">
                            Take Profit
                          </span>
                        </div>
                        <div className="text-white font-['JetBrains_Mono']">
                          {position.take_profit.toFixed(5)}
                        </div>
                        <div className="text-xs text-gray-500 font-['JetBrains_Mono']">
                          {position.tp_distance_pips.toFixed(1)} pips
                        </div>
                      </div>
                    </div>

                    {/* Duration */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Clock size={14} className="text-[#a855f7]" />
                        <span className="text-gray-400 text-xs uppercase tracking-wider font-['Outfit']">
                          Open For
                        </span>
                      </div>
                      <div className="text-white font-['JetBrains_Mono']">
                        {position.duration_minutes < 60
                          ? `${position.duration_minutes} min`
                          : position.duration_minutes < 1440
                            ? `${(position.duration_minutes / 60).toFixed(1)} hours`
                            : `${(position.duration_minutes / 1440).toFixed(1)} days`}
                      </div>
                    </div>
                  </div>
                </SpotlightCard>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 animate-in fade-in duration-500">
            <TrendingUp size={48} className="text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white font-['Outfit'] mb-2">
              No Open Positions
            </h2>
            <p className="text-gray-400 mb-6">
              There are currently no open trading positions. Start trading to see your positions here.
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-2 bg-[#00f0ff] text-black rounded font-semibold hover:bg-[#00d4e6] transition font-['Outfit']"
            >
              Back to Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
