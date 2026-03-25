"use client";

import { useState, useEffect, useRef } from "react";
import {
  Shield,
  TrendingUp,
  BarChart3,
  Bell,
  Save,
  ArrowLeft,
  Check,
  AlertTriangle,
  Zap,
  Settings2,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";

/* ─── Interfaces ─── */
interface Settings {
  risk: {
    daily_drawdown_pct: number;
    risk_per_trade_pct: number;
    max_consecutive_losses: number;
    circuit_breaker: boolean;
    max_open_trades: number;
    max_daily_trades: number;
  };
  trading: {
    pair: string;
    timeframe: string;
    lot_size: number;
    stop_loss_pips: number;
    take_profit_pips: number;
    trailing_stop_pips: number;
  };
  strategy: {
    min_confidence: number;
    rsi_period: number;
    rsi_oversold: number;
    rsi_overbought: number;
    ema_fast: number;
    ema_slow: number;
    bollinger_period: number;
    bollinger_std: number;
  };
  notifications: {
    telegram_enabled: boolean;
    telegram_bot_token: string;
    telegram_chat_id: string;
  };
}

/* ─── Spotlight Card ─── */
function SpotlightCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    cardRef.current.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    cardRef.current.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };
  return (
    <div ref={cardRef} onMouseMove={handleMouseMove} className={`spotlight-card ${className}`}>
      <div className="glass-sheen absolute inset-0 rounded-[16px] pointer-events-none" />
      {children}
    </div>
  );
}

/* ─── Input Components ─── */
function NumberInput({ label, value, onChange, min, max, step = 1, unit, description }: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; unit?: string; description?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-apex-muted mb-1.5 font-medium">{label}</label>
      <div className="flex items-center gap-2">
        <input type="number" value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min} max={max} step={step}
          className="input-glass" />
        {unit && <span className="text-xs text-apex-muted font-mono whitespace-nowrap">{unit}</span>}
      </div>
      {description && <p className="text-[10px] text-apex-muted/50 mt-1">{description}</p>}
    </div>
  );
}

function SelectInput({ label, value, onChange, options, description }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; description?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-apex-muted mb-1.5 font-medium">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input-glass">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {description && <p className="text-[10px] text-apex-muted/50 mt-1">{description}</p>}
    </div>
  );
}

function ToggleInput({ label, value, onChange, description }: {
  label: string; value: boolean; onChange: (v: boolean) => void; description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <span className="text-sm text-white">{label}</span>
        {description && <p className="text-[10px] text-apex-muted/50 mt-0.5">{description}</p>}
      </div>
      <button onClick={() => onChange(!value)}
        className={`toggle-switch ${value ? "active" : ""}`} />
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-apex-muted mb-1.5 font-medium">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} className="input-glass" />
    </div>
  );
}

/* ═══════ SETTINGS PAGE ═══════ */
export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => { setSettings(d.settings); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } catch {} finally { setSaving(false); }
  };

  const handleReset = () => {
    setSettings({
      risk: { daily_drawdown_pct: 5.0, risk_per_trade_pct: 1.0, max_consecutive_losses: 5, circuit_breaker: true, max_open_trades: 3, max_daily_trades: 20 },
      trading: { pair: "EUR_USD", timeframe: "M5", lot_size: 0.01, stop_loss_pips: 15, take_profit_pips: 25, trailing_stop_pips: 10 },
      strategy: { min_confidence: 72, rsi_period: 14, rsi_oversold: 30, rsi_overbought: 70, ema_fast: 20, ema_slow: 50, bollinger_period: 20, bollinger_std: 2.0 },
      notifications: { telegram_enabled: false, telegram_bot_token: "", telegram_chat_id: "" },
    });
  };

  const update = <S extends keyof Settings>(section: S, key: keyof Settings[S], value: Settings[S][keyof Settings[S]]) => {
    if (!settings) return;
    setSettings({ ...settings, [section]: { ...settings[section], [key]: value } });
  };

  if (loading || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-apex-card border border-apex-border flex items-center justify-center animate-pulse">
            <Settings2 className="w-6 h-6 text-apex-accent" />
          </div>
          <div className="text-sm text-apex-muted font-mono">Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 min-h-screen p-4 md:p-6 lg:p-8 max-w-[1100px] mx-auto">
      {/* ═══════ HEADER ═══════ */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 animate-fade-in">
        <div className="flex items-center gap-4">
          <Link href="/" className="btn-glass">
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-apex-accent/10 border border-apex-accent/20 flex items-center justify-center">
              <Settings2 className="w-4 h-4 text-apex-accent" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Settings</h1>
              <p className="text-[10px] text-apex-muted font-mono">Configure trading parameters</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={handleReset} className="btn-glass">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button onClick={handleSave} disabled={saving}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
              saved ? "bg-apex-green/15 border border-apex-green/30 text-apex-green shadow-[0_0_20px_rgba(0,230,118,0.1)]"
                : "bg-apex-accent/10 border border-apex-accent/25 text-apex-accent hover:bg-apex-accent/15 hover:shadow-[0_0_20px_rgba(0,240,255,0.08)]"
            }`}>
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
          </button>
        </div>
      </header>

      {/* ═══════ SETTINGS GRID ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Risk Management */}
        <SpotlightCard className="p-6 animate-slide-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-apex-red/10 border border-apex-red/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-apex-red" />
            </div>
            <h2 className="text-base font-semibold text-white">Risk Management</h2>
          </div>
          <div className="space-y-4">
            <NumberInput label="Daily Drawdown Limit" value={settings.risk.daily_drawdown_pct}
              onChange={(v) => update("risk", "daily_drawdown_pct", v)} min={0.5} max={20} step={0.5} unit="%"
              description="Maximum daily loss before trading stops" />
            <NumberInput label="Risk Per Trade" value={settings.risk.risk_per_trade_pct}
              onChange={(v) => update("risk", "risk_per_trade_pct", v)} min={0.1} max={5} step={0.1} unit="%"
              description="Percentage of balance risked per trade" />
            <NumberInput label="Max Consecutive Losses" value={settings.risk.max_consecutive_losses}
              onChange={(v) => update("risk", "max_consecutive_losses", v)} min={1} max={20} step={1}
              description="Pause trading after this many losses in a row" />
            <NumberInput label="Max Open Trades" value={settings.risk.max_open_trades}
              onChange={(v) => update("risk", "max_open_trades", v)} min={1} max={10} step={1}
              description="Maximum simultaneous positions" />
            <NumberInput label="Max Daily Trades" value={settings.risk.max_daily_trades}
              onChange={(v) => update("risk", "max_daily_trades", v)} min={1} max={100} step={1}
              description="Maximum trades per day" />
            <ToggleInput label="Circuit Breaker" value={settings.risk.circuit_breaker}
              onChange={(v) => update("risk", "circuit_breaker", v)}
              description="Auto-pause after consecutive losses" />
          </div>
        </SpotlightCard>

        {/* Trading Parameters */}
        <SpotlightCard className="p-6 animate-slide-up stagger-1">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-apex-green/10 border border-apex-green/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-apex-green" />
            </div>
            <h2 className="text-base font-semibold text-white">Trading Parameters</h2>
          </div>
          <div className="space-y-4">
            <SelectInput label="Trading Pair" value={settings.trading.pair}
              onChange={(v) => update("trading", "pair", v)}
              options={[
                { value: "EUR_USD", label: "EUR/USD" }, { value: "GBP_USD", label: "GBP/USD" },
                { value: "USD_JPY", label: "USD/JPY" }, { value: "AUD_USD", label: "AUD/USD" },
                { value: "USD_CHF", label: "USD/CHF" }, { value: "EUR_GBP", label: "EUR/GBP" },
                { value: "NZD_USD", label: "NZD/USD" }, { value: "USD_CAD", label: "USD/CAD" },
              ]} />
            <SelectInput label="Timeframe" value={settings.trading.timeframe}
              onChange={(v) => update("trading", "timeframe", v)}
              options={[
                { value: "M1", label: "1 Minute" }, { value: "M5", label: "5 Minutes" },
                { value: "M15", label: "15 Minutes" }, { value: "M30", label: "30 Minutes" },
                { value: "H1", label: "1 Hour" }, { value: "H4", label: "4 Hours" },
                { value: "D1", label: "Daily" },
              ]} />
            <NumberInput label="Lot Size" value={settings.trading.lot_size}
              onChange={(v) => update("trading", "lot_size", v)} min={0.01} max={10} step={0.01} unit="lots"
              description="Base position size" />
            <NumberInput label="Stop Loss" value={settings.trading.stop_loss_pips}
              onChange={(v) => update("trading", "stop_loss_pips", v)} min={5} max={100} step={1} unit="pips" />
            <NumberInput label="Take Profit" value={settings.trading.take_profit_pips}
              onChange={(v) => update("trading", "take_profit_pips", v)} min={5} max={200} step={1} unit="pips" />
            <NumberInput label="Trailing Stop" value={settings.trading.trailing_stop_pips}
              onChange={(v) => update("trading", "trailing_stop_pips", v)} min={0} max={50} step={1} unit="pips"
              description="0 = disabled" />
          </div>
        </SpotlightCard>

        {/* Strategy / Indicators */}
        <SpotlightCard className="p-6 animate-slide-up stagger-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-apex-accent/10 border border-apex-accent/20 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-apex-accent" />
            </div>
            <h2 className="text-base font-semibold text-white">Strategy / Indicators</h2>
          </div>
          <div className="space-y-4">
            <NumberInput label="Minimum Confidence" value={settings.strategy.min_confidence}
              onChange={(v) => update("strategy", "min_confidence", v)} min={50} max={95} step={1} unit="%"
              description="Minimum confluence score to trigger a trade" />

            <div className="border-t border-white/[0.04] pt-4">
              <p className="text-[10px] text-apex-accent font-mono uppercase tracking-[0.15em] mb-3">RSI Settings</p>
              <div className="grid grid-cols-3 gap-3">
                <NumberInput label="Period" value={settings.strategy.rsi_period}
                  onChange={(v) => update("strategy", "rsi_period", v)} min={5} max={30} />
                <NumberInput label="Oversold" value={settings.strategy.rsi_oversold}
                  onChange={(v) => update("strategy", "rsi_oversold", v)} min={10} max={40} />
                <NumberInput label="Overbought" value={settings.strategy.rsi_overbought}
                  onChange={(v) => update("strategy", "rsi_overbought", v)} min={60} max={90} />
              </div>
            </div>

            <div className="border-t border-white/[0.04] pt-4">
              <p className="text-[10px] text-apex-accent font-mono uppercase tracking-[0.15em] mb-3">EMA Crossover</p>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Fast Period" value={settings.strategy.ema_fast}
                  onChange={(v) => update("strategy", "ema_fast", v)} min={5} max={50} />
                <NumberInput label="Slow Period" value={settings.strategy.ema_slow}
                  onChange={(v) => update("strategy", "ema_slow", v)} min={20} max={200} />
              </div>
            </div>

            <div className="border-t border-white/[0.04] pt-4">
              <p className="text-[10px] text-apex-accent font-mono uppercase tracking-[0.15em] mb-3">Bollinger Bands</p>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Period" value={settings.strategy.bollinger_period}
                  onChange={(v) => update("strategy", "bollinger_period", v)} min={10} max={50} />
                <NumberInput label="Std Dev" value={settings.strategy.bollinger_std}
                  onChange={(v) => update("strategy", "bollinger_std", v)} min={1} max={4} step={0.1} />
              </div>
            </div>
          </div>
        </SpotlightCard>

        {/* Notifications */}
        <SpotlightCard className="p-6 animate-slide-up stagger-3">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-apex-amber/10 border border-apex-amber/20 flex items-center justify-center">
              <Bell className="w-4 h-4 text-apex-amber" />
            </div>
            <h2 className="text-base font-semibold text-white">Notifications</h2>
          </div>
          <div className="space-y-4">
            <ToggleInput label="Telegram Alerts" value={settings.notifications.telegram_enabled}
              onChange={(v) => update("notifications", "telegram_enabled", v)}
              description="Send trade signals to Telegram" />
            {settings.notifications.telegram_enabled && (
              <>
                <TextInput label="Bot Token" value={settings.notifications.telegram_bot_token}
                  onChange={(v) => update("notifications", "telegram_bot_token", v)}
                  placeholder="123456:ABC-DEF1234ghIkl..." type="password" />
                <TextInput label="Chat ID" value={settings.notifications.telegram_chat_id}
                  onChange={(v) => update("notifications", "telegram_chat_id", v)}
                  placeholder="-1001234567890" />
              </>
            )}
          </div>

          {/* Info box */}
          <div className="mt-6 p-4 rounded-xl bg-apex-amber/[0.04] border border-apex-amber/[0.12]">
            <div className="flex gap-3">
              <AlertTriangle className="w-4 h-4 text-apex-amber flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-apex-amber font-medium mb-1">Note</p>
                <p className="text-[10px] text-apex-muted leading-relaxed">
                  Settings are saved on the server. On Vercel&apos;s free tier,
                  the file system is ephemeral &mdash; settings will reset on
                  redeploy. For persistent storage, consider Vercel KV or an external database.
                </p>
              </div>
            </div>
          </div>
        </SpotlightCard>
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-[10px] text-apex-muted/40 font-mono pb-4 tracking-wider">
        APEX TRADER AI &middot; Settings Panel &middot; Changes take effect on next signal analysis
      </footer>
    </div>
  );
}
