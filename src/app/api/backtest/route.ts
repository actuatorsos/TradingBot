import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      pair = "EUR_USD",
      period = "1M",
      sl_pips = 15,
      tp_pips = 25,
      min_confidence = 72,
    } = body;

    // Generate historical candle data for backtesting
    const periodDays: Record<string, number> = { "1W": 7, "1M": 30, "3M": 90, "6M": 180 };
    const days = periodDays[period] || 30;
    const candleCount = days * 288; // 288 M5 candles per day

    const priceMap: Record<string, number> = {
      "EUR_USD": 1.0850, "GBP_USD": 1.2650, "USD_JPY": 149.50,
      "AUD_USD": 0.6540, "USD_CAD": 1.3580, "USD_CHF": 0.8750,
    };
    const basePrice = priceMap[pair] || 1.0850;
    const pip = pair.includes("JPY") ? 0.01 : 0.0001;
    const volatility = pair.includes("JPY") ? 0.3 : 0.0003;

    // Generate realistic candles with trends and mean reversion
    const candles = [];
    let price = basePrice;
    let trend = 0;
    const now = Date.now();

    for (let i = candleCount - 1; i >= 0; i--) {
      // Add trending behavior
      if (Math.random() < 0.02) trend = (Math.random() - 0.5) * volatility * 0.5;
      if (Math.random() < 0.005) trend = 0; // Mean reversion

      const change = trend + (Math.random() - 0.5) * volatility * 2;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * volatility * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * 0.5;
      const volume = Math.floor(500 + Math.random() * 2000);

      const time = new Date(now - i * 5 * 60000);
      candles.push({
        time: time.toISOString(),
        open: parseFloat(open.toFixed(pair.includes("JPY") ? 3 : 5)),
        high: parseFloat(high.toFixed(pair.includes("JPY") ? 3 : 5)),
        low: parseFloat(low.toFixed(pair.includes("JPY") ? 3 : 5)),
        close: parseFloat(close.toFixed(pair.includes("JPY") ? 3 : 5)),
        volume,
      });
      price = close;
    }

    // Run simplified backtest (mirrors Python engine logic)
    const trades: any[] = [];
    let balance = 10000;
    let peakBalance = balance;
    let maxDrawdown = 0;
    const equity: any[] = [{ candle: 0, balance }];
    let tradeId = 0;
    const openTrades: any[] = [];

    // Simple EMA calculation
    const ema = (data: number[], period: number) => {
      const k = 2 / (period + 1);
      const result = [data[0]];
      for (let i = 1; i < data.length; i++) result.push(data[i] * k + result[i-1] * (1-k));
      return result;
    };

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    for (let i = 50; i < candles.length; i++) {
      const currentPrice = candles[i].close;

      // Check SL/TP for open trades
      for (let j = openTrades.length - 1; j >= 0; j--) {
        const t = openTrades[j];
        let hitSL = false, hitTP = false;

        if (t.direction === "BUY") {
          hitSL = candles[i].low <= t.sl;
          hitTP = candles[i].high >= t.tp;
        } else {
          hitSL = candles[i].high >= t.sl;
          hitTP = candles[i].low <= t.tp;
        }

        if (hitTP || hitSL) {
          const exitPrice = hitTP ? t.tp : t.sl;
          const pnlPips = t.direction === "BUY"
            ? (exitPrice - t.entry) / pip
            : (t.entry - exitPrice) / pip;
          const pnl = pnlPips * pip * 10000;
          balance += pnl;

          trades.push({
            id: t.id, pair, direction: t.direction,
            entry: t.entry, exit: parseFloat(exitPrice.toFixed(5)),
            pnl: parseFloat(pnl.toFixed(2)),
            pips: parseFloat(pnlPips.toFixed(1)),
            status: hitTP ? "tp" : "sl",
            time: candles[i].time,
          });
          openTrades.splice(j, 1);
        }
      }

      if (balance > peakBalance) peakBalance = balance;
      const dd = peakBalance - balance;
      if (dd > maxDrawdown) maxDrawdown = dd;

      if (i % 50 === 0) equity.push({ candle: i, balance: parseFloat(balance.toFixed(2)) });

      // Signal generation (simplified)
      if (openTrades.length > 0) continue;

      const window = closes.slice(i - 50, i + 1);
      const emaFast = ema(window, 8);
      const emaSlow = ema(window, 21);

      let buyScore = 0, sellScore = 0;
      if (emaFast[emaFast.length-1] > emaSlow[emaSlow.length-1]) buyScore += 2;
      else sellScore += 2;

      // RSI approximation
      let gains = 0, losses_count = 0;
      for (let k = window.length - 14; k < window.length; k++) {
        const diff = window[k] - window[k-1];
        if (diff > 0) gains += diff; else losses_count += Math.abs(diff);
      }
      const rsi = 100 - (100 / (1 + gains / (losses_count || 0.0001)));
      if (rsi < 30) buyScore += 1.5;
      else if (rsi > 70) sellScore += 1.5;

      const maxScore = Math.max(buyScore, sellScore);
      const confidence = (maxScore / 3.5) * 100;

      if (confidence >= min_confidence) {
        tradeId++;
        const dir = buyScore > sellScore ? "BUY" : "SELL";
        openTrades.push({
          id: tradeId,
          direction: dir,
          entry: currentPrice,
          sl: dir === "BUY" ? currentPrice - sl_pips * pip : currentPrice + sl_pips * pip,
          tp: dir === "BUY" ? currentPrice + tp_pips * pip : currentPrice - tp_pips * pip,
        });
      }
    }

    equity.push({ candle: candles.length - 1, balance: parseFloat(balance.toFixed(2)) });

    const wins = trades.filter(t => t.pnl > 0);
    const lossTrades = trades.filter(t => t.pnl <= 0);
    const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
    const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
    const avgLoss = lossTrades.length > 0 ? Math.abs(lossTrades.reduce((s, t) => s + t.pnl, 0) / lossTrades.length) : 0;
    const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(lossTrades.reduce((s, t) => s + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

    return NextResponse.json({
      success: true,
      result: {
        pair,
        period,
        total_candles: candles.length,
        total_trades: trades.length,
        wins: wins.length,
        losses: lossTrades.length,
        win_rate: parseFloat(winRate.toFixed(1)),
        total_pnl: parseFloat(totalPnl.toFixed(2)),
        avg_win: parseFloat(avgWin.toFixed(2)),
        avg_loss: parseFloat(avgLoss.toFixed(2)),
        profit_factor: parseFloat(profitFactor.toFixed(2)),
        max_drawdown: parseFloat(maxDrawdown.toFixed(2)),
        max_drawdown_pct: parseFloat((peakBalance > 0 ? maxDrawdown / peakBalance * 100 : 0).toFixed(2)),
        starting_balance: 10000,
        final_balance: parseFloat(balance.toFixed(2)),
        return_pct: parseFloat(((balance - 10000) / 10000 * 100).toFixed(2)),
      },
      trades: trades.slice(-50), // Last 50 trades
      equity,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Backtest failed" },
      { status: 500 }
    );
  }
}
