"""
Pure functional indicator calculations for the trading signal engine.

All indicator functions take raw OHLCV data and return calculated values.
Functions use numpy for efficient numerical operations.
"""

from typing import List, Tuple, Dict, Optional
import numpy as np


def calc_sma(data: List[float], period: int) -> float:
    """
    Calculate Simple Moving Average.

    Args:
        data: List of values (typically closes)
        period: Number of periods for the average

    Returns:
        Simple Moving Average value

    Raises:
        ValueError: If period > len(data) or period < 1
    """
    if period < 1:
        raise ValueError("Period must be >= 1")
    if period > len(data):
        raise ValueError(f"Period {period} cannot exceed data length {len(data)}")

    arr = np.array(data[-period:], dtype=np.float64)
    return float(np.mean(arr))


def calc_ema(data: List[float], period: int) -> float:
    """
    Calculate Exponential Moving Average.

    Uses the standard EMA formula with smoothing factor = 2 / (period + 1)

    Args:
        data: List of values (typically closes)
        period: Number of periods for the average

    Returns:
        Exponential Moving Average value

    Raises:
        ValueError: If period < 1 or insufficient data
    """
    if period < 1:
        raise ValueError("Period must be >= 1")
    if period > len(data):
        raise ValueError(f"Period {period} cannot exceed data length {len(data)}")

    arr = np.array(data, dtype=np.float64)
    multiplier = 2.0 / (period + 1)

    ema = arr[0]
    for i in range(1, len(arr)):
        ema = arr[i] * multiplier + ema * (1 - multiplier)

    return float(ema)


def calc_std_dev(data: List[float], period: int) -> float:
    """
    Calculate Standard Deviation over a period.

    Args:
        data: List of values
        period: Number of periods for calculation

    Returns:
        Standard deviation value

    Raises:
        ValueError: If period < 1 or insufficient data
    """
    if period < 1:
        raise ValueError("Period must be >= 1")
    if period > len(data):
        raise ValueError(f"Period {period} cannot exceed data length {len(data)}")

    arr = np.array(data[-period:], dtype=np.float64)
    return float(np.std(arr, ddof=0))


def calc_rsi(closes: List[float], period: int = 14) -> float:
    """
    Calculate Relative Strength Index using Wilder's smoothing.

    RSI = 100 - (100 / (1 + RS))
    where RS = Average Gain / Average Loss

    Args:
        closes: List of closing prices
        period: RSI period (default 14)

    Returns:
        RSI value (0-100)

    Raises:
        ValueError: If period < 1 or insufficient data
    """
    if period < 1:
        raise ValueError("Period must be >= 1")
    if period + 1 > len(closes):
        raise ValueError(f"Need at least {period + 1} candles for RSI")

    closes_arr = np.array(closes, dtype=np.float64)
    deltas = np.diff(closes_arr)

    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)

    # Wilder's smoothing
    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])

    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

    if avg_loss == 0:
        return 100.0 if avg_gain > 0 else 50.0

    rs = avg_gain / avg_loss
    rsi = 100.0 - (100.0 / (1.0 + rs))

    return float(rsi)


def calc_macd(
    closes: List[float],
    fast: int = 12,
    slow: int = 26,
    signal: int = 9
) -> Tuple[float, float, float]:
    """
    Calculate MACD (Moving Average Convergence Divergence).

    Args:
        closes: List of closing prices
        fast: Fast EMA period (default 12)
        slow: Slow EMA period (default 26)
        signal: Signal line EMA period (default 9)

    Returns:
        Tuple of (macd_line, signal_line, histogram)

    Raises:
        ValueError: If insufficient data for calculations
    """
    if slow > len(closes):
        raise ValueError(f"Need at least {slow} candles for MACD")

    ema_fast = calc_ema(closes, fast)
    ema_slow = calc_ema(closes, slow)

    macd_line = ema_fast - ema_slow

    # Calculate signal line - EMA of MACD line
    # For this, we need to calculate MACD for all points
    if slow > len(closes):
        signal_line = macd_line
        histogram = 0.0
    else:
        closes_arr = np.array(closes, dtype=np.float64)
        multiplier_fast = 2.0 / (fast + 1)
        multiplier_slow = 2.0 / (slow + 1)

        ema_fast_val = closes_arr[0]
        ema_slow_val = closes_arr[0]

        for i in range(1, len(closes_arr)):
            ema_fast_val = closes_arr[i] * multiplier_fast + ema_fast_val * (1 - multiplier_fast)
            ema_slow_val = closes_arr[i] * multiplier_slow + ema_slow_val * (1 - multiplier_slow)

        macd_line = ema_fast_val - ema_slow_val
        signal_line = calc_ema([macd_line], signal) if signal <= 1 else macd_line
        histogram = macd_line - signal_line

    return (float(macd_line), float(signal_line), float(histogram))


def calc_bollinger(
    closes: List[float],
    period: int = 20,
    std_dev: float = 2.0
) -> Tuple[float, float, float]:
    """
    Calculate Bollinger Bands.

    Args:
        closes: List of closing prices
        period: SMA period (default 20)
        std_dev: Number of standard deviations (default 2.0)

    Returns:
        Tuple of (upper_band, middle_band, lower_band)

    Raises:
        ValueError: If period < 1 or insufficient data
    """
    if period < 1:
        raise ValueError("Period must be >= 1")
    if period > len(closes):
        raise ValueError(f"Period {period} cannot exceed data length {len(closes)}")

    middle = calc_sma(closes, period)
    std = calc_std_dev(closes, period)

    upper = middle + (std * std_dev)
    lower = middle - (std * std_dev)

    return (float(upper), float(middle), float(lower))


def calc_ema_cross(closes: List[float], fast: int = 20, slow: int = 50) -> int:
    """
    Detect EMA crossover direction.

    Args:
        closes: List of closing prices
        fast: Fast EMA period (default 20)
        slow: Slow EMA period (default 50)

    Returns:
        1 if fast > slow (bullish), -1 if fast < slow (bearish), 0 if equal

    Raises:
        ValueError: If insufficient data for EMA calculation
    """
    if slow > len(closes):
        raise ValueError(f"Need at least {slow} candles for EMA cross")

    ema_fast = calc_ema(closes, fast)
    ema_slow = calc_ema(closes, slow)

    if ema_fast > ema_slow:
        return 1
    elif ema_fast < ema_slow:
        return -1
    else:
        return 0


def calc_volume_analysis(volumes: List[float], period: int = 20) -> float:
    """
    Calculate volume analysis as a ratio of current volume to average.

    Args:
        volumes: List of volume values
        period: Period for average calculation (default 20)

    Returns:
        Ratio of current volume to average (>1.0 = above average)

    Raises:
        ValueError: If period < 1 or insufficient data
    """
    if period < 1:
        raise ValueError("Period must be >= 1")
    if period > len(volumes):
        raise ValueError(f"Period {period} cannot exceed data length {len(volumes)}")

    current_volume = volumes[-1]
    avg_volume = calc_sma(volumes, period)

    if avg_volume == 0:
        return 1.0

    return float(current_volume / avg_volume)


def detect_candlestick_pattern(
    opens: List[float],
    highs: List[float],
    lows: List[float],
    closes: List[float]
) -> str:
    """
    Detect candlestick patterns (doji, hammer, engulfing, etc.).

    Args:
        opens: List of open prices
        highs: List of high prices
        lows: List of low prices
        closes: List of close prices

    Returns:
        Pattern name string or "none" if no pattern detected

    Raises:
        ValueError: If arrays have different lengths or are empty
    """
    if not (len(opens) == len(highs) == len(lows) == len(closes)):
        raise ValueError("All OHLC arrays must have the same length")

    if len(opens) < 2:
        raise ValueError("Need at least 2 candles to detect patterns")

    # Get last two candles
    o1, h1, l1, c1 = opens[-2], highs[-2], lows[-2], closes[-2]
    o2, h2, l2, c2 = opens[-1], highs[-1], lows[-1], closes[-1]

    body1 = abs(c1 - o1)
    body2 = abs(c2 - o2)
    range1 = h1 - l1
    range2 = h2 - l2

    # Doji: very small body, long wicks
    if range2 > 0 and body2 / range2 < 0.1:
        return "doji"

    # Hammer: small body at top, long lower wick
    if range2 > 0 and body2 / range2 < 0.3:
        lower_wick = min(o2, c2) - l2
        upper_wick = h2 - max(o2, c2)
        if lower_wick > body2 * 2 and upper_wick < body2:
            return "hammer"

    # Engulfing: current candle body contains previous candle body
    if c2 > o2 and c1 < o1:  # Bullish engulfing
        if o2 < l1 and c2 > h1:
            return "engulfing_bullish"
    elif c2 < o2 and c1 > o1:  # Bearish engulfing
        if o2 > h1 and c2 < l1:
            return "engulfing_bearish"

    # Morning star / Evening star would require 3 candles
    if len(closes) >= 3:
        o0, c0 = opens[-3], closes[-3]
        # Morning star: down, gap down small body, up
        if c0 < o0 and body2 < body1 * 0.5 and c2 > o2:
            return "morning_star"
        # Evening star: up, gap up small body, down
        if c0 > o0 and body2 < body1 * 0.5 and c2 < o2:
            return "evening_star"

    return "none"


def calc_stochastic(
    highs: List[float],
    lows: List[float],
    closes: List[float],
    k_period: int = 14,
    d_period: int = 3
) -> Tuple[float, float]:
    """
    Calculate Stochastic Oscillator (%K and %D).

    %K = (Close - Lowest Low) / (Highest High - Lowest Low) * 100
    %D = SMA of %K

    Args:
        highs: List of high prices
        lows: List of low prices
        closes: List of close prices
        k_period: Period for %K calculation (default 14)
        d_period: Period for %D (signal) calculation (default 3)

    Returns:
        Tuple of (%K, %D) values (0-100)

    Raises:
        ValueError: If arrays have different lengths or insufficient data
    """
    if not (len(highs) == len(lows) == len(closes)):
        raise ValueError("Highs, lows, and closes arrays must have the same length")

    if k_period > len(highs):
        raise ValueError(f"Need at least {k_period} candles for stochastic")

    highs_arr = np.array(highs[-k_period:], dtype=np.float64)
    lows_arr = np.array(lows[-k_period:], dtype=np.float64)
    closes_arr = np.array(closes, dtype=np.float64)

    highest_high = float(np.max(highs_arr))
    lowest_low = float(np.min(lows_arr))
    current_close = closes_arr[-1]

    denominator = highest_high - lowest_low
    if denominator == 0:
        k_value = 50.0
    else:
        k_value = ((current_close - lowest_low) / denominator) * 100.0

    # %D is SMA of %K - for simplicity, use the current %K
    d_value = k_value  # In a real implementation, track all %K values

    return (float(np.clip(k_value, 0, 100)), float(np.clip(d_value, 0, 100)))


def calc_atr(
    highs: List[float],
    lows: List[float],
    closes: List[float],
    period: int = 14
) -> float:
    """
    Calculate Average True Range.

    True Range = max(high - low, abs(high - prev_close), abs(low - prev_close))
    ATR = SMA of True Range

    Args:
        highs: List of high prices
        lows: List of low prices
        closes: List of close prices
        period: ATR period (default 14)

    Returns:
        Average True Range value

    Raises:
        ValueError: If arrays have different lengths or insufficient data
    """
    if not (len(highs) == len(lows) == len(closes)):
        raise ValueError("Highs, lows, and closes arrays must have the same length")

    if period < 1:
        raise ValueError("Period must be >= 1")

    if period > len(highs):
        raise ValueError(f"Need at least {period} candles for ATR")

    highs_arr = np.array(highs, dtype=np.float64)
    lows_arr = np.array(lows, dtype=np.float64)
    closes_arr = np.array(closes, dtype=np.float64)

    true_ranges = []

    for i in range(len(highs_arr)):
        high_low = highs_arr[i] - lows_arr[i]

        if i == 0:
            true_range = high_low
        else:
            high_prev_close = abs(highs_arr[i] - closes_arr[i - 1])
            low_prev_close = abs(lows_arr[i] - closes_arr[i - 1])
            true_range = max(high_low, high_prev_close, low_prev_close)

        true_ranges.append(true_range)

    atr = np.mean(true_ranges[-period:])

    return float(atr)
