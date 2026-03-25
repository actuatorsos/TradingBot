import { NextResponse } from "next/server";
import { fetchSpotRate, generateCandleHistory } from "@/lib/oanda";
import { analyzeSignal, getIndicatorDetails } from "@/lib/signals";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rate = await fetchSpotRate("EUR", "USD");

    if (!rate) {
      return NextResponse.json(
        { success: false, error: "Could not fetch current rate" },
        { status: 503 }
      );
    }

    // Generate candle history from current price for signal analysis
    const candles = generateCandleHistory(rate.midpoint, 100);
    const signal = analyzeSignal(candles, 0, 72);
    const details = getIndicatorDetails(signal);

    return NextResponse.json({
      success: true,
      signal,
      indicator_details: details,
      current_rate: rate,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Signal analysis failed" },
      { status: 500 }
    );
  }
}
