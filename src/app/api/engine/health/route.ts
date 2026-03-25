import { NextResponse } from "next/server";
import { getEngineUrl } from "@/lib/engine-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const engineUrl = getEngineUrl();
  const startTime = Date.now();

  try {
    const res = await fetch(`${engineUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const latency = Date.now() - startTime;
    const data = await res.json();

    return NextResponse.json({
      success: true,
      engine: {
        status: data.status || "unknown",
        running: data.engine_running || false,
        latency_ms: latency,
        url: engineUrl,
        timestamp: data.timestamp,
      },
      dashboard: {
        status: "healthy",
        uptime_seconds: Math.floor(process.uptime()),
        node_version: process.version,
        memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
    });
  } catch {
    return NextResponse.json({
      success: true,
      engine: {
        status: "unreachable",
        running: false,
        latency_ms: Date.now() - startTime,
        url: engineUrl,
        timestamp: null,
      },
      dashboard: {
        status: "healthy",
        uptime_seconds: Math.floor(process.uptime()),
        node_version: process.version,
        memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
    });
  }
}
