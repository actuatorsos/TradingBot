import { NextResponse } from "next/server";
import { getEnginePositions } from "@/lib/engine-client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { positions, isDemo } = await getEnginePositions();

    // Calculate unrealized P&L estimates for open positions
    const positionsWithUnrealized = positions.map(p => {
      // Simulate current price movement for unrealized P&L
      const pip = p.pair.includes("JPY") ? 0.01 : 0.0001;
      const movement = (Math.random() - 0.5) * 10 * pip;
      const currentPrice = p.entry_price + movement;
      const unrealizedPips = p.direction === "BUY"
        ? (currentPrice - p.entry_price) / pip
        : (p.entry_price - currentPrice) / pip;
      const unrealizedPnl = unrealizedPips * p.lot_size * (p.pair.includes("JPY") ? 100 : 10000) * pip;

      return {
        ...p,
        current_price: parseFloat(currentPrice.toFixed(p.pair.includes("JPY") ? 3 : 5)),
        unrealized_pnl: parseFloat(unrealizedPnl.toFixed(2)),
        unrealized_pips: parseFloat(unrealizedPips.toFixed(1)),
        duration_minutes: Math.floor((Date.now() - new Date(p.open_time).getTime()) / 60000),
        sl_distance_pips: parseFloat((Math.abs(p.entry_price - p.stop_loss) / pip).toFixed(1)),
        tp_distance_pips: parseFloat((Math.abs(p.take_profit - p.entry_price) / pip).toFixed(1)),
      };
    });

    const totalUnrealized = positionsWithUnrealized.reduce((sum, p) => sum + p.unrealized_pnl, 0);

    return NextResponse.json({
      success: true,
      demo_mode: isDemo,
      positions: positionsWithUnrealized,
      summary: {
        total_positions: positions.length,
        total_unrealized_pnl: parseFloat(totalUnrealized.toFixed(2)),
        pairs: Array.from(new Set(positions.map(p => p.pair))),
        net_direction: positions.reduce((sum, p) => sum + (p.direction === "BUY" ? 1 : -1), 0),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch positions" },
      { status: 500 }
    );
  }
}
