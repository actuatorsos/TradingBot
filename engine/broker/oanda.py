"""OANDA v20 REST API implementation of BaseBroker."""

import asyncio
import json
import logging
import time
from typing import Any, Dict, List, Optional

import aiohttp

from .base import AccountInfo, BaseBroker, Candle, OrderSide, Trade, TradeState

logger = logging.getLogger(__name__)


class RateLimiter:
    """Token bucket rate limiter."""

    def __init__(self, tokens_per_second: float = 30):
        """Initialize rate limiter.

        Args:
            tokens_per_second: Number of allowed requests per second.
        """
        self.tokens_per_second = tokens_per_second
        self.tokens = tokens_per_second
        self.last_update = time.time()
        self.lock = asyncio.Lock()

    async def acquire(self) -> None:
        """Acquire a token, waiting if necessary."""
        async with self.lock:
            now = time.time()
            elapsed = now - self.last_update
            self.tokens = min(
                self.tokens_per_second,
                self.tokens + elapsed * self.tokens_per_second,
            )
            self.last_update = now

            if self.tokens < 1:
                sleep_time = (1 - self.tokens) / self.tokens_per_second
                await asyncio.sleep(sleep_time)
                self.tokens = 0
            else:
                self.tokens -= 1


class OandaBroker(BaseBroker):
    """OANDA v20 REST API broker implementation."""

    def __init__(
        self,
        api_key: str,
        account_id: Optional[str] = None,
        base_url: str = "https://api-fxpractice.oanda.com",
        request_timeout: int = 30,
        max_retries: int = 3,
        retry_backoff: float = 1.0,
    ):
        """Initialize OANDA broker.

        Args:
            api_key: OANDA API key.
            account_id: Account ID (will be fetched if not provided).
            base_url: Base URL for OANDA API.
            request_timeout: Request timeout in seconds.
            max_retries: Maximum number of retry attempts.
            retry_backoff: Backoff multiplier for retries.
        """
        self.api_key = api_key
        self.account_id = account_id
        self.base_url = base_url.rstrip("/")
        self.request_timeout = request_timeout
        self.max_retries = max_retries
        self.retry_backoff = retry_backoff

        self._session: Optional[aiohttp.ClientSession] = None
        self._connected = False
        self._rate_limiter = RateLimiter(tokens_per_second=30)
        self._last_health_check = 0
        self._health_check_interval = 60  # seconds

    async def connect(self) -> None:
        """Establish connection to OANDA.

        Fetches account ID if not already set.

        Raises:
            ConnectionError: If connection fails.
        """
        try:
            self._session = aiohttp.ClientSession()

            # Fetch account ID if not set
            if not self.account_id:
                self.account_id = await self._get_account_id()
                logger.info(f"Connected to OANDA account: {self.account_id}")

            # Verify connection with a simple API call
            await self.get_account()
            self._connected = True
            logger.info("OANDA broker connected successfully")
        except Exception as e:
            if self._session:
                await self._session.close()
                self._session = None
            raise ConnectionError(f"Failed to connect to OANDA: {e}") from e

    async def disconnect(self) -> None:
        """Close connection to OANDA."""
        if self._session:
            await self._session.close()
            self._session = None
        self._connected = False
        logger.info("OANDA broker disconnected")

    @property
    def is_connected(self) -> bool:
        """Check if broker is connected."""
        return self._connected and self._session is not None

    async def get_account(self) -> AccountInfo:
        """Get account information.

        Returns:
            AccountInfo: Current account details.

        Raises:
            ConnectionError: If broker is not connected.
            RuntimeError: If API call fails.
        """
        self._check_connected()

        try:
            data = await self._request(
                "GET",
                f"/v3/accounts/{self.account_id}/summary",
            )
            account = data["account"]
            return AccountInfo(
                id=account["id"],
                currency=account["currency"],
                balance=float(account["balance"]),
                used_margin=float(account["marginUsed"]),
                available_margin=float(account["marginAvailable"]),
                margin_level=float(account.get("marginCloseoutMarginUsed", 0)),
                open_trades=account.get("openTradeCount", 0),
                open_orders=account.get("openOrderCount", 0),
                unrealized_pl=float(account.get("unrealizedPL", 0)),
            )
        except Exception as e:
            raise RuntimeError(f"Failed to get account info: {e}") from e

    async def get_balance(self) -> float:
        """Get current account balance.

        Returns:
            float: Account balance.

        Raises:
            ConnectionError: If broker is not connected.
            RuntimeError: If API call fails.
        """
        account = await self.get_account()
        return account.balance

    async def get_open_trades(self) -> List[Trade]:
        """Get all open trades.

        Returns:
            List[Trade]: List of open trades.

        Raises:
            ConnectionError: If broker is not connected.
            RuntimeError: If API call fails.
        """
        self._check_connected()

        try:
            data = await self._request(
                "GET",
                f"/v3/accounts/{self.account_id}/openTrades",
            )
            trades = []
            for trade_data in data.get("trades", []):
                trade = self._parse_trade(trade_data)
                trades.append(trade)
            return trades
        except Exception as e:
            raise RuntimeError(f"Failed to get open trades: {e}") from e

    async def place_market_order(
        self,
        pair: str,
        units: float,
        sl: Optional[float] = None,
        tp: Optional[float] = None,
    ) -> str:
        """Place a market order.

        Args:
            pair: Currency pair (e.g., "EUR_USD").
            units: Number of units (positive for long, negative for short).
            sl: Stop loss price (optional).
            tp: Take profit price (optional).

        Returns:
            str: Trade ID.

        Raises:
            ConnectionError: If broker is not connected.
            ValueError: If parameters are invalid.
            RuntimeError: If API call fails.
        """
        self._check_connected()
        self._validate_order_params(pair, units, sl, tp)

        try:
            order_body = {
                "order": {
                    "instrument": pair,
                    "units": str(int(units)),
                    "type": "MARKET",
                    "priceBound": str(self._calculate_price_bound(units)),
                }
            }

            # Add stop loss
            if sl is not None:
                order_body["order"]["stopLossOnFill"] = {
                    "price": str(sl),
                }

            # Add take profit
            if tp is not None:
                order_body["order"]["takeProfitOnFill"] = {
                    "price": str(tp),
                }

            data = await self._request(
                "POST",
                f"/v3/accounts/{self.account_id}/orders",
                json=order_body,
            )

            trade_id = str(data["orderFillTransaction"]["tradeOpened"]["tradeID"])
            logger.info(
                f"Market order placed: {pair} {units} units (ID: {trade_id})"
            )
            return trade_id
        except Exception as e:
            raise RuntimeError(f"Failed to place market order: {e}") from e

    async def place_limit_order(
        self,
        pair: str,
        units: float,
        price: float,
        sl: Optional[float] = None,
        tp: Optional[float] = None,
    ) -> str:
        """Place a limit order.

        Args:
            pair: Currency pair.
            units: Number of units.
            price: Limit order price.
            sl: Stop loss price (optional).
            tp: Take profit price (optional).

        Returns:
            str: Order ID.

        Raises:
            ConnectionError: If broker is not connected.
            ValueError: If parameters are invalid.
            RuntimeError: If API call fails.
        """
        self._check_connected()
        self._validate_order_params(pair, units, sl, tp, price)

        try:
            order_body = {
                "order": {
                    "instrument": pair,
                    "units": str(int(units)),
                    "price": str(price),
                    "type": "LIMIT",
                    "timeInForce": "GTC",
                }
            }

            if sl is not None:
                order_body["order"]["stopLossOnFill"] = {"price": str(sl)}

            if tp is not None:
                order_body["order"]["takeProfitOnFill"] = {"price": str(tp)}

            data = await self._request(
                "POST",
                f"/v3/accounts/{self.account_id}/orders",
                json=order_body,
            )

            order_id = str(data["orderCreateTransaction"]["id"])
            logger.info(
                f"Limit order placed: {pair} {units} units @ {price} (ID: {order_id})"
            )
            return order_id
        except Exception as e:
            raise RuntimeError(f"Failed to place limit order: {e}") from e

    async def close_position(self, trade_id: str) -> float:
        """Close a position.

        Args:
            trade_id: Trade ID to close.

        Returns:
            float: Realized P&L.

        Raises:
            ConnectionError: If broker is not connected.
            ValueError: If trade ID is invalid.
            RuntimeError: If API call fails.
        """
        self._check_connected()

        if not trade_id or not isinstance(trade_id, str):
            raise ValueError(f"Invalid trade ID: {trade_id}")

        try:
            close_body = {"longUnits": "ALL", "shortUnits": "ALL"}
            data = await self._request(
                "PUT",
                f"/v3/accounts/{self.account_id}/trades/{trade_id}/close",
                json=close_body,
            )

            realized_pl = float(
                data.get("orderFillTransaction", {}).get("pl", 0)
            )
            logger.info(f"Position closed: {trade_id} (P&L: {realized_pl})")
            return realized_pl
        except Exception as e:
            raise RuntimeError(f"Failed to close position: {e}") from e

    async def modify_trade(
        self,
        trade_id: str,
        sl: Optional[float] = None,
        tp: Optional[float] = None,
    ) -> None:
        """Modify stop loss and/or take profit.

        Args:
            trade_id: Trade ID to modify.
            sl: New stop loss price (None to leave unchanged).
            tp: New take profit price (None to leave unchanged).

        Raises:
            ConnectionError: If broker is not connected.
            ValueError: If parameters are invalid.
            RuntimeError: If API call fails.
        """
        self._check_connected()

        if not trade_id:
            raise ValueError(f"Invalid trade ID: {trade_id}")

        if sl is None and tp is None:
            raise ValueError("Must specify at least sl or tp")

        try:
            orders_body = {}

            if sl is not None:
                orders_body["stopLoss"] = {
                    "price": str(sl),
                }

            if tp is not None:
                orders_body["takeProfit"] = {
                    "price": str(tp),
                }

            await self._request(
                "PUT",
                f"/v3/accounts/{self.account_id}/trades/{trade_id}/orders",
                json=orders_body,
            )

            logger.info(f"Trade modified: {trade_id} (SL: {sl}, TP: {tp})")
        except Exception as e:
            raise RuntimeError(f"Failed to modify trade: {e}") from e

    async def get_candles(
        self,
        pair: str,
        granularity: str,
        count: int,
    ) -> List[Candle]:
        """Get historical candles.

        Args:
            pair: Currency pair.
            granularity: Candle timeframe (M1, H1, D, etc.).
            count: Number of candles to retrieve.

        Returns:
            List[Candle]: Historical candle data.

        Raises:
            ConnectionError: If broker is not connected.
            ValueError: If parameters are invalid.
            RuntimeError: If API call fails.
        """
        self._check_connected()

        if not pair or not granularity:
            raise ValueError("pair and granularity are required")

        if count < 1 or count > 5000:
            raise ValueError("count must be between 1 and 5000")

        try:
            params = {
                "granularity": granularity.upper(),
                "count": count,
                "price": "MBA",  # Mid, Bid, Ask prices
            }
            data = await self._request(
                "GET",
                f"/v3/instruments/{pair}/candles",
                params=params,
            )

            candles = []
            for candle_data in data.get("candles", []):
                if candle_data.get("complete", False):
                    bid = candle_data["bid"]
                    candle = Candle(
                        time=candle_data["time"],
                        open=float(bid["o"]),
                        high=float(bid["h"]),
                        low=float(bid["l"]),
                        close=float(bid["c"]),
                        volume=int(candle_data.get("volume", 0)),
                    )
                    candles.append(candle)

            return candles
        except Exception as e:
            raise RuntimeError(f"Failed to get candles: {e}") from e

    async def _get_account_id(self) -> str:
        """Fetch the account ID from OANDA.

        Returns:
            str: Account ID.

        Raises:
            RuntimeError: If account lookup fails.
        """
        try:
            data = await self._request("GET", "/v3/accounts")
            if data.get("accounts"):
                account_id = data["accounts"][0]["id"]
                logger.info(f"Fetched account ID: {account_id}")
                return account_id
            raise RuntimeError("No accounts found")
        except Exception as e:
            raise RuntimeError(f"Failed to fetch account ID: {e}") from e

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make an HTTP request with retry logic and rate limiting.

        Args:
            method: HTTP method (GET, POST, PUT, etc.).
            endpoint: API endpoint path.
            params: Query parameters.
            json: JSON body.

        Returns:
            Dict: Parsed JSON response.

        Raises:
            RuntimeError: If request fails after retries.
        """
        # Rate limiting
        await self._rate_limiter.acquire()

        # Health check
        await self._check_health()

        url = f"{self.base_url}{endpoint}"
        headers = self._get_headers()

        last_error = None
        for attempt in range(self.max_retries):
            try:
                async with self._session.request(
                    method,
                    url,
                    params=params,
                    json=json,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=self.request_timeout),
                ) as resp:
                    if resp.status == 401:
                        raise RuntimeError("Unauthorized: Invalid API key")
                    elif resp.status == 404:
                        raise RuntimeError(f"Not found: {url}")
                    elif resp.status >= 500:
                        # Server error, retry
                        last_error = RuntimeError(
                            f"Server error ({resp.status}): {await resp.text()}"
                        )
                        if attempt < self.max_retries - 1:
                            wait_time = (self.retry_backoff ** attempt)
                            logger.warning(
                                f"Request failed ({resp.status}), retrying in {wait_time}s"
                            )
                            await asyncio.sleep(wait_time)
                            continue
                        raise last_error
                    elif resp.status >= 400:
                        error_body = await resp.text()
                        raise RuntimeError(
                            f"Client error ({resp.status}): {error_body}"
                        )

                    response_data = await resp.json()
                    return response_data

            except asyncio.TimeoutError as e:
                last_error = RuntimeError(f"Request timeout: {e}")
                if attempt < self.max_retries - 1:
                    wait_time = self.retry_backoff ** attempt
                    logger.warning(
                        f"Request timeout, retrying in {wait_time}s"
                    )
                    await asyncio.sleep(wait_time)
                    continue
                raise last_error
            except Exception as e:
                last_error = e
                if attempt < self.max_retries - 1:
                    wait_time = self.retry_backoff ** attempt
                    logger.warning(
                        f"Request failed: {e}, retrying in {wait_time}s"
                    )
                    await asyncio.sleep(wait_time)
                    continue
                raise RuntimeError(f"Request failed after {self.max_retries} attempts: {e}") from e

        raise RuntimeError(f"Request failed after {self.max_retries} attempts: {last_error}")

    def _get_headers(self) -> Dict[str, str]:
        """Get headers for OANDA API requests."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept-Datetime-Format": "UNIX",
        }

    def _check_connected(self) -> None:
        """Check if broker is connected, raise error if not."""
        if not self.is_connected:
            raise ConnectionError("Broker is not connected. Call connect() first.")

    async def _check_health(self) -> None:
        """Periodic health check to verify connection is still active."""
        now = time.time()
        if now - self._last_health_check > self._health_check_interval:
            try:
                await self.get_account()
                self._last_health_check = now
            except Exception as e:
                logger.error(f"Health check failed: {e}")
                self._connected = False
                raise ConnectionError(f"Connection health check failed: {e}") from e

    @staticmethod
    def _parse_trade(trade_data: Dict[str, Any]) -> Trade:
        """Parse a trade from OANDA API response."""
        return Trade(
            id=str(trade_data["id"]),
            pair=trade_data["instrument"],
            side=OrderSide.BUY if float(trade_data["units"]) > 0 else OrderSide.SELL,
            units=float(trade_data["units"]),
            entry_price=float(trade_data["openPrice"]),
            current_price=float(trade_data.get("price", 0)),
            stop_loss=(
                float(trade_data["stopLossOrder"]["price"])
                if trade_data.get("stopLossOrder")
                else None
            ),
            take_profit=(
                float(trade_data["takeProfitOrder"]["price"])
                if trade_data.get("takeProfitOrder")
                else None
            ),
            unrealized_pl=float(trade_data.get("unrealizedPL", 0)),
            open_time=trade_data.get("openTime"),
            commission=float(trade_data.get("financing", 0)),
        )

    @staticmethod
    def _validate_order_params(
        pair: str,
        units: float,
        sl: Optional[float],
        tp: Optional[float],
        price: Optional[float] = None,
    ) -> None:
        """Validate order parameters."""
        if not pair or not isinstance(pair, str):
            raise ValueError("pair must be a non-empty string")

        if not units or units == 0:
            raise ValueError("units must be non-zero")

        if abs(units) < 1:
            raise ValueError("units must be at least 1 in absolute value")

        if sl is not None and tp is not None:
            if units > 0 and (sl >= tp):
                raise ValueError("For long trades, SL must be < TP")
            elif units < 0 and (sl <= tp):
                raise ValueError("For short trades, SL must be > TP")

        if price is not None and price <= 0:
            raise ValueError("price must be positive")

    @staticmethod
    def _calculate_price_bound(units: float) -> float:
        """Calculate a reasonable price bound for market orders.

        Args:
            units: Order units.

        Returns:
            float: Price bound percentage (e.g., 0.05 = 0.05% slippage tolerance).
        """
        # Conservative slippage tolerance: 0.05%
        return 0.0005
