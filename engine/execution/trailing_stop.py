"""
APEX TRADER AI - Trailing Stop Loss
====================================
Dynamic stop loss that follows price movement to lock in profits.
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

log = logging.getLogger("apex.trailing_stop")


@dataclass
class TrailingStopState:
    """State for a single trailing stop."""
    trade_id: str
    pair: str
    direction: str  # "BUY" or "SELL"
    entry_price: float
    initial_sl: float
    current_sl: float
    trail_distance_pips: float
    activation_pips: float  # Only start trailing after X pips profit
    highest_price: float = 0.0  # For BUY trades
    lowest_price: float = float('inf')  # For SELL trades
    activated: bool = False
    pips_locked: float = 0.0


class TrailingStopManager:
    """Manages trailing stops for all active positions."""

    def __init__(self, default_trail_pips: float = 10.0, activation_pips: float = 5.0):
        self.default_trail_pips = default_trail_pips
        self.activation_pips = activation_pips
        self.stops: dict[str, TrailingStopState] = {}

    def _pip_value(self, pair: str) -> float:
        """Get pip value for a pair."""
        return 0.01 if "JPY" in pair else 0.0001

    def register(
        self,
        trade_id: str,
        pair: str,
        direction: str,
        entry_price: float,
        initial_sl: float,
        trail_pips: Optional[float] = None,
        activation_pips: Optional[float] = None,
    ) -> TrailingStopState:
        """Register a new position for trailing stop management."""
        state = TrailingStopState(
            trade_id=trade_id,
            pair=pair,
            direction=direction,
            entry_price=entry_price,
            initial_sl=initial_sl,
            current_sl=initial_sl,
            trail_distance_pips=trail_pips or self.default_trail_pips,
            activation_pips=activation_pips or self.activation_pips,
            highest_price=entry_price if direction == "BUY" else 0.0,
            lowest_price=entry_price if direction == "SELL" else float('inf'),
        )
        self.stops[trade_id] = state
        log.info(f"Trailing stop registered: {trade_id} ({pair} {direction}) trail={state.trail_distance_pips}p activation={state.activation_pips}p")
        return state

    def update(self, trade_id: str, current_price: float) -> Optional[float]:
        """
        Update trailing stop with current price.

        Returns:
            New stop loss price if it changed, None otherwise.
        """
        state = self.stops.get(trade_id)
        if not state:
            return None

        pip = self._pip_value(state.pair)
        trail_distance = state.trail_distance_pips * pip
        activation_distance = state.activation_pips * pip

        if state.direction == "BUY":
            # Track highest price
            if current_price > state.highest_price:
                state.highest_price = current_price

            # Check activation
            profit_pips = (current_price - state.entry_price) / pip
            if not state.activated and profit_pips >= state.activation_pips:
                state.activated = True
                log.info(f"Trailing stop activated for {trade_id}: {profit_pips:.1f} pips profit")

            if state.activated:
                new_sl = state.highest_price - trail_distance
                if new_sl > state.current_sl:
                    old_sl = state.current_sl
                    state.current_sl = new_sl
                    state.pips_locked = (new_sl - state.entry_price) / pip
                    log.info(f"Trailing stop moved: {trade_id} SL {old_sl:.5f} -> {new_sl:.5f} (locked {state.pips_locked:.1f} pips)")
                    return new_sl

        elif state.direction == "SELL":
            # Track lowest price
            if current_price < state.lowest_price:
                state.lowest_price = current_price

            # Check activation
            profit_pips = (state.entry_price - current_price) / pip
            if not state.activated and profit_pips >= state.activation_pips:
                state.activated = True
                log.info(f"Trailing stop activated for {trade_id}: {profit_pips:.1f} pips profit")

            if state.activated:
                new_sl = state.lowest_price + trail_distance
                if new_sl < state.current_sl:
                    old_sl = state.current_sl
                    state.current_sl = new_sl
                    state.pips_locked = (state.entry_price - new_sl) / pip
                    log.info(f"Trailing stop moved: {trade_id} SL {old_sl:.5f} -> {new_sl:.5f} (locked {state.pips_locked:.1f} pips)")
                    return new_sl

        return None

    def remove(self, trade_id: str) -> None:
        """Remove a position from trailing stop management."""
        if trade_id in self.stops:
            del self.stops[trade_id]
            log.info(f"Trailing stop removed: {trade_id}")

    def get_status(self) -> list[dict]:
        """Get status of all trailing stops."""
        return [
            {
                "trade_id": s.trade_id,
                "pair": s.pair,
                "direction": s.direction,
                "entry_price": s.entry_price,
                "initial_sl": s.initial_sl,
                "current_sl": s.current_sl,
                "activated": s.activated,
                "pips_locked": round(s.pips_locked, 1),
                "trail_distance": s.trail_distance_pips,
            }
            for s in self.stops.values()
        ]
