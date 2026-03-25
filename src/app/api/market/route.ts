import { NextResponse } from "next/server";
import { fetchSpotRate, fetchMultipleRates } from "@/lib/oanda";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [mainPair, allRates] = await Promise.all([
      fetchSpotRate("EUR", "USD"),
      fetchMultipleRates(),
    ]);

    return NextResponse.json({
      success: true,
      main: mainPair,
      pairs: allRates,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch market data" },
      { status: 500 }
    );
  }
}
