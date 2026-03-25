"""
APEX TRADER AI - Multi-Timeframe Analysis
==========================================
Analyzes signals across M1, M5, M15, H1, H4 timeframes
and calculates alignment score for higher-confidence entries.
"""

import logging
from typing import Optional
from dataclasses import dataclass

log = logging.getLogger("apex.mtf")


@dataclass
class TimeframeSignal:
    timeframe: str
    direction: str  # "BUY", "SELL", "NEUTRAL"
    strength: float  # 0-100
    trend: str  # "up", "down", "range"
    key_level: Optional[float] = None


@dataclass
class MTFAnalysis:
    pair: str
    alignment_score: float  # 0-100, how aligned are the timeframes
    primary_direction: str  # "BUY", "SELL", "NEUTRAL"
    timeframes: list  # list of TimeframeSignal dicts
    recommendation: str  # "strong_buy", "buy", "neutral", "sell", "strong_sell"
    conflicts: list  # list of conflicting timeframe pairs


TIMEFRAME_WEIGHTS = {
    "M1": 0.5,
    "M5": 1.0,
    "M15": 1.5,
    "H1": 2.0,
    "H4": 2.5,
    "D1": 3.0,
}


def aggregate_candles(m5_candles: list, target_tf: str) -> list:
    """
    Aggregate M5 candles into higher timeframes.

    Args:
        m5_candles: List of M5 candle dicts
        target_tf: Target timeframe ("M15", "H1", "H4")

    Returns:
        Aggregated candles
    """
    multipliers = {"M1": 1, "M5": 1, "M15": 3, "H1": 12, "H4": 48, "D1": 288}
    n = multipliers.get(target_tf, 1)

    if n <= 1:
        return m5_candles

    aggregated = []
    for i in range(0, len(m5_candles) - n + 1, n):
        chunk = m5_candles[i:i + n]
        if not chunk:
            continue
        agg = {
            "time": chunk[0]["time"],
            "open": chunk[0]["open"],
            "high": max(c["high"] for c in chunk),
            "low": min(c["low"] for c in chunk),
            "close": chunk[-1]["close"],
            "volume": sum(c.get("volume", 0) for c in chunk),
        }
        aggregated.append(agg)

    return aggregated


def analyze_timeframe(candles: list, timeframe: str) -> TimeframeSignal:
    """Analyze a single timeframe for trend and signal."""
    if len(candles) < 20:
        return TimeframeSignal(
            timeframe=timeframe,
            direction="NEUTRAL",
            strength=0,
            trend="range",
        )

    closes = [c["close"] for c in candles]

    # Simple EMA-based trend detection
    ema_fast = _ema(closes, min(8, len(closes) - 1))
    ema_slow = _ema(closes, min(21, len(closes) - 1))

    if not ema_fast or not ema_slow:
        return TimeframeSignal(timeframe=timeframe, direction="NEUTRAL", strength=0, trend="range")

    fast_val = ema_fast[-1]
    slow_val = ema_slow[-1]
    price = closes[-1]

    # Trend determination
    if fast_val > slow_val and price > fast_val:
        trend = "up"
        direction = "BUY"
        strength = min(100, abs(fast_val - slow_val) / slow_val * 10000)
    elif fast_val < slow_val and price < fast_val:
        trend = "down"
        direction = "SELL"
        strength = min(100, abs(slow_val - fast_val) / slow_val * 10000)
    else:
        trend = "range"
        direction = "NEUTRAL"
        strength = 20

    # Find key levels (recent swing high/low)
    recent = closes[-20:]
    key_level = max(recent) if direction == "SELL" else min(recent) if direction == "BUY" else None

    return TimeframeSignal(
        timeframe=timeframe,
        direction=direction,
        strength=round(strength, 1),
        trend=trend,
        key_level=round(key_level, 5) if key_level else None,
    )


def _ema(data: list, period: int) -> list:
    """Calculate EMA."""
    if len(data) < period:
        return data
    k = 2 / (period + 1)
    result = [data[0]]
    for i in range(1, len(data)):
        result.append(data[i] * k + result[-1] * (1 - k))
    return result


def multi_timeframe_analysis(
    m5_candles: list,
    pair: str = "EUR_USD",
    timeframes: list = None,
) -> MTFAnalysis:
    """
    Run multi-timeframe analysis.

    Args:
        m5_candles: Base M5 candle data (need at least 500 for H4)
        pair: Currency pair
        timeframes: Timeframes to analyze (default: M5, M15, H1, H4)

    Returns:
        MTFAnalysis with alignment score and recommendations
    """
    if timeframes is None:
        timeframes = ["M5", "M15", "H1", "H4"]

    signals = []
    for tf in timeframes:
        tf_candles = aggregate_candles(m5_candles, tf)
        signal = analyze_timeframe(tf_candles, tf)
        signals.append(signal)

    # Calculate alignment
    buy_weight = 0
    sell_weight = 0
    total_weight = 0

    for sig in signals:
        w = TIMEFRAME_WEIGHTS.get(sig.timeframe, 1.0)
        total_weight += w
        if sig.direction == "BUY":
            buy_weight += w * (sig.strength / 100)
        elif sig.direction == "SELL":
            sell_weight += w * (sig.strength / 100)

    if total_weight == 0:
        alignment = 0
        primary = "NEUTRAL"
    else:
        buy_pct = buy_weight / total_weight * 100
        sell_pct = sell_weight / total_weight * 100
        alignment = max(buy_pct, sell_pct)
        primary = "BUY" if buy_weight > sell_weight else "SELL" if sell_weight > buy_weight else "NEUTRAL"

    # Find conflicts
    conflicts = []
    for i, s1 in enumerate(signals):
        for s2 in signals[i+1:]:
            if s1.direction != "NEUTRAL" and s2.direction != "NEUTRAL" and s1.direction != s2.direction:
                conflicts.append(f"{s1.timeframe} ({s1.direction}) vs {s2.timeframe} ({s2.direction})")

    # Recommendation
    if alignment >= 80 and not conflicts:
        rec = f"strong_{primary.lower()}" if primary != "NEUTRAL" else "neutral"
    elif alignment >= 60:
        rec = primary.lower() if primary != "NEUTRAL" else "neutral"
    else:
        rec = "neutral"

    return MTFAnalysis(
        pair=pair,
        alignment_score=round(alignment, 1),
        primary_direction=primary,
        timeframes=[{
            "timeframe": s.timeframe,
            "direction": s.direction,
            "strength": s.strength,
            "trend": s.trend,
            "key_level": s.key_level,
        } for s in signals],
        recommendation=rec,
        conflicts=conflicts,
    )
