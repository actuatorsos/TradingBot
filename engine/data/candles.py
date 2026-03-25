"""
Candle data management and rolling buffer storage.

Efficiently manages OHLCV candle data with rolling buffers per pair/timeframe.
"""

from collections import deque
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Tuple


@dataclass
class Candle:
    """OHLCV candle data point."""

    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float

    def __repr__(self) -> str:
        """String representation of candle."""
        return (
            f"Candle(ts={self.timestamp.isoformat()}, "
            f"O={self.open:.2f}, H={self.high:.2f}, "
            f"L={self.low:.2f}, C={self.close:.2f}, V={self.volume:.0f})"
        )


class CandleManager:
    """
    Manages rolling buffers of candles per pair/timeframe combination.

    Uses collections.deque for O(1) append and trim operations.
    Stores up to 200 candles per pair/timeframe for technical analysis.
    """

    # Maximum candles to keep in buffer
    MAX_BUFFER_SIZE = 200

    def __init__(self, buffer_size: int = MAX_BUFFER_SIZE):
        """
        Initialize candle manager.

        Args:
            buffer_size: Maximum candles to store per pair/timeframe (default 200)
        """
        self.buffer_size = buffer_size
        # Dictionary keyed by (pair, timeframe) tuple
        self._buffers: Dict[Tuple[str, str], deque] = {}

    def update(self, pair: str, timeframe: str, candle: Candle) -> None:
        """
        Add or update a candle in the rolling buffer.

        Automatically trims buffer to max size.

        Args:
            pair: Trading pair (e.g., "BTC/USD")
            timeframe: Timeframe (e.g., "1h", "15m", "1d")
            candle: Candle data to add

        Raises:
            ValueError: If candle data is invalid
        """
        self._validate_candle(candle)

        key = (pair, timeframe)

        # Create buffer if doesn't exist
        if key not in self._buffers:
            self._buffers[key] = deque(maxlen=self.buffer_size)

        # Add candle to buffer (deque auto-trims when full)
        self._buffers[key].append(candle)

    def get_candles(
        self, pair: str, timeframe: str, count: Optional[int] = None
    ) -> List[Candle]:
        """
        Retrieve candles for a pair/timeframe combination.

        Args:
            pair: Trading pair (e.g., "BTC/USD")
            timeframe: Timeframe (e.g., "1h", "15m", "1d")
            count: Number of most recent candles to return (None = all)

        Returns:
            List of Candle objects, most recent last

        Raises:
            KeyError: If pair/timeframe combination has no data
        """
        key = (pair, timeframe)

        if key not in self._buffers:
            raise KeyError(f"No candle data for {pair} {timeframe}")

        buffer = self._buffers[key]

        if not buffer:
            return []

        if count is None:
            return list(buffer)

        if count < 1:
            raise ValueError("Count must be >= 1")

        # Return last 'count' candles
        return list(buffer)[-count:]

    def get_latest(self, pair: str, timeframe: str) -> Optional[Candle]:
        """
        Get the most recent candle for a pair/timeframe.

        Args:
            pair: Trading pair (e.g., "BTC/USD")
            timeframe: Timeframe (e.g., "1h", "15m", "1d")

        Returns:
            Latest Candle or None if no data

        Raises:
            KeyError: If pair/timeframe combination has no data
        """
        key = (pair, timeframe)

        if key not in self._buffers:
            raise KeyError(f"No candle data for {pair} {timeframe}")

        buffer = self._buffers[key]
        return buffer[-1] if buffer else None

    def has_data(self, pair: str, timeframe: str) -> bool:
        """
        Check if candle data exists for a pair/timeframe.

        Args:
            pair: Trading pair
            timeframe: Timeframe

        Returns:
            True if data exists and is not empty
        """
        key = (pair, timeframe)
        return key in self._buffers and len(self._buffers[key]) > 0

    def buffer_size_for(self, pair: str, timeframe: str) -> int:
        """
        Get current buffer size for a pair/timeframe.

        Args:
            pair: Trading pair
            timeframe: Timeframe

        Returns:
            Number of candles currently stored
        """
        key = (pair, timeframe)
        return len(self._buffers.get(key, []))

    def clear(self, pair: Optional[str] = None, timeframe: Optional[str] = None) -> None:
        """
        Clear candle data.

        Args:
            pair: Clear specific pair (None = all pairs)
            timeframe: Clear specific timeframe (None = all timeframes)
        """
        if pair is None and timeframe is None:
            self._buffers.clear()
        else:
            keys_to_remove = []
            for key in self._buffers.keys():
                if (pair is None or key[0] == pair) and (timeframe is None or key[1] == timeframe):
                    keys_to_remove.append(key)

            for key in keys_to_remove:
                del self._buffers[key]

    def get_pairs(self) -> List[str]:
        """
        Get all pairs with stored candle data.

        Returns:
            List of unique pair names
        """
        return sorted(list(set(key[0] for key in self._buffers.keys())))

    def get_timeframes(self, pair: Optional[str] = None) -> List[str]:
        """
        Get all timeframes with data.

        Args:
            pair: Filter to specific pair (None = all pairs)

        Returns:
            List of unique timeframe names
        """
        timeframes = set()
        for key in self._buffers.keys():
            if pair is None or key[0] == pair:
                timeframes.add(key[1])

        return sorted(list(timeframes))

    def get_statistics(self) -> Dict[str, object]:
        """
        Get statistics about stored candle data.

        Returns:
            Dictionary with buffer statistics
        """
        stats = {
            "total_pairs": len(self.get_pairs()),
            "total_timeframes": len(self.get_timeframes()),
            "total_candles": sum(len(b) for b in self._buffers.values()),
            "buffers": {},
        }

        for key, buffer in self._buffers.items():
            stats["buffers"][f"{key[0]}:{key[1]}"] = len(buffer)

        return stats

    @staticmethod
    def _validate_candle(candle) -> None:
        """
        Validate candle data integrity.

        Args:
            candle: Candle to validate (must have OHLCV attributes)

        Raises:
            ValueError: If candle data is invalid
        """
        # Accept any object with OHLCV attributes
        required_attrs = {'timestamp', 'open', 'high', 'low', 'close', 'volume'}
        if not all(hasattr(candle, attr) for attr in required_attrs):
            raise ValueError("Candle must have timestamp, open, high, low, close, volume attributes")

        if candle.high < candle.low:
            raise ValueError(f"High ({candle.high}) cannot be less than low ({candle.low})")

        if candle.open < candle.low or candle.open > candle.high:
            raise ValueError(f"Open ({candle.open}) must be within high/low range")

        if candle.close < candle.low or candle.close > candle.high:
            raise ValueError(f"Close ({candle.close}) must be within high/low range")

        if candle.volume < 0:
            raise ValueError(f"Volume ({candle.volume}) cannot be negative")

        if any(p <= 0 for p in [candle.open, candle.high, candle.low, candle.close]):
            raise ValueError("OHLC prices must be positive")
