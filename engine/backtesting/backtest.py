"""
APEX TRADER AI - Backtesting Engine
====================================
Replay historical candle data through the signal engine
to evaluate strategy performance without risking capital.
"""

import logging
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime, timezone

log = logging.getLogger("apex.backtest")


@dataclass
class BacktestTrade:
    id: int
    pair: str
    direction: str  # "BUY" or "SELL"
    entry_price: float
    entry_time: str
    exit_price: float = 0.0
    exit_time: str = ""
    stop_loss: float = 0.0
    take_profit: float = 0.0
    pnl: float = 0.0
    pnl_pips: float = 0.0
    status: str = "open"  # "open", "closed_tp", "closed_sl", "closed_signal"
    confidence: float = 0.0


@dataclass
class BacktestResult:
    pair: str
    timeframe: str
    period: str
    total_candles: int
    total_trades: int
    wins: int
    losses: int
    win_rate: float
    total_pnl: float
    total_pnl_pips: float
    avg_win: float
    avg_loss: float
    profit_factor: float
    max_drawdown: float
    max_drawdown_pct: float
    sharpe_ratio: float
    max_consecutive_wins: int
    max_consecutive_losses: int
    avg_trade_duration_candles: int
    trades: list = field(default_factory=list)
    equity_curve: list = field(default_factory=list)


class Backtester:
    """Replays historical data through the signal engine."""

    def __init__(
        self,
        min_confidence: float = 72.0,
        stop_loss_pips: float = 15.0,
        take_profit_pips: float = 25.0,
        risk_per_trade_pct: float = 1.0,
        initial_balance: float = 10000.0,
        max_open_trades: int = 1,
    ):
        self.min_confidence = min_confidence
        self.sl_pips = stop_loss_pips
        self.tp_pips = take_profit_pips
        self.risk_pct = risk_per_trade_pct
        self.initial_balance = initial_balance
        self.max_open = max_open_trades

    def run(self, candles: list, pair: str = "EUR_USD", timeframe: str = "M5") -> BacktestResult:
        """
        Run backtest on historical candle data.

        Args:
            candles: List of dicts with keys: time, open, high, low, close, volume
            pair: Currency pair
            timeframe: Candle timeframe

        Returns:
            BacktestResult with full performance metrics
        """
        from engine.signals.indicators import (
            calc_rsi, calc_macd, calc_bollinger, calc_ema_cross,
            calc_stochastic, calc_atr
        )

        pip = 0.01 if "JPY" in pair else 0.0001
        balance = self.initial_balance
        peak_balance = balance
        max_drawdown = 0.0

        trades: list[BacktestTrade] = []
        open_trades: list[BacktestTrade] = []
        equity_curve = [{"candle": 0, "balance": balance}]
        trade_counter = 0

        # Need at least 50 candles for indicators
        lookback = 50
        if len(candles) < lookback + 10:
            return BacktestResult(
                pair=pair, timeframe=timeframe, period="insufficient",
                total_candles=len(candles), total_trades=0,
                wins=0, losses=0, win_rate=0, total_pnl=0,
                total_pnl_pips=0, avg_win=0, avg_loss=0,
                profit_factor=0, max_drawdown=0, max_drawdown_pct=0,
                sharpe_ratio=0, max_consecutive_wins=0,
                max_consecutive_losses=0, avg_trade_duration_candles=0,
            )

        closes = [c["close"] for c in candles]
        highs = [c["high"] for c in candles]
        lows = [c["low"] for c in candles]

        for i in range(lookback, len(candles)):
            current = candles[i]
            price = current["close"]

            # Check existing trades for SL/TP
            for trade in open_trades[:]:
                hit_sl = False
                hit_tp = False

                if trade.direction == "BUY":
                    hit_sl = current["low"] <= trade.stop_loss
                    hit_tp = current["high"] >= trade.take_profit
                elif trade.direction == "SELL":
                    hit_sl = current["high"] >= trade.stop_loss
                    hit_tp = current["low"] <= trade.take_profit

                if hit_tp:
                    trade.exit_price = trade.take_profit
                    trade.exit_time = current["time"]
                    trade.status = "closed_tp"
                    if trade.direction == "BUY":
                        trade.pnl_pips = (trade.exit_price - trade.entry_price) / pip
                    else:
                        trade.pnl_pips = (trade.entry_price - trade.exit_price) / pip
                    trade.pnl = trade.pnl_pips * pip * 10000  # Approximate USD P&L
                    balance += trade.pnl
                    open_trades.remove(trade)

                elif hit_sl:
                    trade.exit_price = trade.stop_loss
                    trade.exit_time = current["time"]
                    trade.status = "closed_sl"
                    if trade.direction == "BUY":
                        trade.pnl_pips = (trade.exit_price - trade.entry_price) / pip
                    else:
                        trade.pnl_pips = (trade.entry_price - trade.exit_price) / pip
                    trade.pnl = trade.pnl_pips * pip * 10000
                    balance += trade.pnl
                    open_trades.remove(trade)

            # Track equity
            if balance > peak_balance:
                peak_balance = balance
            dd = peak_balance - balance
            if dd > max_drawdown:
                max_drawdown = dd

            if i % 10 == 0:  # Record every 10 candles
                equity_curve.append({"candle": i, "balance": round(balance, 2)})

            # Generate signal using indicator window
            if len(open_trades) >= self.max_open:
                continue

            window_closes = closes[i - lookback:i + 1]
            window_highs = highs[i - lookback:i + 1]
            window_lows = lows[i - lookback:i + 1]

            # Simple signal logic (mirrors the main engine)
            rsi_values = calc_rsi(window_closes, 14)
            current_rsi = rsi_values[-1] if rsi_values else 50

            macd_data = calc_macd(window_closes)
            macd_line = macd_data.get("macd_line", [0])
            signal_line = macd_data.get("signal_line", [0])

            ema_data = calc_ema_cross(window_closes, 20, 50)

            buy_score = 0
            sell_score = 0

            # RSI
            if current_rsi < 30: buy_score += 1.5
            elif current_rsi > 70: sell_score += 1.5

            # MACD
            if len(macd_line) > 1 and len(signal_line) > 1:
                if macd_line[-1] > signal_line[-1]: buy_score += 1.2
                else: sell_score += 1.2

            # EMA
            if ema_data.get("bullish", False): buy_score += 1.0
            else: sell_score += 1.0

            # Bollinger
            bb = calc_bollinger(window_closes, 20, 2.0)
            if bb and price <= bb.get("lower", price): buy_score += 1.3
            elif bb and price >= bb.get("upper", price): sell_score += 1.3

            # Stochastic
            stoch = calc_stochastic(window_highs, window_lows, window_closes, 14)
            if stoch and stoch.get("k", 50) < 20: buy_score += 0.9
            elif stoch and stoch.get("k", 50) > 80: sell_score += 0.9

            total_weight = 1.5 + 1.2 + 1.0 + 1.3 + 0.9  # 5.9
            max_score = max(buy_score, sell_score)
            confidence = (max_score / total_weight) * 100

            if confidence >= self.min_confidence:
                direction = "BUY" if buy_score > sell_score else "SELL"
                trade_counter += 1

                if direction == "BUY":
                    sl = price - self.sl_pips * pip
                    tp = price + self.tp_pips * pip
                else:
                    sl = price + self.sl_pips * pip
                    tp = price - self.tp_pips * pip

                trade = BacktestTrade(
                    id=trade_counter,
                    pair=pair,
                    direction=direction,
                    entry_price=price,
                    entry_time=current["time"],
                    stop_loss=round(sl, 5),
                    take_profit=round(tp, 5),
                    confidence=round(confidence, 1),
                )
                open_trades.append(trade)
                trades.append(trade)

        # Close remaining open trades at last price
        last_price = candles[-1]["close"]
        for trade in open_trades:
            trade.exit_price = last_price
            trade.exit_time = candles[-1]["time"]
            trade.status = "closed_signal"
            if trade.direction == "BUY":
                trade.pnl_pips = (trade.exit_price - trade.entry_price) / pip
            else:
                trade.pnl_pips = (trade.entry_price - trade.exit_price) / pip
            trade.pnl = trade.pnl_pips * pip * 10000
            balance += trade.pnl

        equity_curve.append({"candle": len(candles) - 1, "balance": round(balance, 2)})

        # Calculate metrics
        closed = [t for t in trades if t.status != "open"]
        wins = [t for t in closed if t.pnl > 0]
        losses_list = [t for t in closed if t.pnl <= 0]

        win_rate = (len(wins) / len(closed) * 100) if closed else 0
        avg_win = sum(t.pnl for t in wins) / len(wins) if wins else 0
        avg_loss = abs(sum(t.pnl for t in losses_list) / len(losses_list)) if losses_list else 0
        total_pnl = sum(t.pnl for t in closed)
        total_pnl_pips = sum(t.pnl_pips for t in closed)
        gross_profit = sum(t.pnl for t in wins)
        gross_loss = abs(sum(t.pnl for t in losses_list))
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf') if gross_profit > 0 else 0

        max_dd_pct = (max_drawdown / peak_balance * 100) if peak_balance > 0 else 0

        # Sharpe
        returns = [t.pnl for t in closed]
        if len(returns) > 1:
            import numpy as np
            avg_r = np.mean(returns)
            std_r = np.std(returns, ddof=1)
            sharpe = (avg_r / std_r) * (252 ** 0.5) if std_r > 0 else 0
        else:
            sharpe = 0

        # Streaks
        max_w_streak = max_l_streak = cur_streak = 0
        streak_type = ""
        for t in closed:
            is_win = t.pnl > 0
            if (is_win and streak_type == "w") or (not is_win and streak_type == "l"):
                cur_streak += 1
            else:
                cur_streak = 1
                streak_type = "w" if is_win else "l"
            if streak_type == "w": max_w_streak = max(max_w_streak, cur_streak)
            else: max_l_streak = max(max_l_streak, cur_streak)

        period_str = ""
        if candles:
            period_str = f"{candles[0].get('time', '')[:10]} to {candles[-1].get('time', '')[:10]}"

        return BacktestResult(
            pair=pair,
            timeframe=timeframe,
            period=period_str,
            total_candles=len(candles),
            total_trades=len(closed),
            wins=len(wins),
            losses=len(losses_list),
            win_rate=round(win_rate, 2),
            total_pnl=round(total_pnl, 2),
            total_pnl_pips=round(total_pnl_pips, 1),
            avg_win=round(avg_win, 2),
            avg_loss=round(avg_loss, 2),
            profit_factor=round(profit_factor, 2),
            max_drawdown=round(max_drawdown, 2),
            max_drawdown_pct=round(max_dd_pct, 2),
            sharpe_ratio=round(float(sharpe), 2),
            max_consecutive_wins=max_w_streak,
            max_consecutive_losses=max_l_streak,
            avg_trade_duration_candles=0,
            trades=[{
                "id": t.id, "pair": t.pair, "direction": t.direction,
                "entry": t.entry_price, "exit": t.exit_price,
                "pnl": round(t.pnl, 2), "pips": round(t.pnl_pips, 1),
                "status": t.status, "confidence": t.confidence,
            } for t in closed],
            equity_curve=equity_curve,
        )
