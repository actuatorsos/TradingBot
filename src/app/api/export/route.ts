import { NextResponse } from "next/server";
import { getAllTrades, isOandaConfigured } from "@/lib/oanda-v20";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";

    if (!isOandaConfigured()) {
      return NextResponse.json({ success: false, error: "OANDA not configured" }, { status: 503 });
    }
    const trades = await getAllTrades(200);

    if (format === "csv") {
      const headers = ["ID", "Pair", "Direction", "Status", "Entry Price", "Exit Price", "Stop Loss", "Take Profit", "P&L ($)", "Lot Size", "Confidence", "Open Time", "Close Time"];
      const rows = trades.map(t => [
        t.id,
        t.pair,
        t.direction,
        t.status,
        t.entry_price,
        t.exit_price || "",
        t.stop_loss,
        t.take_profit,
        t.pnl ?? "",
        t.lot_size,
        "",
        t.open_time,
        t.close_time || "",
      ].join(","));

      const csv = [headers.join(","), ...rows].join("\n");

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="apex-trades-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // JSON format
    return NextResponse.json({
      success: true,
      live: true,
      trades,
      exported_at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Export failed" },
      { status: 500 }
    );
  }
}
