"""
APEX TRADER AI - Trade Execution Engine
========================================
Main entry point. Runs the full trading loop:
  1. Connect to broker (OANDA or Paper)
  2. Fetch candles on schedule
  3. Run 9-indicator signal analysis
  4. Execute trades when confidence > threshold
  5. Monitor open positions
  6. Send notifications
  7. Expose API for Vercel dashboard

Usage:
  python -m engine.main              # Run with settings from env / settings.json
  python -m engine.main --paper      # Force paper trading mode
  python -m engine.main --once       # Run one analysis cycle and exit
"""

import asyncio
import json
import logging
import os
import sys
import signal as sig
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from engine.config import EngineConfig, ConfigLoader
from engine.broker.base import Candle
from engine.broker.oanda import OandaBroker
from engine.broker.capital import CapitalBroker
from engine.signals.engine import SignalEngine
from engine.signals.indicators import calc_atr
from engine.data.candles import CandleManager
from engine.execution.executor import TradeExecutor, TradeSignal
from engine.execution.risk_manager import RiskManager
from engine.execution.paper_trader import PaperTrader
from engine.notifications.telegram import TelegramNotifier
from engine.api_server import DashboardAPI

# ── Logging ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("apex.main")


class ApexTraderEngine:
    """Main orchestrator for the Apex Trader AI system."""

    def __init__(self, config: EngineConfig, paper_mode: bool = False):
        self.config = config
        self.paper_mode = paper_mode or config.paper_trading
        self.running = False

        # ── Core components ──
        self.signal_engine = SignalEngine(
            min_confidence=config.min_confidence,
            rsi_period=config.rsi_period,
            rsi_oversold=config.rsi_oversold,
            rsi_overbought=config.rsi_overbought,
            ema_fast=config.ema_fast,
            ema_slow=config.ema_slow,
            bb_period=config.bollinger_period,
            bb_std=config.bollinger_std,
        )
        self.candle_manager = CandleManager(max_candles=200)

        # ── Broker ──
        if self.paper_mode:
            log.info("🟡 PAPER TRADING MODE - No real orders will be placed")
            self.broker = PaperTrader(initial_balance=config.paper_balance)
        else:
            log.info("🟢 LIVE TRADING MODE - Real orders will be placed!")
            broker_type = getattr(config, "broker", "capital")
            if broker_type == "capital" and getattr(config, "capital", None):
                self.broker = CapitalBroker(
                    api_key=config.capital.api_key,
                    identifier=config.capital.identifier,
                    password=config.capital.password,
                    demo=config.capital.demo,
                )
            else:
                self.broker = OandaBroker(
                    api_key=config.oanda_api_key,
                    account_id=config.oanda_account_id,
                    practice=config.oanda_practice,
                )

        # ── Risk Manager ──
        self.risk_manager = RiskManager(
            daily_drawdown_pct=config.daily_drawdown_pct,
            risk_per_trade_pct=config.risk_per_trade_pct,
            max_consecutive_losses=config.max_consecutive_losses,
            circuit_breaker_enabled=config.circuit_breaker,
            max_open_trades=config.max_open_trades,
            max_daily_trades=config.max_daily_trades,
        )

        # ── Notifications ──
        self.notifier: Optional[TelegramNotifier] = None
        if config.telegram_enabled and config.telegram_bot_token and config.telegram_chat_id:
            self.notifier = TelegramNotifier(
                bot_token=config.telegram_bot_token,
                chat_id=config.telegram_chat_id,
            )
            log.info("📱 Telegram notifications enabled")

        # ── Executor ──
        self.executor = TradeExecutor(
            broker=self.broker,
            risk_manager=self.risk_manager,
            notifier=self.notifier,
        )

        # ── API Server ──
        self.api_server = DashboardAPI(self)

        # ── State ──
        self.last_signal_time: Optional[datetime] = None
        self.cycle_count = 0

    async def start(self):
        """Start the trading engine."""
        log.info("=" * 60)
        log.info("  APEX TRADER AI - Execution Engine")
        log.info(f"  Mode: {'PAPER' if self.paper_mode else 'LIVE'}")
        log.info(f"  Pair: {self.config.pair}")
        log.info(f"  Timeframe: {self.config.timeframe}")
        log.info(f"  Min Confidence: {self.config.min_confidence}%")
        log.info(f"  Risk Per Trade: {self.config.risk_per_trade_pct}%")
        log.info("=" * 60)

        self.running = True

        # Connect broker
        if not self.paper_mode:
            try:
                await self.broker.connect()
                account = await self.broker.get_account()
                log.info(f"Connected to OANDA - Balance: {account.get('balance', 'N/A')}")
            except Exception as e:
                log.error(f"Failed to connect to broker: {e}")
                if self.notifier:
                    await self.notifier.send_system_alert(f"Broker connection failed: {e}", level="error")
                return

        # Send startup notification
        if self.notifier:
            await self.notifier.send_system_alert(
                f"Engine started in {'PAPER' if self.paper_mode else 'LIVE'} mode\n"
                f"Pair: {self.config.pair} | TF: {self.config.timeframe}\n"
                f"Confidence threshold: {self.config.min_confidence}%",
                level="info",
            )

        # Load initial candles
        await self._load_initial_candles()

        # Start dashboard API server
        api_port = int(os.environ.get("APEX_API_PORT", "8080"))
        api_host = os.environ.get("APEX_API_HOST", "0.0.0.0")
        self._api_runner = await self.api_server.start(host=api_host, port=api_port)

        log.info("Engine started. Entering main loop...")

    async def _load_initial_candles(self):
        """Fetch initial historical candles to populate the buffer."""
        log.info(f"Loading initial candles for {self.config.pair}...")
        try:
            if self.paper_mode:
                # Generate synthetic candles for paper trading
                import random
                base_price = 1.0850
                candles = []
                now = datetime.now(timezone.utc)
                for i in range(200):
                    o = base_price + random.uniform(-0.005, 0.005)
                    c = o + random.uniform(-0.003, 0.003)
                    h = max(o, c) + random.uniform(0, 0.002)
                    l = min(o, c) - random.uniform(0, 0.002)
                    v = random.uniform(100, 1000)
                    t = now - timedelta(minutes=(200 - i) * 5)
                    candle = Candle(
                        timestamp=t.isoformat(),
                        open=round(o, 5),
                        high=round(h, 5),
                        low=round(l, 5),
                        close=round(c, 5),
                        volume=round(v, 0),
                    )
                    candles.append(candle)
                    self.candle_manager.update(self.config.pair, self.config.timeframe, {
                        "timestamp": t.isoformat(),
                        "open": candle.open,
                        "high": candle.high,
                        "low": candle.low,
                        "close": candle.close,
                        "volume": candle.volume,
                    })
                log.info(f"Loaded {len(candles)} synthetic candles for paper trading")
            else:
                raw_candles = await self.broker.get_candles(
                    self.config.pair, self.config.timeframe, count=200
                )
                for c in raw_candles:
                    self.candle_manager.update(self.config.pair, self.config.timeframe, {
                        "timestamp": c.timestamp,
                        "open": c.open,
                        "high": c.high,
                        "low": c.low,
                        "close": c.close,
                        "volume": c.volume,
                    })
                log.info(f"Loaded {len(raw_candles)} candles from broker")
        except Exception as e:
            log.error(f"Failed to load initial candles: {e}")

    async def run_cycle(self):
        """Run one analysis + execution cycle."""
        self.cycle_count += 1
        log.info(f"── Cycle {self.cycle_count} ──")

        try:
            # 1. Get current candles
            candles = self.candle_manager.get_candles(
                self.config.pair, self.config.timeframe, count=100
            )
            if len(candles) < 30:
                log.warning(f"Not enough candles ({len(candles)}), need at least 30")
                return

            # Convert to lists for signal engine
            candle_dicts = [
                {"open": c.open, "high": c.high, "low": c.low, "close": c.close, "volume": c.volume}
                for c in candles
            ]

            # 2. Run signal analysis
            signal = self.signal_engine.analyze(candle_dicts)
            log.info(
                f"Signal: {signal.direction.value} | "
                f"Confidence: {signal.confidence:.1f}% | "
                f"Reasons: {', '.join(signal.reasons[:3])}"
            )

            # 3. Execute if actionable
            if signal.direction.value != "HOLD" and signal.confidence >= self.config.min_confidence:
                log.info(f"🎯 Actionable signal! Attempting trade...")

                trade_signal = TradeSignal(
                    pair=self.config.pair,
                    direction=signal.direction.value,
                    confidence=signal.confidence,
                    entry_price=signal.entry_price,
                    stop_loss=signal.stop_loss,
                    take_profit=signal.take_profit,
                    reasons=signal.reasons,
                )
                result = await self.executor.execute_signal(trade_signal)

                if result and result.success:
                    log.info(f"✅ Trade placed: {result.trade_id}")
                elif result:
                    log.warning(f"❌ Trade rejected: {result.message}")
            else:
                log.info("No actionable signal this cycle")

            # 4. Monitor open positions
            await self.executor.monitor_positions()

            # 5. Check daily reset
            self.risk_manager.check_daily_reset()

            self.last_signal_time = datetime.now(timezone.utc)

        except Exception as e:
            log.error(f"Error in cycle: {e}", exc_info=True)
            if self.notifier:
                await self.notifier.send_system_alert(f"Cycle error: {e}", level="error")

    async def run_loop(self):
        """Main trading loop."""
        # Determine interval based on timeframe
        intervals = {
            "M1": 60, "M5": 300, "M15": 900, "M30": 1800,
            "H1": 3600, "H4": 14400, "D1": 86400,
        }
        interval = intervals.get(self.config.timeframe, 300)
        log.info(f"Loop interval: {interval}s ({self.config.timeframe})")

        while self.running:
            await self.run_cycle()
            log.info(f"Sleeping {interval}s until next cycle...")
            await asyncio.sleep(interval)

    async def stop(self):
        """Graceful shutdown."""
        log.info("Shutting down engine...")
        self.running = False

        # Stop API server
        if hasattr(self, '_api_runner') and self._api_runner:
            await self._api_runner.cleanup()

        if self.notifier:
            # Send daily summary before shutdown
            status = self.risk_manager.get_status()
            await self.notifier.send_system_alert(
                f"Engine stopped\n"
                f"Trades today: {status.get('trades_today', 0)}\n"
                f"Daily P&L: {status.get('daily_pnl', 0):.2f}",
                level="warning",
            )

        if not self.paper_mode and hasattr(self.broker, 'disconnect'):
            await self.broker.disconnect()

        # Print paper trading results
        if self.paper_mode and isinstance(self.broker, PaperTrader):
            perf = self.broker.get_performance()
            log.info("=" * 50)
            log.info("  PAPER TRADING RESULTS")
            log.info(f"  Total Trades: {perf.get('total_trades', 0)}")
            log.info(f"  Win Rate: {perf.get('win_rate', 0):.1f}%")
            log.info(f"  Profit Factor: {perf.get('profit_factor', 0):.2f}")
            log.info(f"  Balance: ${perf.get('balance', 0):.2f}")
            log.info(f"  Max Drawdown: {perf.get('max_drawdown_pct', 0):.1f}%")
            log.info("=" * 50)

        log.info("Engine stopped.")

    def get_dashboard_data(self) -> dict:
        """Get current state for the Vercel dashboard API."""
        return {
            "mode": "paper" if self.paper_mode else "live",
            "running": self.running,
            "cycle_count": self.cycle_count,
            "last_signal_time": self.last_signal_time.isoformat() if self.last_signal_time else None,
            "risk": self.risk_manager.get_status(),
            "trades": [
                {
                    "id": t.id,
                    "pair": t.pair,
                    "direction": t.direction,
                    "entry_price": t.entry_price,
                    "exit_price": t.exit_price,
                    "lot_size": t.lot_size,
                    "pnl": t.pnl,
                    "status": t.status,
                    "open_time": t.open_time,
                    "close_time": t.close_time,
                }
                for t in self.executor.trade_history[-50:]  # Last 50 trades
            ],
            "paper_performance": (
                self.broker.get_performance()
                if self.paper_mode and isinstance(self.broker, PaperTrader)
                else None
            ),
        }


async def main():
    """Entry point."""
    import argparse
    parser = argparse.ArgumentParser(description="Apex Trader AI - Execution Engine")
    parser.add_argument("--paper", action="store_true", help="Force paper trading mode")
    parser.add_argument("--once", action="store_true", help="Run one cycle and exit")
    args = parser.parse_args()

    # Load config
    config = ConfigLoader.load()

    # Create engine
    engine = ApexTraderEngine(config, paper_mode=args.paper)

    # Handle graceful shutdown
    loop = asyncio.get_event_loop()
    for s in (sig.SIGINT, sig.SIGTERM):
        loop.add_signal_handler(s, lambda: asyncio.create_task(engine.stop()))

    # Start
    await engine.start()

    if args.once:
        await engine.run_cycle()
        await engine.stop()
    else:
        await engine.run_loop()


if __name__ == "__main__":
    asyncio.run(main())
