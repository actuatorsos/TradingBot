/**
 * APEX TRADER AI - Engine Client
 * Connects Vercel dashboard to the Python execution engine on VPS.
 * Falls back to demo data when ENGINE_URL is not configured.
 */

const ENGINE_URL = process.env.ENGINE_URL || "";

interface EngineTradeRecord {
  id: string;
  pair: string;
  direction: "BUY" | "SELL";
  entry_price: number;
  exit_price: number | null;
  lot_size: number;
  pnl: number | null;
  status: "open" | "closed" | "cancelled";
  open_time: string;
  close_time: string | null;
  stop_loss: number;
  take_profit: number;
  confidence: number;
  reasons: string[];
}

interface EngineStatus {
  mode: "paper" | "live";
  running: boolean;
  cycle_count: number;
  last_signal_time: string | null;
  risk: {
    kill_switch: boolean;
    circuit_breaker_tripped: boolean;
    daily_pnl: number;
    daily_drawdown_pct: number;
    trades_today: number;
    max_daily_trades: number;
    consecutive_losses: number;
    open_positions: number;
  };
  trades: EngineTradeRecord[];
  paper_performance: {
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    win_rate: number;
    total_pnl: number;
    profit_factor: number;
    balance: number;
    max_drawdown_pct: number;
    sharpe_ratio: number;
  } | null;
}

interface EquityPoint {
  timestamp: string;
  balance: number;
  equity: number;
  drawdown_pct: number;
}

async function fetchEngine<T>(path: string): Promise<T | null> {
  if (!ENGINE_URL) return null;
  try {
    const res = await fetch(`${ENGINE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 10 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Demo Data Generators ──

function generateDemoTrades(count: number = 25): EngineTradeRecord[] {
  const pairs = ["EUR_USD", "GBP_USD", "USD_JPY", "AUD_USD"];
  const trades: EngineTradeRecord[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const pair = pairs[Math.floor(Math.random() * pairs.length)];
    const direction = Math.random() > 0.5 ? "BUY" as const : "SELL" as const;
    const isJPY = pair.includes("JPY");
    const basePrice = isJPY ? 149.5 : pair.includes("GBP") ? 1.265 : pair.includes("AUD") ? 0.665 : 1.085;
    const pip = isJPY ? 0.01 : 0.0001;
    const entry = basePrice + (Math.random() - 0.5) * 50 * pip;
    const pnlPips = (Math.random() - 0.4) * 40; // slightly positive bias
    const exit = direction === "BUY" ? entry + pnlPips * pip : entry - pnlPips * pip;
    const lotSize = 0.01 + Math.random() * 0.04;
    const pnl = pnlPips * lotSize * (isJPY ? 100 : 10000) * pip;
    const isClosed = i > 2; // first 3 are open
    const openTime = new Date(now - (count - i) * 3600000 * (1 + Math.random())).toISOString();

    trades.push({
      id: `demo-${i.toString().padStart(4, "0")}`,
      pair,
      direction,
      entry_price: parseFloat(entry.toFixed(isJPY ? 3 : 5)),
      exit_price: isClosed ? parseFloat(exit.toFixed(isJPY ? 3 : 5)) : null,
      lot_size: parseFloat(lotSize.toFixed(2)),
      pnl: isClosed ? parseFloat(pnl.toFixed(2)) : null,
      status: isClosed ? "closed" : "open",
      open_time: openTime,
      close_time: isClosed ? new Date(new Date(openTime).getTime() + Math.random() * 7200000).toISOString() : null,
      stop_loss: parseFloat((direction === "BUY" ? entry - 15 * pip : entry + 15 * pip).toFixed(isJPY ? 3 : 5)),
      take_profit: parseFloat((direction === "BUY" ? entry + 25 * pip : entry - 25 * pip).toFixed(isJPY ? 3 : 5)),
      confidence: 72 + Math.random() * 26,
      reasons: [
        direction === "BUY" ? "RSI oversold" : "RSI overbought",
        direction === "BUY" ? "MACD bullish crossover" : "MACD bearish crossover",
        "EMA trend confirmed",
      ],
    });
  }
  return trades;
}

function generateDemoEquity(days: number = 30): EquityPoint[] {
  const points: EquityPoint[] = [];
  let balance = 10000;
  let peak = balance;
  const now = Date.now();

  for (let i = 0; i < days * 24; i++) { // hourly points
    const change = (Math.random() - 0.47) * 15; // slight upward bias
    balance += change;
    balance = Math.max(balance, 8000); // floor
    peak = Math.max(peak, balance);
    const drawdown = ((peak - balance) / peak) * 100;

    points.push({
      timestamp: new Date(now - (days * 24 - i) * 3600000).toISOString(),
      balance: parseFloat(balance.toFixed(2)),
      equity: parseFloat((balance + (Math.random() - 0.5) * 20).toFixed(2)),
      drawdown_pct: parseFloat(drawdown.toFixed(2)),
    });
  }
  return points;
}

function getDemoStatus(): EngineStatus {
  const trades = generateDemoTrades(25);
  const closedTrades = trades.filter(t => t.status === "closed");
  const winners = closedTrades.filter(t => (t.pnl || 0) > 0);
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

  return {
    mode: "paper",
    running: true,
    cycle_count: 147 + Math.floor(Math.random() * 50),
    last_signal_time: new Date(Date.now() - Math.random() * 300000).toISOString(),
    risk: {
      kill_switch: false,
      circuit_breaker_tripped: false,
      daily_pnl: parseFloat((Math.random() * 100 - 20).toFixed(2)),
      daily_drawdown_pct: parseFloat((Math.random() * 3).toFixed(2)),
      trades_today: 3 + Math.floor(Math.random() * 8),
      max_daily_trades: 20,
      consecutive_losses: Math.floor(Math.random() * 3),
      open_positions: trades.filter(t => t.status === "open").length,
    },
    trades,
    paper_performance: {
      total_trades: closedTrades.length,
      winning_trades: winners.length,
      losing_trades: closedTrades.length - winners.length,
      win_rate: closedTrades.length > 0 ? parseFloat(((winners.length / closedTrades.length) * 100).toFixed(1)) : 0,
      total_pnl: parseFloat(totalPnl.toFixed(2)),
      profit_factor: 1.4 + Math.random() * 0.6,
      balance: 10000 + totalPnl,
      max_drawdown_pct: parseFloat((2 + Math.random() * 3).toFixed(1)),
      sharpe_ratio: parseFloat((0.8 + Math.random() * 1.2).toFixed(2)),
    },
  };
}

// ── Public API ──

export async function getEngineTrades(): Promise<{ trades: EngineTradeRecord[]; isDemo: boolean }> {
  const data = await fetchEngine<{ trades: EngineTradeRecord[] }>("/api/trades");
  if (data) return { trades: data.trades, isDemo: false };
  return { trades: generateDemoTrades(25), isDemo: true };
}

export async function getEnginePositions(): Promise<{ positions: EngineTradeRecord[]; isDemo: boolean }> {
  const data = await fetchEngine<{ positions: EngineTradeRecord[] }>("/api/positions");
  if (data) return { positions: data.positions, isDemo: false };
  const demoTrades = generateDemoTrades(25);
  return { positions: demoTrades.filter(t => t.status === "open"), isDemo: true };
}

export async function getEngineEquity(): Promise<{ equity: EquityPoint[]; isDemo: boolean }> {
  const data = await fetchEngine<{ equity: EquityPoint[] }>("/api/equity");
  if (data) return { equity: data.equity, isDemo: false };
  return { equity: generateDemoEquity(30), isDemo: true };
}

export async function getEngineStatus(): Promise<{ status: EngineStatus; isDemo: boolean }> {
  const data = await fetchEngine<EngineStatus>("/api/dashboard");
  if (data) return { status: data, isDemo: false };
  return { status: getDemoStatus(), isDemo: true };
}

export type { EngineTradeRecord, EngineStatus, EquityPoint };
