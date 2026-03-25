import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    success: true,
    status: "online",
    version: "1.0.0",
    engine: "Apex Trader AI",
    mode: "monitoring",
    uptime: process.uptime(),
    config: {
      pair: process.env.TRADING_PAIR || "EUR_USD",
      timeframe: process.env.TIMEFRAME || "M5",
      min_confidence: parseInt(process.env.MIN_CONFIDENCE || "72"),
      indicators: 9,
      strategy: "Multi-Indicator Confluence",
    },
    risk: {
      daily_drawdown_limit: "5%",
      risk_per_trade: "1%",
      max_consecutive_losses: 5,
      circuit_breaker: "active",
    },
    timestamp: new Date().toISOString(),
  });
}
