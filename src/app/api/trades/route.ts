import { NextResponse } from "next/server";
import { getEngineTrades } from "@/lib/engine-client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const status = searchParams.get("status"); // "open" | "closed" | null (all)
    const pair = searchParams.get("pair");

    const { trades, isDemo } = await getEngineTrades();

    let filtered = trades;
    if (status) filtered = filtered.filter(t => t.status === status);
    if (pair) filtered = filtered.filter(t => t.pair === pair);
    filtered = filtered.slice(0, limit);

    // Calculate summary stats
    const closedTrades = trades.filter(t => t.status === "closed");
    const winners = closedTrades.filter(t => (t.pnl || 0) > 0);
    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossProfit = winners.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(closedTrades.filter(t => (t.pnl || 0) < 0).reduce((sum, t) => sum + (t.pnl || 0), 0));

    return NextResponse.json({
      success: true,
      demo_mode: isDemo,
      trades: filtered,
      summary: {
        total_trades: closedTrades.length,
        open_trades: trades.filter(t => t.status === "open").length,
        win_rate: closedTrades.length > 0 ? parseFloat(((winners.length / closedTrades.length) * 100).toFixed(1)) : 0,
        total_pnl: parseFloat(totalPnl.toFixed(2)),
        profit_factor: grossLoss > 0 ? parseFloat((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 999 : 0,
        avg_win: winners.length > 0 ? parseFloat((grossProfit / winners.length).toFixed(2)) : 0,
        avg_loss: (closedTrades.length - winners.length) > 0 ? parseFloat((grossLoss / (closedTrades.length - winners.length)).toFixed(2)) : 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch trades" },
      { status: 500 }
    );
  }
}
