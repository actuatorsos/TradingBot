"""
APEX TRADER AI - Structured Logging & Monitoring
================================================
Centralized logging with rotation, structured format, and error tracking.
"""

import logging
import logging.handlers
import json
import os
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


class StructuredFormatter(logging.Formatter):
    """JSON-structured log formatter for machine parsing."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        if record.exc_info and record.exc_info[0]:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "traceback": traceback.format_exception(*record.exc_info),
            }
        if hasattr(record, "extra_data"):
            log_entry["data"] = record.extra_data
        return json.dumps(log_entry)


class ErrorTracker:
    """Tracks error frequency for circuit-breaker style monitoring."""

    def __init__(self, max_errors: int = 50):
        self.errors: list[dict] = []
        self.max_errors = max_errors
        self.error_counts: dict[str, int] = {}

    def record(self, error: Exception, context: str = "") -> None:
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "type": type(error).__name__,
            "message": str(error),
            "context": context,
        }
        self.errors.append(entry)
        if len(self.errors) > self.max_errors:
            self.errors.pop(0)

        key = f"{type(error).__name__}:{context}"
        self.error_counts[key] = self.error_counts.get(key, 0) + 1

    def get_summary(self) -> dict:
        return {
            "total_errors": len(self.errors),
            "recent_errors": self.errors[-10:],
            "error_frequency": dict(sorted(self.error_counts.items(), key=lambda x: x[1], reverse=True)[:10]),
        }


def setup_logging(
    log_dir: str = "logs",
    level: str = "INFO",
    structured: bool = True,
) -> ErrorTracker:
    """
    Configure application-wide logging.

    Returns:
        ErrorTracker instance for monitoring.
    """
    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)

    root = logging.getLogger("apex")
    root.setLevel(getattr(logging, level.upper(), logging.INFO))
    root.handlers.clear()

    # Console handler (human-readable)
    console = logging.StreamHandler()
    console.setLevel(logging.INFO)
    console.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S"
    ))
    root.addHandler(console)

    # File handler (structured JSON, rotating)
    if structured:
        file_handler = logging.handlers.RotatingFileHandler(
            log_path / "engine.jsonl",
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5,
            encoding="utf-8",
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(StructuredFormatter())
        root.addHandler(file_handler)

    # Error-only file handler
    error_handler = logging.handlers.RotatingFileHandler(
        log_path / "errors.jsonl",
        maxBytes=5 * 1024 * 1024,  # 5MB
        backupCount=3,
        encoding="utf-8",
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(StructuredFormatter())
    root.addHandler(error_handler)

    error_tracker = ErrorTracker()

    logging.getLogger("apex").info("Logging initialized", extra={
        "log_dir": str(log_path.absolute()),
        "level": level,
        "structured": structured,
    })

    return error_tracker
