"""
APEX TRADER AI - Session-Aware Trading Filter
=============================================
Determines if current market session has sufficient volume/volatility for trading.
Avoids entering trades during low-volume periods (e.g., between sessions).
"""

from datetime import datetime, timezone
from typing import NamedTuple


class SessionInfo(NamedTuple):
    name: str
    active: bool
    overlap: bool
    volume_level: str  # "high", "medium", "low"
    recommendation: str  # "trade", "caution", "avoid"


# Session times in UTC
SESSIONS = {
    "sydney":  {"open": 21, "close": 6},
    "tokyo":   {"open": 0,  "close": 9},
    "london":  {"open": 7,  "close": 16},
    "new_york": {"open": 12, "close": 21},
}

# High-volume overlap windows (UTC hours)
OVERLAPS = {
    "london_new_york": (12, 16),   # Highest volume period
    "tokyo_london":    (7, 9),     # Moderate overlap
    "sydney_tokyo":    (0, 6),     # Lower overlap
}


def is_hour_in_session(hour: int, session: dict) -> bool:
    """Check if UTC hour falls within a session (handles overnight)."""
    open_h = session["open"]
    close_h = session["close"]
    if open_h < close_h:
        return open_h <= hour < close_h
    else:  # Overnight session (e.g., Sydney 21-06)
        return hour >= open_h or hour < close_h


def get_session_info(utc_hour: int | None = None) -> SessionInfo:
    """
    Get current market session information and trading recommendation.

    Returns SessionInfo with:
    - name: Active session name(s)
    - active: Whether any major session is open
    - overlap: Whether we're in a session overlap (high volume)
    - volume_level: "high", "medium", or "low"
    - recommendation: "trade", "caution", or "avoid"
    """
    if utc_hour is None:
        utc_hour = datetime.now(timezone.utc).hour

    active_sessions = []
    for name, times in SESSIONS.items():
        if is_hour_in_session(utc_hour, times):
            active_sessions.append(name)

    # Check overlaps
    in_overlap = False
    for overlap_name, (start, end) in OVERLAPS.items():
        if start <= utc_hour < end:
            in_overlap = True
            break

    # Determine volume and recommendation
    if not active_sessions:
        return SessionInfo(
            name="off-hours",
            active=False,
            overlap=False,
            volume_level="low",
            recommendation="avoid",
        )

    session_name = " + ".join(s.replace("_", " ").title() for s in active_sessions)

    if in_overlap and len(active_sessions) >= 2:
        return SessionInfo(
            name=session_name,
            active=True,
            overlap=True,
            volume_level="high",
            recommendation="trade",
        )

    # London or New York solo = good
    if "london" in active_sessions or "new_york" in active_sessions:
        return SessionInfo(
            name=session_name,
            active=True,
            overlap=in_overlap,
            volume_level="high" if in_overlap else "medium",
            recommendation="trade",
        )

    # Tokyo solo = moderate
    if "tokyo" in active_sessions:
        return SessionInfo(
            name=session_name,
            active=True,
            overlap=in_overlap,
            volume_level="medium",
            recommendation="caution",
        )

    # Sydney only = low
    return SessionInfo(
        name=session_name,
        active=True,
        overlap=False,
        volume_level="low",
        recommendation="caution",
    )


def should_trade(pair: str = "EUR_USD", utc_hour: int | None = None) -> tuple[bool, str]:
    """
    Determine if trading is recommended right now.

    Returns:
        (should_trade: bool, reason: str)
    """
    session = get_session_info(utc_hour)

    if session.recommendation == "avoid":
        return False, f"Off-hours: No major session active (UTC {utc_hour or datetime.now(timezone.utc).hour}:00)"

    # JPY pairs are fine during Tokyo
    if "JPY" in pair and "tokyo" in session.name.lower():
        return True, f"JPY pair active during Tokyo session"

    if session.recommendation == "caution":
        return True, f"Caution: {session.name} - {session.volume_level} volume"

    return True, f"Active: {session.name} - {session.volume_level} volume"
