import { NextResponse } from "next/server";
import {
  getOpenPositions,
  getOpenTrades,
  getAccount,
  isOandaConfigured,
  getConnectionInfo,
} from "@/lib/capital-com";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isOandaConfigured()) {
      return NextResponse.json({
        success: false,
        error: "OANDA v20 not configured. Set OANDA_V20_API_KEY and OANDA_V20_ACCOUNT_ID env vars.",
        connection: getConnectionInfo(),
      }, { status: 503 });
    }

    // Fetch positions, individual trades, and account in parallel
    const [positions, openTrades, account] = await Promise.all([
      getOpenPositions(),
      getOpenTrades(),
      getAccount(),
    ]);

    // Enrich positions with SL/TP from individual trades
    const enrichedPositions = positions.map((pos) => {
      const relatedTrades = openTrades.filter(
        (t) => t.pair === pos.pair && t.status === "open"
      );
      // Use first trade's SL/TP as representative
      const firstTrade = relatedTrades[0];
      return {
        ...pos,
        stop_loss: firstTrade?.stop_loss ?? 0,
        take_profit: firstTrade?.take_profit ?? 0,
        trade_count: relatedTrades.length,
        trades: relatedTrades.map((t) => ({
          id: t.id,
          units: t.current_units,
          entry_price: t.entry_price,
          unrealized_pnl: t.unrealized_pnl,
          open_time: t.open_time,
        })),
      };
    });

    const totalUnrealized = positions.reduce((s, p) => s + p.unrealized_pnl, 0);

    return NextResponse.json({
      success: true,
      live: true,
      connection: getConnectionInfo(),
      positions: enrichedPositions,
      open_trades: openTrades,
      account: account
        ? {
            balance: account.balance,
            nav: account.nav,
            unrealized_pnl: account.unrealized_pnl,
            margin_used: account.margin_used,
            margin_available: account.margin_available,
          }
        : null,
      summary: {
        total_positions: positions.length,
        total_trades: openTrades.length,
        total_unrealized_pnl: parseFloat(totalUnrealized.toFixed(2)),
        pairs: Array.from(new Set(positions.map((p) => p.pair))),
        net_direction: positions.reduce(
          (sum, p) => sum + (p.direction === "BUY" ? 1 : -1),
          0
        ),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Positions API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch positions from OANDA" },
      { status: 500 }
    );
  }
}
