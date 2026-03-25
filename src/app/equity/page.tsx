"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ArrowLeft, RefreshCw, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";

/* ═══════ INTERFACES ═══════ */
interface EquityPoint {
  timestamp: string;
  balance: number;
  equity: number;
  drawdown_pct: number;
}

interface EquitySummary {
  starting_balance: number;
  current_balance: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  total_pnl: number;
}

interface EquityData {
  success: boolean;
  demo_mode: boolean;
  equity: EquityPoint[];
  summary: EquitySummary;
}

/* ═══════ SPOTLIGHT CARD ═══════ */
function SpotlightCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--mouse-x", `${e.clientX - r.left}px`);
    ref.current.style.setProperty("--mouse-y", `${e.clientY - r.top}px`);
  };
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={`spotlight-card ${className}`}
    >
      <div className="glass-sheen absolute inset-0 rounded-[16px] pointer-events-none" />
      {children}
    </div>
  );
}

/* ═══════ EQUITY CURVE CHART ═══════ */
interface ChartPoint {
  x: number;
  y: number;
  balance: number;
  timestamp: string;
}

interface ChartDimensions {
  width: number;
  height: number;
  padding: number;
}

function EquityCurveChart({
  data,
  period,
}: {
  data: EquityPoint[];
  period: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const dims: ChartDimensions = {
    width: 1000,
    height: 400,
    padding: 60,
  };

  const plotArea = {
    width: dims.width - 2 * dims.padding,
    height: dims.height - 2 * dims.padding,
  };

  // Normalize data to fit chart
  const minBalance = Math.min(...data.map((d) => d.balance));
  const maxBalance = Math.max(...data.map((d) => d.balance));
  const balanceRange = maxBalance - minBalance || 1;

  const points: ChartPoint[] = data.map((d, i) => ({
    x: dims.padding + (i / (data.length - 1 || 1)) * plotArea.width,
    y:
      dims.height -
      dims.padding -
      ((d.balance - minBalance) / balanceRange) * plotArea.height,
    balance: d.balance,
    timestamp: d.timestamp,
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");

  const areaD = `${pathD} L${dims.width - dims.padding},${dims.height - dims.padding} L${dims.padding},${dims.height - dims.padding} Z`;

  // Grid lines (Y axis)
  const gridLines = [];
  const gridCount = 5;
  for (let i = 0; i <= gridCount; i++) {
    const y = dims.padding + (i / gridCount) * plotArea.height;
    const balance = maxBalance - (i / gridCount) * balanceRange;
    gridLines.push({ y, balance });
  }

  // Time labels (X axis)
  const timeLabels = [];
  const labelCount = Math.min(5, data.length);
  for (let i = 0; i < labelCount; i++) {
    const index = Math.floor((i / (labelCount - 1)) * (data.length - 1));
    if (data[index]) {
      const timeStr = new Date(data[index].timestamp).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      timeLabels.push({
        x: points[index].x,
        label: timeStr,
        index,
      });
    }
  }

  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Find closest point
    let closest = 0;
    let minDist = Math.abs(points[0].x - x);
    for (let i = 1; i < points.length; i++) {
      const dist = Math.abs(points[i].x - x);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }

    setHoveredIndex(closest);
    setTooltipPos({
      x: points[closest].x,
      y: points[closest].y,
    });
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${dims.width} ${dims.height}`}
        className="w-full min-w-[800px] h-auto cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          {/* Gradient for equity curve */}
          <linearGradient
            id="equity-gradient"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
          </linearGradient>

          {/* Gradient for drawdown area */}
          <linearGradient
            id="drawdown-gradient"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#ff1744" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#ff1744" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Background */}
        <rect
          x={dims.padding}
          y={dims.padding}
          width={plotArea.width}
          height={plotArea.height}
          fill="rgba(14,21,37,0.4)"
          rx="4"
        />

        {/* Grid lines */}
        {gridLines.map((line, i) => (
          <g key={`grid-${i}`}>
            <line
              x1={dims.padding}
              y1={line.y}
              x2={dims.width - dims.padding}
              y2={line.y}
              stroke="rgba(26,35,64,0.3)"
              strokeDasharray="4,4"
              strokeWidth="0.5"
            />
            {/* Y-axis label */}
            <text
              x={dims.padding - 12}
              y={line.y + 4}
              textAnchor="end"
              fontSize="11"
              fontFamily="JetBrains Mono"
              fill="rgba(90,106,138,0.8)"
            >
              ${line.balance.toFixed(0)}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {timeLabels.map((label, i) => (
          <g key={`time-${i}`}>
            <line
              x1={label.x}
              y1={dims.height - dims.padding}
              x2={label.x}
              y2={dims.height - dims.padding + 6}
              stroke="rgba(26,35,64,0.5)"
              strokeWidth="0.5"
            />
            <text
              x={label.x}
              y={dims.height - dims.padding + 20}
              textAnchor="middle"
              fontSize="10"
              fontFamily="JetBrains Mono"
              fill="rgba(90,106,138,0.7)"
            >
              {label.label}
            </text>
          </g>
        ))}

        {/* Equity curve area fill */}
        <path
          d={areaD}
          fill="url(#equity-gradient)"
          className="equity-area"
        />

        {/* Equity curve line */}
        <path
          d={pathD}
          stroke="#00f0ff"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="equity-line"
          style={{ filter: "drop-shadow(0 0 8px rgba(0,240,255,0.3))" }}
        />

        {/* Hover crosshair */}
        {hoveredPoint && (
          <>
            <line
              x1={hoveredPoint.x}
              y1={dims.padding}
              x2={hoveredPoint.x}
              y2={dims.height - dims.padding}
              stroke="rgba(0,240,255,0.4)"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
            <circle
              cx={hoveredPoint.x}
              cy={hoveredPoint.y}
              r="4"
              fill="#00f0ff"
              opacity="0.8"
            />
            <circle
              cx={hoveredPoint.x}
              cy={hoveredPoint.y}
              r="8"
              fill="none"
              stroke="#00f0ff"
              strokeWidth="1"
              opacity="0.4"
            />
          </>
        )}
      </svg>

      {/* Hover Tooltip */}
      {hoveredPoint && (
        <div
          className="absolute bg-apex-surface border border-apex-border rounded-lg p-3 pointer-events-none z-20"
          style={{
            left: `${(tooltipPos.x / dims.width) * 100}%`,
            top: `${(tooltipPos.y / dims.height) * 100}%`,
            transform: "translate(-50%, -120%)",
          }}
        >
          <div className="text-xs text-apex-muted mb-1 font-mono">
            {new Date(hoveredPoint.timestamp).toLocaleString()}
          </div>
          <div className="text-sm font-bold font-mono text-apex-accent">
            ${hoveredPoint.balance.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════ DRAWDOWN CHART ═══════ */
function DrawdownChart({ data }: { data: EquityPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const dims = { width: 1000, height: 200, padding: 40 };
  const plotArea = {
    width: dims.width - 2 * dims.padding,
    height: dims.height - 2 * dims.padding,
  };

  const maxDrawdown = Math.max(...data.map((d) => d.drawdown_pct));

  const points = data.map((d, i) => ({
    x: dims.padding + (i / (data.length - 1 || 1)) * plotArea.width,
    y:
      dims.height -
      dims.padding -
      ((d.drawdown_pct / (maxDrawdown || 1)) * plotArea.height),
    drawdown: d.drawdown_pct,
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");

  const areaD = `${pathD} L${dims.width - dims.padding},${dims.height - dims.padding} L${dims.padding},${dims.height - dims.padding} Z`;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;

    let closest = 0;
    let minDist = Math.abs(points[0].x - x);
    for (let i = 1; i < points.length; i++) {
      const dist = Math.abs(points[i].x - x);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }
    setHoveredIndex(closest);
  };

  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${dims.width} ${dims.height}`}
        className="w-full min-w-[800px] h-auto cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <defs>
          <linearGradient id="drawdown-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff1744" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#ff1744" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Background */}
        <rect
          x={dims.padding}
          y={dims.padding}
          width={plotArea.width}
          height={plotArea.height}
          fill="rgba(14,21,37,0.4)"
          rx="4"
        />

        {/* Grid lines */}
        {[0, 1, 2].map((i) => {
          const y = dims.padding + (i / 2) * plotArea.height;
          const dd = (maxDrawdown / 2) * (2 - i);
          return (
            <g key={`grid-${i}`}>
              <line
                x1={dims.padding}
                y1={y}
                x2={dims.width - dims.padding}
                y2={y}
                stroke="rgba(26,35,64,0.3)"
                strokeDasharray="4,4"
                strokeWidth="0.5"
              />
              <text
                x={dims.padding - 12}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fontFamily="JetBrains Mono"
                fill="rgba(90,106,138,0.7)"
              >
                {dd.toFixed(1)}%
              </text>
            </g>
          );
        })}

        {/* Drawdown area fill */}
        <path d={areaD} fill="url(#drawdown-fill)" />

        {/* Drawdown line */}
        <path
          d={pathD}
          stroke="#ff1744"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 0 6px rgba(255,23,68,0.25))" }}
        />

        {/* Hover indicator */}
        {hoveredPoint && (
          <>
            <line
              x1={hoveredPoint.x}
              y1={dims.padding}
              x2={hoveredPoint.x}
              y2={dims.height - dims.padding}
              stroke="rgba(255,23,68,0.3)"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
            <circle
              cx={hoveredPoint.x}
              cy={hoveredPoint.y}
              r="3.5"
              fill="#ff1744"
              opacity="0.8"
            />
          </>
        )}
      </svg>

      {/* Tooltip */}
      {hoveredPoint && (
        <div
          className="absolute bg-apex-surface border border-apex-border rounded-lg p-2 pointer-events-none z-20 text-xs"
          style={{
            left: `${(hoveredPoint.x / dims.width) * 100}%`,
            top: `${(hoveredPoint.y / dims.height) * 100}%`,
            transform: "translate(-50%, -80%)",
          }}
        >
          <div className="font-bold font-mono text-apex-red">
            {hoveredPoint.drawdown.toFixed(2)}%
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   EQUITY PAGE
   ═══════════════════════════════════════════ */
export default function EquityPage() {
  const [data, setData] = useState<EquityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [period, setPeriod] = useState("ALL");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchEquity = async () => {
    try {
      const res = await fetch("/api/equity");
      const json = await res.json();
      setData(json);
      setIsConnected(true);
      setLastUpdate(new Date());
    } catch {
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEquity();
    const interval = setInterval(fetchEquity, 60000);
    return () => clearInterval(interval);
  }, []);

  // Filter data by period
  const filteredData = useMemo(() => {
    if (!data?.equity) return [];

    const now = new Date();
    let cutoffDate = new Date();

    switch (period) {
      case "1D":
        cutoffDate.setDate(now.getDate() - 1);
        break;
      case "1W":
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case "1M":
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case "3M":
        cutoffDate.setMonth(now.getMonth() - 3);
        break;
      default: // ALL
        cutoffDate = new Date(0);
    }

    return data.equity.filter(
      (point) => new Date(point.timestamp) >= cutoffDate
    );
  }, [data?.equity, period]);

  const summary = data?.summary;

  /* Loading state */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <div className="orb orb-1 top-[10%] left-[20%]" />
        <div className="text-center relative z-10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-apex-card border border-apex-border flex items-center justify-center animate-pulse">
            <RefreshCw className="w-8 h-8 text-apex-accent" />
          </div>
          <div className="text-sm text-apex-muted font-mono">
            Loading equity data...
          </div>
        </div>
      </div>
    );
  }

  if (!data || !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <div className="text-center relative z-10">
          <div className="text-sm text-apex-red mb-4">Failed to load equity data</div>
          <button
            onClick={fetchEquity}
            className="px-4 py-2 rounded-lg bg-apex-accent text-black font-semibold text-sm hover:opacity-90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const returnColor =
    summary.total_return_pct >= 0 ? "text-apex-green" : "text-apex-red";
  const drawdownColor =
    summary.max_drawdown_pct <= 0 ? "text-apex-green" : "text-apex-red";

  return (
    <div className="relative z-10 min-h-screen pb-12">
      {/* Floating orbs */}
      <div className="orb orb-1 top-[5%] left-[10%]" />
      <div className="orb orb-2 top-[40%] right-[5%]" />
      <div className="orb orb-3 bottom-[10%] left-[30%]" />

      <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
        {/* Header with back button */}
        <div className="flex items-center justify-between mb-8 animate-slide-down">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2.5 rounded-lg bg-apex-surface border border-apex-border hover:border-apex-accent/50 transition-all text-apex-muted hover:text-apex-accent"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white font-[Outfit]">
                EQUITY CURVE
              </h1>
              <p className="text-xs text-apex-muted mt-1">
                Balance and drawdown analysis
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {data.demo_mode && (
              <div className="px-3 py-1.5 bg-apex-amber/10 border border-apex-amber/30 rounded-lg text-[11px] font-semibold text-apex-amber uppercase tracking-widest">
                DEMO
              </div>
            )}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono ${
                isConnected
                  ? "bg-apex-green/10 border border-apex-green/30 text-apex-green"
                  : "bg-apex-red/10 border border-apex-red/30 text-apex-red"
              }`}
            >
              {isConnected ? (
                <Wifi className="w-3 h-3" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
              {isConnected ? "CONNECTED" : "OFFLINE"}
            </div>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8 animate-slide-down stagger-1">
          <SpotlightCard className="p-4">
            <div className="text-[10px] text-apex-muted uppercase tracking-widest mb-2 font-[Outfit]">
              Starting Balance
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              ${summary.starting_balance.toFixed(2)}
            </div>
          </SpotlightCard>

          <SpotlightCard className="p-4">
            <div className="text-[10px] text-apex-muted uppercase tracking-widest mb-2 font-[Outfit]">
              Current Balance
            </div>
            <div className="text-2xl font-bold text-apex-accent font-mono">
              ${summary.current_balance.toFixed(2)}
            </div>
          </SpotlightCard>

          <SpotlightCard className="p-4">
            <div className="text-[10px] text-apex-muted uppercase tracking-widest mb-2 font-[Outfit]">
              Total Return
            </div>
            <div className={`text-2xl font-bold font-mono ${returnColor}`}>
              {summary.total_return_pct.toFixed(2)}%
            </div>
            <div className="text-[9px] text-apex-muted mt-1">
              ${summary.total_pnl.toFixed(2)} PnL
            </div>
          </SpotlightCard>

          <SpotlightCard className="p-4">
            <div className="text-[10px] text-apex-muted uppercase tracking-widest mb-2 font-[Outfit]">
              Max Drawdown
            </div>
            <div className={`text-2xl font-bold font-mono ${drawdownColor}`}>
              {summary.max_drawdown_pct.toFixed(2)}%
            </div>
          </SpotlightCard>

          <SpotlightCard className="p-4">
            <div className="text-[10px] text-apex-muted uppercase tracking-widest mb-2 font-[Outfit]">
              Last Update
            </div>
            <div className="text-sm font-mono text-apex-muted">
              {lastUpdate
                ? lastUpdate.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "—"}
            </div>
          </SpotlightCard>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2 mb-6 animate-slide-down stagger-2">
          {["1D", "1W", "1M", "3M", "ALL"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all font-[Outfit] ${
                period === p
                  ? "bg-apex-accent text-black border border-apex-accent"
                  : "bg-apex-surface border border-apex-border text-apex-muted hover:border-apex-accent/50 hover:text-white"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Equity Curve Chart */}
        <SpotlightCard className="p-6 mb-8 animate-slide-down stagger-3">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white mb-1 font-[Outfit]">
              Equity Balance
            </h2>
            <p className="text-xs text-apex-muted">
              Account balance over time — hover for exact values
            </p>
          </div>
          {filteredData.length > 1 ? (
            <EquityCurveChart data={filteredData} period={period} />
          ) : (
            <div className="h-96 flex items-center justify-center text-apex-muted text-sm">
              Insufficient data for selected period
            </div>
          )}
        </SpotlightCard>

        {/* Drawdown Chart */}
        <SpotlightCard className="p-6 animate-slide-down stagger-4">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white mb-1 font-[Outfit]">
              Drawdown %
            </h2>
            <p className="text-xs text-apex-muted">
              Peak-to-trough decline percentage
            </p>
          </div>
          {filteredData.length > 1 ? (
            <DrawdownChart data={filteredData} />
          ) : (
            <div className="h-48 flex items-center justify-center text-apex-muted text-sm">
              Insufficient data for selected period
            </div>
          )}
        </SpotlightCard>
      </div>
    </div>
  );
}
