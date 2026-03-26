"""Capital.com REST API implementation of BaseBroker."""

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional

import aiohttp

from .base import AccountInfo, BaseBroker, Candle, OrderSide, Trade, TradeState

logger = logging.getLogger(__name__)


class RateLimiter:
    """Token bucket rate limiter."""

    def __init__(self, tokens_per_second: float = 10):
        self.tokens_per_second = tokens_per_second
        self.tokens = tokens_per_second
        self.last_update = time.time()
        self.lock = asyncio.Lock()

    async def acquire(self) -> None:
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


class CapitalBroker(BaseBroker):
    """Capital.com REST API broker implementation.

    Capital.com API docs: https://open-api.capital.com/
    Demo base: https://demo-api-capital.backend-capital.com
    Live base: https://api-capital.backend-capital.com
    """

    # Granularity mapping from OANDA-style to Capital.com
    GRANULARITY_MAP = {
        "S5": "MINUTE",
        "S10": "MINUTE",
        "S15": "MINUTE",
        "S30": "MINUTE",
        "M1": "MINUTE",
        "M2": "MINUTE_2",
        "M3": "MINUTE_3",
        "M5": "MINUTE_5",
        "M10": "MINUTE_10",
        "M15": "MINUTE_15",
        "M30": "MINUTE_30",
        "H1": "HOUR",
        "H2": "HOUR_2",
        "H3": "HOUR_3",
        "H4": "HOUR_4",
        "D": "DAY",
        "W": "WEEK",
    }

    def __init__(
        self,
        api_key: str,
        identifier: str,
        password: str,
        demo: bool = True,
        request_timeout: int = 30,
        max_retries: int = 3,
        retry_backoff: float = 1.0,
    ):
        """Initialize Capital.com broker.

        Args:
            api_key: Capital.com API key.
            identifier: Login email/identifier.
            password: Account password.
            demo: Use demo environment if True.
            request_timeout: Request timeout in seconds.
            max_retries: Maximum retry attempts.
            retry_backoff: Backoff multiplier for retries.
        """
        self.api_key = api_key
        self.identifier = identifier
        self.password = password
        self.demo = demo
        self.base_url = (
            "https://demo-api-capital.backend-capital.com"
            if demo
            else "https://api-capital.backend-capital.com"
        )
        self.request_timeout = request_timeout
        self.max_retries = max_retries
        self.retry_backoff = retry_backoff

        self._session: Optional[aiohttp.ClientSession] = None
        self._connected = False
        self._rate_limiter = RateLimiter(tokens_per_second=10)

        # Session tokens
        self._cst: Optional[str] = None
        self._security_token: Optional[str] = None
        self._session_expiry: float = 0
        self._account_id: Optional[str] = None

    async def connect(self) -> None:
        """Establish connection to Capital.com."""
        try:
            self._session = aiohttp.ClientSession()
            await self._ensure_auth()
            self._connected = True
            logger.info(
                f"Capital.com broker connected (account: {self._account_id}, "
                f"{'demo' if self.demo else 'live'})"
            )
        except Exception as e:
            if self._session:
                await self._session.close()
                self._session = None
            raise ConnectionError(f"Failed to connect to Capital.com: {e}") from e

    async def disconnect(self) -> None:
        """Close connection to Capital.com."""
        if self._session and self._cst:
            try:
                await self._request("DELETE", "/session")
            except Exception:
                pass
        if self._session:
            await self._session.close()
            self._session = None
        self._connected = False
        self._cst = None
        self._security_token = None
        logger.info("Capital.com broker disconnected")

    @property
    def is_connected(self) -> bool:
        return self._connected and self._session is not None

    async def _ensure_auth(self) -> None:
        """Ensure we have a valid session, creating one if needed."""
        if self._cst and self._security_token and time.time() < self._session_expiry:
            return

        url = f"{self.base_url}/api/v1/session"
        headers = {
            "Content-Type": "application/json",
            "X-CAP-API-KEY": self.api_key,
        }
        body = {
            "identifier": self.identifier,
            "password": self.password,
            "encryptedPassword": False,
        }

        async with self._session.request(
            "POST",
            url,
            json=body,
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=self.request_timeout),
        ) as resp:
            if resp.status != 200:
                error_text = await resp.text()
                raise RuntimeError(
                    f"Capital.com auth failed ({resp.status}): {error_text}"
                )

            self._cst = resp.headers.get("CST") or resp.headers.get("cst")
            self._security_token = (
                resp.headers.get("X-SECURITY-TOKEN")
                or resp.headers.get("x-security-token")
            )

            if not self._cst or not self._security_token:
                raise RuntimeError("Missing CST or X-SECURITY-TOKEN in response")

            data = await resp.json()
            self._account_id = data.get("currentAccountId")
            # Session valid for ~9 minutes
            self._session_expiry = time.time() + 9 * 60

    def _auth_headers(self) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "X-CAP-API-KEY": self.api_key,
            "CST": self._cst or "",
            "X-SECURITY-TOKEN": self._security_token or "",
        }

    async def get_account(self) -> AccountInfo:
        """Get account information."""
        self._check_connected()

        try:
            data = await self._request("GET", "/accounts")
            accounts = data.get("accounts", [])
            if not accounts:
                raise RuntimeError("No accounts found")

            acct = next((a for a in accounts if a.get("preferred")), accounts[0])
            bal = acct.get("balance", {})

            return AccountInfo(
                id=acct.get("accountId", ""),
                currency=acct.get("currency", "USD"),
                balance=float(bal.get("balance", 0)),
                used_margin=float(bal.get("deposit", 0)),
                available_margin=float(bal.get("available", 0)),
                margin_level=0,
                open_trades=0,
                open_orders=0,
                unrealized_pl=float(bal.get("profitLoss", 0)),
            )
        except Exception as e:
            raise RuntimeError(f"Failed to get account info: {e}") from e

    async def get_balance(self) -> float:
        account = await self.get_account()
        return account.balance

    async def get_open_trades(self) -> List[Trade]:
        """Get all open positions from Capital.com."""
        self._check_connected()

        try:
            data = await self._request("GET", "/positions")
            trades = []
            for pos_data in data.get("positions", []):
                trade = self._parse_position(pos_data)
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
        """Place a market order on Capital.com."""
        self._check_connected()
        self._validate_order_params(pair, units, sl, tp)

        try:
            epic = pair.replace("_", "")
            direction = "BUY" if units > 0 else "SELL"
            size = abs(units)

            body: Dict[str, Any] = {
                "epic": epic,
                "direction": direction,
                "size": size,
            }

            if sl is not None:
                body["stopLevel"] = sl
            if tp is not None:
                body["profitLevel"] = tp

            data = await self._request("POST", "/positions", json=body)
            deal_ref = data.get("dealReference", "")

            # Confirm the deal
            confirm = await self._request("GET", f"/confirms/{deal_ref}")
            deal_id = confirm.get("dealId", deal_ref)

            logger.info(
                f"Market order placed: {pair} {direction} {size} units (ID: {deal_id})"
            )
            return str(deal_id)
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
        """Place a limit/working order on Capital.com."""
        self._check_connected()
        self._validate_order_params(pair, units, sl, tp, price)

        try:
            epic = pair.replace("_", "")
            direction = "BUY" if units > 0 else "SELL"
            size = abs(units)

            body: Dict[str, Any] = {
                "epic": epic,
                "direction": direction,
                "size": size,
                "level": price,
                "type": "LIMIT",
            }

            if sl is not None:
                body["stopLevel"] = sl
            if tp is not None:
                body["profitLevel"] = tp

            data = await self._request("POST", "/workingorders", json=body)
            deal_ref = data.get("dealReference", "")

            confirm = await self._request("GET", f"/confirms/{deal_ref}")
            deal_id = confirm.get("dealId", deal_ref)

            logger.info(
                f"Limit order placed: {pair} {direction} {size} @ {price} (ID: {deal_id})"
            )
            return str(deal_id)
        except Exception as e:
            raise RuntimeError(f"Failed to place limit order: {e}") from e

    async def close_position(self, trade_id: str) -> float:
        """Close a position on Capital.com."""
        self._check_connected()

        if not trade_id:
            raise ValueError(f"Invalid trade ID: {trade_id}")

        try:
            data = await self._request("DELETE", f"/positions/{trade_id}")
            deal_ref = data.get("dealReference", "")

            # Confirm the close
            confirm = await self._request("GET", f"/confirms/{deal_ref}")
            profit = float(confirm.get("profit", 0))

            logger.info(f"Position closed: {trade_id} (P&L: {profit})")
            return profit
        except Exception as e:
            raise RuntimeError(f"Failed to close position: {e}") from e

    async def modify_trade(
        self,
        trade_id: str,
        sl: Optional[float] = None,
        tp: Optional[float] = None,
    ) -> None:
        """Modify SL/TP for a position on Capital.com."""
        self._check_connected()

        if not trade_id:
            raise ValueError(f"Invalid trade ID: {trade_id}")
        if sl is None and tp is None:
            raise ValueError("Must specify at least sl or tp")

        try:
            body: Dict[str, Any] = {}
            if sl is not None:
                body["stopLevel"] = sl
            if tp is not None:
                body["profitLevel"] = tp

            await self._request("PUT", f"/positions/{trade_id}", json=body)
            logger.info(f"Trade modified: {trade_id} (SL: {sl}, TP: {tp})")
        except Exception as e:
            raise RuntimeError(f"Failed to modify trade: {e}") from e

    async def get_candles(
        self,
        pair: str,
        granularity: str,
        count: int,
    ) -> List[Candle]:
        """Get historical candles from Capital.com."""
        self._check_connected()

        if not pair or not granularity:
            raise ValueError("pair and granularity are required")
        if count < 1 or count > 1000:
            raise ValueError("count must be between 1 and 1000")

        try:
            epic = pair.replace("_", "")
            resolution = self.GRANULARITY_MAP.get(granularity.upper(), "MINUTE_5")

            data = await self._request(
                "GET",
                f"/prices/{epic}",
                params={"resolution": resolution, "max": count},
            )

            candles = []
            for c in data.get("prices", []):
                bid_open = c.get("openPrice", {}).get("bid", 0)
                ask_open = c.get("openPrice", {}).get("ask", 0)
                bid_high = c.get("highPrice", {}).get("bid", 0)
                ask_high = c.get("highPrice", {}).get("ask", 0)
                bid_low = c.get("lowPrice", {}).get("bid", 0)
                ask_low = c.get("lowPrice", {}).get("ask", 0)
                bid_close = c.get("closePrice", {}).get("bid", 0)
                ask_close = c.get("closePrice", {}).get("ask", 0)

                candle = Candle(
                    time=c.get("snapshotTimeUTC", c.get("snapshotTime", "")),
                    open=(bid_open + ask_open) / 2,
                    high=(bid_high + ask_high) / 2,
                    low=(bid_low + ask_low) / 2,
                    close=(bid_close + ask_close) / 2,
                    volume=int(c.get("lastTradedVolume", 0)),
                )
                candles.append(candle)

            return candles
        except Exception as e:
            raise RuntimeError(f"Failed to get candles: {e}") from e

    # ─── Internal helpers ───

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make an authenticated HTTP request with retry logic."""
        await self._rate_limiter.acquire()

        # Ensure auth is fresh (except for auth endpoint itself)
        if endpoint != "/session":
            await self._ensure_auth()

        url = f"{self.base_url}/api/v1{endpoint}"
        headers = self._auth_headers()

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
                        # Session expired, refresh
                        self._cst = None
                        self._security_token = None
                        self._session_expiry = 0
                        await self._ensure_auth()
                        headers = self._auth_headers()
                        continue

                    if resp.status >= 500:
                        last_error = RuntimeError(
                            f"Server error ({resp.status}): {await resp.text()}"
                        )
                        if attempt < self.max_retries - 1:
                            await asyncio.sleep(self.retry_backoff ** attempt)
                            continue
                        raise last_error

                    if resp.status >= 400:
                        error_body = await resp.text()
                        raise RuntimeError(
                            f"Client error ({resp.status}): {error_body}"
                        )

                    content_type = resp.headers.get("content-type", "")
                    if "application/json" in content_type:
                        return await resp.json()
                    return {"status": "ok"}

            except asyncio.TimeoutError as e:
                last_error = RuntimeError(f"Request timeout: {e}")
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_backoff ** attempt)
                    continue
                raise last_error
            except RuntimeError:
                raise
            except Exception as e:
                last_error = e
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_backoff ** attempt)
                    continue
                raise RuntimeError(
                    f"Request failed after {self.max_retries} attempts: {e}"
                ) from e

        raise RuntimeError(
            f"Request failed after {self.max_retries} attempts: {last_error}"
        )

    def _check_connected(self) -> None:
        if not self.is_connected:
            raise ConnectionError("Broker is not connected. Call connect() first.")

    @staticmethod
    def _parse_position(pos_data: Dict[str, Any]) -> Trade:
        """Parse a Capital.com position into a Trade object."""
        pos = pos_data.get("position", {})
        mkt = pos_data.get("market", {})

        direction = pos.get("direction", "BUY")
        size = float(pos.get("size", 0))
        entry_price = float(pos.get("level", 0))
        current_bid = float(mkt.get("bid", 0))
        current_ask = float(mkt.get("offer", 0))
        current_price = current_bid if direction == "BUY" else current_ask

        price_diff = (
            (current_price - entry_price) if direction == "BUY"
            else (entry_price - current_price)
        )
        unrealized_pl = price_diff * size

        return Trade(
            id=str(pos.get("dealId", "")),
            pair=mkt.get("epic", ""),
            side=OrderSide.BUY if direction == "BUY" else OrderSide.SELL,
            units=size if direction == "BUY" else -size,
            entry_price=entry_price,
            current_price=current_price,
            stop_loss=float(pos["stopLevel"]) if pos.get("stopLevel") else None,
            take_profit=float(pos["limitLevel"]) if pos.get("limitLevel") else None,
            unrealized_pl=unrealized_pl,
            open_time=pos.get("createdDateUTC", pos.get("createdDate")),
            commission=0,
        )

    @staticmethod
    def _validate_order_params(
        pair: str,
        units: float,
        sl: Optional[float],
        tp: Optional[float],
        price: Optional[float] = None,
    ) -> None:
        if not pair or not isinstance(pair, str):
            raise ValueError("pair must be a non-empty string")
        if not units or units == 0:
            raise ValueError("units must be non-zero")
        if abs(units) < 0.01:
            raise ValueError("units must be at least 0.01 in absolute value")
        if sl is not None and tp is not None:
            if units > 0 and (sl >= tp):
                raise ValueError("For long trades, SL must be < TP")
            elif units < 0 and (sl <= tp):
                raise ValueError("For short trades, SL must be > TP")
        if price is not None and price <= 0:
            raise ValueError("price must be positive")
