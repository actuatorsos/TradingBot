# APEX TRADER AI - Trading Dashboard

Algorithmic Forex Trading Bot with 9-Indicator Confluence Analysis. This is the web dashboard for real-time monitoring deployed on Vercel.

## Features

- **Live forex rates** via OANDA Exchange Rates API
- **9-indicator signal engine** (RSI, MACD, Bollinger, EMA, Volume, Candlestick, Stochastic, ATR, Sentiment)
- **Risk management** visualization
- **Auto-refresh** every 15 seconds
- **Responsive** dark-theme dashboard

## Setup

### 1. Clone and Install

```bash
git clone https://github.com/actuatorsos/TradingBot.git
cd TradingBot
npm install
```

### 2. Configure Environment

Create a `.env.local` file:

```env
OANDA_API_KEY=your_oanda_exchange_rates_api_key
TRADING_PAIR=EUR_USD
TIMEFRAME=M5
MIN_CONFIDENCE=72
```

### 3. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Deploy to Vercel

Set the same environment variables in your Vercel project settings under **Settings > Environment Variables**.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/market` | Live forex spot rates |
| `GET /api/signals` | Current signal analysis with all 9 indicators |
| `GET /api/status` | System status and configuration |

## Tech Stack

- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **Lucide React** for icons
- **OANDA Exchange Rates API** for market data
