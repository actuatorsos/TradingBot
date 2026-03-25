"use client";

import { useState, useEffect } from "react";
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
  Target,
  Settings2,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";

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

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  description,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  description?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-apex-muted mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
          className="w-full px-3 py-2.5 rounded-xl bg-apex-surface border border-apex-border text-white font-mono text-sm focus:outline-none focus:border-apex-accent/50 focus:ring-1 focus:ring-apex-accent/20 transition-all"
        />
        {unit && (
          <span className="text-sm text-apex-muted font-mono whitespace-nowrap">
            {unit}
          </span>
        )}
      </div>
      {description && (
        <p className="text-[11px] text-apex-muted/60 mt-1">{description}</p>
      )}
    </div>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
  description,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  description?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-apex-muted mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl bg-apex-surface border border-apex-border text-white font-mono text-sm focus:outline-none focus:border-apex-accent/50 appearance-none cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {description && (
        <p className="text-[11px] text-apex-muted/60 mt-1">{description}</p>
      )}
    </div>
  );
}

function ToggleInput({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <span className="text-sm text-white">{label}</span>
        {description && (
          <p className="text-[11px] text-apex-muted/60 mt-0.5">{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          value ? "bg-apex-green/30" : "bg-apex-surface"
        } border ${value ? "border-apex-green/50" : "border-apex-border"}`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${
            value
              ? "left-[calc(100%-22px)] bg-apex-green"
              : "left-0.5 bg-apex-muted"
          }`}
        />
      </button>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-apex-muted mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl bg-apex-surface border border-apex-border text-white font-mono text-sm focus:outline-none focus:border-apex-accent/50 focus:ring-1 focus:ring-apex-accent/20 transition-all placeholder:text-apex-muted/40"
      />
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setSettings(d.settings);
        setLoading(false);
      })
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
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings({
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
    });
  };

  const update = <S extends keyof Settings>(
    section: S,
    key: keyof Settings[S],
    value: Settings[S][keyof Settings[S]]
  ) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [section]: { ...settings[section], [key]: value },
    });
  };

  if (loading || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-apex-muted font-mono">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="relative z-10 min-h-screen p-4 md:p-6 lg:p-8 max-w-[1100px] mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-8 animate-fade-in">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-apex-border bg-apex-surface/50 hover:bg-apex-card text-apex-muted hover:text-white transition-all text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-apex-accent/20 to-apex-green/20 border border-apex-accent/30 flex items-center justify-center">
              <Settings2 className="w-5 h-5 text-apex-accent" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Settings</h1>
              <p className="text-xs text-apex-muted font-mono">
                Configure trading parameters
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-apex-border bg-apex-surface/50 hover:bg-apex-card text-apex-muted hover:text-white transition-all text-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              saved
                ? "bg-apex-green/20 border border-apex-green/40 text-apex-green"
                : "bg-apex-accent/10 border border-apex-accent/30 text-apex-accent hover:bg-apex-accent/20"
            }`}
          >
            {saved ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Management */}
        <div className="rounded-2xl border border-apex-border bg-apex-card/60 backdrop-blur-sm p-6 animate-slide-up">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-5 h-5 text-apex-red" />
            <h2 className="text-lg font-semibold text-white">
              Risk Management
            </h2>
          </div>
          <div className="space-y-5">
            <NumberInput
              label="Daily Drawdown Limit"
              value={settings.risk.daily_drawdown_pct}
              onChange={(v) => update("risk", "daily_drawdown_pct", v)}
              min={0.5}
              max={20}
              step={0.5}
              unit="%"
              description="Maximum daily loss before trading stops"
            />
            <NumberInput
              label="Risk Per Trade"
              value={settings.risk.risk_per_trade_pct}
              onChange={(v) => update("risk", "risk_per_trade_pct", v)}
              min={0.1}
              max={5}
              step={0.1}
              unit="%"
              description="Percentage of balance risked per trade"
            />
            <NumberInput
              label="Max Consecutive Losses"
              value={settings.risk.max_consecutive_losses}
              onChange={(v) => update("risk", "max_consecutive_losses", v)}
              min={1}
              max={20}
              step={1}
              description="Pause trading after this many losses in a row"
            />
            <NumberInput
              label="Max Open Trades"
              value={settings.risk.max_open_trades}
              onChange={(v) => update("risk", "max_open_trades", v)}
              min={1}
              max={10}
              step={1}
              description="Maximum simultaneous positions"
            />
            <NumberInput
              label="Max Daily Trades"
              value={settings.risk.max_daily_trades}
              onChange={(v) => update("risk", "max_daily_trades", v)}
              min={1}
              max={100}
              step={1}
              description="Maximum trades per day"
            />
            <ToggleInput
              label="Circuit Breaker"
              value={settings.risk.circuit_breaker}
              onChange={(v) => update("risk", "circuit_breaker", v)}
              description="Auto-pause after consecutive losses"
            />
          </div>
        </div>

        {/* Trading Parameters */}
        <div className="rounded-2xl border border-apex-border bg-apex-card/60 backdrop-blur-sm p-6 animate-slide-up stagger-1">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-5 h-5 text-apex-green" />
            <h2 className="text-lg font-semibold text-white">
              Trading Parameters
            </h2>
          </div>
          <div className="space-y-5">
            <SelectInput
              label="Trading Pair"
              value={settings.trading.pair}
              onChange={(v) => update("trading", "pair", v)}
              options={[
                { value: "EUR_USD", label: "EUR/USD" },
                { value: "GBP_USD", label: "GBP/USD" },
                { value: "USD_JPY", label: "USD/JPY" },
                { value: "AUD_USD", label: "AUD/USD" },
                { value: "USD_CHF", label: "USD/CHF" },
                { value: "EUR_GBP", label: "EUR/GBP" },
                { value: "NZD_USD", label: "NZD/USD" },
                { value: "USD_CAD", label: "USD/CAD" },
              ]}
            />
            <SelectInput
              label="Timeframe"
              value={settings.trading.timeframe}
              onChange={(v) => update("trading", "timeframe", v)}
              options={[
                { value: "M1", label: "1 Minute" },
                { value: "M5", label: "5 Minutes" },
                { value: "M15", label: "15 Minutes" },
                { value: "M30", label: "30 Minutes" },
                { value: "H1", label: "1 Hour" },
                { value: "H4", label: "4 Hours" },
                { value: "D1", label: "Daily" },
              ]}
            />
            <NumberInput
              label="Lot Size"
              value={settings.trading.lot_size}
              onChange={(v) => update("trading", "lot_size", v)}
              min={0.01}
              max={10}
              step={0.01}
              unit="lots"
              description="Base position size"
            />
            <NumberInput
              label="Stop Loss"
              value={settings.trading.stop_loss_pips}
              onChange={(v) => update("trading", "stop_loss_pips", v)}
              min={5}
              max={100}
              step={1}
              unit="pips"
            />
            <NumberInput
              label="Take Profit"
              value={settings.trading.take_profit_pips}
              onChange={(v) => update("trading", "take_profit_pips", v)}
              min={5}
              max={200}
              step={1}
              unit="pips"
            />
            <NumberInput
              label="Trailing Stop"
              value={settings.trading.trailing_stop_pips}
              onChange={(v) => update("trading", "trailing_stop_pips", v)}
              min={0}
              max={50}
              step={1}
              unit="pips"
              description="0 = disabled"
            />
          </div>
        </div>

        {/* Strategy / Indicators */}
        <div className="rounded-2xl border border-apex-border bg-apex-card/60 backdrop-blur-sm p-6 animate-slide-up stagger-2">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-5 h-5 text-apex-accent" />
            <h2 className="text-lg font-semibold text-white">
              Strategy / Indicators
            </h2>
          </div>
          <div className="space-y-5">
            <NumberInput
              label="Minimum Confidence"
              value={settings.strategy.min_confidence}
              onChange={(v) => update("strategy", "min_confidence", v)}
              min={50}
              max={95}
              step={1}
              unit="%"
              description="Minimum confluence score to trigger a trade"
            />
            <div className="border-t border-white/5 pt-4">
              <p className="text-xs text-apex-accent font-mono uppercase tracking-wider mb-4">
                RSI Settings
              </p>
              <div className="grid grid-cols-3 gap-3">
                <NumberInput
                  label="Period"
                  value={settings.strategy.rsi_period}
                  onChange={(v) => update("strategy", "rsi_period", v)}
                  min={5}
                  max={30}
                />
                <NumberInput
                  label="Oversold"
                  value={settings.strategy.rsi_oversold}
                  onChange={(v) => update("strategy", "rsi_oversold", v)}
                  min={10}
                  max={40}
                />
                <NumberInput
                  label="Overbought"
                  value={settings.strategy.rsi_overbought}
                  onChange={(v) => update("strategy", "rsi_overbought", v)}
                  min={60}
                  max={90}
                />
              </div>
            </div>
            <div className="border-t border-white/5 pt-4">
              <p className="text-xs text-apex-accent font-mono uppercase tracking-wider mb-4">
                EMA Crossover
              </p>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput
                  label="Fast Period"
                  value={settings.strategy.ema_fast}
                  onChange={(v) => update("strategy", "ema_fast", v)}
                  min={5}
                  max={50}
                />
                <NumberInput
                  label="Slow Period"
                  value={settings.strategy.ema_slow}
                  onChange={(v) => update("strategy", "ema_slow", v)}
                  min={20}
                  max={200}
                />
              </div>
            </div>
            <div className="border-t border-white/5 pt-4">
              <p className="text-xs text-apex-accent font-mono uppercase tracking-wider mb-4">
                Bollinger Bands
              </p>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput
                  label="Period"
                  value={settings.strategy.bollinger_period}
                  onChange={(v) => update("strategy", "bollinger_period", v)}
                  min={10}
                  max={50}
                />
                <NumberInput
                  label="Std Dev"
                  value={settings.strategy.bollinger_std}
                  onChange={(v) => update("strategy", "bollinger_std", v)}
                  min={1}
                  max={4}
                  step={0.1}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-2xl border border-apex-border bg-apex-card/60 backdrop-blur-sm p-6 animate-slide-up stagger-3">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-5 h-5 text-apex-amber" />
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
          </div>
          <div className="space-y-5">
            <ToggleInput
              label="Telegram Alerts"
              value={settings.notifications.telegram_enabled}
              onChange={(v) =>
                update("notifications", "telegram_enabled", v)
              }
              description="Send trade signals to Telegram"
            />
            {settings.notifications.telegram_enabled && (
              <>
                <TextInput
                  label="Bot Token"
                  value={settings.notifications.telegram_bot_token}
                  onChange={(v) =>
                    update("notifications", "telegram_bot_token", v)
                  }
                  placeholder="123456:ABC-DEF1234ghIkl..."
                  type="password"
                />
                <TextInput
                  label="Chat ID"
                  value={settings.notifications.telegram_chat_id}
                  onChange={(v) =>
                    update("notifications", "telegram_chat_id", v)
                  }
                  placeholder="-1001234567890"
                />
              </>
            )}
          </div>

          {/* Info box */}
          <div className="mt-8 p-4 rounded-xl bg-apex-surface/50 border border-apex-border">
            <div className="flex gap-3">
              <AlertTriangle className="w-4 h-4 text-apex-amber flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-apex-amber font-medium mb-1">
                  Important
                </p>
                <p className="text-xs text-apex-muted leading-relaxed">
                  Settings are saved on the server. On Vercel&apos;s free tier,
                  the file system is ephemeral — settings will reset on
                  redeploy. For persistent storage, consider using Vercel KV or
                  an external database.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-apex-muted/50 font-mono pb-4">
        APEX TRADER AI &middot; Settings Panel &middot; Changes take effect on
        next signal analysis
      </footer>
    </div>
  );
}
