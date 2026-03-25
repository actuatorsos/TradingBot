"""
Main signal engine for confluence-based trading signal generation.

Combines multiple technical indicators with weighted scoring to produce
trading signals with confidence levels and risk management parameters.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Dict, Optional, Tuple

from .indicators import (
    calc_sma,
    calc_ema,
    calc_std_dev,
    calc_rsi,
    calc_macd,
    calc_bollinger,
    calc_ema_cross,
    calc_volume_analysis,
    detect_candlestick_pattern,
    calc_stochastic,
    calc_atr,
)
from ..data.candles import Candle


class TradeDirection(Enum):
    """Trading signal direction."""

    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"


@dataclass
class IndicatorValue:
    """Single indicator analysis result."""

    name: str
    direction: int  # -1 (bearish), 0 (neutral), 1 (bullish)
    value: float
    details: Dict[str, float] = field(default_factory=dict)


@dataclass
class Signal:
    """Trading signal with confidence and risk parameters."""

    direction: TradeDirection
    confidence: float  # 0-100%
    reasons: List[str] = field(default_factory=list)
    indicator_details: List[IndicatorValue] = field(default_factory=list)
    entry_price: float = 0.0
    stop_loss: float = 0.0
    take_profit: float = 0.0
    timestamp: Optional[datetime] = None


class SignalEngine:
    """
    Main signal engine combining 11 technical indicators.

    Uses weighted confluence scoring to determine trade signals.
    Weights based on indicator reliability and market conditions.
    """

    # Indicator weights (sum ≈ 8.6)
    WEIGHTS = {
        "rsi": 1.5,
        "macd": 1.2,
        "bollinger": 1.3,
        "ema_cross": 1.0,
        "volume": 0.8,
        "candlestick": 1.0,
        "stochastic": 0.9,
        "atr": 0.7,
        "pattern": 0.5,
    }

    TOTAL_WEIGHT = sum(WEIGHTS.values())

    def __init__(
        self,
        min_confidence: float = 60.0,
        risk_reward_ratio: float = 2.0,
        atr_multiplier_stop: float = 1.5,
        atr_multiplier_tp: float = 3.0,
    ):
        """
        Initialize signal engine.

        Args:
            min_confidence: Minimum confidence threshold for signals (0-100)
            risk_reward_ratio: Risk/reward ratio for take profit calculation
            atr_multiplier_stop: ATR multiplier for stop loss
            atr_multiplier_tp: ATR multiplier for take profit
        """
        self.min_confidence = min_confidence
        self.risk_reward_ratio = risk_reward_ratio
        self.atr_multiplier_stop = atr_multiplier_stop
        self.atr_multiplier_tp = atr_multiplier_tp

    def analyze(self, candles: List[Candle]) -> Signal:
        """
        Analyze candles and generate trading signal.

        Runs all indicators, calculates weighted confluence score,
        and determines entry/exit levels.

        Args:
            candles: List of OHLCV candles (minimum 50 for full analysis)

        Returns:
            Signal object with direction, confidence, and risk parameters

        Raises:
            ValueError: If candles list is empty or too small
        """
        if not candles:
            raise ValueError("Candles list cannot be empty")

        if len(candles) < 30:
            raise ValueError("Need at least 30 candles for signal analysis")

        # Extract OHLCV arrays
        opens = [c.open for c in candles]
        highs = [c.high for c in candles]
        lows = [c.low for c in candles]
        closes = [c.close for c in candles]
        volumes = [c.volume for c in candles]

        current_close = closes[-1]
        indicator_details = []
        bullish_score = 0.0
        bearish_score = 0.0

        # 1. RSI Analysis (1.5x weight)
        rsi = calc_rsi(closes, period=14)
        rsi_direction = self._evaluate_rsi(rsi)
        indicator_details.append(
            IndicatorValue(
                "RSI", rsi_direction, rsi, {"value": rsi, "oversold": rsi < 30, "overbought": rsi > 70}
            )
        )
        if rsi_direction == 1:
            bullish_score += self.WEIGHTS["rsi"]
        elif rsi_direction == -1:
            bearish_score += self.WEIGHTS["rsi"]

        # 2. MACD Analysis (1.2x weight)
        macd_line, signal_line, histogram = calc_macd(closes, fast=12, slow=26, signal=9)
        macd_direction = self._evaluate_macd(macd_line, signal_line, histogram)
        indicator_details.append(
            IndicatorValue(
                "MACD",
                macd_direction,
                macd_line,
                {"macd_line": macd_line, "signal_line": signal_line, "histogram": histogram},
            )
        )
        if macd_direction == 1:
            bullish_score += self.WEIGHTS["macd"]
        elif macd_direction == -1:
            bearish_score += self.WEIGHTS["macd"]

        # 3. Bollinger Bands Analysis (1.3x weight)
        upper, middle, lower = calc_bollinger(closes, period=20, std_dev=2.0)
        bb_direction = self._evaluate_bollinger(current_close, upper, middle, lower)
        indicator_details.append(
            IndicatorValue(
                "Bollinger",
                bb_direction,
                middle,
                {"upper": upper, "middle": middle, "lower": lower, "close": current_close},
            )
        )
        if bb_direction == 1:
            bullish_score += self.WEIGHTS["bollinger"]
        elif bb_direction == -1:
            bearish_score += self.WEIGHTS["bollinger"]

        # 4. EMA Cross Analysis (1.0x weight)
        ema_direction = calc_ema_cross(closes, fast=20, slow=50)
        indicator_details.append(
            IndicatorValue("EMA_Cross", ema_direction, current_close, {"fast_period": 20, "slow_period": 50})
        )
        if ema_direction == 1:
            bullish_score += self.WEIGHTS["ema_cross"]
        elif ema_direction == -1:
            bearish_score += self.WEIGHTS["ema_cross"]

        # 5. Volume Analysis (0.8x weight)
        volume_ratio = calc_volume_analysis(volumes, period=20)
        vol_direction = self._evaluate_volume(volume_ratio)
        indicator_details.append(
            IndicatorValue("Volume", vol_direction, volume_ratio, {"ratio": volume_ratio, "threshold": 1.2})
        )
        if vol_direction == 1:
            bullish_score += self.WEIGHTS["volume"]
        elif vol_direction == -1:
            bearish_score += self.WEIGHTS["volume"]

        # 6. Candlestick Pattern (1.0x weight)
        pattern = detect_candlestick_pattern(opens, highs, lows, closes)
        pattern_direction = self._evaluate_pattern(pattern)
        indicator_details.append(
            IndicatorValue("Pattern", pattern_direction, 0.0, {"pattern": pattern})
        )
        if pattern_direction == 1:
            bullish_score += self.WEIGHTS["candlestick"]
        elif pattern_direction == -1:
            bearish_score += self.WEIGHTS["candlestick"]

        # 7. Stochastic Oscillator (0.9x weight)
        k_value, d_value = calc_stochastic(highs, lows, closes, k_period=14, d_period=3)
        stoch_direction = self._evaluate_stochastic(k_value, d_value)
        indicator_details.append(
            IndicatorValue("Stochastic", stoch_direction, k_value, {"k": k_value, "d": d_value})
        )
        if stoch_direction == 1:
            bullish_score += self.WEIGHTS["stochastic"]
        elif stoch_direction == -1:
            bearish_score += self.WEIGHTS["stochastic"]

        # 8. ATR (0.7x weight) - more for volatility context
        atr = calc_atr(highs, lows, closes, period=14)
        atr_direction = self._evaluate_atr(atr, closes)
        indicator_details.append(
            IndicatorValue("ATR", atr_direction, atr, {"atr": atr, "atr_percent": (atr / current_close) * 100})
        )
        if atr_direction == 1:
            bullish_score += self.WEIGHTS["atr"]
        elif atr_direction == -1:
            bearish_score += self.WEIGHTS["atr"]

        # 9. Standard Deviation (included via Bollinger, but separate eval)
        std = calc_std_dev(closes, 20)
        std_direction = self._evaluate_volatility(std, closes)
        indicator_details.append(
            IndicatorValue("Volatility", std_direction, std, {"std_dev": std})
        )

        # Calculate confidence scores
        bull_confidence = (bullish_score / self.TOTAL_WEIGHT) * 100
        bear_confidence = (bearish_score / self.TOTAL_WEIGHT) * 100

        # Determine direction and final confidence
        direction = TradeDirection.HOLD
        confidence = 0.0
        reasons = []

        if bull_confidence > bear_confidence and bull_confidence > self.min_confidence:
            direction = TradeDirection.BUY
            confidence = bull_confidence
            reasons = self._generate_buy_reasons(indicator_details)
        elif bear_confidence > bull_confidence and bear_confidence > self.min_confidence:
            direction = TradeDirection.SELL
            confidence = bear_confidence
            reasons = self._generate_sell_reasons(indicator_details)
        else:
            reasons = ["Insufficient confluence for trade signal"]

        # Calculate risk management levels
        entry_price = current_close
        stop_loss = 0.0
        take_profit = 0.0

        if direction == TradeDirection.BUY:
            stop_loss = entry_price - (atr * self.atr_multiplier_stop)
            take_profit = entry_price + (atr * self.atr_multiplier_tp)
        elif direction == TradeDirection.SELL:
            stop_loss = entry_price + (atr * self.atr_multiplier_stop)
            take_profit = entry_price - (atr * self.atr_multiplier_tp)

        signal = Signal(
            direction=direction,
            confidence=min(confidence, 100.0),
            reasons=reasons,
            indicator_details=indicator_details,
            entry_price=entry_price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            timestamp=candles[-1].timestamp,
        )

        return signal

    @staticmethod
    def _evaluate_rsi(rsi: float) -> int:
        """Evaluate RSI direction: oversold bullish, overbought bearish."""
        if rsi < 30:
            return 1  # Oversold - bullish
        elif rsi > 70:
            return -1  # Overbought - bearish
        elif rsi < 50:
            return 1  # Below midpoint - bullish bias
        elif rsi > 50:
            return -1  # Above midpoint - bearish bias
        return 0

    @staticmethod
    def _evaluate_macd(macd_line: float, signal_line: float, histogram: float) -> int:
        """Evaluate MACD: positive histogram bullish, negative bearish."""
        if histogram > 0 and macd_line > signal_line:
            return 1  # Bullish
        elif histogram < 0 and macd_line < signal_line:
            return -1  # Bearish
        return 0

    @staticmethod
    def _evaluate_bollinger(close: float, upper: float, middle: float, lower: float) -> int:
        """Evaluate position relative to Bollinger Bands."""
        if close < lower:
            return 1  # Oversold - bullish
        elif close > upper:
            return -1  # Overbought - bearish
        elif close > middle:
            return 1  # Above middle - bullish bias
        elif close < middle:
            return -1  # Below middle - bearish bias
        return 0

    @staticmethod
    def _evaluate_volume(volume_ratio: float) -> int:
        """Evaluate volume ratio vs average."""
        if volume_ratio > 1.5:
            return 1  # High volume - bullish
        elif volume_ratio < 0.5:
            return -1  # Low volume - bearish
        elif volume_ratio > 1.2:
            return 1  # Above average - bullish
        elif volume_ratio < 0.8:
            return -1  # Below average - bearish
        return 0

    @staticmethod
    def _evaluate_pattern(pattern: str) -> int:
        """Evaluate candlestick pattern direction."""
        bullish_patterns = {"hammer", "morning_star", "engulfing_bullish"}
        bearish_patterns = {"engulfing_bearish", "evening_star"}

        if pattern in bullish_patterns:
            return 1
        elif pattern in bearish_patterns:
            return -1
        return 0

    @staticmethod
    def _evaluate_stochastic(k: float, d: float) -> int:
        """Evaluate stochastic levels."""
        if k < 20:
            return 1  # Oversold - bullish
        elif k > 80:
            return -1  # Overbought - bearish
        elif k < 50 and k > d:
            return 1  # Rising from bottom - bullish
        elif k > 50 and k < d:
            return -1  # Falling from top - bearish
        return 0

    @staticmethod
    def _evaluate_atr(atr: float, closes: List[float]) -> int:
        """Evaluate ATR for volatility context."""
        if len(closes) < 20:
            return 0

        atr_percent = (atr / closes[-1]) * 100
        # Higher ATR = higher volatility (neutral on direction)
        if atr_percent > 5:
            return 0  # High volatility - neutral
        elif atr_percent < 1:
            return 0  # Low volatility - neutral
        return 0

    @staticmethod
    def _evaluate_volatility(std_dev: float, closes: List[float]) -> int:
        """Evaluate volatility context."""
        if not closes:
            return 0
        # Standard deviation doesn't directly signal direction
        return 0

    @staticmethod
    def _generate_buy_reasons(indicators: List[IndicatorValue]) -> List[str]:
        """Generate bullish reasons from indicators."""
        reasons = []

        for ind in indicators:
            if ind.direction == 1:
                if ind.name == "RSI":
                    reasons.append(f"RSI oversold at {ind.value:.1f}")
                elif ind.name == "MACD":
                    reasons.append("MACD bullish crossover")
                elif ind.name == "Bollinger":
                    reasons.append("Price approaching lower band")
                elif ind.name == "EMA_Cross":
                    reasons.append("Fast EMA above slow EMA")
                elif ind.name == "Volume":
                    reasons.append(f"Volume {ind.details.get('ratio', 1):.1f}x average")
                elif ind.name == "Pattern":
                    pattern = ind.details.get("pattern", "")
                    if pattern != "none":
                        reasons.append(f"Bullish {pattern} pattern")
                elif ind.name == "Stochastic":
                    reasons.append(f"Stochastic oversold at {ind.value:.1f}")

        return reasons if reasons else ["Confluence of bullish indicators"]

    @staticmethod
    def _generate_sell_reasons(indicators: List[IndicatorValue]) -> List[str]:
        """Generate bearish reasons from indicators."""
        reasons = []

        for ind in indicators:
            if ind.direction == -1:
                if ind.name == "RSI":
                    reasons.append(f"RSI overbought at {ind.value:.1f}")
                elif ind.name == "MACD":
                    reasons.append("MACD bearish crossover")
                elif ind.name == "Bollinger":
                    reasons.append("Price approaching upper band")
                elif ind.name == "EMA_Cross":
                    reasons.append("Fast EMA below slow EMA")
                elif ind.name == "Volume":
                    reasons.append(f"Volume {ind.details.get('ratio', 1):.1f}x average")
                elif ind.name == "Pattern":
                    pattern = ind.details.get("pattern", "")
                    if pattern != "none":
                        reasons.append(f"Bearish {pattern} pattern")
                elif ind.name == "Stochastic":
                    reasons.append(f"Stochastic overbought at {ind.value:.1f}")

        return reasons if reasons else ["Confluence of bearish indicators"]
