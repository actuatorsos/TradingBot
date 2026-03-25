import { NextResponse } from "next/server";
import { getEngineStatus } from "@/lib/engine-client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { status: engineStatus, isDemo } = await getEngineStatus();

    return NextResponse.json({
      success: true,
      demo_mode: isDemo,
      status: engineStatus.running ? "online" : "stopped",
      version: "2.0.0",
      engine: "Apex Trader AI",
      mode: engineStatus.mode,
      running: engineStatus.running,
      cycle_count: engineStatus.cycle_count,
      last_signal_time: engineStatus.last_signal_time,
      uptime: process.uptime(),
      config: {
        pair: process.env.TRADING_PAIR || "EUR_USD",
        timeframe: process.env.TIMEFRAME || "M5",
        min_confidence: parseInt(process.env.MIN_CONFIDENCE || "72"),
        indicators: 9,
        strategy: "Multi-Indicator Confluence",
      },
      risk: engineStatus.risk,
      paper_performance: engineStatus.paper_performance,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch engine status" },
      { status: 500 }
    );
  }
}
