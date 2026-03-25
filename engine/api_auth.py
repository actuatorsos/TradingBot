"""
APEX TRADER AI - API Authentication
====================================
Simple bearer token authentication for the engine REST API.
"""

import os
import hashlib
import secrets
import logging
from aiohttp import web

log = logging.getLogger("apex.auth")


def generate_api_key() -> str:
    """Generate a new API key."""
    return f"apex_{secrets.token_hex(24)}"


class APIAuthMiddleware:
    """Bearer token authentication middleware for aiohttp."""

    def __init__(self, api_key: str = None):
        """
        Args:
            api_key: API key to validate against. If None, reads from
                     APEX_API_KEY env var. If neither, auth is disabled.
        """
        self.api_key = api_key or os.environ.get("APEX_API_KEY", "")
        self.enabled = bool(self.api_key)

        if self.enabled:
            # Store hash instead of raw key
            self.key_hash = hashlib.sha256(self.api_key.encode()).hexdigest()
            log.info(f"API authentication enabled (key hash: {self.key_hash[:12]}...)")
        else:
            self.key_hash = ""
            log.warning("API authentication DISABLED - no APEX_API_KEY set")

    def _check_key(self, provided_key: str) -> bool:
        """Constant-time comparison of API key."""
        provided_hash = hashlib.sha256(provided_key.encode()).hexdigest()
        return secrets.compare_digest(self.key_hash, provided_hash)

    @web.middleware
    async def middleware(self, request: web.Request, handler):
        """aiohttp middleware for request authentication."""
        # Always allow health checks
        if request.path == "/health":
            return await handler(request)

        # Skip auth if not enabled
        if not self.enabled:
            return await handler(request)

        # Check Authorization header
        auth_header = request.headers.get("Authorization", "")

        if not auth_header:
            # Also check query parameter as fallback
            api_key = request.query.get("api_key", "")
            if not api_key:
                return web.json_response(
                    {"error": "Missing API key. Use Authorization: Bearer <key> header."},
                    status=401,
                )
        else:
            if not auth_header.startswith("Bearer "):
                return web.json_response(
                    {"error": "Invalid auth format. Use: Authorization: Bearer <key>"},
                    status=401,
                )
            api_key = auth_header[7:]

        if not self._check_key(api_key):
            log.warning(f"Invalid API key attempt from {request.remote}")
            return web.json_response(
                {"error": "Invalid API key"},
                status=403,
            )

        return await handler(request)


class RateLimiter:
    """Simple in-memory rate limiter."""

    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window = window_seconds
        self.requests: dict[str, list[float]] = {}

    @web.middleware
    async def middleware(self, request: web.Request, handler):
        """Rate limiting middleware."""
        import time

        client_ip = request.remote or "unknown"
        now = time.time()

        # Clean old entries
        if client_ip in self.requests:
            self.requests[client_ip] = [
                t for t in self.requests[client_ip]
                if now - t < self.window
            ]
        else:
            self.requests[client_ip] = []

        # Check limit
        if len(self.requests[client_ip]) >= self.max_requests:
            return web.json_response(
                {"error": "Rate limit exceeded. Try again later."},
                status=429,
                headers={"Retry-After": str(self.window)},
            )

        self.requests[client_ip].append(now)
        return await handler(request)
