"""
APEX TRADER AI - Daily Report Generator
========================================
Generates and sends a comprehensive daily trading report via Telegram.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

log = logging.getLogger("apex.daily_report")


class DailyReportGenerator:
    """Generates formatted daily trading reports."""

    def __init__(self, notifier=None):
        """
        Args:
            notifier: TelegramNotifier instance (or None for dry run)
        """
        self.notifier = notifier

    def generate_report(
        self,
        trades: list,
        balance: float,
        starting_balance: float,
        risk_status: dict,
        mode: str = "paper",
    ) -> str:
        """
        Generate a formatted daily report.

        Args:
            trades: List of today's trades
            balance: Current balance
            starting_balance: Balance at start of day
            risk_status: Risk manager status dict
            mode: "paper" or "live"

        Returns:
            HTML-formatted report string
        """
        now = datetime.now(timezone.utc)

        # Filter today's trades
        today = now.date()
        todays_trades = [
            t for t in trades
            if hasattr(t, 'open_time') and t.open_time
            and datetime.fromisoformat(str(t.open_time).replace('Z', '+00:00')).date() == today
        ]

        closed_today = [t for t in todays_trades if hasattr(t, 'status') and t.status == 'closed']
        wins = [t for t in closed_today if hasattr(t, 'pnl') and t.pnl and t.pnl > 0]
        losses = [t for t in closed_today if hasattr(t, 'pnl') and t.pnl and t.pnl <= 0]

        daily_pnl = sum(t.pnl for t in closed_today if hasattr(t, 'pnl') and t.pnl)
        daily_pnl_pct = (daily_pnl / starting_balance * 100) if starting_balance > 0 else 0
        win_rate = (len(wins) / len(closed_today) * 100) if closed_today else 0

        # Build report
        mode_emoji = "📝" if mode == "paper" else "🔴"
        pnl_emoji = "📈" if daily_pnl >= 0 else "📉"

        report = f"""
<b>{'═' * 30}</b>
<b>📊 APEX TRADER AI - Daily Report</b>
<b>{'═' * 30}</b>

📅 <b>Date:</b> {now.strftime('%Y-%m-%d')}
⏰ <b>Generated:</b> {now.strftime('%H:%M UTC')}
{mode_emoji} <b>Mode:</b> {'Paper Trading' if mode == 'paper' else 'LIVE TRADING'}

<b>{'─' * 25}</b>
<b>💰 Account Summary</b>
<b>{'─' * 25}</b>

💵 <b>Balance:</b> ${balance:,.2f}
{pnl_emoji} <b>Daily P&L:</b> ${daily_pnl:+,.2f} ({daily_pnl_pct:+.2f}%)
📊 <b>Starting:</b> ${starting_balance:,.2f}

<b>{'─' * 25}</b>
<b>📈 Trading Activity</b>
<b>{'─' * 25}</b>

🔢 <b>Total Trades:</b> {len(closed_today)}
✅ <b>Wins:</b> {len(wins)}
❌ <b>Losses:</b> {len(losses)}
🎯 <b>Win Rate:</b> {win_rate:.1f}%
"""

        if wins:
            best = max(wins, key=lambda t: t.pnl)
            report += f"🏆 <b>Best Trade:</b> ${best.pnl:+.2f}\n"

        if losses:
            worst = min(losses, key=lambda t: t.pnl)
            report += f"💀 <b>Worst Trade:</b> ${worst.pnl:+.2f}\n"

        # Risk status
        report += f"""
<b>{'─' * 25}</b>
<b>🛡️ Risk Status</b>
<b>{'─' * 25}</b>

🔒 <b>Kill Switch:</b> {'🔴 ACTIVE' if risk_status.get('kill_switch') else '🟢 Off'}
⚡ <b>Circuit Breaker:</b> {'🔴 TRIPPED' if risk_status.get('circuit_breaker_tripped') else '🟢 Ready'}
📉 <b>Daily Drawdown:</b> {risk_status.get('daily_drawdown_pct', 0):.2f}%
🔄 <b>Consecutive Losses:</b> {risk_status.get('consecutive_losses', 0)}
📊 <b>Open Positions:</b> {risk_status.get('open_positions', 0)}
"""

        # Trade list
        if closed_today:
            report += f"\n<b>{'─' * 25}</b>\n<b>📋 Today's Trades</b>\n<b>{'─' * 25}</b>\n\n"
            for i, t in enumerate(closed_today[:10], 1):
                emoji = "🟢" if t.pnl > 0 else "🔴"
                pair = getattr(t, 'pair', 'EUR_USD')
                direction = getattr(t, 'direction', '?')
                pnl = t.pnl if hasattr(t, 'pnl') and t.pnl else 0
                report += f"{emoji} #{i} {pair} {direction} → ${pnl:+.2f}\n"

            if len(closed_today) > 10:
                report += f"\n... and {len(closed_today) - 10} more trades\n"
        else:
            report += "\n<i>No trades executed today.</i>\n"

        report += f"""
<b>{'═' * 30}</b>
<i>🤖 Apex Trader AI v2.0</i>
<i>⚡ 9-Indicator Confluence Engine</i>
"""

        return report.strip()

    async def send_report(
        self,
        trades: list,
        balance: float,
        starting_balance: float,
        risk_status: dict,
        mode: str = "paper",
    ) -> bool:
        """Generate and send the daily report via Telegram."""
        report = self.generate_report(trades, balance, starting_balance, risk_status, mode)

        if self.notifier:
            try:
                await self.notifier.send_raw(report)
                log.info("Daily report sent successfully")
                return True
            except Exception as e:
                log.error(f"Failed to send daily report: {e}")
                return False
        else:
            log.info("Daily report generated (no notifier configured)")
            print(report)
            return True
