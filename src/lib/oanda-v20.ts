/**
 * APEX TRADER AI - OANDA v20 REST API Client
 * ============================================
 * Connects directly to OANDA practice/live account for REAL data:
 * - Open positions
 * - Trade history (closed trades)
 * - Account balance & equity
 * - Pending orders
 */

const OANDA_API_KEY = process.env.OANDA_V20_API_KEY || process.env.OANDA_API_KEY_V20 || "";
const OANDA_ACCOUNT_ID = process.env.OANDA_V20_ACCOUNT_ID || "";
const OANDA_PRACTICE = (process.env.OANDA_V20_PRACTICE ?? "true") === "true";

const BASE_URL = OANDA_PRACTICE
  ? "https://api-fxpractice.oanda.com"
  : "https://api-fxtrade.oanda.com";

function headers() {
  return {
    Authorization: `Bearer ${OANDA_API_KEY}`,
    "Content-Type": "application/json",
    "Accept-Datetime-Format": "RFC3339",
  };
}

function isConfigured(): boolean {
  return Boolean(OANDA_API_KEY && OANDA_ACCOUNT_ID);
}

// ─── Types ───

export interface OandaAccount {
  id: string;
  balance: string;
  unrealizedPL: string;
  pl: string;
  NAV: string;
  marginUsed: string;
  marginAvailable: string;
  openTradeCount: number;
  openPositionCount: number;
  currency: string;
}

export interface OandaTrade {
  id: string;
  instrument: string;
  price: string;
  openTime: string;
  initialUnits: string;
  currentUnits: string;
  realizedPL: string;
  unrealizedPL: string;
  state: "OPEN" | "CLOSED" | "CLOSE_WHEN_TRADEABLE";
  takeProfitOrder?: { price: string };
  stopLossOrder?: { price: string };
  closingTransactionIDs?: string[];
  closeTime?: string;
  averageClosePrice?: string;
}

export interface OandaPosition {
  instrument: string;
  pl: string;
  unrealizedPL: string;
  long: {
    units: string;
    averagePrice: string;
    unrealizedPL: string;
    pl: string;
    tradeIDs: string[];
  };
  short: {
    units: string;
    averagePrice: string;
    unrealizedPL: string;
    pl: string;
    tradeIDs: string[];
  };
}

export interface OandaCandle {
  time: string;
  volume: number;
  mid: { o: string; h: string; l: string; c: string };
  complete: boolean;
}

// ─── Normalized types for dashboard ───

export interface NormalizedTrade {
  id: string;
  pair: string;
  direction: "BUY" | "SELL";
  entry_price: number;
  exit_price: number | null;
  lot_size: number;
  pnl: number | null;
  unrealized_pnl: number | null;
  status: "open" | "closed";
  open_time: string;
  close_time: string | null;
  stop_loss: number;
  take_profit: number;
  current_units: number;
}

export interface NormalizedPosition {
  pair: string;
  direction: "BUY" | "SELL";
  entry_price: number;
  units: number;
  lot_size: number;
  unrealized_pnl: number;
  realized_pnl: number;
  trade_ids: string[];
  stop_loss: number;
  take_profit: number;
}

export interface AccountSummary {
  balance: number;
  unrealized_pnl: number;
  realized_pnl: number;
  nav: number;
  margin_used: number;
  margin_available: number;
  open_trade_count: number;
  open_position_count: number;
  currency: string;
}

// ─── API Functions ───

async function oandaFetch<T>(path: string): Promise<T | null> {
  if (!isConfigured()) return null;
  try {
    const url = `${BASE_URL}/v3/accounts/${OANDA_ACCOUNT_ID}${path}`;
    const res = await fetch(url, {
      headers: headers(),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`OANDA API error ${res.status}: ${await res.text().catch(() => "")}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("OANDA fetch error:", err);
    return null;
  }
}

/**
 * Get account summary (balance, equity, margin, P&L)
 */
export async function getAccount(): Promise<AccountSummary | null> {
  const data = await oandaFetch<{ account: OandaAccount }>("/summary");
  if (!data?.account) return null;

  const a = data.account;
  return {
    balance: parseFloat(a.balance),
    unrealized_pnl: parseFloat(a.unrealizedPL),
    realized_pnl: parseFloat(a.pl),
    nav: parseFloat(a.NAV),
    margin_used: parseFloat(a.marginUsed),
    margin_available: parseFloat(a.marginAvailable),
    open_trade_count: a.openTradeCount,
    open_position_count: a.openPositionCount,
    currency: a.currency,
  };
}

/**
 * Get all OPEN trades from OANDA
 */
export async function getOpenTrades(): Promise<NormalizedTrade[]> {
  const data = await oandaFetch<{ trades: OandaTrade[] }>("/openTrades");
  if (!data?.trades) return [];

  return data.trades.map(normalizeTrade);
}

/**
 * Get closed trade history (last N trades)
 */
export async function getClosedTrades(count: number = 50): Promise<NormalizedTrade[]> {
  const data = await oandaFetch<{ trades: OandaTrade[] }>(
    `/trades?state=CLOSED&count=${count}`
  );
  if (!data?.trades) return [];

  return data.trades.map(normalizeTrade);
}

/**
 * Get ALL trades (open + recent closed)
 */
export async function getAllTrades(closedCount: number = 50): Promise<NormalizedTrade[]> {
  const [openTrades, closedTrades] = await Promise.all([
    getOpenTrades(),
    getClosedTrades(closedCount),
  ]);
  return [...openTrades, ...closedTrades];
}

/**
 * Get open positions (aggregated by instrument)
 */
export async function getOpenPositions(): Promise<NormalizedPosition[]> {
  const data = await oandaFetch<{ positions: OandaPosition[] }>("/openPositions");
  if (!data?.positions) return [];

  const positions: NormalizedPosition[] = [];

  for (const pos of data.positions) {
    const longUnits = parseInt(pos.long.units);
    const shortUnits = parseInt(pos.short.units);

    if (longUnits > 0) {
      positions.push({
        pair: pos.instrument,
        direction: "BUY",
        entry_price: parseFloat(pos.long.averagePrice || "0"),
        units: longUnits,
        lot_size: longUnits / 100000,
        unrealized_pnl: parseFloat(pos.long.unrealizedPL),
        realized_pnl: parseFloat(pos.long.pl),
        trade_ids: pos.long.tradeIDs || [],
        stop_loss: 0, // Will be filled from individual trades
        take_profit: 0,
      });
    }

    if (Math.abs(shortUnits) > 0) {
      positions.push({
        pair: pos.instrument,
        direction: "SELL",
        entry_price: parseFloat(pos.short.averagePrice || "0"),
        units: Math.abs(shortUnits),
        lot_size: Math.abs(shortUnits) / 100000,
        unrealized_pnl: parseFloat(pos.short.unrealizedPL),
        realized_pnl: parseFloat(pos.short.pl),
        trade_ids: pos.short.tradeIDs || [],
        stop_loss: 0,
        take_profit: 0,
      });
    }
  }

  return positions;
}

/**
 * Get account transaction history for equity curve
 */
export async function getEquityHistory(
  days: number = 30
): Promise<Array<{ timestamp: string; balance: number; pl: number }>> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const data = await oandaFetch<{
    transactions: Array<{
      id: string;
      time: string;
      type: string;
      accountBalance?: string;
      pl?: string;
    }>;
  }>(`/transactions?from=${encodeURIComponent(since)}&type=ORDER_FILL`);

  if (!data?.transactions) return [];

  return data.transactions
    .filter((t) => t.accountBalance)
    .map((t) => ({
      timestamp: t.time,
      balance: parseFloat(t.accountBalance!),
      pl: parseFloat(t.pl || "0"),
    }));
}

/**
 * Get candlestick data for a pair
 */
export async function getCandles(
  instrument: string = "EUR_USD",
  granularity: string = "M5",
  count: number = 200
): Promise<OandaCandle[]> {
  if (!isConfigured()) return [];
  try {
    const url = `${BASE_URL}/v3/instruments/${instrument}/candles?granularity=${granularity}&count=${count}&price=M`;
    const res = await fetch(url, {
      headers: headers(),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.candles || [];
  } catch {
    return [];
  }
}

// ─── Helpers ───

function normalizeTrade(t: OandaTrade): NormalizedTrade {
  const units = parseInt(t.currentUnits || t.initialUnits);
  const isBuy = units > 0 || parseInt(t.initialUnits) > 0;
  const isClosed = t.state === "CLOSED";

  return {
    id: t.id,
    pair: t.instrument,
    direction: isBuy ? "BUY" : "SELL",
    entry_price: parseFloat(t.price),
    exit_price: t.averageClosePrice ? parseFloat(t.averageClosePrice) : null,
    lot_size: Math.abs(parseInt(t.initialUnits)) / 100000,
    pnl: isClosed ? parseFloat(t.realizedPL) : null,
    unrealized_pnl: !isClosed ? parseFloat(t.unrealizedPL || "0") : null,
    status: isClosed ? "closed" : "open",
    open_time: t.openTime,
    close_time: t.closeTime || null,
    stop_loss: t.stopLossOrder ? parseFloat(t.stopLossOrder.price) : 0,
    take_profit: t.takeProfitOrder ? parseFloat(t.takeProfitOrder.price) : 0,
    current_units: Math.abs(units),
  };
}

/**
 * Check if OANDA v20 is configured
 */
export function isOandaConfigured(): boolean {
  return isConfigured();
}

export function getConnectionInfo(): {
  configured: boolean;
  practice: boolean;
  accountId: string;
} {
  return {
    configured: isConfigured(),
    practice: OANDA_PRACTICE,
    accountId: OANDA_ACCOUNT_ID ? `***${OANDA_ACCOUNT_ID.slice(-4)}` : "",
  };
}
