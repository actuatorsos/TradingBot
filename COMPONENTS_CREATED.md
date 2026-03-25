# New Components & Pages Created

## Components

### CandlestickChart.tsx
- **Location**: `src/components/CandlestickChart.tsx`
- **Type**: "use client" React component
- **Features**:
  - Pure SVG candlestick rendering (no external chart libraries)
  - OHLCV data display with hover tooltips
  - Crosshair on hover (vertical + horizontal dashed lines)
  - Trade annotations (BUY/SELL triangles at exact prices)
  - Volume sub-chart (bottom 20% of height)
  - Mouse wheel scroll/pan for navigation
  - Responsive sizing via viewBox
  - Premium styling with glow effects

### SpotlightCard.tsx
- **Location**: `src/components/SpotlightCard.tsx`
- **Type**: "use client" React component
- **Features**:
  - Spotlight hover effect that follows mouse
  - Radial gradient with blur
  - Glass morphism overlay
  - Smooth border transitions
  - Fully configurable className support

## API Routes

### /api/candles
- **Location**: `src/app/api/candles/route.ts`
- **Method**: GET
- **Query Parameters**:
  - `pair` (string, default: "EUR_USD") - Currency pair to fetch
  - `count` (number, max: 500, default: 200) - Number of candles
- **Response**:
  ```json
  {
    "success": true,
    "pair": "EUR_USD",
    "timeframe": "M5",
    "candles": [...],
    "count": 200
  }
  ```
- **Features**:
  - Realistic OHLCV generation
  - Proper pip values for JPY vs non-JPY pairs
  - Volatility-based pricing
  - Volume correlation with price movement

## Pages

### /chart
- **Location**: `src/app/chart/page.tsx`
- **Type**: "use client" page
- **Features**:
  - Pair selector with 6 major pairs
  - Live price display
  - Spread display in pips
  - Bid/Ask quotes
  - Auto-refresh every 30 seconds
  - Full candlestick chart with CandlestickChart component
  - Loading state with spinner
  - Info cards for timeframe and candle count

### /news
- **Location**: `src/app/news/page.tsx`
- **Type**: "use client" page
- **Features**:
  - Real-time news feed with sentiment analysis
  - Market sentiment gauge (circular, -100% to +100%)
  - Per-currency sentiment display
  - Filterable by impact level (High/Medium/Low)
  - Filterable by currency
  - Time-ago formatting for news items
  - Color-coded sentiment bars
  - Impact badges with proper styling
  - Currency tags on each news item
  - Auto-refresh every 5 minutes

## Styling & Theme

All components use:
- **Dark theme**: `bg-[#050810]` (background), `bg-[#0e1525]` (cards)
- **Accent colors**: `#00e676` (green), `#ff1744` (red)
- **Font families**: 
  - **Text**: Outfit (sans-serif)
  - **Numbers**: JetBrains Mono
- **Borders**: `border-white/10` with hover state `border-white/20`
- **Muted text**: `text-apex-muted` (mapped to `#64748b`)

## Icons Used

All icons from lucide-react:
- TrendingUp, TrendingDown
- AlertCircle
- Menu, X (for mobile nav)

## Build Status

✓ Production build successful
✓ All TypeScript types validated
✓ No console errors or warnings
✓ Ready for deployment

## Usage Examples

```tsx
// Use CandlestickChart
import CandlestickChart from "@/components/CandlestickChart";

<CandlestickChart
  candles={candleData}
  width={1200}
  height={500}
  pair="EUR_USD"
  trades={[{ time: "...", direction: "BUY", price: 1.085 }]}
/>

// Use SpotlightCard
import { SpotlightCard } from "@/components/SpotlightCard";

<SpotlightCard className="p-6">
  <h2>Premium Content</h2>
</SpotlightCard>

// Fetch candles
const res = await fetch("/api/candles?pair=GBP_USD&count=100");
const data = await res.json();
```

## Notes

- All components are production-quality with proper error handling
- API routes use dynamic rendering for real-time data
- SVG chart is fully responsive and scales via viewBox
- News data is generated but can be easily swapped with a real API
- All styling is Tailwind CSS with custom apex color palette
