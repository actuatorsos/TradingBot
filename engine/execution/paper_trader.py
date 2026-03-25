"""Paper trading simulator for backtesting and demo trading."""

import logging
import random
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import uuid4

UTC = timezone.utc

logger = logging.getLogger(__name__)


class PositionStatus(str, Enum):
    """Position status enumeration."""
    OPEN = "OPEN"
    CLOSED = "CLOSED"


@dataclass
class PaperPosition:
    """Virtual position in paper trading."""
    order_id: str
    pair: str
    direction: str
    lot_size: float
    entry_price: float
    entry_time: datetime
    stop_loss: float
    take_profit: float
    status: PositionStatus = PositionStatus.OPEN
    exit_price: Optional[float] = None
    exit_time: Optional[datetime] = None
    pnl: Optional[float] = None


class PaperTrader:
    """Paper trading simulator with realistic slippage and fills."""

    def __init__(self, initial_balance: float = 10000.0):
        """Initialize paper trader.

        Args:
            initial_balance: Starting account balance in currency units
        """
        self.initial_balance = initial_balance
        self.balance = initial_balance
        self.equity = initial_balance

        self._positions: dict[str, PaperPosition] = {}
        self._closed_trades: list[PaperPosition] = []

        # Performance tracking
        self._trade_count = 0
        self._winning_trades = 0
        self._losing_trades = 0
        self._total_pnl = 0.0
        self._max_drawdown = 0.0
        self._peak_equity = initial_balance

        logger.info(f"PaperTrader initialized with ${initial_balance:.2f}")

    async def get_account(self) -> dict:
        """Get account information.

        Returns:
            Dict with account details
        """
        return {
            "balance": self.balance,
            "equity": self.equity,
            "free_margin": self.balance,
            "used_margin": 0.0,
            "margin_level": 100.0,
            "positions_count": len(self._positions)
        }

    async def get_balance(self) -> float:
        """Get current account balance."""
        return self.balance

    async def get_open_trades(self) -> list[dict]:
        """Get list of open trades."""
        return [
            {
                "order_id": pos.order_id,
                "pair": pos.pair,
                "direction": pos.direction,
                "lot_size": pos.lot_size,
                "entry_price": pos.entry_price,
                "entry_time": pos.entry_time.isoformat(),
                "stop_loss": pos.stop_loss,
                "take_profit": pos.take_profit,
                "status": pos.status.value
            }
            for pos in self._positions.values()
        ]

    async def get_current_price(self, pair: str) -> Optional[float]:
        """Get current price for a pair (simulated).

        Args:
            pair: Currency pair (e.g., 'EURUSD')

        Returns:
            Simulated current price or None
        """
        # Simulate price based on pair type
        if pair == "EURUSD":
            return 1.0950 + (random.random() - 0.5) * 0.01
        elif pair == "GBPUSD":
            return 1.2650 + (random.random() - 0.5) * 0.01
        elif pair == "USDJPY":
            return 149.50 + (random.random() - 0.5) * 1.0
        else:
            # Generic price simulation
            return 1.0000 + (random.random() - 0.5) * 0.01

    async def get_spread(self, pair: str) -> float:
        """Get spread for a pair in pips.

        Args:
            pair: Currency pair

        Returns:
            Spread in pips
        """
        # Simulate typical spreads
        base_spread = 1.0  # 1 pip base
        # Add random variation (0.5-1.5 pips)
        return base_spread + (random.random() - 0.5) * 0.5

    async def place_market_order(
        self,
        pair: str,
        direction: str,
        lot_size: float,
        stop_loss: float,
        take_profit: float
    ) -> dict:
        """Place a market order with slippage simulation.

        Args:
            pair: Currency pair
            direction: BUY or SELL
            lot_size: Position size in lots
            stop_loss: Stop loss price
            take_profit: Take profit price

        Returns:
            Dict with order result {success: bool, error?: str, order_id?: str}
        """
        try:
            # Get simulated current price
            market_price = await self.get_current_price(pair)
            if market_price is None:
                return {"success": False, "error": "Cannot get current price"}

            # Simulate slippage (0-0.5 pips)
            slippage_pips = random.random() * 0.5
            slippage = slippage_pips / 10000

            if direction.upper() == "BUY":
                fill_price = market_price + slippage
            else:  # SELL
                fill_price = market_price - slippage

            # Create position
            order_id = str(uuid4())
            position = PaperPosition(
                order_id=order_id,
                pair=pair,
                direction=direction.upper(),
                lot_size=lot_size,
                entry_price=fill_price,
                entry_time=datetime.now(UTC),
                stop_loss=stop_loss,
                take_profit=take_profit
            )

            self._positions[order_id] = position
            self._trade_count += 1

            logger.info(
                f"Order placed: {order_id} {direction} {lot_size} {pair} "
                f"@ {fill_price:.5f} (slippage: {slippage_pips:.1f} pips)"
            )

            return {
                "success": True,
                "order_id": order_id,
                "fill_price": fill_price
            }

        except Exception as e:
            logger.exception(f"Error placing order: {e}")
            return {"success": False, "error": str(e)}

    async def close_position(
        self,
        pair: str,
        direction: str,
        lot_size: float
    ) -> dict:
        """Close a position at market price.

        Args:
            pair: Currency pair
            direction: BUY or SELL (direction of closing)
            lot_size: Position size to close

        Returns:
            Dict with close result {success: bool, error?: str}
        """
        try:
            # Find matching open position
            matching_position = None
            for pos in self._positions.values():
                if (pos.pair == pair and
                    pos.direction.upper() == direction.upper() and
                    pos.status == PositionStatus.OPEN):
                    matching_position = pos
                    break

            if matching_position is None:
                return {"success": False, "error": f"No open position found for {pair}"}

            # Get current price with slippage
            market_price = await self.get_current_price(pair)
            if market_price is None:
                return {"success": False, "error": "Cannot get current price"}

            slippage_pips = random.random() * 0.5
            slippage = slippage_pips / 10000

            if direction.upper() == "BUY":
                exit_price = market_price - slippage
            else:  # SELL
                exit_price = market_price + slippage

            # Calculate P&L
            if direction.upper() == "BUY":
                pnl = (exit_price - matching_position.entry_price) * lot_size * 10000
            else:
                pnl = (matching_position.entry_price - exit_price) * lot_size * 10000

            # Update position
            matching_position.exit_price = exit_price
            matching_position.exit_time = datetime.now(UTC)
            matching_position.pnl = pnl
            matching_position.status = PositionStatus.CLOSED

            # Update account
            self.balance += pnl
            self.equity += pnl
            self._total_pnl += pnl

            # Track win/loss
            if pnl > 0:
                self._winning_trades += 1
            elif pnl < 0:
                self._losing_trades += 1

            # Update drawdown
            if self.equity > self._peak_equity:
                self._peak_equity = self.equity
            drawdown = (self._peak_equity - self.equity) / self._peak_equity
            if drawdown > self._max_drawdown:
                self._max_drawdown = drawdown

            # Move to closed trades
            self._closed_trades.append(matching_position)
            del self._positions[matching_position.order_id]

            logger.info(
                f"Position closed: {matching_position.pair} "
                f"PnL: {pnl:+.2f} | Balance: {self.balance:+.2f}"
            )

            return {"success": True, "pnl": pnl, "exit_price": exit_price}

        except Exception as e:
            logger.exception(f"Error closing position: {e}")
            return {"success": False, "error": str(e)}

    def get_performance(self) -> dict:
        """Get trading performance statistics.

        Returns:
            Dict with performance metrics
        """
        total_trades = self._winning_trades + self._losing_trades

        # Win rate
        win_rate = (
            (self._winning_trades / total_trades * 100)
            if total_trades > 0 else 0.0
        )

        # Profit factor
        winning_pnl = sum(t.pnl for t in self._closed_trades if t.pnl > 0)
        losing_pnl = sum(t.pnl for t in self._closed_trades if t.pnl < 0)
        profit_factor = (
            (winning_pnl / abs(losing_pnl))
            if losing_pnl != 0 else 0.0
        )

        # Return on investment
        roi = ((self.equity - self.initial_balance) / self.initial_balance * 100)

        # Sharpe ratio (simplified - assuming average return per trade)
        if total_trades > 1:
            avg_pnl = self._total_pnl / total_trades
            pnl_std = (
                sum((t.pnl - avg_pnl) ** 2 for t in self._closed_trades) / total_trades
            ) ** 0.5
            sharpe = (avg_pnl / pnl_std * (252 ** 0.5)) if pnl_std > 0 else 0.0
        else:
            sharpe = 0.0

        return {
            "total_trades": total_trades,
            "winning_trades": self._winning_trades,
            "losing_trades": self._losing_trades,
            "win_rate": win_rate,
            "profit_factor": profit_factor,
            "total_pnl": self._total_pnl,
            "roi_pct": roi,
            "max_drawdown_pct": self._max_drawdown * 100,
            "sharpe_ratio": sharpe,
            "initial_balance": self.initial_balance,
            "final_balance": self.equity,
            "open_positions": len(self._positions)
        }

    def reset(self) -> None:
        """Reset paper trader to initial state."""
        self.balance = self.initial_balance
        self.equity = self.initial_balance
        self._positions.clear()
        self._closed_trades.clear()
        self._trade_count = 0
        self._winning_trades = 0
        self._losing_trades = 0
        self._total_pnl = 0.0
        self._max_drawdown = 0.0
        self._peak_equity = self.initial_balance
        logger.info("Paper trader reset to initial state")
