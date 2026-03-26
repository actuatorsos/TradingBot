import { NextResponse } from "next/server";
import {
  getAccount,
  getOpenTrades,
  isOandaConfigured,
  getConnectionInfo,
} from "@/lib/capital-com";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const connection = getConnectionInfo();

    if (!isOandaConfigured()) {
      return NextResponse.json({
        success: true,
        status: "disconnected",
        version: "2.0.0",
        engine: "Apex Trader AI",
        mode: "not_configured",
        running: false,
        connection,
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

    // Fetch real account data
    const [account, openTrades] = await Promise.all([
      getAccount(),
      getOpenTrades(),
    ]);

    return NextResponse.json({
      success: true,
      status: account ? "online" : "error",
      version: "2.0.0",
      engine: "Apex Trader AI",
      mode: connection.practice ? "practice" : "live",
      running: true,
      connection,
      account: account
        ? {
            balance: account.balance,
            nav: account.nav,
            unrealized_pnl: account.unrealized_pnl,
            margin_used: account.margin_used,
            margin_available: account.margin_available,
            open_trade_count: account.open_trade_count,
            currency: account.currency,
          }
        : null,
      open_trades: openTrades.length,
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
  } catch (error) {
    console.error("Status API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch status" },
      { status: 500 }
    );
  }
}
