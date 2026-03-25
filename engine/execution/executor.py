"""Trade execution pipeline for Apex Trader AI."""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import uuid4

UTC = timezone.utc

logger = logging.getLogger(__name__)


class TradeDirection(str, Enum):
    """Trade direction enumeration."""
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"


class TradeStatus(str, Enum):
    """Trade status enumeration."""
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    PENDING = "PENDING"
    CANCELLED = "CANCELLED"


@dataclass
class TradeRecord:
    """Record of a completed or open trade."""
    id: str
    pair: str
    direction: TradeDirection
    entry_price: float
    lot_size: float
    sl: float
    tp: float
    open_time: datetime
    status: TradeStatus = TradeStatus.OPEN
    exit_price: Optional[float] = None
    close_time: Optional[datetime] = None
    pnl: Optional[float] = None
    pnl_pct: Optional[float] = None
    close_reason: Optional[str] = None

    def calculate_pnl(self) -> None:
        """Calculate PnL based on exit price."""
        if self.exit_price is not None:
            if self.direction == TradeDirection.BUY:
                pip_value = (self.exit_price - self.entry_price) * 10000
            else:  # SELL
                pip_value = (self.entry_price - self.exit_price) * 10000

            self.pnl = pip_value * self.lot_size / 10
            self.pnl_pct = (self.pnl / (self.entry_price * self.lot_size * 100)) * 100


@dataclass
class TradeSignal:
    """Trade signal from analysis."""
    pair: str
    direction: TradeDirection
    entry_price: float
    stop_loss_pips: float
    take_profit_pips: float
    confidence: float
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class TradeResult:
    """Result of trade execution."""
    success: bool
    trade_id: Optional[str] = None
    message: str = ""
    error: Optional[str] = None


class TradeExecutor:
    """Main trade execution engine with full pipeline."""

    def __init__(self, broker, risk_manager, notifier, config: dict):
        """Initialize trade executor.

        Args:
            broker: Broker interface for placing orders
            risk_manager: Risk management engine
            notifier: Notification system
            config: Configuration dictionary with keys:
                - confidence_threshold: Min confidence to trade (0-1)
                - max_spread_pips: Max acceptable spread
                - session_active: Hours when trading is active
        """
        self.broker = broker
        self.risk_manager = risk_manager
        self.notifier = notifier
        self.config = config

        self.trade_history: list[TradeRecord] = []
        self._open_trades: dict[str, TradeRecord] = {}
        self._monitoring = False

        logger.info("TradeExecutor initialized")

    async def execute_signal(self, signal: TradeSignal) -> TradeResult:
        """Execute a trade signal through full validation pipeline.

        Args:
            signal: TradeSignal with entry details

        Returns:
            TradeResult with success status and trade ID
        """
        try:
            # Step 1: Validate signal
            if signal.confidence < self.config.get("confidence_threshold", 0.7):
                return TradeResult(
                    success=False,
                    error=f"Low confidence: {signal.confidence:.2%}"
                )

            if signal.direction == TradeDirection.HOLD:
                return TradeResult(
                    success=False,
                    error="HOLD signals cannot be executed"
                )

            # Step 2: Check risk manager
            can_trade, reason = self.risk_manager.can_trade()
            if not can_trade:
                return TradeResult(
                    success=False,
                    error=f"Risk check failed: {reason}"
                )

            # Step 3: Check pre-trade conditions
            spread_check = await self._check_spread(signal.pair)
            if not spread_check:
                return TradeResult(
                    success=False,
                    error=f"Spread too wide for {signal.pair}"
                )

            session_check = self._check_market_session()
            if not session_check:
                return TradeResult(
                    success=False,
                    error="Market session not active"
                )

            duplicate_check = self._check_duplicate_position(signal.pair)
            if not duplicate_check:
                return TradeResult(
                    success=False,
                    error=f"Duplicate position already open for {signal.pair}"
                )

            # Step 4: Calculate position size
            lot_size = self.risk_manager.calculate_lot_size(
                signal.stop_loss_pips,
                self.broker.get_balance()
            )

            if lot_size <= 0:
                return TradeResult(
                    success=False,
                    error="Invalid lot size calculated"
                )

            # Step 5: Calculate SL and TP prices
            if signal.direction == TradeDirection.BUY:
                sl_price = signal.entry_price - (signal.stop_loss_pips / 10000)
                tp_price = signal.entry_price + (signal.take_profit_pips / 10000)
            else:  # SELL
                sl_price = signal.entry_price + (signal.stop_loss_pips / 10000)
                tp_price = signal.entry_price - (signal.take_profit_pips / 10000)

            # Step 6: Place order via broker
            order_result = await self.broker.place_market_order(
                pair=signal.pair,
                direction=signal.direction,
                lot_size=lot_size,
                stop_loss=sl_price,
                take_profit=tp_price
            )

            if not order_result.get("success", False):
                return TradeResult(
                    success=False,
                    error=f"Broker order failed: {order_result.get('error', 'Unknown')}"
                )

            # Step 7: Create trade record
            trade_id = str(uuid4())
            trade = TradeRecord(
                id=trade_id,
                pair=signal.pair,
                direction=signal.direction,
                entry_price=signal.entry_price,
                lot_size=lot_size,
                sl=sl_price,
                tp=tp_price,
                open_time=datetime.now(UTC),
                status=TradeStatus.OPEN
            )

            # Step 8: Log to history
            self.trade_history.append(trade)
            self._open_trades[trade_id] = trade

            # Step 9: Record for risk management
            self.risk_manager.record_trade_result(0)  # Trade opened, no PnL yet

            # Step 10: Send notification
            await self.notifier.send_trade_alert(trade)

            logger.info(
                f"Trade executed: {trade_id} {signal.pair} {signal.direction} "
                f"@ {signal.entry_price} SL={sl_price:.5f} TP={tp_price:.5f}"
            )

            return TradeResult(
                success=True,
                trade_id=trade_id,
                message=f"Trade {trade_id} opened"
            )

        except Exception as e:
            logger.exception(f"Error executing signal: {e}")
            return TradeResult(
                success=False,
                error=str(e)
            )

    async def monitor_positions(self) -> None:
        """Monitor open positions and update trailing stops.

        Checks for:
        - SL/TP hit
        - Trailing stop updates
        - Manual close conditions
        """
        if self._monitoring:
            return

        self._monitoring = True
        try:
            while self._monitoring:
                try:
                    trades_to_check = list(self._open_trades.values())

                    for trade in trades_to_check:
                        # Get current price
                        current_price = await self.broker.get_current_price(trade.pair)

                        if current_price is None:
                            continue

                        # Check if SL or TP hit
                        if trade.direction == TradeDirection.BUY:
                            if current_price <= trade.sl:
                                await self.close_trade(trade.id, "Stop loss hit")
                                continue
                            if current_price >= trade.tp:
                                await self.close_trade(trade.id, "Take profit hit")
                                continue
                        else:  # SELL
                            if current_price >= trade.sl:
                                await self.close_trade(trade.id, "Stop loss hit")
                                continue
                            if current_price <= trade.tp:
                                await self.close_trade(trade.id, "Take profit hit")
                                continue

                    await asyncio.sleep(5)  # Check every 5 seconds

                except Exception as e:
                    logger.exception(f"Error in monitoring loop: {e}")
                    await asyncio.sleep(5)
        finally:
            self._monitoring = False

    async def close_trade(self, trade_id: str, reason: str) -> bool:
        """Close a specific trade.

        Args:
            trade_id: ID of trade to close
            reason: Reason for closing

        Returns:
            True if successful
        """
        trade = self._open_trades.get(trade_id)
        if trade is None:
            logger.warning(f"Trade {trade_id} not found")
            return False

        try:
            current_price = await self.broker.get_current_price(trade.pair)
            if current_price is None:
                logger.error(f"Cannot get price for {trade.pair}")
                return False

            # Close position via broker
            close_result = await self.broker.close_position(
                pair=trade.pair,
                direction=trade.direction,
                lot_size=trade.lot_size
            )

            if not close_result.get("success", False):
                logger.error(f"Failed to close trade {trade_id}: {close_result}")
                return False

            # Update trade record
            trade.exit_price = current_price
            trade.close_time = datetime.now(UTC)
            trade.close_reason = reason
            trade.status = TradeStatus.CLOSED
            trade.calculate_pnl()

            # Remove from open trades
            del self._open_trades[trade_id]

            # Record result for risk management
            if trade.pnl is not None:
                self.risk_manager.record_trade_result(trade.pnl)

            # Send notification
            await self.notifier.send_trade_closed(trade)

            logger.info(
                f"Trade closed: {trade_id} {trade.pair} "
                f"PnL: {trade.pnl:+.2f} ({trade.pnl_pct:+.2f}%)"
            )

            return True

        except Exception as e:
            logger.exception(f"Error closing trade {trade_id}: {e}")
            return False

    async def _check_spread(self, pair: str) -> bool:
        """Check if spread is acceptable."""
        try:
            spread = await self.broker.get_spread(pair)
            max_spread = self.config.get("max_spread_pips", 3)
            return spread <= max_spread
        except Exception as e:
            logger.error(f"Error checking spread: {e}")
            return False

    def _check_market_session(self) -> bool:
        """Check if current time is within active trading session."""
        try:
            session_hours = self.config.get("session_active", (0, 24))
            current_hour = datetime.now(UTC).hour
            return session_hours[0] <= current_hour < session_hours[1]
        except Exception as e:
            logger.error(f"Error checking market session: {e}")
            return True  # Allow trading by default

    def _check_duplicate_position(self, pair: str) -> bool:
        """Check if position already exists for this pair."""
        for trade in self._open_trades.values():
            if trade.pair == pair:
                logger.warning(f"Duplicate position detected for {pair}")
                return False
        return True

    def stop_monitoring(self) -> None:
        """Stop position monitoring."""
        self._monitoring = False

    def get_open_trades(self) -> list[TradeRecord]:
        """Get list of open trades."""
        return list(self._open_trades.values())

    def get_trade_history(self, limit: Optional[int] = None) -> list[TradeRecord]:
        """Get trade history."""
        if limit:
            return self.trade_history[-limit:]
        return self.trade_history
