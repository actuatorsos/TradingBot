/**
 * APEX TRADER AI - Capital.com REST API Client
 * =============================================
 * Connects to Capital.com demo/live account for REAL trading data:
 * - Account balance & equity
 * - Open positions with P&L
 * - Trade/activity history
 * - Working orders
 * - Market prices & candles
 *
 * Capital.com API docs: https://open-api.capital.com/
 * Demo base: https://demo-api-capital.backend-capital.com
 * Live base: https://api-capital.backend-capital.com
 */

// ─── Configuration ───

const CAPITAL_API_KEY = process.env.CAPITAL_API_KEY || "";
const CAPITAL_IDENTIFIER = process.env.CAPITAL_IDENTIFIER || ""; // email
const CAPITAL_PASSWORD = process.env.CAPITAL_PASSWORD || "";
const CAPITAL_DEMO = (process.env.CAPITAL_DEMO ?? "true") === "true";

const BASE_URL = CAPITAL_DEMO
  ? "https://demo-api-capital.backend-capital.com"
  : "https://api-capital.backend-capital.com";

// ─── Session Management ───

let sessionCST: string | null = null;
let sessionToken: string | null = null;
let sessionExpiry: number = 0;

function isConfigured(): boolean {
  return Boolean(CAPITAL_API_KEY && CAPITAL_IDENTIFIER && CAPITAL_PASSWORD);
}

async function ensureSession(): Promise<boolean> {
  // Reuse session if still valid (refresh every 9 minutes, Capital.com sessions last ~10min)
  if (sessionCST && sessionToken && Date.now() < sessionExpiry) {
    return true;
  }

  if (!isConfigured()) return false;

  try {
    const res = await fetch(`${BASE_URL}/api/v1/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CAP-API-KEY": CAPITAL_API_KEY,
      },
      body: JSON.stringify({
        identifier: CAPITAL_IDENTIFIER,
        password: CAPITAL_PASSWORD,
        encryptedPassword: false,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`Capital.com session error ${res.status}: ${text}`);
      return false;
    }

    sessionCST = res.headers.get("CST") || res.headers.get("cst");
    sessionToken =
      res.headers.get("X-SECURITY-TOKEN") ||
      res.headers.get("x-security-token");

    if (!sessionCST || !sessionToken) {
      console.error("Capital.com: Missing CST or X-SECURITY-TOKEN in response");
      return false;
    }

    // Session valid for ~9 minutes
    sessionExpiry = Date.now() + 9 * 60 * 1000;
    return true;
  } catch (err) {
    console.error("Capital.com session error:", err);
    return false;
  }
}

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-CAP-API-KEY": CAPITAL_API_KEY,
    CST: sessionCST || "",
    "X-SECURITY-TOKEN": sessionToken || "",
  };
}

// ─── Raw API Types (Capital.com response shapes) ───

interface CapitalAccountInfo {
  balance: number;
  deposit: number;
  profitLoss: number;
  available: number;
}

interface CapitalSessionResponse {
  accountType: string;
  accountInfo: CapitalAccountInfo;
  currencyIsoCode: string;
  currencySymbol: string;
  currentAccountId: string;
  accounts: Array<{
    accountId: string;
    accountName: string;
    preferred: boolean;
    accountType: string;
  }>;
  clientId: string;
  hasActiveDemoAccounts: boolean;
  hasActiveLiveAccounts: boolean;
  trailingStopsEnabled: boolean;
}

interface CapitalPosition {
  position: {
    contractSize: number;
    createdDate: string;
    createdDateUTC: string;
    dealId: string;
    dealReference: string;
    size: number;
    currency: string;
    direction: "BUY" | "SELL";
    level: number; // entry price
    limitLevel: number | null; // take profit
    stopLevel: number | null; // stop loss
    controlledRisk: boolean;
    trailingStep: number | null;
    trailingStopDistance: number | null;
    limitedRiskPremium: number | null;
  };
  market: {
    instrumentName: string;
    expiry: string;
    epic: string;
    instrumentType: string;
    marketStatus: string;
    lotSize: number;
    high: number;
    low: number;
    percentageChange: number;
    netChange: number;
    bid: number;
    offer: number;
    updateTime: string;
    updateTimeUTC: string;
    delayTime: number;
    streamingPricesAvailable: boolean;
    scalingFactor: number;
  };
}

interface CapitalActivity {
  date: string;
  dateUTC: string;
  epic: string;
  period: string;
  dealId: string;
  channel: string;
  type: string;
  status: string;
  description: string;
  details: {
    direction: string;
    epic: string;
    dealReference: string;
    size: number;
    level: number;
    limitLevel: number | null;
    stopLevel: number | null;
    currency: string;
    actions: Array<{
      actionType: string;
      affectedDealId: string;
    }>;
  };
}

interface CapitalTransaction {
  date: string;
  dateUtc: string;
  instrumentName: string;
  period: string;
  profitAndLoss: string;
  transactionType: string;
  reference: string;
  openLevel: string;
  closeLevel: string;
  size: string;
  currency: string;
  cashTransaction: boolean;
}

interface CapitalCandle {
  snapshotTime: string;
  snapshotTimeUTC: string;
  openPrice: { bid: number; ask: number };
  closePrice: { bid: number; ask: number };
  highPrice: { bid: number; ask: number };
  lowPrice: { bid: number; ask: number };
  lastTradedVolume: number;
}

// ─── Normalized Types (for dashboard) ───

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

export interface OandaCandle {
  time: string;
  volume: number;
  mid: { o: string; h: string; l: string; c: string };
  complete: boolean;
}

// ─── Generic Fetch ───

async function capitalFetch<T>(
  path: string,
  options?: { method?: string; body?: unknown }
): Promise<T | null> {
  const hasSession = await ensureSession();
  if (!hasSession) return null;

  try {
    const url = `${BASE_URL}/api/v1${path}`;
    const fetchOpts: RequestInit = {
      method: options?.method || "GET",
      headers: authHeaders(),
      cache: "no-store",
    };
    if (options?.body) {
      fetchOpts.body = JSON.stringify(options.body);
    }

    const res = await fetch(url, fetchOpts);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`Capital.com API error ${res.status} on ${path}: ${text}`);
      // If unauthorized, clear session so next call refreshes
      if (res.status === 401) {
        sessionCST = null;
        sessionToken = null;
        sessionExpiry = 0;
      }
      return null;
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error(`Capital.com fetch error on ${path}:`, err);
    return null;
  }
}

// ─── Account ───

export async function getAccount(): Promise<AccountSummary | null> {
  // The session response already contains account info, but let's get
  // fresh data from /accounts endpoint
  const data = await capitalFetch<{
    accounts: Array<{
      accountId: string;
      accountName: string;
      accountType: string;
      balance: {
        balance: number;
        deposit: number;
        profitLoss: number;
        available: number;
      };
      currency: string;
      preferred: boolean;
    }>;
  }>("/accounts");

  if (!data?.accounts?.length) {
    // Fallback: create session and use session response data
    const hasSession = await ensureSession();
    if (!hasSession) return null;

    // Re-create session to get account info
    try {
      const res = await fetch(`${BASE_URL}/api/v1/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CAP-API-KEY": CAPITAL_API_KEY,
        },
        body: JSON.stringify({
          identifier: CAPITAL_IDENTIFIER,
          password: CAPITAL_PASSWORD,
          encryptedPassword: false,
        }),
      });
      if (!res.ok) return null;
      const sessionData: CapitalSessionResponse = await res.json();
      const ai = sessionData.accountInfo;

      return {
        balance: ai.balance,
        unrealized_pnl: ai.profitLoss,
        realized_pnl: 0,
        nav: ai.balance + ai.profitLoss,
        margin_used: ai.deposit,
        margin_available: ai.available,
        open_trade_count: 0,
        open_position_count: 0,
        currency: sessionData.currencyIsoCode,
      };
    } catch {
      return null;
    }
  }

  // Use preferred account or first
  const acct =
    data.accounts.find((a) => a.preferred) || data.accounts[0];
  const bal = acct.balance;

  // Get position count
  const positions = await getOpenPositions();

  return {
    balance: bal.balance,
    unrealized_pnl: bal.profitLoss,
    realized_pnl: 0,
    nav: bal.balance + bal.profitLoss,
    margin_used: bal.deposit,
    margin_available: bal.available,
    open_trade_count: positions.length,
    open_position_count: positions.length,
    currency: acct.currency,
  };
}

// ─── Positions ───

export async function getOpenPositions(): Promise<NormalizedPosition[]> {
  const data = await capitalFetch<{ positions: CapitalPosition[] }>(
    "/positions"
  );
  if (!data?.positions) return [];

  return data.positions.map((p) => {
    const pos = p.position;
    const mkt = p.market;

    // Calculate unrealized P&L from current price vs entry
    const currentPrice =
      pos.direction === "BUY" ? mkt.bid : mkt.offer;
    const priceDiff =
      pos.direction === "BUY"
        ? currentPrice - pos.level
        : pos.level - currentPrice;
    const unrealizedPnl = priceDiff * pos.size;

    return {
      pair: mkt.epic,
      direction: pos.direction,
      entry_price: pos.level,
      units: pos.size,
      lot_size: pos.size / (mkt.lotSize || 100000),
      unrealized_pnl: parseFloat(unrealizedPnl.toFixed(2)),
      realized_pnl: 0,
      trade_ids: [pos.dealId],
      stop_loss: pos.stopLevel ?? 0,
      take_profit: pos.limitLevel ?? 0,
    };
  });
}

export async function getOpenTrades(): Promise<NormalizedTrade[]> {
  const data = await capitalFetch<{ positions: CapitalPosition[] }>(
    "/positions"
  );
  if (!data?.positions) return [];

  return data.positions.map((p) => {
    const pos = p.position;
    const mkt = p.market;

    const currentPrice =
      pos.direction === "BUY" ? mkt.bid : mkt.offer;
    const priceDiff =
      pos.direction === "BUY"
        ? currentPrice - pos.level
        : pos.level - currentPrice;
    const unrealizedPnl = priceDiff * pos.size;

    return {
      id: pos.dealId,
      pair: mkt.epic,
      direction: pos.direction,
      entry_price: pos.level,
      exit_price: null,
      lot_size: pos.size / (mkt.lotSize || 100000),
      pnl: null,
      unrealized_pnl: parseFloat(unrealizedPnl.toFixed(2)),
      status: "open" as const,
      open_time: pos.createdDateUTC || pos.createdDate,
      close_time: null,
      stop_loss: pos.stopLevel ?? 0,
      take_profit: pos.limitLevel ?? 0,
      current_units: pos.size,
    };
  });
}

// ─── Trade History (Closed Trades) ───

export async function getClosedTrades(
  count: number = 50
): Promise<NormalizedTrade[]> {
  // Capital.com uses /history/transactions for closed trades
  // Max range is limited, so we fetch last 90 days in chunks
  const now = new Date();
  const allTrades: NormalizedTrade[] = [];

  // Fetch in 1-day chunks going backwards (API limits range to ~1 day for activity)
  // For transactions, we can do larger ranges
  const daysBack = 90;
  const from = new Date(now.getTime() - daysBack * 86400000);

  const data = await capitalFetch<{ transactions: CapitalTransaction[] }>(
    `/history/transactions?from=${from.toISOString()}&to=${now.toISOString()}&type=TRADE`
  );

  if (!data?.transactions) return [];

  for (const tx of data.transactions) {
    if (tx.cashTransaction) continue;
    if (!tx.instrumentName) continue;

    const pnl = parseFloat(tx.profitAndLoss?.replace(/[^0-9.\-]/g, "") || "0");
    const size = parseFloat(tx.size || "0");
    const openLevel = parseFloat(tx.openLevel || "0");
    const closeLevel = parseFloat(tx.closeLevel || "0");

    const direction: "BUY" | "SELL" =
      closeLevel > openLevel
        ? pnl >= 0
          ? "BUY"
          : "SELL"
        : pnl >= 0
          ? "SELL"
          : "BUY";

    allTrades.push({
      id: tx.reference,
      pair: tx.instrumentName.replace(/\s/g, "_").toUpperCase(),
      direction,
      entry_price: openLevel,
      exit_price: closeLevel,
      lot_size: size,
      pnl,
      unrealized_pnl: null,
      status: "closed",
      open_time: tx.dateUtc || tx.date,
      close_time: tx.dateUtc || tx.date,
      stop_loss: 0,
      take_profit: 0,
      current_units: 0,
    });
  }

  return allTrades.slice(0, count);
}

export async function getAllTrades(
  closedCount: number = 50
): Promise<NormalizedTrade[]> {
  const [openTrades, closedTrades] = await Promise.all([
    getOpenTrades(),
    getClosedTrades(closedCount),
  ]);
  return [...openTrades, ...closedTrades];
}

// ─── Equity History ───

export async function getEquityHistory(
  days: number = 30
): Promise<Array<{ timestamp: string; balance: number; pl: number }>> {
  const now = new Date();
  const from = new Date(now.getTime() - days * 86400000);

  const data = await capitalFetch<{ transactions: CapitalTransaction[] }>(
    `/history/transactions?from=${from.toISOString()}&to=${now.toISOString()}`
  );

  if (!data?.transactions) return [];

  // Build equity curve from transactions
  const points: Array<{ timestamp: string; balance: number; pl: number }> = [];
  let runningBalance = 0;

  // Get current account balance to work backwards
  const account = await getAccount();
  if (account) {
    runningBalance = account.balance;
  }

  // Capital.com transactions include running balance info through P&L
  // We'll reconstruct from the transaction list
  const sortedTx = [...data.transactions].sort(
    (a, b) =>
      new Date(a.dateUtc || a.date).getTime() -
      new Date(b.dateUtc || b.date).getTime()
  );

  // Calculate starting balance by subtracting all P&L from current balance
  let totalPnl = 0;
  for (const tx of sortedTx) {
    const pnl = parseFloat(
      tx.profitAndLoss?.replace(/[^0-9.\-]/g, "") || "0"
    );
    totalPnl += pnl;
  }

  let balance = runningBalance - totalPnl;

  for (const tx of sortedTx) {
    const pnl = parseFloat(
      tx.profitAndLoss?.replace(/[^0-9.\-]/g, "") || "0"
    );
    balance += pnl;
    points.push({
      timestamp: tx.dateUtc || tx.date,
      balance: parseFloat(balance.toFixed(2)),
      pl: pnl,
    });
  }

  return points;
}

// ─── Candles / Market Data ───

export async function getCandles(
  instrument: string = "EURUSD",
  granularity: string = "MINUTE_5",
  count: number = 200
): Promise<OandaCandle[]> {
  if (!isConfigured()) return [];

  // Map OANDA-style granularity to Capital.com format
  const granularityMap: Record<string, string> = {
    M1: "MINUTE",
    M5: "MINUTE_5",
    M15: "MINUTE_15",
    M30: "MINUTE_30",
    H1: "HOUR",
    H4: "HOUR_4",
    D: "DAY",
    W: "WEEK",
    MINUTE: "MINUTE",
    MINUTE_5: "MINUTE_5",
    MINUTE_15: "MINUTE_15",
    MINUTE_30: "MINUTE_30",
    HOUR: "HOUR",
    HOUR_4: "HOUR_4",
    DAY: "DAY",
    WEEK: "WEEK",
  };

  const resolution = granularityMap[granularity] || "MINUTE_5";

  // Capital.com uses epic format like EURUSD, not EUR_USD
  const epic = instrument.replace("_", "");

  const data = await capitalFetch<{
    prices: CapitalCandle[];
  }>(`/prices/${epic}?resolution=${resolution}&max=${count}`);

  if (!data?.prices) return [];

  // Normalize to OANDA candle format for compatibility
  return data.prices.map((c) => ({
    time: c.snapshotTimeUTC || c.snapshotTime,
    volume: c.lastTradedVolume,
    mid: {
      o: ((c.openPrice.bid + c.openPrice.ask) / 2).toFixed(5),
      h: ((c.highPrice.bid + c.highPrice.ask) / 2).toFixed(5),
      l: ((c.lowPrice.bid + c.lowPrice.ask) / 2).toFixed(5),
      c: ((c.closePrice.bid + c.closePrice.ask) / 2).toFixed(5),
    },
    complete: true,
  }));
}

// ─── Helpers ───

export function isCapitalConfigured(): boolean {
  return isConfigured();
}

export function getConnectionInfo(): {
  configured: boolean;
  practice: boolean;
  accountId: string;
  broker: string;
} {
  return {
    configured: isConfigured(),
    practice: CAPITAL_DEMO,
    accountId: CAPITAL_IDENTIFIER
      ? `***${CAPITAL_IDENTIFIER.slice(-4)}`
      : "",
    broker: "Capital.com",
  };
}

// ─── Re-exports with OANDA-compatible names ───
// These ensure API routes work without changes

export const isOandaConfigured = isCapitalConfigured;
