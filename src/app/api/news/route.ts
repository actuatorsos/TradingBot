import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 300; // Cache for 5 minutes

interface NewsItem {
  title: string;
  source: string;
  url: string;
  published: string;
  sentiment: number; // -1 to 1
  impact: "high" | "medium" | "low";
  currencies: string[];
}

// Simple keyword-based sentiment scoring
function scoreSentiment(title: string): number {
  const positive = ["surge", "rally", "gain", "rise", "boost", "strong", "bull", "up", "growth", "recover", "high", "advance", "climb", "soar", "jump"];
  const negative = ["fall", "drop", "crash", "decline", "weak", "bear", "down", "loss", "slump", "plunge", "cut", "recession", "crisis", "low", "sink"];

  const lower = title.toLowerCase();
  let score = 0;
  for (const w of positive) if (lower.includes(w)) score += 0.3;
  for (const w of negative) if (lower.includes(w)) score -= 0.3;
  return Math.max(-1, Math.min(1, score));
}

function detectCurrencies(title: string): string[] {
  const currencies = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD"];
  const found = currencies.filter(c => title.toUpperCase().includes(c));
  // Also check for country names
  const mapping: Record<string, string> = {
    "dollar": "USD", "euro": "EUR", "pound": "GBP", "sterling": "GBP",
    "yen": "JPY", "franc": "CHF", "aussie": "AUD", "loonie": "CAD",
    "kiwi": "NZD", "fed": "USD", "ecb": "EUR", "boe": "GBP", "boj": "JPY",
  };
  for (const [keyword, currency] of Object.entries(mapping)) {
    if (title.toLowerCase().includes(keyword) && !found.includes(currency)) {
      found.push(currency);
    }
  }
  return found;
}

function classifyImpact(title: string): "high" | "medium" | "low" {
  const high = ["rate", "interest", "inflation", "nfp", "payroll", "gdp", "fed", "ecb", "boe", "boj", "war", "crisis", "emergency"];
  const lower = title.toLowerCase();
  if (high.some(w => lower.includes(w))) return "high";
  if (Math.abs(scoreSentiment(title)) > 0.5) return "medium";
  return "low";
}

// Generate realistic demo news
function generateDemoNews(): NewsItem[] {
  const templates = [
    { title: "EUR/USD Rises After ECB Holds Interest Rates Steady", source: "Reuters" },
    { title: "US Dollar Strengthens on Strong Jobs Data", source: "Bloomberg" },
    { title: "GBP Falls as UK GDP Growth Slows", source: "Financial Times" },
    { title: "Fed Officials Signal Potential Rate Cut in Coming Months", source: "CNBC" },
    { title: "Japanese Yen Weakens to Multi-Year Low Against Dollar", source: "Nikkei" },
    { title: "Australian Dollar Gains on Rising Commodity Prices", source: "Reuters" },
    { title: "Swiss Franc Surge as Safe Haven Demand Increases", source: "Bloomberg" },
    { title: "Canadian Dollar Under Pressure Amid Oil Price Decline", source: "Globe and Mail" },
    { title: "Euro Zone Inflation Data Meets Expectations at 2.4%", source: "ECB" },
    { title: "US Treasury Yields Drop, Dollar Weakens on Recession Fears", source: "WSJ" },
    { title: "Bank of England Maintains Hawkish Stance on Rates", source: "BBC" },
    { title: "NZD/USD Climbs After Strong Trade Balance Report", source: "RBNZ" },
  ];

  return templates.map((t, i) => {
    const hoursAgo = i * 2 + Math.floor(Math.random() * 3);
    const published = new Date(Date.now() - hoursAgo * 3600000).toISOString();
    return {
      title: t.title,
      source: t.source,
      url: "#",
      published,
      sentiment: scoreSentiment(t.title),
      impact: classifyImpact(t.title),
      currencies: detectCurrencies(t.title),
    };
  });
}

export async function GET() {
  try {
    // In production, you'd fetch from a real news API here
    // For now, use demo data that looks realistic
    const news = generateDemoNews();

    // Calculate overall sentiment
    const avgSentiment = news.length > 0
      ? news.reduce((s, n) => s + n.sentiment, 0) / news.length
      : 0;

    // Per-currency sentiment
    const currencySentiment: Record<string, { score: number; count: number }> = {};
    for (const item of news) {
      for (const currency of item.currencies) {
        if (!currencySentiment[currency]) currencySentiment[currency] = { score: 0, count: 0 };
        currencySentiment[currency].score += item.sentiment;
        currencySentiment[currency].count++;
      }
    }

    return NextResponse.json({
      success: true,
      news,
      summary: {
        total: news.length,
        avg_sentiment: parseFloat(avgSentiment.toFixed(3)),
        high_impact: news.filter(n => n.impact === "high").length,
        currency_sentiment: Object.fromEntries(
          Object.entries(currencySentiment).map(([k, v]) => [k, parseFloat((v.score / v.count).toFixed(3))])
        ),
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch news" },
      { status: 500 }
    );
  }
}
