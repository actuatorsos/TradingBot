/**
 * OANDA Exchange Rates API Client
 * Fetches forex spot rates (historical for free-tier, real-time for paid)
 */

const OANDA_BASE_URL = "https://web-services.oanda.com/rates/api/v2/rates";

export interface SpotRate {
  base: string;
  quote: string;
  bid: number;
  ask: number;
  midpoint: number;
  spread: number;
  timestamp: string;
}

export interface CandleData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Get the nearest valid OANDA API timestamp (must be on 00/15/30/45 minute boundary)
 * Free tier only allows historical data, so we use a recent valid date
 */
function getOandaTimestamp(): string {
  // Use a recent date that falls within the API's allowed range
  // The free tier allows dates within a 1-year rolling window
  const now = new Date();
  // Go back 1 day to ensure it's available, align to 15-min boundary
  now.setDate(now.getDate() - 1);
  now.setMinutes(Math.floor(now.getMinutes() / 15) * 15, 0, 0);
  return now.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

export async function fetchSpotRate(
  base: string = "EUR",
  quote: string = "USD"
): Promise<SpotRate | null> {
  const apiKey = process.env.OANDA_API_KEY;
  if (!apiKey) {
    console.error("OANDA_API_KEY not set");
    return null;
  }

  try {
    const dateTime = getOandaTimestamp();
    const url = `${OANDA_BASE_URL}/spot.json?base=${base}&quote=${quote}&date_time=${encodeURIComponent(dateTime)}`;
    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`OANDA API error: ${res.status} - ${errText}`);
      return null;
    }

    const data = await res.json();
    const quote_data = data.quotes?.[0];

    if (!quote_data) return null;

    const bid = parseFloat(quote_data.bid);
    const ask = parseFloat(quote_data.ask);
    const midpoint = parseFloat(quote_data.midpoint);

    return {
      base,
      quote,
      bid,
      ask,
      midpoint,
      spread: parseFloat(((ask - bid) * 10000).toFixed(1)),
      timestamp: quote_data.date_time || new Date().toISOString(),
    };
  } catch (err) {
    console.error("Failed to fetch spot rate:", err);
    return null;
  }
}

export async function fetchMultipleRates(
  pairs: string[][] = [
    ["EUR", "USD"],
    ["GBP", "USD"],
    ["USD", "JPY"],
    ["AUD", "USD"],
    ["USD", "CHF"],
    ["EUR", "GBP"],
  ]
): Promise<SpotRate[]> {
  const apiKey = process.env.OANDA_API_KEY;
  if (!apiKey) return [];

  try {
    const results: SpotRate[] = [];
    for (const [b, q] of pairs) {
      const rate = await fetchSpotRate(b, q);
      if (rate) results.push(rate);
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Generate simulated OHLCV candle history from a spot rate
 * Used for indicator calculations when real candles aren't available
 */
export function generateCandleHistory(
  currentPrice: number,
  periods: number = 100,
  volatility: number = 0.0008
): CandleData[] {
  const candles: CandleData[] = [];
  let price = currentPrice * (1 - volatility * periods * 0.1);
  const now = Date.now();

  for (let i = 0; i < periods; i++) {
    const change = (Math.random() - 0.48) * volatility * price;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * volatility * price * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * price * 0.5;
    const volume = Math.floor(1000 + Math.random() * 9000);

    candles.push({
      timestamp: new Date(now - (periods - i) * 5 * 60 * 1000).toISOString(),
      open: parseFloat(open.toFixed(5)),
      high: parseFloat(high.toFixed(5)),
      low: parseFloat(low.toFixed(5)),
      close: parseFloat(close.toFixed(5)),
      volume,
    });

    price = close;
  }

  return candles;
}
