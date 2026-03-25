"""Central configuration loader for Apex Trader AI engine."""

import json
import logging
import os
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class OandaConfig:
    """OANDA broker configuration."""
    api_key: str
    account_id: Optional[str] = None
    base_url: str = "https://api-fxpractice.oanda.com"
    request_timeout: int = 30


@dataclass
class TradingConfig:
    """Trading parameters configuration."""
    default_lot_size: float = 1.0
    max_open_trades: int = 5
    max_daily_losses: float = 1000.0
    max_position_size: float = 10.0
    default_sl_pips: int = 50
    default_tp_pips: int = 100


@dataclass
class RiskConfig:
    """Risk management parameters."""
    risk_per_trade_percent: float = 2.0
    max_leverage: float = 50.0
    correlation_threshold: float = 0.7
    max_concurrent_pairs: int = 5
    stop_loss_required: bool = True
    take_profit_required: bool = True


@dataclass
class NotificationConfig:
    """Notification settings."""
    enabled: bool = True
    webhook_url: Optional[str] = None
    email_enabled: bool = False
    email_recipient: Optional[str] = None
    notify_trade_open: bool = True
    notify_trade_close: bool = True
    notify_errors: bool = True
    slack_webhook: Optional[str] = None


@dataclass
class EngineConfig:
    """Complete engine configuration."""
    oanda: OandaConfig
    trading: TradingConfig
    risk: RiskConfig
    notifications: NotificationConfig
    paper_trading: bool = True
    log_level: str = "INFO"
    heartbeat_interval: int = 60
    reconnect_timeout: int = 30


class ConfigLoader:
    """Loads and manages engine configuration."""

    def __init__(self, config_file: Optional[str] = None, env_prefix: str = "APEX_"):
        """Initialize config loader.

        Args:
            config_file: Path to settings.json file. If None, uses default locations.
            env_prefix: Prefix for environment variables (e.g., APEX_OANDA_API_KEY).
        """
        self.env_prefix = env_prefix
        self.config_file = config_file or self._find_config_file()
        self.config: Optional[EngineConfig] = None

    @staticmethod
    def _find_config_file() -> Optional[str]:
        """Find settings.json in standard locations."""
        search_paths = [
            Path("settings.json"),
            Path("config/settings.json"),
            Path.home() / ".apex_trader" / "settings.json",
        ]
        for path in search_paths:
            if path.exists():
                logger.info(f"Found config file at {path}")
                return str(path)
        return None

    def load(self) -> EngineConfig:
        """Load configuration from file and environment variables.

        Priority: Environment variables > settings.json > defaults

        Returns:
            EngineConfig: Complete configuration object.
        """
        # Start with defaults
        config_dict = self._get_defaults()

        # Override with settings.json if it exists
        if self.config_file and Path(self.config_file).exists():
            logger.info(f"Loading config from {self.config_file}")
            with open(self.config_file) as f:
                file_config = json.load(f)
                self._deep_update(config_dict, file_config)

        # Override with environment variables
        config_dict = self._override_from_env(config_dict)

        # Validate required fields
        self._validate_config(config_dict)

        # Build config objects
        self.config = EngineConfig(
            oanda=OandaConfig(**config_dict["oanda"]),
            trading=TradingConfig(**config_dict["trading"]),
            risk=RiskConfig(**config_dict["risk"]),
            notifications=NotificationConfig(**config_dict["notifications"]),
            paper_trading=config_dict.get("paper_trading", True),
            log_level=config_dict.get("log_level", "INFO"),
            heartbeat_interval=config_dict.get("heartbeat_interval", 60),
            reconnect_timeout=config_dict.get("reconnect_timeout", 30),
        )

        logger.info(f"Configuration loaded successfully (paper_trading={self.config.paper_trading})")
        return self.config

    @staticmethod
    def _get_defaults() -> dict:
        """Get default configuration values."""
        return {
            "oanda": {
                "api_key": "",
                "account_id": None,
                "base_url": "https://api-fxpractice.oanda.com",
                "request_timeout": 30,
            },
            "trading": {
                "default_lot_size": 1.0,
                "max_open_trades": 5,
                "max_daily_losses": 1000.0,
                "max_position_size": 10.0,
                "default_sl_pips": 50,
                "default_tp_pips": 100,
            },
            "risk": {
                "risk_per_trade_percent": 2.0,
                "max_leverage": 50.0,
                "correlation_threshold": 0.7,
                "max_concurrent_pairs": 5,
                "stop_loss_required": True,
                "take_profit_required": True,
            },
            "notifications": {
                "enabled": True,
                "webhook_url": None,
                "email_enabled": False,
                "email_recipient": None,
                "notify_trade_open": True,
                "notify_trade_close": True,
                "notify_errors": True,
                "slack_webhook": None,
            },
            "paper_trading": True,
            "log_level": "INFO",
            "heartbeat_interval": 60,
            "reconnect_timeout": 30,
        }

    def _override_from_env(self, config_dict: dict) -> dict:
        """Override config with environment variables."""
        # OANDA settings
        if api_key := os.getenv(f"{self.env_prefix}OANDA_API_KEY"):
            config_dict["oanda"]["api_key"] = api_key
        if account_id := os.getenv(f"{self.env_prefix}OANDA_ACCOUNT_ID"):
            config_dict["oanda"]["account_id"] = account_id
        if base_url := os.getenv(f"{self.env_prefix}OANDA_BASE_URL"):
            config_dict["oanda"]["base_url"] = base_url

        # Trading settings
        if lot_size := os.getenv(f"{self.env_prefix}TRADING_LOT_SIZE"):
            config_dict["trading"]["default_lot_size"] = float(lot_size)
        if max_trades := os.getenv(f"{self.env_prefix}TRADING_MAX_OPEN"):
            config_dict["trading"]["max_open_trades"] = int(max_trades)
        if max_loss := os.getenv(f"{self.env_prefix}TRADING_MAX_LOSS"):
            config_dict["trading"]["max_daily_losses"] = float(max_loss)

        # Risk settings
        if risk_pct := os.getenv(f"{self.env_prefix}RISK_PER_TRADE"):
            config_dict["risk"]["risk_per_trade_percent"] = float(risk_pct)
        if max_leverage := os.getenv(f"{self.env_prefix}RISK_MAX_LEVERAGE"):
            config_dict["risk"]["max_leverage"] = float(max_leverage)

        # Notification settings
        if webhook := os.getenv(f"{self.env_prefix}NOTIFY_WEBHOOK"):
            config_dict["notifications"]["webhook_url"] = webhook
        if slack := os.getenv(f"{self.env_prefix}NOTIFY_SLACK"):
            config_dict["notifications"]["slack_webhook"] = slack

        # Global settings
        if paper_trading := os.getenv(f"{self.env_prefix}PAPER_TRADING"):
            config_dict["paper_trading"] = paper_trading.lower() in ("true", "1", "yes")
        if log_level := os.getenv(f"{self.env_prefix}LOG_LEVEL"):
            config_dict["log_level"] = log_level.upper()

        return config_dict

    @staticmethod
    def _deep_update(base: dict, updates: dict) -> None:
        """Recursively update base dict with updates."""
        for key, value in updates.items():
            if isinstance(value, dict) and key in base and isinstance(base[key], dict):
                ConfigLoader._deep_update(base[key], value)
            else:
                base[key] = value

    @staticmethod
    def _validate_config(config_dict: dict) -> None:
        """Validate required configuration fields."""
        if not config_dict["oanda"]["api_key"]:
            raise ValueError(
                "OANDA API key is required. Set via APEX_OANDA_API_KEY env var or config file."
            )

    def to_dict(self) -> dict:
        """Export current config as dictionary (excluding sensitive data)."""
        if not self.config:
            raise RuntimeError("Configuration not loaded. Call load() first.")

        config_dict = asdict(self.config)
        # Mask API key for safety
        config_dict["oanda"]["api_key"] = "***MASKED***"
        return config_dict

    def __repr__(self) -> str:
        """String representation of config."""
        if not self.config:
            return "EngineConfig(not loaded)"
        return f"EngineConfig(paper_trading={self.config.paper_trading}, log_level={self.config.log_level})"


def get_config(config_file: Optional[str] = None) -> EngineConfig:
    """Convenience function to load and return config."""
    loader = ConfigLoader(config_file)
    return loader.load()
