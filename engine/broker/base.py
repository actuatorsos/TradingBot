"""Abstract base class for broker implementations."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional


class OrderType(Enum):
    """Order type enumeration."""
    MARKET = "MARKET"
    LIMIT = "LIMIT"
    STOP = "STOP"


class OrderSide(Enum):
    """Order side enumeration."""
    BUY = "BUY"
    SELL = "SELL"


class TradeState(Enum):
    """Trade state enumeration."""
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    CLOSING = "CLOSING"


@dataclass
class AccountInfo:
    """Account information."""
    id: str
    currency: str
    balance: float
    used_margin: float
    available_margin: float
    margin_level: float
    open_trades: int
    open_orders: int
    unrealized_pl: float


@dataclass
class Trade:
    """Trade/Position information."""
    id: str
    pair: str
    side: OrderSide
    units: float
    entry_price: float
    current_price: float
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    unrealized_pl: float = 0.0
    state: TradeState = TradeState.OPEN
    open_time: Optional[str] = None
    commission: float = 0.0


@dataclass
class OrderRequest:
    """Order request parameters."""
    pair: str
    units: float
    price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    order_type: OrderType = OrderType.MARKET


@dataclass
class Candle:
    """OHLCV candle data."""
    time: str
    open: float
    high: float
    low: float
    close: float
    volume: int


class BaseBroker(ABC):
    """Abstract base class for broker implementations."""

    @abstractmethod
    async def connect(self) -> None:
        """Establish connection to broker.

        Raises:
            ConnectionError: If connection fails.
        """
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        """Close connection to broker."""
        pass

    @abstractmethod
    async def get_account(self) -> AccountInfo:
        """Get account information.

        Returns:
            AccountInfo: Current account details.

        Raises:
            ConnectionError: If broker is not connected.
            RuntimeError: If API call fails.
        """
        pass

    @abstractmethod
    async def get_balance(self) -> float:
        """Get current account balance.

        Returns:
            float: Account balance in base currency.

        Raises:
            ConnectionError: If broker is not connected.
            RuntimeError: If API call fails.
        """
        pass

    @abstractmethod
    async def get_open_trades(self) -> List[Trade]:
        """Get all open trades/positions.

        Returns:
            List[Trade]: List of open trades.

        Raises:
            ConnectionError: If broker is not connected.
            RuntimeError: If API call fails.
        """
        pass

    @abstractmethod
    async def place_market_order(
        self,
        pair: str,
        units: float,
        sl: Optional[float] = None,
        tp: Optional[float] = None,
    ) -> str:
        """Place a market order.

        Args:
            pair: Currency pair (e.g., "EUR_USD").
            units: Number of units to trade (positive for long, negative for short).
            sl: Stop loss price (optional).
            tp: Take profit price (optional).

        Returns:
            str: Trade/Order ID.

        Raises:
            ConnectionError: If broker is not connected.
            ValueError: If parameters are invalid.
            RuntimeError: If API call fails.
        """
        pass

    @abstractmethod
    async def place_limit_order(
        self,
        pair: str,
        units: float,
        price: float,
        sl: Optional[float] = None,
        tp: Optional[float] = None,
    ) -> str:
        """Place a limit order.

        Args:
            pair: Currency pair (e.g., "EUR_USD").
            units: Number of units to trade.
            price: Limit order price.
            sl: Stop loss price (optional).
            tp: Take profit price (optional).

        Returns:
            str: Order ID.

        Raises:
            ConnectionError: If broker is not connected.
            ValueError: If parameters are invalid.
            RuntimeError: If API call fails.
        """
        pass

    @abstractmethod
    async def close_position(self, trade_id: str) -> float:
        """Close a position/trade.

        Args:
            trade_id: ID of the trade to close.

        Returns:
            float: Realized P&L from closed position.

        Raises:
            ConnectionError: If broker is not connected.
            ValueError: If trade ID is invalid.
            RuntimeError: If API call fails.
        """
        pass

    @abstractmethod
    async def modify_trade(
        self,
        trade_id: str,
        sl: Optional[float] = None,
        tp: Optional[float] = None,
    ) -> None:
        """Modify stop loss and/or take profit for a trade.

        Args:
            trade_id: ID of the trade to modify.
            sl: New stop loss price (None to leave unchanged).
            tp: New take profit price (None to leave unchanged).

        Raises:
            ConnectionError: If broker is not connected.
            ValueError: If parameters are invalid.
            RuntimeError: If API call fails.
        """
        pass

    @abstractmethod
    async def get_candles(
        self,
        pair: str,
        granularity: str,
        count: int,
    ) -> List[Candle]:
        """Get historical candle data.

        Args:
            pair: Currency pair (e.g., "EUR_USD").
            granularity: Candle timeframe (e.g., "M1", "H1", "D").
            count: Number of candles to retrieve.

        Returns:
            List[Candle]: Historical candle data.

        Raises:
            ConnectionError: If broker is not connected.
            ValueError: If parameters are invalid.
            RuntimeError: If API call fails.
        """
        pass

    @property
    @abstractmethod
    def is_connected(self) -> bool:
        """Check if broker is currently connected.

        Returns:
            bool: True if connected, False otherwise.
        """
        pass
