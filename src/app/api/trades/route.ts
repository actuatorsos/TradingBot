import { NextResponse } from "next/server";
import {
  getAllTrades,
  isOandaConfigured,
  getConnectionInfo,
} from "@/lib/capital-com";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const statusFilter = searchParams.get("status"); // "open" | "closed" | null
    const pair = searchParams.get("pair");

    if (!isOandaConfigured()) {
      return NextResponse.json({
        success: false,
        error: "OANDA v20 not configured. Set OANDA_V20_API_KEY and OANDA_V20_ACCOUNT_ID env vars.",
        connection: getConnectionInfo(),
      }, { status: 503 });
    }

    const allTrades = await getAllTrades(limit);

    let filtered = allTrades;
    if (statusFilter) filtered = filtered.filter((t) => t.status === statusFilter);
    if (pair) filtered = filtered.filter((t) => t.pair === pair);
    filtered = filtered.slice(0, limit);

    // Stats from closed trades
    const closedTrades = allTrades.filter((t) => t.status === "closed");
    const winners = closedTrades.filter((t) => (t.pnl ?? 0) > 0);
    const totalPnl = closedTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const grossProfit = winners.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const losers = closedTrades.filter((t) => (t.pnl ?? 0) < 0);
    const grossLoss = Math.abs(losers.reduce((s, t) => s + (t.pnl ?? 0), 0));

    return NextResponse.json({
      success: true,
      live: true,
      connection: getConnectionInfo(),
      trades: filtered,
      summary: {
        total_trades: closedTrades.length,
        wins: winners.length,
        losses: losers.length,
        open_trades: allTrades.filter((t) => t.status === "open").length,
        win_rate: closedTrades.length > 0
          ? parseFloat(((winners.length / closedTrades.length) * 100).toFixed(1))
          : 0,
        total_pnl: parseFloat(totalPnl.toFixed(2)),
        profit_factor: grossLoss > 0
          ? parseFloat((grossProfit / grossLoss).toFixed(2))
          : grossProfit > 0 ? 999 : 0,
        avg_win: winners.length > 0
          ? parseFloat((grossProfit / winners.length).toFixed(2))
          : 0,
        avg_loss: losers.length > 0
          ? parseFloat((grossLoss / losers.length).toFixed(2))
          : 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Trades API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch trades from OANDA" },
      { status: 500 }
    );
  }
}
