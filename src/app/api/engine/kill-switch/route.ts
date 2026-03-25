import { NextResponse } from "next/server";
import { getEngineUrl } from "@/lib/engine-client";

export const dynamic = "force-dynamic";

// GET: Check kill switch status
export async function GET() {
  try {
    const engineUrl = getEngineUrl();
    const res = await fetch(`${engineUrl}/api/dashboard`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return NextResponse.json({
      success: true,
      kill_switch_active: data?.risk?.kill_switch || false,
      engine_running: data?.running || false,
      mode: data?.mode || "unknown",
    });
  } catch {
    return NextResponse.json({
      success: true,
      kill_switch_active: false,
      engine_running: false,
      mode: "disconnected",
    });
  }
}

// POST: Activate/deactivate kill switch
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body; // "activate" | "deactivate" | "close_all"

    const engineUrl = getEngineUrl();

    if (action === "close_all") {
      // Close all open positions
      const res = await fetch(`${engineUrl}/api/close-all`, {
        method: "POST",
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      return NextResponse.json({
        success: true,
        action: "close_all",
        result: data,
      });
    }

    // Toggle kill switch
    const res = await fetch(`${engineUrl}/api/kill-switch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: action === "activate" }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return NextResponse.json({
      success: true,
      action,
      result: data,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Engine not reachable" },
      { status: 503 }
    );
  }
}
