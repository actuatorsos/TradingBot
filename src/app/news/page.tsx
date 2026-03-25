"use client";
import { useState, useEffect, useCallback } from "react";
import { SpotlightCard } from "@/components/SpotlightCard";
import { TrendingUp, TrendingDown, AlertCircle } from "lucide-react";

interface NewsItem {
  title: string;
  source: string;
  url: string;
  published: string;
  sentiment: number;
  impact: "high" | "medium" | "low";
  currencies: string[];
}

interface NewsData {
  success: boolean;
  news: NewsItem[];
  summary: {
    total: number;
    avg_sentiment: number;
    high_impact: number;
    currency_sentiment: Record<string, number>;
  };
  timestamp: string;
}

export default function NewsPage() {
  const [newsData, setNewsData] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [impactFilter, setImpactFilter] = useState<
    "all" | "high" | "medium" | "low"
  >("all");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const fetchNews = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/news");
      if (res.ok) {
        const data = await res.json();
        setNewsData(data);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error("Error fetching news:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and refresh every 5 minutes
  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 5 * 60000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  if (!newsData && loading) {
    return (
      <main className="min-h-screen bg-[#050810] text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="inline-block animate-spin mb-4">
                <div className="w-8 h-8 border-2 border-green-500/20 border-t-green-500 rounded-full" />
              </div>
              <p className="text-apex-muted">Loading news...</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!newsData) {
    return (
      <main className="min-h-screen bg-[#050810] text-white p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-apex-muted text-center py-12">Failed to load news</p>
        </div>
      </main>
    );
  }

  // Filter news
  let filteredNews = newsData.news;
  if (impactFilter !== "all") {
    filteredNews = filteredNews.filter((item) => item.impact === impactFilter);
  }
  if (currencyFilter !== "all") {
    filteredNews = filteredNews.filter((item) =>
      item.currencies.includes(currencyFilter)
    );
  }

  // Get unique currencies
  const allCurrencies = Array.from(
    new Set(newsData.news.flatMap((item) => item.currencies))
  ).sort();

  // Calculate market sentiment
  const avgSentiment = newsData.summary.avg_sentiment;
  const sentimentPercent = Math.round((avgSentiment + 1) * 50);

  // Format time ago
  const formatTimeAgo = (isoTime: string) => {
    const now = new Date();
    const time = new Date(isoTime);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  // Get impact badge color
  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "medium":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "low":
        return "bg-gray-500/10 text-gray-400 border-gray-500/20";
      default:
        return "bg-gray-500/10 text-gray-400 border-gray-500/20";
    }
  };

  // Get sentiment color
  const getSentimentColor = (sentiment: number) => {
    if (sentiment > 0.3) return "text-green-400";
    if (sentiment < -0.3) return "text-red-400";
    return "text-yellow-400";
  };

  return (
    <main className="min-h-screen bg-[#050810] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold font-outfit mb-2">
              Market News & Sentiment
            </h1>
            <p className="text-apex-muted">
              Real-time news feed with sentiment analysis for currency markets
            </p>
          </div>
        </div>

        {/* Market Sentiment Gauge */}
        <SpotlightCard className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold font-outfit mb-2">
                Overall Market Sentiment
              </h2>
              <p className="text-apex-muted text-sm">
                Based on {newsData.summary.total} news items
              </p>
            </div>

            <div className="flex items-center gap-8">
              {/* Sentiment Gauge */}
              <div className="relative w-32 h-32">
                <svg
                  viewBox="0 0 100 50"
                  className="w-full h-full"
                  style={{ overflow: "visible" }}
                >
                  {/* Background arc */}
                  <path
                    d="M 10 50 A 40 40 0 0 1 90 50"
                    fill="none"
                    stroke="white"
                    strokeWidth="4"
                    opacity="0.1"
                  />
                  {/* Sentiment arc */}
                  <path
                    d={`M 10 50 A 40 40 0 0 1 ${
                      10 + (sentimentPercent / 100) * 80
                    } 50`}
                    fill="none"
                    stroke={avgSentiment > 0 ? "#00e676" : "#ff1744"}
                    strokeWidth="4"
                  />
                  {/* Center text */}
                  <text
                    x="50"
                    y="40"
                    textAnchor="middle"
                    fill="white"
                    fontSize="16"
                    fontWeight="bold"
                    fontFamily="JetBrains Mono"
                  >
                    {(avgSentiment * 100).toFixed(0)}%
                  </text>
                </svg>
              </div>

              {/* Sentiment Label */}
              <div className="text-right">
                <p className="text-2xl font-bold font-outfit mb-2">
                  {avgSentiment > 0.3
                    ? "Bullish"
                    : avgSentiment < -0.3
                      ? "Bearish"
                      : "Neutral"}
                </p>
                <p className="text-sm text-apex-muted">
                  {newsData.summary.high_impact} high impact items
                </p>
              </div>
            </div>
          </div>
        </SpotlightCard>

        {/* Currency Sentiment Summary */}
        <SpotlightCard className="p-6">
          <h2 className="text-lg font-bold font-outfit mb-4">
            Per-Currency Sentiment
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {allCurrencies.map((currency) => {
              const sentiment =
                newsData.summary.currency_sentiment[currency] || 0;
              return (
                <div
                  key={currency}
                  className="bg-[#0e1525] rounded-lg p-4 border border-white/5"
                >
                  <p className="text-sm text-apex-muted mb-2">{currency}</p>
                  <div className="flex items-center gap-2">
                    {sentiment > 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-400" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-400" />
                    )}
                    <p
                      className={`text-lg font-bold font-jetbrains-mono ${getSentimentColor(
                        sentiment
                      )}`}
                    >
                      {(sentiment * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </SpotlightCard>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 bg-[#0e1525] rounded-lg p-4 border border-white/5">
          <div>
            <label className="block text-xs text-apex-muted uppercase tracking-wide mb-2">
              Impact
            </label>
            <div className="flex gap-2">
              {["all", "high", "medium", "low"].map((impact) => (
                <button
                  key={impact}
                  onClick={() =>
                    setImpactFilter(impact as "all" | "high" | "medium" | "low")
                  }
                  className={`px-3 py-1.5 rounded text-sm font-jetbrains-mono transition ${
                    impactFilter === impact
                      ? "bg-green-500/20 border border-green-500/50 text-green-400"
                      : "bg-white/5 border border-white/10 text-apex-muted hover:border-white/20"
                  }`}
                >
                  {impact.charAt(0).toUpperCase() + impact.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="border-l border-white/10 pl-6">
            <label className="block text-xs text-apex-muted uppercase tracking-wide mb-2">
              Currency
            </label>
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="px-3 py-1.5 bg-[#050810] text-white border border-white/10 rounded text-sm font-jetbrains-mono focus:outline-none focus:border-green-500 transition"
            >
              <option value="all">All</option>
              {allCurrencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto text-right text-xs text-apex-muted">
            <p>Last update: {lastUpdate.toLocaleTimeString()}</p>
            <p>Showing {filteredNews.length} of {newsData.summary.total} items</p>
          </div>
        </div>

        {/* News Feed */}
        <div className="space-y-4">
          {filteredNews.length === 0 ? (
            <SpotlightCard className="p-8 text-center">
              <AlertCircle className="w-8 h-8 text-apex-muted mx-auto mb-3" />
              <p className="text-apex-muted">No news items match your filters</p>
            </SpotlightCard>
          ) : (
            filteredNews.map((item, i) => (
              <SpotlightCard key={i} className="p-5 hover:border-white/15 transition">
                <div className="space-y-3">
                  {/* Title and Meta */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold font-outfit leading-tight mb-2">
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm text-apex-muted">
                          {item.source}
                        </span>
                        <span className="text-xs text-apex-muted">
                          {formatTimeAgo(item.published)}
                        </span>
                      </div>
                    </div>

                    {/* Impact Badge */}
                    <div
                      className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wide border ${getImpactColor(
                        item.impact
                      )}`}
                    >
                      {item.impact}
                    </div>
                  </div>

                  {/* Sentiment and Currencies */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div className="flex items-center gap-4">
                      {/* Sentiment Bar */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-apex-muted">Sentiment</span>
                        <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              item.sentiment > 0
                                ? "bg-green-500"
                                : "bg-red-500"
                            }`}
                            style={{
                              width: `${Math.abs(item.sentiment) * 100}%`,
                            }}
                          />
                        </div>
                        <span
                          className={`text-xs font-jetbrains-mono ${getSentimentColor(
                            item.sentiment
                          )}`}
                        >
                          {(item.sentiment * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* Currency Tags */}
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {item.currencies.map((currency) => (
                        <span
                          key={currency}
                          className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-xs font-semibold"
                        >
                          {currency}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </SpotlightCard>
            ))
          )}
        </div>

        {/* Footer Info */}
        <SpotlightCard className="p-4 bg-amber-500/5 border-amber-500/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-apex-muted">
              <span className="font-semibold text-amber-400">Note:</span> News
              items are generated for demonstration purposes. Sentiment scores
              range from -100% (bearish) to +100% (bullish). High impact items
              typically affect currency volatility more significantly.
            </p>
          </div>
        </SpotlightCard>
      </div>
    </main>
  );
}
