"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Heart, Activity, Wifi, WifiOff, Clock, Cpu, MemoryStick, Zap,
  AlertCircle, CheckCircle
} from "lucide-react";

/* ═══════ INTERFACES ═══════ */
interface HealthStatus {
  connected: boolean;
  latency: number;
  engine_running: boolean;
  mode: "paper" | "live";
  cycle_count: number;
  last_signal: string;
  uptime: number;
  node_version: string;
  memory_usage: number;
  timestamp: string;
}

interface HealthResponse {
  success: boolean;
  data: HealthStatus | null;
  error?: string;
}

interface EndpointStatus {
  name: string;
  path: string;
  status: "ok" | "error";
  latency: number;
  lastChecked: number;
}

/* ═══════ SPARKLINE FOR LATENCY ═══════ */
function LatencySparkline({ data, width = 120, height = 40 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * (height - 8) - 4,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${pathD} L${width},${height} L0,${height} Z`} fill="url(#sparkline-gradient)" />
      <path d={pathD} stroke="#00f0ff" strokeWidth="1.5" fill="none" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2" fill="#00f0ff" />
    </svg>
  );
}

/* ═══════ SPOTLIGHT CARD (INLINE) ═══════ */
function SpotlightCard({ children, className = "", glowClass = "" }: { children: React.ReactNode; className?: string; glowClass?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--mouse-x", `${e.clientX - r.left}px`);
    ref.current.style.setProperty("--mouse-y", `${e.clientY - r.top}px`);
  };
  return (
    <div ref={ref} onMouseMove={onMove} className={`spotlight-card ${glowClass} ${className}`}>
      <div className="glass-sheen absolute inset-0 rounded-[16px] pointer-events-none" />
      {children}
    </div>
  );
}

/* ═══════ UPTIME BAR (24H TIMELINE) ═══════ */
function UptimeBar({ events }: { events: Array<{ time: number; connected: boolean }> }) {
  const segments = 24;
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const bars = Array.from({ length: segments }).map((_, i) => {
    const segStart = now - oneDay + (i / segments) * oneDay;
    const segEnd = now - oneDay + ((i + 1) / segments) * oneDay;
    const isConnected = events.some(e => e.time >= segStart && e.time < segEnd && e.connected);
    return (
      <div
        key={i}
        className={`flex-1 h-2 rounded-sm transition-colors ${
          isConnected ? "bg-green-500" : "bg-red-600"
        }`}
        title={new Date(segStart).toLocaleTimeString()}
      />
    );
  });
  return <div className="flex gap-0.5">{bars}</div>;
}

/* ═══════════════════════════════════════════
   ENGINE HEALTH MONITORING DASHBOARD
   ═══════════════════════════════════════════ */
export default function HealthDashboard() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
  const [uptimeEvents, setUptimeEvents] = useState<Array<{ time: number; connected: boolean }>>([]);
  const [endpoints, setEndpoints] = useState<EndpointStatus[]>([
    { name: "Market", path: "/api/market", status: "ok", latency: 0, lastChecked: 0 },
    { name: "Signals", path: "/api/signals", status: "ok", latency: 0, lastChecked: 0 },
    { name: "Positions", path: "/api/positions", status: "ok", latency: 0, lastChecked: 0 },
    { name: "Trades", path: "/api/trades", status: "ok", latency: 0, lastChecked: 0 },
  ]);

  const fetchHealth = useCallback(async () => {
    const start = performance.now();
    try {
      const res = await fetch("/api/engine/health");
      const duration = performance.now() - start;
      const json: HealthResponse = await res.json();

      if (json.success && json.data) {
        setHealth(json.data);
        setLatencyHistory(prev => [...prev.slice(-49), duration]);
        setUptimeEvents(prev => {
          const lastEvent = prev[prev.length - 1];
          if (!lastEvent || lastEvent.connected !== true) {
            return [...prev, { time: Date.now(), connected: true }];
          }
          return prev;
        });
      }
    } catch (err) {
      setUptimeEvents(prev => {
        const lastEvent = prev[prev.length - 1];
        if (!lastEvent || lastEvent.connected !== false) {
          return [...prev, { time: Date.now(), connected: false }];
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const checkEndpoints = useCallback(async () => {
    const checks = await Promise.all(
      endpoints.map(async ep => {
        const start = performance.now();
        try {
          const res = await fetch(ep.path, { method: "GET" });
          const duration = performance.now() - start;
          return { ...ep, status: (res.ok ? "ok" : "error") as "ok" | "error", latency: Math.round(duration), lastChecked: Date.now() };
        } catch {
          return { ...ep, status: "error" as const, latency: 0, lastChecked: Date.now() };
        }
      })
    );
    setEndpoints(checks);
  }, [endpoints]);

  useEffect(() => {
    fetchHealth();
    const healthInterval = setInterval(fetchHealth, 10000);
    return () => clearInterval(healthInterval);
  }, [fetchHealth]);

  useEffect(() => {
    checkEndpoints();
    const endpointInterval = setInterval(checkEndpoints, 15000);
    return () => clearInterval(endpointInterval);
  }, [checkEndpoints]);

  const isConnected = health?.connected ?? false;
  const uptime = health?.uptime ?? 0;
  const memoryMB = Math.round((health?.memory_usage ?? 0) / 1024 / 1024);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050810] to-[#0a0f1e] relative overflow-hidden">
      {/* Mesh background */}
      <div className="mesh-bg absolute inset-0" />

      <div className="relative z-10">
        {/* Header */}
        <div className="border-b border-[#1a2340] sticky top-0 backdrop-blur-sm bg-[#050810]/80 z-20">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Heart className="w-6 h-6 text-[#ff1744]" />
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>Engine Health</h1>
            </div>
            <div className="text-sm text-[#5a6a8a]">
              Last update: {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : "—"}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          {/* CONNECTION STATUS CARD */}
          <SpotlightCard className="relative overflow-hidden">
            <div className="p-8 space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-[#5a6a8a] mb-3">Connection Status</h2>
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center relative transition-all duration-500 ${
                      isConnected ? "bg-green-500/20 border border-green-500" : "bg-red-600/20 border border-red-600"
                    }`}>
                      {isConnected ? (
                        <Wifi className="w-8 h-8 text-green-500 animate-pulse" />
                      ) : (
                        <WifiOff className="w-8 h-8 text-red-600" />
                      )}
                    </div>
                    <div>
                      <div className="text-3xl font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {isConnected ? "Online" : "Offline"}
                      </div>
                      <div className={`text-sm mt-1 ${isConnected ? "text-green-400" : "text-red-400"}`}>
                        Latency: <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          {latencyHistory.length > 0 ? Math.round(latencyHistory[latencyHistory.length - 1]) : "—"}ms
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right space-y-3">
                  <div>
                    <div className="text-xs text-[#5a6a8a] mb-1">MODE</div>
                    <div className="text-lg font-bold uppercase" style={{ fontFamily: "'Outfit', sans-serif" }}>
                      <span className={health?.mode === "paper" ? "text-yellow-500" : "text-red-600"}>
                        {health?.mode || "—"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#5a6a8a] mb-1">STATE</div>
                    <div className={`text-lg font-bold ${health?.engine_running ? "text-green-400" : "text-[#5a6a8a]"}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                      {health?.engine_running ? "Running" : "Stopped"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Latency History Chart */}
              {latencyHistory.length > 0 && (
                <div className="pt-4 border-t border-[#1a2340]">
                  <div className="flex items-end justify-between mb-3">
                    <span className="text-xs uppercase tracking-wider text-[#5a6a8a]">Latency History (50 readings)</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }} className="text-xs text-[#00f0ff]">
                      Avg: {Math.round(latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length)}ms
                    </span>
                  </div>
                  <LatencySparkline data={latencyHistory} width={200} height={40} />
                </div>
              )}
            </div>
          </SpotlightCard>

          {/* ENGINE INFO GRID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SpotlightCard>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-[#00f0ff]" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[#5a6a8a]">Engine Stats</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#5a6a8a]">Cycle Count</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }} className="font-bold text-[#00e676]">
                      {health?.cycle_count || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#5a6a8a]">Last Signal</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }} className="text-xs text-[#5a6a8a]">
                      {health?.last_signal ? new Date(health.last_signal).toLocaleTimeString() : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </SpotlightCard>

            <SpotlightCard>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-[#00f0ff]" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[#5a6a8a]">Dashboard</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#5a6a8a]">Uptime</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }} className="font-bold text-[#00e676]">
                      {uptime ? `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#5a6a8a]">Node Version</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }} className="text-xs text-[#5a6a8a]">
                      {health?.node_version || "—"}
                    </span>
                  </div>
                </div>
              </div>
            </SpotlightCard>

            <SpotlightCard>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <MemoryStick className="w-4 h-4 text-[#00f0ff]" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[#5a6a8a]">Resources</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#5a6a8a]">Memory Usage</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }} className="font-bold text-[#00e676]">
                      {memoryMB}MB
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#5a6a8a]">Status</span>
                    <span className={`text-xs font-semibold ${health?.connected ? "text-green-400" : "text-red-400"}`}>
                      {health?.connected ? "Healthy" : "Disconnected"}
                    </span>
                  </div>
                </div>
              </div>
            </SpotlightCard>
          </div>

          {/* UPTIME BAR (24H) */}
          <SpotlightCard>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-[#00f0ff]" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[#5a6a8a]">Uptime Timeline (Last 24h)</h3>
              </div>
              <UptimeBar events={uptimeEvents} />
              <div className="flex gap-4 text-xs mt-4 pt-4 border-t border-[#1a2340]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-sm bg-green-500" />
                  <span className="text-[#5a6a8a]">Connected</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-sm bg-red-600" />
                  <span className="text-[#5a6a8a]">Disconnected</span>
                </div>
              </div>
            </div>
          </SpotlightCard>

          {/* API ENDPOINTS STATUS GRID */}
          <SpotlightCard>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#00f0ff]" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[#5a6a8a]">API Endpoints</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {endpoints.map(ep => (
                  <div key={ep.path} className="border border-[#1a2340] rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{ep.name}</span>
                      <div className={`w-2 h-2 rounded-full ${ep.status === "ok" ? "bg-green-500" : "bg-red-600"}`} />
                    </div>
                    <div className="text-xs text-[#5a6a8a]">{ep.path}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace" }} className="text-xs text-[#00f0ff]">
                      {ep.latency}ms
                    </div>
                    <div className="text-[10px] text-[#5a6a8a] mt-2">
                      {ep.lastChecked ? `${Math.round((Date.now() - ep.lastChecked) / 1000)}s ago` : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </div>
  );
}
