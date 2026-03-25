"use client";
import { useState, useRef, useCallback, useEffect } from "react";

export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandlestickChartProps {
  candles: CandleData[];
  width?: number;
  height?: number;
  pair?: string;
  trades?: Array<{ time: string; direction: "BUY" | "SELL"; price: number }>;
}

const CandlestickChart = ({
  candles,
  width = 1200,
  height = 500,
  pair = "EUR_USD",
  trades = [],
}: CandlestickChartProps) => {
  const [visibleRange, setVisibleRange] = useState({ start: Math.max(0, candles.length - 50), end: candles.length });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Constants
  const CHART_MARGIN = { top: 20, right: 20, bottom: 60, left: 60 };
  const VOLUME_HEIGHT_RATIO = 0.2;
  const chartHeight = height * (1 - VOLUME_HEIGHT_RATIO);
  const volumeHeight = height * VOLUME_HEIGHT_RATIO;
  const chartWidth = width - CHART_MARGIN.left - CHART_MARGIN.right;

  const visibleCandles = candles.slice(visibleRange.start, visibleRange.end);

  if (visibleCandles.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ backgroundColor: "#050810" }}
      >
        <text x={width / 2} y={height / 2} textAnchor="middle" fill="#999" fontSize="14">
          No data available
        </text>
      </svg>
    );
  }

  // Calculate price range
  const prices = visibleCandles.flatMap((c) => [c.high, c.low]);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  const padding = priceRange * 0.05;
  const yMin = minPrice - padding;
  const yMax = maxPrice + padding;

  // Calculate volume range
  const volumes = visibleCandles.map((c) => c.volume);
  const maxVolume = Math.max(...volumes);

  // Scale functions
  const scaleX = (index: number) => (index / (visibleCandles.length - 1 || 1)) * chartWidth + CHART_MARGIN.left;
  const scaleY = (price: number) => {
    const normalized = (yMax - price) / (yMax - yMin || 1);
    return normalized * chartHeight + CHART_MARGIN.top;
  };
  const scaleVolume = (volume: number) => (volume / maxVolume) * volumeHeight;

  // Format price with appropriate decimals
  const formatPrice = (price: number) => {
    const decimals = pair.includes("JPY") ? 2 : 4;
    return price.toFixed(decimals);
  };

  // Generate Y-axis labels
  const yLabels = [];
  const labelCount = 5;
  for (let i = 0; i <= labelCount; i++) {
    const price = yMin + (yMax - yMin) * (i / labelCount);
    yLabels.push({
      price,
      y: scaleY(price),
      label: formatPrice(price),
    });
  }

  // Generate X-axis time labels (show every Nth to avoid overlap)
  const timeLabels = [];
  const labelInterval = Math.ceil(visibleCandles.length / 5);
  for (let i = 0; i < visibleCandles.length; i += labelInterval) {
    const candle = visibleCandles[i];
    const time = new Date(candle.time);
    timeLabels.push({
      index: i,
      x: scaleX(i),
      label: time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  }

  // Find trades within visible range
  const visibleTrades = trades.filter((trade) => {
    const tradeTime = new Date(trade.time).getTime();
    const startTime = new Date(visibleCandles[0].time).getTime();
    const endTime = new Date(visibleCandles[visibleCandles.length - 1].time).getTime();
    return tradeTime >= startTime && tradeTime <= endTime;
  });

  // Handle scroll/pan
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const direction = e.deltaY > 0 ? 1 : -1;
      const step = Math.max(1, Math.floor(visibleCandles.length * 0.1));

      setVisibleRange((prev) => {
        let newStart = prev.start + direction * step;
        let newEnd = prev.end + direction * step;

        newStart = Math.max(0, Math.min(newStart, candles.length - 10));
        newEnd = Math.min(candles.length, Math.max(newEnd, 10));

        if (newEnd - newStart < 10) {
          if (newStart === 0) newEnd = Math.min(10, candles.length);
          else newStart = Math.max(0, newEnd - 10);
        }

        return { start: newStart, end: newEnd };
      });
    },
    [candles.length, visibleCandles.length]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMousePos({ x, y });

    // Determine hovered candle
    if (
      x >= CHART_MARGIN.left &&
      x <= CHART_MARGIN.left + chartWidth &&
      y >= CHART_MARGIN.top &&
      y <= CHART_MARGIN.top + chartHeight
    ) {
      const candleIndex = Math.round(
        ((x - CHART_MARGIN.left) / chartWidth) * (visibleCandles.length - 1)
      );
      setHoveredIndex(Math.max(0, Math.min(candleIndex, visibleCandles.length - 1)));
    } else {
      setHoveredIndex(null);
    }
  }, [visibleCandles.length, chartWidth, chartHeight]);

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  const hoveredCandle = hoveredIndex !== null ? visibleCandles[hoveredIndex] : null;
  const hoveredX = hoveredIndex !== null ? scaleX(hoveredIndex) : 0;

  return (
    <div className="w-full bg-[#050810] rounded-lg overflow-hidden border border-white/5">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full cursor-crosshair"
        style={{ backgroundColor: "#050810" }}
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Background */}
        <defs>
          <linearGradient id="volumeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00e676" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00e676" stopOpacity="0.05" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines and Y-axis labels */}
        {yLabels.map((label, i) => (
          <g key={`y-${i}`}>
            <line
              x1={CHART_MARGIN.left}
              y1={label.y}
              x2={CHART_MARGIN.left + chartWidth}
              y2={label.y}
              stroke="white"
              strokeOpacity="0.05"
              strokeWidth="1"
            />
            <text
              x={CHART_MARGIN.left - 10}
              y={label.y + 4}
              textAnchor="end"
              fill="#999"
              fontSize="12"
              fontFamily="JetBrains Mono"
            >
              {label.label}
            </text>
          </g>
        ))}

        {/* Volume bars */}
        {visibleCandles.map((candle, i) => {
          const x = scaleX(i);
          const barHeight = scaleVolume(candle.volume);
          const yBase = CHART_MARGIN.top + chartHeight + volumeHeight;
          return (
            <rect
              key={`volume-${i}`}
              x={x - (chartWidth / visibleCandles.length) * 0.35}
              y={yBase - barHeight}
              width={(chartWidth / visibleCandles.length) * 0.7}
              height={barHeight}
              fill="url(#volumeGradient)"
              opacity={hoveredIndex === i ? 0.6 : 0.3}
              style={{ transition: "opacity 0.2s ease" }}
            />
          );
        })}

        {/* Candlestick bodies and wicks */}
        {visibleCandles.map((candle, i) => {
          const x = scaleX(i);
          const yOpen = scaleY(candle.open);
          const yClose = scaleY(candle.close);
          const yHigh = scaleY(candle.high);
          const yLow = scaleY(candle.low);

          const isGreen = candle.close >= candle.open;
          const color = isGreen ? "#00e676" : "#ff1744";
          const bodyTop = Math.min(yOpen, yClose);
          const bodyHeight = Math.abs(yClose - yOpen) || 1;
          const candleWidth = (chartWidth / visibleCandles.length) * 0.6;
          const isHovered = hoveredIndex === i;

          return (
            <g key={`candle-${i}`} filter={isHovered ? "url(#glow)" : undefined}>
              {/* Wick */}
              <line
                x1={x}
                y1={yHigh}
                x2={x}
                y2={yLow}
                stroke={color}
                strokeWidth="1"
                opacity={isHovered ? 1 : 0.6}
                style={{ transition: "opacity 0.2s ease" }}
              />
              {/* Body */}
              <rect
                x={x - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={bodyHeight}
                fill={color}
                opacity={isHovered ? 1 : 0.8}
                style={{ transition: "opacity 0.2s ease" }}
              />
            </g>
          );
        })}

        {/* Trade markers */}
        {visibleTrades.map((trade, i) => {
          const tradeTime = new Date(trade.time).getTime();
          const candleIndex = visibleCandles.findIndex(
            (c) => Math.abs(new Date(c.time).getTime() - tradeTime) < 300000
          );

          if (candleIndex === -1) return null;

          const x = scaleX(candleIndex);
          const y = scaleY(trade.price);
          const isLong = trade.direction === "BUY";
          const color = isLong ? "#00e676" : "#ff1744";
          const triangleSize = 8;

          return (
            <g key={`trade-${i}`}>
              {/* Triangle marker */}
              <polygon
                points={
                  isLong
                    ? `${x},${y - triangleSize} ${x - triangleSize},${y + triangleSize} ${x + triangleSize},${y + triangleSize}`
                    : `${x},${y + triangleSize} ${x - triangleSize},${y - triangleSize} ${x + triangleSize},${y - triangleSize}`
                }
                fill={color}
                opacity="0.9"
                filter="url(#glow)"
              />
              {/* Label */}
              <text
                x={x}
                y={isLong ? y - 20 : y + 25}
                textAnchor="middle"
                fill={color}
                fontSize="10"
                fontFamily="JetBrains Mono"
                fontWeight="bold"
              >
                {trade.direction}
              </text>
            </g>
          );
        })}

        {/* Crosshair and hover tooltip */}
        {hoveredIndex !== null && hoveredCandle && (
          <g>
            {/* Vertical line */}
            <line
              x1={hoveredX}
              y1={CHART_MARGIN.top}
              x2={hoveredX}
              y2={CHART_MARGIN.top + chartHeight}
              stroke="white"
              strokeWidth="1"
              strokeDasharray="4"
              opacity="0.4"
            />

            {/* Horizontal line */}
            <line
              x1={CHART_MARGIN.left}
              y1={mousePos.y}
              x2={CHART_MARGIN.left + chartWidth}
              y2={mousePos.y}
              stroke="white"
              strokeWidth="1"
              strokeDasharray="4"
              opacity="0.4"
            />

            {/* Tooltip background */}
            <rect
              x={hoveredX + 15}
              y={CHART_MARGIN.top + 10}
              width={160}
              height={110}
              fill="#0e1525"
              stroke="#00e676"
              strokeWidth="1"
              opacity="0.95"
              rx="4"
            />

            {/* Tooltip text */}
            <text
              x={hoveredX + 22}
              y={CHART_MARGIN.top + 28}
              fill="#00e676"
              fontSize="11"
              fontFamily="JetBrains Mono"
              fontWeight="bold"
            >
              O: {formatPrice(hoveredCandle.open)}
            </text>
            <text
              x={hoveredX + 22}
              y={CHART_MARGIN.top + 45}
              fill="#00e676"
              fontSize="11"
              fontFamily="JetBrains Mono"
            >
              H: {formatPrice(hoveredCandle.high)}
            </text>
            <text
              x={hoveredX + 22}
              y={CHART_MARGIN.top + 62}
              fill="#00e676"
              fontSize="11"
              fontFamily="JetBrains Mono"
            >
              L: {formatPrice(hoveredCandle.low)}
            </text>
            <text
              x={hoveredX + 22}
              y={CHART_MARGIN.top + 79}
              fill="#00e676"
              fontSize="11"
              fontFamily="JetBrains Mono"
            >
              C: {formatPrice(hoveredCandle.close)}
            </text>
            <text
              x={hoveredX + 22}
              y={CHART_MARGIN.top + 96}
              fill="#00e676"
              fontSize="11"
              fontFamily="JetBrains Mono"
            >
              V: {hoveredCandle.volume.toLocaleString()}
            </text>
          </g>
        )}

        {/* X-axis labels */}
        {timeLabels.map((label, i) => (
          <g key={`x-${i}`}>
            <line
              x1={label.x}
              y1={CHART_MARGIN.top + chartHeight}
              x2={label.x}
              y2={CHART_MARGIN.top + chartHeight + 5}
              stroke="white"
              opacity="0.2"
            />
            <text
              x={label.x}
              y={CHART_MARGIN.top + chartHeight + 20}
              textAnchor="middle"
              fill="#999"
              fontSize="12"
              fontFamily="JetBrains Mono"
            >
              {label.label}
            </text>
          </g>
        ))}

        {/* Axis labels */}
        <text
          x={width / 2}
          y={height - 10}
          textAnchor="middle"
          fill="#666"
          fontSize="12"
          fontFamily="Outfit"
        >
          Time
        </text>
        <text
          x={20}
          y={height / 2}
          textAnchor="middle"
          fill="#666"
          fontSize="12"
          fontFamily="Outfit"
          transform={`rotate(-90 20 ${height / 2})`}
        >
          Price ({pair.split("_")[1]})
        </text>
      </svg>
    </div>
  );
};

export default CandlestickChart;
