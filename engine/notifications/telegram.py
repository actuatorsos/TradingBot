"""Telegram notification system for Apex Trader AI."""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

import aiohttp

UTC = timezone.utc

logger = logging.getLogger(__name__)


class TelegramNotifier:
    """Send trade alerts and system notifications via Telegram Bot API."""

    def __init__(self, bot_token: str, chat_id: str | int):
        """Initialize Telegram notifier.

        Args:
            bot_token: Telegram Bot API token
            chat_id: Target chat ID for messages
        """
        self.bot_token = bot_token
        self.chat_id = chat_id
        self.api_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"

        logger.info(f"TelegramNotifier initialized for chat {chat_id}")

    async def _send_message(self, text: str, parse_mode: str = "HTML") -> bool:
        """Send a message via Telegram Bot API.

        Args:
            text: Message text (supports HTML formatting)
            parse_mode: Parse mode (HTML or Markdown)

        Returns:
            True if successful
        """
        try:
            async with aiohttp.ClientSession() as session:
                payload = {
                    "chat_id": self.chat_id,
                    "text": text,
                    "parse_mode": parse_mode
                }

                async with session.post(self.api_url, json=payload, timeout=10) as response:
                    if response.status == 200:
                        return True
                    else:
                        error = await response.text()
                        logger.error(f"Telegram API error: {response.status} - {error}")
                        return False

        except asyncio.TimeoutError:
            logger.error("Telegram API request timeout")
            return False
        except Exception as e:
            logger.exception(f"Error sending Telegram message: {e}")
            return False

    async def send_trade_alert(self, trade) -> bool:
        """Send formatted trade entry alert.

        Args:
            trade: TradeRecord object with trade details

        Returns:
            True if successful
        """
        try:
            # Format entry alert with emojis and monospace for numbers
            message = (
                f"📊 <b>TRADE OPENED</b>\n"
                f"<code>{trade.id[:8]}</code>\n\n"
                f"<b>Pair:</b> {trade.pair}\n"
                f"<b>Direction:</b> {'📈 BUY' if trade.direction.value == 'BUY' else '📉 SELL'}\n"
                f"<b>Entry:</b> <code>{trade.entry_price:.5f}</code>\n"
                f"<b>Size:</b> <code>{trade.lot_size:.2f} lots</code>\n\n"
                f"<b>Stop Loss:</b> <code>{trade.sl:.5f}</code>\n"
                f"<b>Take Profit:</b> <code>{trade.tp:.5f}</code>\n\n"
                f"<b>Time:</b> {trade.open_time.strftime('%H:%M:%S UTC')}"
            )

            success = await self._send_message(message)
            if success:
                logger.info(f"Trade alert sent for {trade.id}")
            return success

        except Exception as e:
            logger.exception(f"Error sending trade alert: {e}")
            return False

    async def send_trade_closed(self, trade) -> bool:
        """Send formatted trade closure notification with P&L.

        Args:
            trade: TradeRecord object with closure details

        Returns:
            True if successful
        """
        try:
            # Format close alert with P&L result
            pnl_emoji = "✅" if trade.pnl >= 0 else "❌"

            message = (
                f"{pnl_emoji} <b>TRADE CLOSED</b>\n"
                f"<code>{trade.id[:8]}</code>\n\n"
                f"<b>Pair:</b> {trade.pair}\n"
                f"<b>Direction:</b> {'📈 BUY' if trade.direction.value == 'BUY' else '📉 SELL'}\n\n"
                f"<b>Entry:</b> <code>{trade.entry_price:.5f}</code>\n"
                f"<b>Exit:</b> <code>{trade.exit_price:.5f}</code>\n"
                f"<b>Size:</b> <code>{trade.lot_size:.2f} lots</code>\n\n"
                f"<b>P&L:</b> <code>{trade.pnl:+.2f}</code>\n"
                f"<b>Return:</b> <code>{trade.pnl_pct:+.2f}%</code>\n\n"
                f"<b>Reason:</b> {trade.close_reason}\n"
                f"<b>Duration:</b> {self._format_duration(trade.open_time, trade.close_time)}"
            )

            success = await self._send_message(message)
            if success:
                logger.info(f"Trade closed notification sent for {trade.id}")
            return success

        except Exception as e:
            logger.exception(f"Error sending trade closed notification: {e}")
            return False

    async def send_daily_summary(self, stats: dict) -> bool:
        """Send end-of-day trading summary.

        Args:
            stats: Dictionary with daily statistics:
                - total_trades: Number of trades
                - winning_trades: Winning trades count
                - losing_trades: Losing trades count
                - daily_pnl: Daily profit/loss
                - win_rate: Win rate percentage
                - balance: Current balance

        Returns:
            True if successful
        """
        try:
            total = stats.get("total_trades", 0)
            wins = stats.get("winning_trades", 0)
            losses = stats.get("losing_trades", 0)
            daily_pnl = stats.get("daily_pnl", 0)
            win_rate = stats.get("win_rate", 0)
            balance = stats.get("balance", 0)

            pnl_emoji = "📈" if daily_pnl >= 0 else "📉"

            message = (
                f"📋 <b>DAILY SUMMARY</b>\n"
                f"{datetime.now(UTC).strftime('%Y-%m-%d')}\n\n"
                f"<b>Trades:</b> <code>{total}</code> "
                f"(✅ {wins} | ❌ {losses})\n"
                f"<b>Win Rate:</b> <code>{win_rate:.1f}%</code>\n\n"
                f"{pnl_emoji} <b>Daily P&L:</b> <code>{daily_pnl:+.2f}</code>\n"
                f"💰 <b>Balance:</b> <code>${balance:,.2f}</code>\n"
            )

            success = await self._send_message(message)
            if success:
                logger.info("Daily summary sent")
            return success

        except Exception as e:
            logger.exception(f"Error sending daily summary: {e}")
            return False

    async def send_system_alert(
        self,
        message: str,
        level: str = "info"
    ) -> bool:
        """Send system status alert.

        Args:
            message: Alert message
            level: Alert level (info, warning, error, critical)

        Returns:
            True if successful
        """
        try:
            level = level.lower()
            emoji_map = {
                "info": "ℹ️",
                "warning": "⚠️",
                "error": "🔴",
                "critical": "🚨"
            }
            emoji = emoji_map.get(level, "ℹ️")

            formatted_message = (
                f"{emoji} <b>SYSTEM ALERT</b>\n"
                f"<b>Level:</b> {level.upper()}\n\n"
                f"{message}\n\n"
                f"<b>Time:</b> {datetime.now(UTC).strftime('%H:%M:%S UTC')}"
            )

            success = await self._send_message(formatted_message)
            if success:
                logger.info(f"System alert sent: {level}")
            return success

        except Exception as e:
            logger.exception(f"Error sending system alert: {e}")
            return False

    async def send_risk_alert(self, message: str) -> bool:
        """Send risk management warning.

        Args:
            message: Risk warning message

        Returns:
            True if successful
        """
        try:
            formatted_message = (
                f"🛑 <b>RISK ALERT</b>\n\n"
                f"{message}\n\n"
                f"<b>Time:</b> {datetime.now(UTC).strftime('%H:%M:%S UTC')}\n"
                f"<b>Action Required:</b> Review risk settings"
            )

            success = await self._send_message(formatted_message)
            if success:
                logger.warning(f"Risk alert sent: {message}")
            return success

        except Exception as e:
            logger.exception(f"Error sending risk alert: {e}")
            return False

    @staticmethod
    def _format_duration(start_time: datetime, end_time: datetime) -> str:
        """Format duration between two times.

        Args:
            start_time: Start datetime
            end_time: End datetime

        Returns:
            Formatted duration string
        """
        delta = end_time - start_time
        hours, remainder = divmod(int(delta.total_seconds()), 3600)
        minutes, seconds = divmod(remainder, 60)

        if hours > 0:
            return f"{hours}h {minutes}m"
        elif minutes > 0:
            return f"{minutes}m {seconds}s"
        else:
            return f"{seconds}s"
