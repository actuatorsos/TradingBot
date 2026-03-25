import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const SETTINGS_PATH = join(process.cwd(), "settings.json");

// Default settings
const DEFAULTS = {
  risk: {
    daily_drawdown_pct: 5.0,
    risk_per_trade_pct: 1.0,
    max_consecutive_losses: 5,
    circuit_breaker: true,
    max_open_trades: 3,
    max_daily_trades: 20,
  },
  trading: {
    pair: "EUR_USD",
    timeframe: "M5",
    lot_size: 0.01,
    stop_loss_pips: 15,
    take_profit_pips: 25,
    trailing_stop_pips: 10,
  },
  strategy: {
    min_confidence: 72,
    rsi_period: 14,
    rsi_oversold: 30,
    rsi_overbought: 70,
    ema_fast: 20,
    ema_slow: 50,
    bollinger_period: 20,
    bollinger_std: 2.0,
  },
  notifications: {
    telegram_enabled: false,
    telegram_bot_token: "",
    telegram_chat_id: "",
  },
};

async function loadSettings() {
  try {
    const data = await readFile(SETTINGS_PATH, "utf-8");
    return { ...DEFAULTS, ...JSON.parse(data) };
  } catch {
    return DEFAULTS;
  }
}

async function saveSettings(settings: typeof DEFAULTS) {
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await loadSettings();
  return NextResponse.json({ success: true, settings });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const current = await loadSettings();
    const updated = {
      risk: { ...current.risk, ...body.risk },
      trading: { ...current.trading, ...body.trading },
      strategy: { ...current.strategy, ...body.strategy },
      notifications: { ...current.notifications, ...body.notifications },
    };
    await saveSettings(updated);
    return NextResponse.json({ success: true, settings: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
