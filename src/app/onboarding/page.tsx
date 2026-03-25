"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Check, AlertCircle, Eye, EyeOff } from "lucide-react";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

interface FormData {
  // Broker setup
  oandaApiKey: string;
  accountMode: "practice" | "live";

  // Trading config
  pairs: string[];
  timeframe: string;
  lotSize: number;

  // Risk settings
  dailyDrawdownPercent: number;
  riskPerTradePercent: number;
  maxConsecutiveLosses: number;

  // Notifications
  telegramBotToken: string;
  telegramChatId: string;
}

const TRADING_PAIRS = [
  "EUR_USD",
  "GBP_USD",
  "USD_JPY",
  "USD_CHF",
  "AUD_USD",
  "NZD_USD",
  "EUR_GBP",
  "EUR_JPY",
  "GBP_JPY",
  "XAU_USD",
];

const TIMEFRAMES = ["M5", "M15", "M30", "H1", "H4", "D"];

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showBotToken, setShowBotToken] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    oandaApiKey: "",
    accountMode: "practice",
    pairs: ["EUR_USD"],
    timeframe: "H1",
    lotSize: 0.01,
    dailyDrawdownPercent: 2,
    riskPerTradePercent: 1,
    maxConsecutiveLosses: 3,
    telegramBotToken: "",
    telegramChatId: "",
  });

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const togglePair = (pair: string) => {
    setFormData(prev => ({
      ...prev,
      pairs: prev.pairs.includes(pair)
        ? prev.pairs.filter(p => p !== pair)
        : [...prev.pairs, pair],
    }));
  };

  const validateStep = (): boolean => {
    switch (step) {
      case 2:
        if (!formData.oandaApiKey.trim()) {
          setError("OANDA API key is required");
          return false;
        }
        break;
      case 3:
        if (formData.pairs.length === 0) {
          setError("Select at least one trading pair");
          return false;
        }
        if (formData.lotSize <= 0) {
          setError("Lot size must be greater than 0");
          return false;
        }
        break;
      case 4:
        if (formData.dailyDrawdownPercent <= 0 || formData.dailyDrawdownPercent > 100) {
          setError("Daily drawdown must be between 0 and 100%");
          return false;
        }
        if (formData.riskPerTradePercent <= 0 || formData.riskPerTradePercent > 100) {
          setError("Risk per trade must be between 0 and 100%");
          return false;
        }
        if (formData.maxConsecutiveLosses < 1) {
          setError("Max consecutive losses must be at least 1");
          return false;
        }
        break;
      case 5:
        if (!formData.telegramBotToken.trim() || !formData.telegramChatId.trim()) {
          setError("Telegram bot token and chat ID are required");
          return false;
        }
        break;
    }
    return true;
  };

  const handleNext = async () => {
    if (!validateStep()) return;

    if (step < 6) {
      setStep((step + 1) as Step);
    }
  };

  const handlePrevious = () => {
    if (step > 1) {
      setStep((step - 1) as Step);
    }
  };

  const handleSave = async () => {
    if (!validateStep()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const testTelegram = async () => {
    if (!formData.telegramBotToken || !formData.telegramChatId) {
      setError("Please fill in bot token and chat ID");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: formData.telegramBotToken,
          chatId: formData.telegramChatId,
        }),
      });

      if (response.ok) {
        setError(null);
        alert("Test message sent successfully!");
      } else {
        setError("Failed to send test message");
      }
    } catch (err) {
      setError("Connection error. Check your bot token and chat ID.");
    } finally {
      setIsLoading(false);
    }
  };

  const progress = (step / 6) * 100;
  const stepTitles = [
    "Welcome",
    "Broker Setup",
    "Trading Config",
    "Risk Settings",
    "Notifications",
    "Review & Save",
  ];

  return (
    <div className="relative z-10 min-h-screen bg-black overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-b from-apex-purple/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-40 w-80 h-80 bg-gradient-to-r from-apex-cyan/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative p-4 md:p-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-apex-cyan to-apex-purple flex items-center justify-center">
              <span className="text-white font-bold">A</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white font-[Outfit]">Apex Trader AI</h1>
              <p className="text-sm text-apex-muted">Setup & Configuration</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-apex-cyan to-apex-purple transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex justify-between mb-8">
          {Array.from({ length: 6 }).map((_, i) => {
            const stepNum = (i + 1) as Step;
            const isActive = stepNum === step;
            const isComplete = stepNum < step;

            return (
              <div key={i} className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    isComplete
                      ? "bg-apex-green text-white"
                      : isActive
                      ? "bg-gradient-to-r from-apex-cyan to-apex-purple text-white ring-2 ring-apex-cyan/50"
                      : "bg-white/[0.05] text-apex-muted border border-white/[0.1]"
                  }`}
                >
                  {isComplete ? <Check className="w-4 h-4" /> : stepNum}
                </div>
                <p className="text-xs text-apex-muted mt-2 text-center">{stepTitles[i]}</p>
              </div>
            );
          })}
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-apex-red/10 border border-apex-red/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-apex-red flex-shrink-0 mt-0.5" />
            <p className="text-sm text-apex-red">{error}</p>
          </div>
        )}

        {/* Success message */}
        {success && (
          <div className="mb-6 p-4 bg-apex-green/10 border border-apex-green/30 rounded-lg flex items-start gap-3">
            <Check className="w-5 h-5 text-apex-green flex-shrink-0 mt-0.5" />
            <p className="text-sm text-apex-green">Settings saved! Redirecting...</p>
          </div>
        )}

        {/* Step content */}
        <div className="bg-[#0e1525]/60 border border-white/[0.04] rounded-2xl p-6 md:p-8 mb-8">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2 font-[Outfit]">Welcome to Apex Trader AI</h2>
                <p className="text-apex-muted">
                  Let's get your trading engine set up in just a few minutes. Follow these steps to configure your broker,
                  trading preferences, risk management, and notifications.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-1 bg-gradient-to-b from-apex-cyan to-transparent" />
                  <div>
                    <h3 className="font-semibold text-white mb-1">Step 1: Broker Setup</h3>
                    <p className="text-sm text-apex-muted">Connect your OANDA account (paper or live trading)</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-1 bg-gradient-to-b from-apex-cyan to-transparent" />
                  <div>
                    <h3 className="font-semibold text-white mb-1">Step 2: Trading Configuration</h3>
                    <p className="text-sm text-apex-muted">Choose currency pairs and timeframes</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-1 bg-gradient-to-b from-apex-cyan to-transparent" />
                  <div>
                    <h3 className="font-semibold text-white mb-1">Step 3: Risk Management</h3>
                    <p className="text-sm text-apex-muted">Set drawdown limits and position sizing</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-1 bg-gradient-to-b from-apex-cyan to-transparent" />
                  <div>
                    <h3 className="font-semibold text-white mb-1">Step 4: Notifications</h3>
                    <p className="text-sm text-apex-muted">Configure Telegram for trade alerts</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-apex-cyan/5 border border-apex-cyan/20 rounded-lg">
                <p className="text-sm text-apex-muted">
                  🚀 <span className="text-white font-semibold">Pro tip:</span> Use paper trading mode first to test
                  your strategy before going live.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Broker Setup */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-2 font-[Outfit]">Broker Setup</h2>
                <p className="text-sm text-apex-muted">Connect your OANDA trading account</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">OANDA API Key</label>
                  <div className="relative">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={formData.oandaApiKey}
                      onChange={(e) => handleInputChange("oandaApiKey", e.target.value)}
                      placeholder="Paste your API key here"
                      className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/[0.08] rounded-lg text-white placeholder-apex-muted focus:outline-none focus:border-apex-cyan/50 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-apex-muted hover:text-white transition-colors"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-apex-muted mt-2">
                    Get your API key from{" "}
                    <a
                      href="https://www.oanda.com/account/toc/v1/personal-info"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-apex-cyan hover:text-apex-cyan/80"
                    >
                      OANDA Account Settings
                    </a>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-3">Account Mode</label>
                  <div className="flex gap-4">
                    {(["practice", "live"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => handleInputChange("accountMode", mode)}
                        className={`flex-1 px-4 py-3 rounded-lg border transition-all ${
                          formData.accountMode === mode
                            ? "bg-apex-cyan/10 border-apex-cyan/50 text-white"
                            : "bg-white/[0.02] border-white/[0.08] text-apex-muted hover:border-white/[0.15]"
                        }`}
                      >
                        <div className="font-semibold capitalize">{mode} Trading</div>
                        <div className="text-xs mt-1">
                          {mode === "practice" ? "Paper trading (no real money)" : "Real money trading"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Trading Config */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-2 font-[Outfit]">Trading Configuration</h2>
                <p className="text-sm text-apex-muted">Select trading pairs and timeframe</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-3">Trading Pairs</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TRADING_PAIRS.map((pair) => (
                      <button
                        key={pair}
                        onClick={() => togglePair(pair)}
                        className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                          formData.pairs.includes(pair)
                            ? "bg-apex-cyan/10 border-apex-cyan/50 text-white"
                            : "bg-white/[0.02] border-white/[0.08] text-apex-muted hover:border-white/[0.15]"
                        }`}
                      >
                        {pair}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-3">Timeframe</label>
                  <div className="grid grid-cols-3 gap-2">
                    {TIMEFRAMES.map((tf) => (
                      <button
                        key={tf}
                        onClick={() => handleInputChange("timeframe", tf)}
                        className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                          formData.timeframe === tf
                            ? "bg-apex-cyan/10 border-apex-cyan/50 text-white"
                            : "bg-white/[0.02] border-white/[0.08] text-apex-muted hover:border-white/[0.15]"
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Lot Size</label>
                  <input
                    type="number"
                    value={formData.lotSize}
                    onChange={(e) => handleInputChange("lotSize", parseFloat(e.target.value))}
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/[0.08] rounded-lg text-white placeholder-apex-muted focus:outline-none focus:border-apex-cyan/50 transition-colors"
                  />
                  <p className="text-xs text-apex-muted mt-2">Standard lot = 1.0, Mini lot = 0.1, Micro lot = 0.01</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Risk Settings */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-2 font-[Outfit]">Risk Management</h2>
                <p className="text-sm text-apex-muted">Configure your risk limits and position sizing</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Daily Drawdown Limit: {formData.dailyDrawdownPercent}%
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={formData.dailyDrawdownPercent}
                    onChange={(e) => handleInputChange("dailyDrawdownPercent", parseFloat(e.target.value))}
                    className="w-full h-2 bg-white/[0.05] rounded-full appearance-none cursor-pointer accent-apex-cyan"
                  />
                  <p className="text-xs text-apex-muted mt-2">Max loss before stopping all trades today</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Risk Per Trade: {formData.riskPerTradePercent}%
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={formData.riskPerTradePercent}
                    onChange={(e) => handleInputChange("riskPerTradePercent", parseFloat(e.target.value))}
                    className="w-full h-2 bg-white/[0.05] rounded-full appearance-none cursor-pointer accent-apex-cyan"
                  />
                  <p className="text-xs text-apex-muted mt-2">Risk on each individual trade</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Max Consecutive Losses: {formData.maxConsecutiveLosses}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={formData.maxConsecutiveLosses}
                    onChange={(e) => handleInputChange("maxConsecutiveLosses", parseInt(e.target.value))}
                    className="w-full h-2 bg-white/[0.05] rounded-full appearance-none cursor-pointer accent-apex-cyan"
                  />
                  <p className="text-xs text-apex-muted mt-2">Stop trading after this many losses in a row</p>
                </div>
              </div>

              <div className="p-4 bg-apex-cyan/5 border border-apex-cyan/20 rounded-lg">
                <p className="text-xs text-apex-muted">
                  These conservative defaults protect your capital. Adjust based on your risk tolerance and account size.
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Notifications */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-2 font-[Outfit]">Telegram Notifications</h2>
                <p className="text-sm text-apex-muted">Receive trade alerts and daily reports via Telegram</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Bot Token</label>
                  <div className="relative">
                    <input
                      type={showBotToken ? "text" : "password"}
                      value={formData.telegramBotToken}
                      onChange={(e) => handleInputChange("telegramBotToken", e.target.value)}
                      placeholder="Paste your bot token"
                      className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/[0.08] rounded-lg text-white placeholder-apex-muted focus:outline-none focus:border-apex-cyan/50 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBotToken(!showBotToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-apex-muted hover:text-white transition-colors"
                    >
                      {showBotToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-apex-muted mt-2">
                    Create a bot at{" "}
                    <a
                      href="https://t.me/botfather"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-apex-cyan hover:text-apex-cyan/80"
                    >
                      @BotFather
                    </a>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Chat ID</label>
                  <input
                    type="text"
                    value={formData.telegramChatId}
                    onChange={(e) => handleInputChange("telegramChatId", e.target.value)}
                    placeholder="Your Telegram chat ID"
                    className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/[0.08] rounded-lg text-white placeholder-apex-muted focus:outline-none focus:border-apex-cyan/50 transition-colors"
                  />
                  <p className="text-xs text-apex-muted mt-2">
                    Forward a message to{" "}
                    <a
                      href="https://t.me/userinfobot"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-apex-cyan hover:text-apex-cyan/80"
                    >
                      @userinfobot
                    </a>{" "}
                    to get your ID
                  </p>
                </div>

                <button
                  onClick={testTelegram}
                  disabled={isLoading || !formData.telegramBotToken || !formData.telegramChatId}
                  className="w-full px-4 py-2.5 bg-white/[0.05] border border-white/[0.1] rounded-lg text-white text-sm hover:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? "Sending..." : "Send Test Message"}
                </button>
              </div>
            </div>
          )}

          {/* Step 6: Review & Save */}
          {step === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-2 font-[Outfit]">Review Settings</h2>
                <p className="text-sm text-apex-muted">Everything looks good? Save to start trading.</p>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-white/[0.02] border border-white/[0.08] rounded-lg space-y-3">
                  <div>
                    <p className="text-xs text-apex-muted">BROKER</p>
                    <p className="text-white font-semibold">
                      {formData.accountMode === "practice" ? "Paper Trading (OANDA)" : "Live Trading (OANDA)"}
                    </p>
                  </div>
                  <div className="h-px bg-white/[0.05]" />
                  <div>
                    <p className="text-xs text-apex-muted">TRADING PAIRS</p>
                    <p className="text-white font-semibold">{formData.pairs.join(", ")}</p>
                  </div>
                  <div className="h-px bg-white/[0.05]" />
                  <div>
                    <p className="text-xs text-apex-muted">TIMEFRAME & LOT SIZE</p>
                    <p className="text-white font-semibold">
                      {formData.timeframe} • {formData.lotSize.toFixed(2)} lots
                    </p>
                  </div>
                  <div className="h-px bg-white/[0.05]" />
                  <div>
                    <p className="text-xs text-apex-muted">RISK LIMITS</p>
                    <p className="text-white font-semibold">
                      {formData.dailyDrawdownPercent}% daily • {formData.riskPerTradePercent}% per trade •{" "}
                      {formData.maxConsecutiveLosses} max losses
                    </p>
                  </div>
                  <div className="h-px bg-white/[0.05]" />
                  <div>
                    <p className="text-xs text-apex-muted">NOTIFICATIONS</p>
                    <p className="text-white font-semibold">Telegram enabled</p>
                  </div>
                </div>

                <div className="p-4 bg-apex-green/5 border border-apex-green/20 rounded-lg">
                  <p className="text-sm text-apex-muted">
                    All settings are securely saved and encrypted. You can update these at any time in Settings.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-4">
          <button
            onClick={handlePrevious}
            disabled={step === 1}
            className="flex items-center gap-2 px-6 py-2.5 bg-white/[0.05] border border-white/[0.1] rounded-lg text-white text-sm hover:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <button
            onClick={step === 6 ? handleSave : handleNext}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-apex-cyan to-apex-purple rounded-lg text-white text-sm font-semibold hover:from-apex-cyan/90 hover:to-apex-purple/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? "Processing..." : step === 6 ? "Save & Start Trading" : "Next"}
            {step < 6 && <ChevronRight className="w-4 h-4" />}
            {step === 6 && <Check className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
