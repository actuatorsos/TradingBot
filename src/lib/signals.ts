/**
 * APEX TRADER AI - Signal Engine (TypeScript Port)
 * 9-indicator confluence analysis for high-confidence forex signals
 */

import type { CandleData } from "./oanda";

export interface Signal {
  direction: "BUY" | "SELL" | "HOLD";
  confidence: number;
  reasons: string[];
  indicators: Record<string, number | boolean>;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  timestamp: string;
}

export interface IndicatorDetail {
  name: string;
  value: number | string;
  signal: "bullish" | "bearish" | "neutral";
  weight: number;
  contribution: number;
}

const WEIGHTS: Record<string, number> = {
  rsi: 1.5,
  macd: 1.2,
  bollinger: 1.3,
  ema_cross: 1.0,
  volume: 0.8,
  candlestick: 1.0,
  stochastic: 0.9,
  atr_filter: 0.7,
  sentiment: 1.2,
};

const TOTAL_WEIGHT = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

// ─── Helper Functions ───

function sma(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / period);
    }
  }
  return result;
}

function ema(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function stdDev(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
      result.push(Math.sqrt(variance));
    }
  }
  return result;
}

function calcRSI(closes: number[], period: number = 14): number[] {
  const rsi: number[] = [];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      rsi.push(50);
      continue;
    }
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (i <= period) {
      avgGain += gain / period;
      avgLoss += loss / period;
      rsi.push(i < period ? 50 : 100 - 100 / (1 + avgGain / (avgLoss || 0.0001)));
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      rsi.push(100 - 100 / (1 + avgGain / (avgLoss || 0.0001)));
    }
  }
  return rsi;
}

function calcStochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): { k: number[]; d: number[] } {
  const kValues: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      kValues.push(50);
    } else {
      const highSlice = highs.slice(i - period + 1, i + 1);
      const lowSlice = lows.slice(i - period + 1, i + 1);
      const hh = Math.max(...highSlice);
      const ll = Math.min(...lowSlice);
      kValues.push(hh !== ll ? ((closes[i] - ll) / (hh - ll)) * 100 : 50);
    }
  }
  return { k: kValues, d: sma(kValues, 3) };
}

function calcATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number[] {
  const tr: number[] = [highs[0] - lows[0]];
  for (let i = 1; i < closes.length; i++) {
    tr.push(
      Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      )
    );
  }
  return ema(tr, period);
}

// ─── Main Signal Engine ───

export function analyzeSignal(
  candles: CandleData[],
  sentimentScore: number = 0,
  minConfidence: number = 72
): Signal {
  if (candles.length < 50) {
    return {
      direction: "HOLD",
      confidence: 0,
      reasons: ["Insufficient data"],
      indicators: {},
      entry_price: 0,
      stop_loss: 0,
      take_profit: 0,
      timestamp: new Date().toISOString(),
    };
  }

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const volumes = candles.map((c) => c.volume);
  const n = closes.length;

  let buyScore = 0;
  let sellScore = 0;
  const reasonsBuy: string[] = [];
  const reasonsSell: string[] = [];
  const indicators: Record<string, number | boolean> = {};

  // ── 1. RSI ──
  const rsiValues = calcRSI(closes, 14);
  const currentRSI = rsiValues[n - 1];
  const prevRSI = rsiValues[n - 2];
  indicators.rsi = parseFloat(currentRSI.toFixed(2));

  if (currentRSI < 30) {
    buyScore += WEIGHTS.rsi;
    reasonsBuy.push(`RSI oversold (${currentRSI.toFixed(1)})`);
  } else if (currentRSI > 70) {
    sellScore += WEIGHTS.rsi;
    reasonsSell.push(`RSI overbought (${currentRSI.toFixed(1)})`);
  }

  if (currentRSI > prevRSI && closes[n - 1] < closes[n - 2]) {
    buyScore += WEIGHTS.rsi * 0.5;
    reasonsBuy.push("Bullish RSI divergence");
  } else if (currentRSI < prevRSI && closes[n - 1] > closes[n - 2]) {
    sellScore += WEIGHTS.rsi * 0.5;
    reasonsSell.push("Bearish RSI divergence");
  }

  // ── 2. MACD ──
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = ema(macdLine, 9);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);

  indicators.macd = parseFloat(macdLine[n - 1].toFixed(6));
  indicators.macd_signal = parseFloat(signalLine[n - 1].toFixed(6));
  indicators.macd_histogram = parseFloat(histogram[n - 1].toFixed(6));

  if (macdLine[n - 1] > signalLine[n - 1] && histogram[n - 2] < 0 && histogram[n - 1] > 0) {
    buyScore += WEIGHTS.macd;
    reasonsBuy.push("MACD bullish crossover");
  } else if (macdLine[n - 1] < signalLine[n - 1] && histogram[n - 2] > 0 && histogram[n - 1] < 0) {
    sellScore += WEIGHTS.macd;
    reasonsSell.push("MACD bearish crossover");
  } else if (histogram[n - 1] > 0 && histogram[n - 1] > histogram[n - 2]) {
    buyScore += WEIGHTS.macd * 0.5;
    reasonsBuy.push("MACD momentum increasing");
  } else if (histogram[n - 1] < 0 && histogram[n - 1] < histogram[n - 2]) {
    sellScore += WEIGHTS.macd * 0.5;
    reasonsSell.push("MACD momentum decreasing");
  }

  // ── 3. Bollinger Bands ──
  const bbSMA = sma(closes, 20);
  const bbStd = stdDev(closes, 20);
  const bbUpper = bbSMA[n - 1] + 2 * bbStd[n - 1];
  const bbLower = bbSMA[n - 1] - 2 * bbStd[n - 1];
  const bbWidth = (bbUpper - bbLower) / bbSMA[n - 1];
  const price = closes[n - 1];

  indicators.bb_upper = parseFloat(bbUpper.toFixed(5));
  indicators.bb_lower = parseFloat(bbLower.toFixed(5));
  indicators.bb_width = parseFloat(bbWidth.toFixed(5));

  if (price <= bbLower) {
    buyScore += WEIGHTS.bollinger;
    reasonsBuy.push("Price at lower Bollinger Band");
  } else if (price >= bbUpper) {
    sellScore += WEIGHTS.bollinger;
    reasonsSell.push("Price at upper Bollinger Band");
  }

  // ── 4. EMA Cross ──
  const emaFast = ema(closes, 20);
  const emaSlow = ema(closes, 50);
  indicators.ema_fast = parseFloat(emaFast[n - 1].toFixed(5));
  indicators.ema_slow = parseFloat(emaSlow[n - 1].toFixed(5));

  if (emaFast[n - 1] > emaSlow[n - 1]) {
    buyScore += WEIGHTS.ema_cross;
    reasonsBuy.push("EMA bullish trend (fast > slow)");
    if (emaFast[n - 2] <= emaSlow[n - 2]) {
      buyScore += WEIGHTS.ema_cross * 0.5;
      reasonsBuy.push("EMA golden cross!");
    }
  } else {
    sellScore += WEIGHTS.ema_cross;
    reasonsSell.push("EMA bearish trend (fast < slow)");
    if (emaFast[n - 2] >= emaSlow[n - 2]) {
      sellScore += WEIGHTS.ema_cross * 0.5;
      reasonsSell.push("EMA death cross!");
    }
  }

  // ── 5. Volume ──
  const volSMA = sma(volumes, 20);
  const volRatio = volumes[n - 1] / (volSMA[n - 1] || 1);
  indicators.volume_ratio = parseFloat(volRatio.toFixed(2));

  if (volRatio > 1.5) {
    if (buyScore > sellScore) {
      buyScore += WEIGHTS.volume;
      reasonsBuy.push(`Volume surge (${volRatio.toFixed(1)}x avg)`);
    } else {
      sellScore += WEIGHTS.volume;
      reasonsSell.push(`Volume surge (${volRatio.toFixed(1)}x avg)`);
    }
  }

  // ── 6. Candlestick Patterns ──
  const c = candles[n - 1];
  const p = candles[n - 2];
  const body = Math.abs(c.close - c.open);
  const upperWick = c.high - Math.max(c.close, c.open);
  const lowerWick = Math.min(c.close, c.open) - c.low;
  const totalRange = c.high - c.low;

  if (totalRange > 0) {
    if (lowerWick > body * 2 && upperWick < body * 0.5 && c.close > c.open) {
      buyScore += WEIGHTS.candlestick;
      reasonsBuy.push("Hammer pattern detected");
    } else if (upperWick > body * 2 && lowerWick < body * 0.5 && c.close < c.open) {
      sellScore += WEIGHTS.candlestick;
      reasonsSell.push("Shooting star pattern");
    } else if (p.close < p.open && c.close > c.open && c.close > p.open && c.open < p.close) {
      buyScore += WEIGHTS.candlestick;
      reasonsBuy.push("Bullish engulfing");
    } else if (p.close > p.open && c.close < c.open && c.close < p.open && c.open > p.close) {
      sellScore += WEIGHTS.candlestick;
      reasonsSell.push("Bearish engulfing");
    }
  }

  // ── 7. Stochastic ──
  const stoch = calcStochastic(highs, lows, closes);
  const stochK = stoch.k[n - 1];
  const stochD = stoch.d[n - 1];
  indicators.stochastic_k = parseFloat(stochK.toFixed(2));

  if (stochK < 20 && stochK > stochD) {
    buyScore += WEIGHTS.stochastic;
    reasonsBuy.push(`Stochastic oversold reversal (${stochK.toFixed(0)})`);
  } else if (stochK > 80 && stochK < stochD) {
    sellScore += WEIGHTS.stochastic;
    reasonsSell.push(`Stochastic overbought reversal (${stochK.toFixed(0)})`);
  }

  // ── 8. ATR ──
  const atrValues = calcATR(highs, lows, closes);
  const currentATR = atrValues[n - 1];
  const avgATR = sma(atrValues.slice(-20), 20).pop() || currentATR;
  indicators.atr = parseFloat(currentATR.toFixed(6));

  if (currentATR > avgATR * 2) {
    buyScore *= 0.7;
    sellScore *= 0.7;
    reasonsBuy.push("High volatility - reduced confidence");
  }

  // ── 9. News Sentiment ──
  indicators.sentiment = sentimentScore;
  if (Math.abs(sentimentScore) > 0.4) {
    if (sentimentScore > 0) {
      buyScore += WEIGHTS.sentiment;
      reasonsBuy.push(`Positive sentiment (${sentimentScore.toFixed(2)})`);
    } else {
      sellScore += WEIGHTS.sentiment;
      reasonsSell.push(`Negative sentiment (${sentimentScore.toFixed(2)})`);
    }
  }

  // ── FINAL ──
  const maxScore = Math.max(buyScore, sellScore);
  let confidence = (maxScore / TOTAL_WEIGHT) * 100;
  confidence = Math.min(confidence, 98);

  if (confidence < minConfidence) {
    return {
      direction: "HOLD",
      confidence: parseFloat(confidence.toFixed(2)),
      reasons: ["Confidence below threshold"],
      indicators,
      entry_price: price,
      stop_loss: 0,
      take_profit: 0,
      timestamp: new Date().toISOString(),
    };
  }

  const direction = buyScore > sellScore ? "BUY" : "SELL";
  const reasons = direction === "BUY" ? reasonsBuy : reasonsSell;
  const pip = 0.0001;
  const slPips = 15;
  const tpPips = 25;

  return {
    direction,
    confidence: parseFloat(confidence.toFixed(2)),
    reasons,
    indicators,
    entry_price: parseFloat(price.toFixed(5)),
    stop_loss: parseFloat(
      (direction === "BUY" ? price - slPips * pip : price + slPips * pip).toFixed(5)
    ),
    take_profit: parseFloat(
      (direction === "BUY" ? price + tpPips * pip : price - tpPips * pip).toFixed(5)
    ),
    timestamp: new Date().toISOString(),
  };
}

export function getIndicatorDetails(signal: Signal): IndicatorDetail[] {
  const ind = signal.indicators;
  return [
    {
      name: "RSI (14)",
      value: ind.rsi as number,
      signal: (ind.rsi as number) < 30 ? "bullish" : (ind.rsi as number) > 70 ? "bearish" : "neutral",
      weight: WEIGHTS.rsi,
      contribution: WEIGHTS.rsi / TOTAL_WEIGHT * 100,
    },
    {
      name: "MACD",
      value: ind.macd as number,
      signal: (ind.macd_histogram as number) > 0 ? "bullish" : "bearish",
      weight: WEIGHTS.macd,
      contribution: WEIGHTS.macd / TOTAL_WEIGHT * 100,
    },
    {
      name: "Bollinger Bands",
      value: `${(ind.bb_width as number)?.toFixed(4) || "N/A"}`,
      signal: "neutral",
      weight: WEIGHTS.bollinger,
      contribution: WEIGHTS.bollinger / TOTAL_WEIGHT * 100,
    },
    {
      name: "EMA Cross (20/50)",
      value: `${((ind.ema_fast as number) - (ind.ema_slow as number))?.toFixed(5) || "0"}`,
      signal: (ind.ema_fast as number) > (ind.ema_slow as number) ? "bullish" : "bearish",
      weight: WEIGHTS.ema_cross,
      contribution: WEIGHTS.ema_cross / TOTAL_WEIGHT * 100,
    },
    {
      name: "Volume",
      value: `${(ind.volume_ratio as number)?.toFixed(2) || "1.0"}x`,
      signal: (ind.volume_ratio as number) > 1.5 ? "bullish" : "neutral",
      weight: WEIGHTS.volume,
      contribution: WEIGHTS.volume / TOTAL_WEIGHT * 100,
    },
    {
      name: "Candlestick",
      value: signal.reasons.find(r => r.includes("pattern") || r.includes("engulfing") || r.includes("Hammer") || r.includes("star")) || "None",
      signal: signal.direction === "BUY" ? "bullish" : signal.direction === "SELL" ? "bearish" : "neutral",
      weight: WEIGHTS.candlestick,
      contribution: WEIGHTS.candlestick / TOTAL_WEIGHT * 100,
    },
    {
      name: "Stochastic",
      value: ind.stochastic_k as number,
      signal: (ind.stochastic_k as number) < 20 ? "bullish" : (ind.stochastic_k as number) > 80 ? "bearish" : "neutral",
      weight: WEIGHTS.stochastic,
      contribution: WEIGHTS.stochastic / TOTAL_WEIGHT * 100,
    },
    {
      name: "ATR Volatility",
      value: ind.atr as number,
      signal: "neutral",
      weight: WEIGHTS.atr_filter,
      contribution: WEIGHTS.atr_filter / TOTAL_WEIGHT * 100,
    },
    {
      name: "News Sentiment",
      value: ind.sentiment as number,
      signal: (ind.sentiment as number) > 0.4 ? "bullish" : (ind.sentiment as number) < -0.4 ? "bearish" : "neutral",
      weight: WEIGHTS.sentiment,
      contribution: WEIGHTS.sentiment / TOTAL_WEIGHT * 100,
    },
  ];
}
