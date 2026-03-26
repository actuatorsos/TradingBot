import { NextResponse } from "next/server";
import { getClosedTrades, isOandaConfigured, getConnectionInfo } from "@/lib/oanda-v20";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isOandaConfigured()) {
      return NextResponse.json({
        success: false,
        error: "OANDA v20 not configured",
        connection: getConnectionInfo(),
      }, { status: 503 });
    }

    const rawTrades = await getClosedTrades(200);

    const closedTrades = rawTrades
      .filter((t) => t.status === "closed" && t.pnl != null)
      .map((t) => ({ ...t, pnl: t.pnl as number }));
    const wins = closedTrades.filter((t) => t.pnl > 0);
    const losses = closedTrades.filter((t) => t.pnl <= 0);

    const totalPnl = closedTrades.reduce((s, t) => s + t.pnl, 0);
    const winRate =
      closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
    const avgWin =
      wins.length > 0
        ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length
        : 0;
    const avgLoss =
      losses.length > 0
        ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length)
        : 0;
    const profitFactor =
      avgLoss > 0
        ? (avgWin * wins.length) / (avgLoss * losses.length)
        : wins.length > 0
          ? Infinity
          : 0;

    // Calculate returns for Sharpe/Sortino
    const returns = closedTrades.map((t) => t.pnl);
    const avgReturn =
      returns.length > 0
        ? returns.reduce((s, r) => s + r, 0) / returns.length
        : 0;
    const variance =
      returns.length > 1
        ? returns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) /
          (returns.length - 1)
        : 0;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

    // Sortino (only downside deviation)
    const negReturns = returns.filter((r) => r < 0);
    const downsideVariance =
      negReturns.length > 1
        ? negReturns.reduce((s, r) => s + Math.pow(r, 2), 0) / negReturns.length
        : 0;
    const downsideDev = Math.sqrt(downsideVariance);
    const sortinoRatio =
      downsideDev > 0 ? (avgReturn / downsideDev) * Math.sqrt(252) : 0;

    // Max drawdown from trade sequence
    let peak = 0,
      maxDrawdown = 0,
      runningPnl = 0;
    for (const t of closedTrades) {
      runningPnl += t.pnl;
      if (runningPnl > peak) peak = runningPnl;
      const dd = peak - runningPnl;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }
    const maxDrawdownPct = peak > 0 ? (maxDrawdown / peak) * 100 : 0;

    // Expectancy
    const expectancy =
      closedTrades.length > 0
        ? (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss
        : 0;

    // Recovery factor
    const recoveryFactor = maxDrawdown > 0 ? totalPnl / maxDrawdown : 0;

    // Calmar ratio (annualized return / max drawdown)
    const calmarRatio = maxDrawdownPct > 0 ? totalPnl / maxDrawdownPct : 0;

    // Consecutive streaks
    let maxWinStreak = 0,
      maxLossStreak = 0,
      currentStreak = 0,
      streakType = "";
    for (const t of closedTrades) {
      const isWin = t.pnl > 0;
      if (
        (isWin && streakType === "win") ||
        (!isWin && streakType === "loss")
      ) {
        currentStreak++;
      } else {
        currentStreak = 1;
        streakType = isWin ? "win" : "loss";
      }
      if (streakType === "win" && currentStreak > maxWinStreak)
        maxWinStreak = currentStreak;
      if (streakType === "loss" && currentStreak > maxLossStreak)
        maxLossStreak = currentStreak;
    }

    // Monthly breakdown
    const monthly: Record<
      string,
      { pnl: number; trades: number; wins: number }
    > = {};
    for (const t of closedTrades) {
      const month = t.close_time
        ? t.close_time.substring(0, 7)
        : t.open_time.substring(0, 7);
      if (!monthly[month]) monthly[month] = { pnl: 0, trades: 0, wins: 0 };
      monthly[month].pnl += t.pnl;
      monthly[month].trades++;
      if (t.pnl > 0) monthly[month].wins++;
    }

    // Distribution bins
    const bins = [-Infinity, -50, -20, -10, 0, 10, 20, 50, Infinity];
    const distribution = bins.slice(0, -1).map((min, i) => {
      const range =
        min === -Infinity
          ? "<-50"
          : bins[i + 1] === Infinity
            ? ">50"
            : `${min} to ${bins[i + 1]}`;
      const count = closedTrades.filter(
        (t) => t.pnl >= min && t.pnl < bins[i + 1]
      ).length;
      return { range, count };
    });

    // Average duration
    const durations = closedTrades
      .filter((t) => t.open_time && t.close_time)
      .map(
        (t) =>
          (new Date(t.close_time!).getTime() -
            new Date(t.open_time).getTime()) /
          60000
      );
    const avgDuration =
      durations.length > 0
        ? durations.reduce((s, d) => s + d, 0) / durations.length
        : 0;

    return NextResponse.json({
      success: true,
      live: true,
      connection: getConnectionInfo(),
      metrics: {
        total_trades: closedTrades.length,
        win_rate: parseFloat(winRate.toFixed(2)),
        total_pnl: parseFloat(totalPnl.toFixed(2)),
        avg_win: parseFloat(avgWin.toFixed(2)),
        avg_loss: parseFloat(avgLoss.toFixed(2)),
        profit_factor: parseFloat(profitFactor.toFixed(2)),
        sharpe_ratio: parseFloat(sharpeRatio.toFixed(2)),
        sortino_ratio: parseFloat(sortinoRatio.toFixed(2)),
        calmar_ratio: parseFloat(calmarRatio.toFixed(2)),
        max_drawdown_pct: parseFloat(maxDrawdownPct.toFixed(2)),
        expectancy: parseFloat(expectancy.toFixed(2)),
        recovery_factor: parseFloat(recoveryFactor.toFixed(2)),
        max_win_streak: maxWinStreak,
        max_loss_streak: maxLossStreak,
        avg_duration_minutes: parseFloat(avgDuration.toFixed(0)),
        best_trade:
          closedTrades.length > 0
            ? Math.max(...closedTrades.map((t) => t.pnl))
            : 0,
        worst_trade:
          closedTrades.length > 0
            ? Math.min(...closedTrades.map((t) => t.pnl))
            : 0,
      },
      monthly: Object.entries(monthly)
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => a.month.localeCompare(b.month)),
      distribution,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Analytics calculation failed" },
      { status: 500 }
    );
  }
}
