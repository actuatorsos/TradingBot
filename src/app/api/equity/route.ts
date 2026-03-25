import { NextResponse } from "next/server";
import { getEngineEquity, getEngineStatus } from "@/lib/engine-client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "30d"; // 1d, 7d, 30d, 90d, all

    const [equityResult, statusResult] = await Promise.all([
      getEngineEquity(),
      getEngineStatus(),
    ]);

    let { equity } = equityResult;
    const { isDemo } = equityResult;
    const { status } = statusResult;

    // Filter by period
    const now = Date.now();
    const periodMs: Record<string, number> = {
      "1d": 86400000,
      "7d": 604800000,
      "30d": 2592000000,
      "90d": 7776000000,
    };

    if (period !== "all" && periodMs[period]) {
      equity = equity.filter(p => now - new Date(p.timestamp).getTime() < periodMs[period]);
    }

    // Downsample if too many points (max 500 for charting)
    if (equity.length > 500) {
      const step = Math.ceil(equity.length / 500);
      equity = equity.filter((_, i) => i % step === 0);
    }

    // Calculate equity curve stats
    const balances = equity.map(p => p.balance);
    const startBalance = balances[0] || 10000;
    const currentBalance = balances[balances.length - 1] || 10000;
    const maxBalance = Math.max(...balances);
    const minBalance = Math.min(...balances);
    const returns = ((currentBalance - startBalance) / startBalance) * 100;
    const maxDrawdown = Math.max(...equity.map(p => p.drawdown_pct));

    return NextResponse.json({
      success: true,
      demo_mode: isDemo,
      equity,
      stats: {
        start_balance: parseFloat(startBalance.toFixed(2)),
        current_balance: parseFloat(currentBalance.toFixed(2)),
        peak_balance: parseFloat(maxBalance.toFixed(2)),
        trough_balance: parseFloat(minBalance.toFixed(2)),
        total_return_pct: parseFloat(returns.toFixed(2)),
        max_drawdown_pct: parseFloat(maxDrawdown.toFixed(2)),
        performance: status.paper_performance,
      },
      period,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch equity data" },
      { status: 500 }
    );
  }
}
