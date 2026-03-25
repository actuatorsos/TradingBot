import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Generate realistic OHLCV data based on current price
function generateCandles(basePrice: number, count: number, pair: string): CandleData[] {
  const candles: CandleData[] = [];
  let price = basePrice;
  const pip = pair.includes("JPY") ? 0.01 : 0.0001;
  const volatility = pair.includes("JPY") ? 0.3 : 0.0003;

  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 5 * 60000); // 5-min candles
    const change = (Math.random() - 0.5) * volatility * 2;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    const volume = Math.floor(
      500 + Math.random() * 2000 + Math.abs(change / pip) * 100
    );

    const decimals = pair.includes("JPY") ? 3 : 5;
    candles.push({
      time: time.toISOString(),
      open: parseFloat(open.toFixed(decimals)),
      high: parseFloat(high.toFixed(decimals)),
      low: parseFloat(low.toFixed(decimals)),
      close: parseFloat(close.toFixed(decimals)),
      volume,
    });
    price = close;
  }
  return candles;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pair = searchParams.get("pair") || "EUR_USD";
  const count = Math.min(parseInt(searchParams.get("count") || "200"), 500);

  // Price map for major pairs
  const priceMap: Record<string, number> = {
    EUR_USD: 1.085,
    GBP_USD: 1.265,
    USD_JPY: 149.5,
    AUD_USD: 0.654,
    USD_CAD: 1.358,
    USD_CHF: 0.875,
  };

  let basePrice = priceMap[pair] || 1.0;

  // Try to get base price from market API
  try {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${appUrl}/api/market`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.pairs && Array.isArray(data.pairs)) {
        const [base, quote] = pair.split("_");
        const found = data.pairs.find(
          (p: any) => p.base === base && p.quote === quote
        );
        if (found && typeof found.midpoint === "number") {
          basePrice = found.midpoint;
        }
      }
    }
  } catch {
    // Fallback to price map
  }

  const candles = generateCandles(basePrice, count, pair);

  return NextResponse.json({
    success: true,
    pair,
    timeframe: "M5",
    candles,
    count: candles.length,
  });
}
