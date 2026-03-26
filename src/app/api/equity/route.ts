import { NextResponse } from "next/server";
import {
  getAccount,
  getEquityHistory,
  getClosedTrades,
  isOandaConfigured,
  getConnectionInfo,
} from "@/lib/capital-com";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "1M";

    if (!isOandaConfigured()) {
      return NextResponse.json({
        success: false,
        error: "OANDA v20 not configured. Set OANDA_V20_API_KEY and OANDA_V20_ACCOUNT_ID env vars.",
        connection: getConnectionInfo(),
      }, { status: 503 });
    }

    // Period to days
    const daysMap: Record<string, number> = {
      "1D": 1, "1W": 7, "1M": 30, "3M": 90, "ALL": 365,
    };
    const days = daysMap[period] || 30;

    // Fetch account, equity history, and recent trades in parallel
    const [account, txHistory, recentTrades] = await Promise.all([
      getAccount(),
      getEquityHistory(days),
      getClosedTrades(100),
    ]);

    // Build equity curve from transaction history
    let equityPoints: Array<{
      timestamp: string;
      balance: number;
      equity: number;
      drawdown_pct: number;
    }> = [];

    if (txHistory.length > 0) {
      let peak = txHistory[0].balance;
      equityPoints = txHistory.map((tx) => {
        if (tx.balance > peak) peak = tx.balance;
        const drawdown = peak > 0 ? ((peak - tx.balance) / peak) * 100 : 0;
        return {
          timestamp: tx.timestamp,
          balance: tx.balance,
          equity: tx.balance,
          drawdown_pct: parseFloat(drawdown.toFixed(2)),
        };
      });
    }

    // If we have account but no transaction history, show current point
    if (equityPoints.length === 0 && account) {
      equityPoints.push({
        timestamp: new Date().toISOString(),
        balance: account.balance,
        equity: account.nav,
        drawdown_pct: 0,
      });
    }

    // Calculate summary
    const closedPnl = recentTrades
      .filter((t) => t.pnl !== null)
      .reduce((s, t) => s + (t.pnl ?? 0), 0);

    const startingBalance = account
      ? account.balance - closedPnl
      : equityPoints.length > 0
        ? equityPoints[0].balance
        : 0;

    const currentBalance = account?.balance ?? (
      equityPoints.length > 0 ? equityPoints[equityPoints.length - 1].balance : 0
    );

    let maxDrawdown = 0;
    if (equityPoints.length > 0) {
      let peak = equityPoints[0].balance;
      for (const pt of equityPoints) {
        if (pt.balance > peak) peak = pt.balance;
        const dd = peak > 0 ? ((peak - pt.balance) / peak) * 100 : 0;
        if (dd > maxDrawdown) maxDrawdown = dd;
      }
    }

    const totalReturn = startingBalance > 0
      ? ((currentBalance - startingBalance) / startingBalance) * 100
      : 0;

    return NextResponse.json({
      success: true,
      live: true,
      connection: getConnectionInfo(),
      equity: equityPoints,
      account: account
        ? {
            balance: account.balance,
            nav: account.nav,
            unrealized_pnl: account.unrealized_pnl,
            currency: account.currency,
          }
        : null,
      summary: {
        starting_balance: parseFloat(startingBalance.toFixed(2)),
        current_balance: parseFloat(currentBalance.toFixed(2)),
        total_return_pct: parseFloat(totalReturn.toFixed(2)),
        max_drawdown_pct: parseFloat(maxDrawdown.toFixed(2)),
        total_pnl: parseFloat(closedPnl.toFixed(2)),
        data_points: equityPoints.length,
      },
      period,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Equity API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch equity data from OANDA" },
      { status: 500 }
    );
  }
}
