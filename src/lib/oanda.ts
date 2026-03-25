/**
 * APEX TRADER AI - Market Data Client
 * Primary: OANDA Exchange Rates API (historical)
 * Fallback: Free public forex API for live rates
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
 * Fetch rate from free public forex API (live rates)
 */
async function fetchFromPublicAPI(
  base: string,
  quote: string
): Promise<SpotRate | null> {
  try {
    // Try frankfurter.app (free, no key needed, ECB data)
    const res = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${quote}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const rate = data.rates?.[quote];
    if (!rate) return null;

    const midpoint = parseFloat(rate.toFixed(5));
    // ECB rates don't have bid/ask, simulate a tight spread
    const spreadPips = 1.5;
    const pip = quote === "JPY" ? 0.01 : 0.0001;
    const halfSpread = (spreadPips * pip) / 2;

    return {
      base,
      quote,
      bid: parseFloat((midpoint - halfSpread).toFixed(5)),
      ask: parseFloat((midpoint + halfSpread).toFixed(5)),
      midpoint,
      spread: spreadPips,
      timestamp: data.date || new Date().toISOString(),
    };
  } catch (err) {
    console.error("Public API fallback failed:", err);
    return null;
  }
}

/**
 * Fetch rate from OANDA Exchange Rates API
 */
async function fetchFromOANDA(
  base: string,
  quote: string
): Promise<SpotRate | null> {
  const apiKey = process.env.OANDA_API_KEY;
  if (!apiKey) return null;

  try {
    // Use the most recent date available in the API's range
    // Free tier has a rolling window; use a safe recent date
    const dateTime = "2025-09-25T00:00:00+00:00";
    const url = `${OANDA_BASE_URL}/spot.json?base=${base}&quote=${quote}&date_time=${encodeURIComponent(dateTime)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 300 },
    });

    if (!res.ok) return null;

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
      spread: parseFloat(((ask - bid) * (quote === "JPY" ? 100 : 10000)).toFixed(1)),
      timestamp: quote_data.date_time || dateTime,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch spot rate with automatic fallback
 * 1. Try free public API (live rates)
 * 2. Fall back to OANDA historical if public fails
 */
export async function fetchSpotRate(
  base: string = "EUR",
  quote: string = "USD"
): Promise<SpotRate | null> {
  // Try live rates first
  const liveRate = await fetchFromPublicAPI(base, quote);
  if (liveRate) return liveRate;

  // Fall back to OANDA historical
  const oandaRate = await fetchFromOANDA(base, quote);
  if (oandaRate) return oandaRate;

  console.error(`Failed to fetch rate for ${base}/${quote} from all sources`);
  return null;
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
  const results: SpotRate[] = [];
  for (const [b, q] of pairs) {
    const rate = await fetchSpotRate(b, q);
    if (rate) results.push(rate);
  }
  return results;
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
