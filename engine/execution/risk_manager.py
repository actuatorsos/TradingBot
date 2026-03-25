"""Risk management engine for Apex Trader AI."""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta

UTC = timezone.utc

logger = logging.getLogger(__name__)


@dataclass
class RiskConfig:
    """Risk management configuration."""
    risk_per_trade_pct: float = 1.0  # Risk 1% per trade
    daily_loss_limit_pct: float = 5.0  # Stop trading at 5% daily loss
    max_consecutive_losses: int = 3  # Stop after 3 consecutive losses
    max_open_trades: int = 5  # Max concurrent positions
    max_daily_trades: int = 20  # Max trades per day
    circuit_breaker_loss_pct: float = 3.0  # Activate circuit breaker at 3% loss
    position_size_multiplier: float = 1.0  # Scale position size


class RiskManager:
    """Risk management engine with position sizing and circuit breaker."""

    def __init__(self, config: RiskConfig | dict):
        """Initialize risk manager.

        Args:
            config: RiskConfig dataclass or dict with config parameters
        """
        if isinstance(config, dict):
            self.config = RiskConfig(**config)
        else:
            self.config = config

        # Daily counters (reset at midnight UTC)
        self._daily_pnl: float = 0.0
        self._trades_today: int = 0
        self._consecutive_losses: int = 0
        self._daily_reset_date: datetime = datetime.now(UTC).date()

        # Circuit breaker state
        self._circuit_breaker_active: bool = False
        self._kill_switch_active: bool = False

        logger.info(f"RiskManager initialized with config: {self.config}")

    @property
    def daily_pnl(self) -> float:
        """Get current daily P&L."""
        return self._daily_pnl

    @property
    def consecutive_losses(self) -> int:
        """Get current consecutive loss count."""
        return self._consecutive_losses

    @property
    def trades_today(self) -> int:
        """Get trades executed today."""
        return self._trades_today

    @property
    def circuit_breaker_active(self) -> bool:
        """Check if circuit breaker is active."""
        return self._circuit_breaker_active

    @property
    def kill_switch_active(self) -> bool:
        """Check if kill switch is active."""
        return self._kill_switch_active

    def _check_daily_reset(self) -> None:
        """Reset daily counters if it's a new day."""
        current_date = datetime.now(UTC).date()
        if current_date > self._daily_reset_date:
            self.reset_daily()

    def can_trade(self) -> tuple[bool, str]:
        """Check if trading is allowed.

        Returns:
            (allowed: bool, reason: str) - Reason explains any restriction
        """
        self._check_daily_reset()

        # Check kill switch
        if self._kill_switch_active:
            return False, "Kill switch is active"

        # Check circuit breaker
        if self._circuit_breaker_active:
            return False, "Circuit breaker triggered"

        # Check daily loss limit
        if self._daily_pnl < 0:
            daily_loss_pct = (abs(self._daily_pnl) / 10000) * 100  # Rough estimate
            if daily_loss_pct >= self.config.daily_loss_limit_pct:
                return False, f"Daily loss limit exceeded ({daily_loss_pct:.2f}%)"

        # Check consecutive losses
        if self._consecutive_losses >= self.config.max_consecutive_losses:
            return False, (
                f"Consecutive loss limit exceeded ({self._consecutive_losses} losses)"
            )

        # Check max open trades
        # Note: This would need integration with executor to check actual open trades
        # For now, we track at trade level

        # Check max daily trades
        if self._trades_today >= self.config.max_daily_trades:
            return False, f"Daily trade limit exceeded ({self._trades_today} trades)"

        return True, "Trading allowed"

    def calculate_lot_size(
        self,
        stop_loss_pips: float,
        account_balance: float
    ) -> float:
        """Calculate position size based on risk per trade.

        Args:
            stop_loss_pips: Stop loss distance in pips
            account_balance: Current account balance

        Returns:
            Lot size (micro-lots, where 1 lot = 100,000 units)
        """
        if stop_loss_pips <= 0 or account_balance <= 0:
            logger.warning(f"Invalid SL or balance: SL={stop_loss_pips}, balance={account_balance}")
            return 0.0

        # Risk amount in account currency
        risk_amount = account_balance * (self.config.risk_per_trade_pct / 100)

        # For standard lots: 1 pip = 10 units of account currency per lot
        # Lot size = Risk amount / (Stop loss in pips * pip value per lot)
        lot_size = (risk_amount / (stop_loss_pips * 10)) * self.config.position_size_multiplier

        # Ensure minimum and maximum bounds
        lot_size = max(0.01, min(lot_size, 100))  # Between 0.01 and 100 lots

        logger.debug(
            f"Calculated lot size: {lot_size:.2f} for SL={stop_loss_pips} pips, "
            f"balance={account_balance:.2f}"
        )

        return lot_size

    def record_trade_result(self, pnl: float) -> None:
        """Record trade result and update risk state.

        Args:
            pnl: Profit/loss in account currency
        """
        self._check_daily_reset()

        self._daily_pnl += pnl
        self._trades_today += 1

        # Update consecutive losses
        if pnl < 0:
            self._consecutive_losses += 1
        else:
            self._consecutive_losses = 0

        # Check circuit breaker threshold
        if self._daily_pnl < 0:
            daily_loss_pct = (abs(self._daily_pnl) / 10000) * 100  # Rough estimate
            if daily_loss_pct >= self.config.circuit_breaker_loss_pct:
                self._circuit_breaker_active = True
                logger.warning(f"Circuit breaker activated at {daily_loss_pct:.2f}% loss")

        logger.info(
            f"Trade recorded: PnL={pnl:+.2f}, Daily PnL={self._daily_pnl:+.2f}, "
            f"Consecutive losses={self._consecutive_losses}, Trades today={self._trades_today}"
        )

    def reset_daily(self) -> None:
        """Reset daily counters (call at midnight UTC)."""
        logger.info(
            f"Daily reset: PnL={self._daily_pnl:+.2f}, "
            f"Trades={self._trades_today}, Losses={self._consecutive_losses}"
        )

        self._daily_pnl = 0.0
        self._trades_today = 0
        self._consecutive_losses = 0
        self._circuit_breaker_active = False
        self._daily_reset_date = datetime.now(UTC).date()

    def activate_kill_switch(self) -> None:
        """Activate kill switch to stop all trading."""
        self._kill_switch_active = True
        logger.critical("KILL SWITCH ACTIVATED - All trading halted")

    def deactivate_kill_switch(self) -> None:
        """Deactivate kill switch to resume trading."""
        self._kill_switch_active = False
        logger.warning("Kill switch deactivated - Trading resumed")

    def get_status(self) -> dict:
        """Get current risk state for dashboard display.

        Returns:
            Dict with current risk metrics
        """
        self._check_daily_reset()

        can_trade, reason = self.can_trade()

        return {
            "can_trade": can_trade,
            "trade_allowed_reason": reason,
            "daily_pnl": self._daily_pnl,
            "daily_pnl_pct": (abs(self._daily_pnl) / 10000) * 100,  # Rough estimate
            "consecutive_losses": self._consecutive_losses,
            "trades_today": self._trades_today,
            "max_daily_trades": self.config.max_daily_trades,
            "circuit_breaker_active": self._circuit_breaker_active,
            "circuit_breaker_threshold": self.config.circuit_breaker_loss_pct,
            "kill_switch_active": self._kill_switch_active,
            "risk_per_trade_pct": self.config.risk_per_trade_pct,
            "daily_loss_limit_pct": self.config.daily_loss_limit_pct,
            "max_consecutive_losses": self.config.max_consecutive_losses,
            "timestamp": datetime.now(UTC).isoformat()
        }
