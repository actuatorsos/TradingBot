"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  AlertTriangle, ShieldOff, XCircle, Power, Play, Loader,
  ChevronRight, AlertCircle, CheckCircle, Zap
} from "lucide-react";

/* ═══════ INTERFACES ═══════ */
interface KillSwitchStatus {
  active: boolean;
  timestamp: string;
  reason?: string;
}

interface PositionsSummary {
  total_positions: number;
  total_unrealized_pnl: number;
  demo: boolean;
}

interface KillSwitchResponse {
  success: boolean;
  data?: KillSwitchStatus;
  error?: string;
}

interface PositionsResponse {
  success: boolean;
  summary?: PositionsSummary;
  error?: string;
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

/* ═══════ CONFIRMATION MODAL ═══════ */
function ConfirmationModal({
  isOpen,
  title,
  message,
  actionLabel,
  isDangerous,
  onConfirm,
  onCancel,
  isLoading = false,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  actionLabel: string;
  isDangerous: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <SpotlightCard className="w-full max-w-md mx-4">
        <div className="p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDangerous ? "bg-red-600/20" : "bg-yellow-500/20"}`}>
              {isDangerous ? (
                <AlertTriangle className="w-6 h-6 text-red-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-yellow-500" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {title}
              </h2>
              <p className="text-sm text-[#5a6a8a] mt-2">{message}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 rounded-lg border border-[#1a2340] text-sm font-semibold transition-colors hover:bg-[#0e1525] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                isDangerous
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-yellow-500 hover:bg-yellow-600 text-black"
              } disabled:opacity-50`}
            >
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                actionLabel
              )}
            </button>
          </div>
        </div>
      </SpotlightCard>
    </div>
  );
}

/* ═══════════════════════════════════════════
   EMERGENCY KILL SWITCH UI
   ═══════════════════════════════════════════ */
export default function KillSwitchPage() {
  const [killSwitchStatus, setKillSwitchStatus] = useState<KillSwitchStatus | null>(null);
  const [positions, setPositions] = useState<PositionsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal states
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const [killRes, posRes] = await Promise.all([
        fetch("/api/engine/kill-switch").then(r => r.json()),
        fetch("/api/positions").then(r => r.json()),
      ]);

      if (killRes.success && killRes.data) {
        setKillSwitchStatus(killRes.data);
      }
      if (posRes.success && posRes.summary) {
        setPositions(posRes.summary);
      }
    } catch (err) {
      console.error("Failed to fetch kill switch status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const executeAction = async (action: "activate" | "close_all" | "deactivate") => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/engine/kill-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const json: KillSwitchResponse = await res.json();
      if (json.success && json.data) {
        setKillSwitchStatus(json.data);
        setLastAction(action);
        setTimeout(() => setLastAction(null), 3000);
      }
    } catch (err) {
      console.error("Action failed:", err);
    } finally {
      setActionLoading(false);
      setShowActivateModal(false);
      setShowCloseModal(false);
      setShowDeactivateModal(false);
    }
  };

  const isActive = killSwitchStatus?.active ?? false;
  const openPositions = positions?.total_positions ?? 0;
  const unrealizedPnL = positions?.total_unrealized_pnl ?? 0;
  const isDemoMode = positions?.demo ?? true;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050810] via-[#0a0f1e] to-[#050810] relative overflow-hidden">
      {/* Aggressive mesh background with red tones */}
      <div className="absolute inset-0">
        <div className="mesh-bg absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-br from-red-600/[0.03] via-transparent to-red-600/[0.02] pointer-events-none" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="border-b border-red-900/30 sticky top-0 backdrop-blur-sm bg-[#050810]/90 z-20">
          <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center border border-red-600/50">
                <ShieldOff className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  Emergency Control
                </h1>
                <p className="text-xs text-[#5a6a8a] mt-1">Handle critical trading situations</p>
              </div>
            </div>
            <div className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${
              isActive ? "bg-red-600/20 border border-red-600 text-red-400" : "bg-green-600/20 border border-green-600 text-green-400"
            }`}>
              {isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
              {isActive ? "KILL SWITCH ACTIVE" : "System Normal"}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-16 space-y-12">
          {/* GIANT KILL SWITCH BUTTON */}
          <div className="flex flex-col items-center space-y-8">
            <div className="text-center space-y-3 mb-6">
              <h2 className="text-3xl font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {isActive ? "Kill Switch is Active" : "Immediate Trading Halt"}
              </h2>
              <p className="text-[#5a6a8a] max-w-2xl mx-auto">
                {isActive
                  ? "The kill switch is currently active. All trading has been halted. Resume trading when ready."
                  : "Click to immediately halt all trading activity and prevent new positions from opening."}
              </p>
            </div>

            {!isActive && (
              <button
                onClick={() => setShowActivateModal(true)}
                disabled={actionLoading}
                className="group relative w-64 h-64 rounded-full flex items-center justify-center transition-all duration-300 disabled:opacity-50"
                style={{
                  background: "conic-gradient(from 0deg, #ff1744 0%, #ff5252 25%, #ff1744 50%, #ff5252 75%, #ff1744 100%)",
                  backgroundSize: "200% 200%",
                  animation: "rotate 4s linear infinite",
                }}
              >
                <style>{`
                  @keyframes rotate {
                    0% { filter: drop-shadow(0 0 20px rgba(255, 23, 68, 0.6)); }
                    50% { filter: drop-shadow(0 0 40px rgba(255, 23, 68, 0.8)); }
                    100% { filter: drop-shadow(0 0 20px rgba(255, 23, 68, 0.6)); }
                  }
                `}</style>
                <div className="absolute inset-2 bg-gradient-to-b from-[#050810] to-[#0a0f1e] rounded-full flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <Power className="w-16 h-16 text-red-600" />
                    <div className="text-center">
                      <div className="text-3xl font-black tracking-wider text-red-600" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        KILL
                      </div>
                      <div className="text-3xl font-black tracking-wider text-red-600" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        SWITCH
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            )}

            {isActive && (
              <div className="text-center space-y-6">
                <div className="w-64 h-64 rounded-full flex items-center justify-center bg-gradient-to-b from-red-900/40 to-red-900/20 border-2 border-red-600/50">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-red-600/30 flex items-center justify-center border border-red-600">
                      <AlertTriangle className="w-10 h-10 text-red-600 animate-pulse" />
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-red-600" style={{ fontFamily: "'Outfit', sans-serif" }}>ACTIVE</div>
                      <div className="text-xs text-[#5a6a8a] mt-1">
                        {killSwitchStatus?.timestamp
                          ? `Since ${new Date(killSwitchStatus.timestamp).toLocaleTimeString()}`
                          : "Unknown"}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowDeactivateModal(true)}
                  disabled={actionLoading}
                  className="px-8 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  Resume Trading
                </button>
              </div>
            )}

            {/* Action Status */}
            {lastAction && (
              <div className="mt-6 px-6 py-3 rounded-lg bg-green-600/20 border border-green-600 text-green-400 text-sm font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Action executed successfully
              </div>
            )}
          </div>

          {/* POSITION INFO CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Current Positions */}
            <SpotlightCard>
              <div className="p-8 space-y-4">
                <div className="flex items-center gap-2 mb-6">
                  <AlertCircle className="w-5 h-5 text-[#ff1744]" />
                  <h3 className="text-lg font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>Open Positions</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-[#5a6a8a] mb-2">Total Positions</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace" }} className="text-4xl font-bold text-[#00f0ff]">
                      {openPositions}
                    </div>
                  </div>
                  {openPositions > 0 && (
                    <div className="pt-4 border-t border-[#1a2340]">
                      <div className="text-sm text-[#5a6a8a] mb-2">Unrealized P&L</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace" }} className={`text-2xl font-bold ${unrealizedPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {unrealizedPnL >= 0 ? "+" : ""}{unrealizedPnL.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </SpotlightCard>

            {/* Mode Indicator */}
            <SpotlightCard>
              <div className="p-8 space-y-6">
                <div className="flex items-center gap-2 mb-6">
                  <Zap className="w-5 h-5 text-[#ffab00]" />
                  <h3 className="text-lg font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>Trading Mode</h3>
                </div>
                <div className={`px-6 py-8 rounded-lg border-2 text-center ${
                  isDemoMode
                    ? "bg-yellow-600/20 border-yellow-600"
                    : "bg-red-600/20 border-red-600"
                }`}>
                  <div className="text-3xl font-black uppercase" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    <span className={isDemoMode ? "text-yellow-500" : "text-red-600"}>
                      {isDemoMode ? "Paper Trading" : "LIVE TRADING"}
                    </span>
                  </div>
                  <p className={`text-sm mt-3 ${isDemoMode ? "text-yellow-400/70" : "text-red-400/70"}`}>
                    {isDemoMode
                      ? "Currently in paper trading mode — no real funds at risk"
                      : "⚠️ Real money is being traded — use kill switch carefully"}
                  </p>
                </div>
              </div>
            </SpotlightCard>
          </div>

          {/* ACTION BUTTONS */}
          {openPositions > 0 && (
            <SpotlightCard>
              <div className="p-8 space-y-6">
                <h3 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  <Zap className="w-5 h-5 text-[#ffab00]" />
                  Position Management
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setShowCloseModal(true)}
                    disabled={actionLoading}
                    className="px-6 py-4 rounded-lg bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <XCircle className="w-5 h-5" />
                    Close All Positions
                  </button>
                  <div className="px-6 py-4 rounded-lg border border-[#1a2340] bg-[#0e1525]/50 flex items-center justify-center">
                    <p className="text-sm text-center text-[#5a6a8a]">
                      Force close all {openPositions} open position{openPositions !== 1 ? "s" : ""} at market price
                    </p>
                  </div>
                </div>
              </div>
            </SpotlightCard>
          )}

          {/* WARNING SECTION */}
          <SpotlightCard className="border-red-600/30">
            <div className="p-8 space-y-4">
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                <div className="space-y-3">
                  <h4 className="font-bold text-red-400" style={{ fontFamily: "'Outfit', sans-serif" }}>What Each Action Does</h4>
                  <ul className="space-y-2 text-sm text-[#5a6a8a]">
                    <li className="flex gap-3">
                      <span className="text-red-600 font-bold">•</span>
                      <span><strong className="text-white">Kill Switch:</strong> Halts all new trades immediately. Positions remain open until manually closed.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-red-600 font-bold">•</span>
                      <span><strong className="text-white">Close All Positions:</strong> Force closes all open positions at current market price. Cannot be undone.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-red-600 font-bold">•</span>
                      <span><strong className="text-white">Resume Trading:</strong> Deactivates kill switch and allows engine to resume normal operation.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </SpotlightCard>
        </div>
      </div>

      {/* MODALS */}
      <ConfirmationModal
        isOpen={showActivateModal}
        title="Activate Kill Switch?"
        message="This will immediately halt all trading activity. New positions will not be opened. Existing positions will remain open."
        actionLabel="Activate Kill Switch"
        isDangerous={true}
        onConfirm={() => executeAction("activate")}
        onCancel={() => setShowActivateModal(false)}
        isLoading={actionLoading}
      />

      <ConfirmationModal
        isOpen={showCloseModal}
        title="Close All Positions?"
        message={`This will force close all ${openPositions} open position${openPositions !== 1 ? "s" : ""} at current market prices. This action cannot be undone.`}
        actionLabel="Close All Positions"
        isDangerous={true}
        onConfirm={() => executeAction("close_all")}
        onCancel={() => setShowCloseModal(false)}
        isLoading={actionLoading}
      />

      <ConfirmationModal
        isOpen={showDeactivateModal}
        title="Resume Trading?"
        message="This will deactivate the kill switch and allow the engine to resume normal trading operations."
        actionLabel="Resume Trading"
        isDangerous={false}
        onConfirm={() => executeAction("deactivate")}
        onCancel={() => setShowDeactivateModal(false)}
        isLoading={actionLoading}
      />
    </div>
  );
}
