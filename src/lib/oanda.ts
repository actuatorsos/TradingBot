/**
 * OANDA Exchange Rates API Client
 * Fetches live forex spot rates and historical data
 */

const OANDA_BASE_URL = "https://www.oanda.com/rates/api/v2/rates";

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
    const url = `${OANDA_BASE_URL}/spot.json?api_key=${apiKey}&base=${base}&quote=${quote}&decimal_places=5`;
    const res = await fetch(url, { next: { revalidate: 10 } });

    if (!res.ok) {
      console.error(`OANDA API error: ${res.status}`);
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
      timestamp: new Date().toISOString(),
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
    const quotes = pairs.map((p) => p[1]).join(",");
    const base = pairs[0][0];

    // Fetch all at once where possible
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
