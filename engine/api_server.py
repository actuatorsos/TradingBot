"""
APEX TRADER AI - Dashboard API Server
=====================================
Lightweight HTTP server that exposes the engine's state
to the Vercel dashboard. Runs alongside the main engine.

Endpoints:
  GET /health          - Health check
  GET /api/dashboard   - Full engine state
  GET /api/trades      - Trade history
  GET /api/positions   - Open positions
  GET /api/equity      - Equity curve data
"""

import asyncio
import json
import os
import logging
from datetime import datetime, timezone
from aiohttp import web

log = logging.getLogger("apex.api")


class DashboardAPI:
    """HTTP API server for dashboard integration."""

    def __init__(self, engine):
        self.engine = engine
        self.app = web.Application()
        self._setup_routes()
        self._equity_history = []

    def _setup_routes(self):
        self.app.router.add_get("/health", self.health)
        self.app.router.add_get("/api/dashboard", self.dashboard)
        self.app.router.add_get("/api/trades", self.trades)
        self.app.router.add_get("/api/positions", self.positions)
        self.app.router.add_get("/api/equity", self.equity)

        # CORS middleware
        @web.middleware
        async def cors_middleware(request, handler):
            response = await handler(request)
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type"
            return response

        self.app.middlewares.append(cors_middleware)

    async def health(self, request):
        return web.json_response({
            "status": "healthy",
            "engine_running": self.engine.running,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    async def dashboard(self, request):
        data = self.engine.get_dashboard_data()
        return web.json_response(data)

    async def trades(self, request):
        data = self.engine.get_dashboard_data()
        return web.json_response({
            "trades": data.get("trades", []),
            "total": len(data.get("trades", [])),
        })

    async def positions(self, request):
        data = self.engine.get_dashboard_data()
        all_trades = data.get("trades", [])
        open_positions = [t for t in all_trades if t.get("status") == "open"]
        return web.json_response({
            "positions": open_positions,
            "total": len(open_positions),
        })

    async def equity(self, request):
        # Record current equity point
        if self.engine.running:
            if self.engine.paper_mode and hasattr(self.engine.broker, 'balance'):
                balance = self.engine.broker.balance
                peak = getattr(self.engine.broker, 'peak_balance', balance)
                drawdown = ((peak - balance) / peak * 100) if peak > 0 else 0
                self._equity_history.append({
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "balance": round(balance, 2),
                    "equity": round(balance, 2),
                    "drawdown_pct": round(drawdown, 2),
                })
                # Keep last 30 days of hourly data
                max_points = 30 * 24
                if len(self._equity_history) > max_points:
                    self._equity_history = self._equity_history[-max_points:]

        return web.json_response({
            "equity": self._equity_history,
            "total_points": len(self._equity_history),
        })

    async def start(self, host: str = "0.0.0.0", port: int = 8080):
        runner = web.AppRunner(self.app)
        await runner.setup()
        site = web.TCPSite(runner, host, port)
        await site.start()
        log.info(f"Dashboard API running on http://{host}:{port}")
        return runner
