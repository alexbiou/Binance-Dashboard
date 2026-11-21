# DashboardBinance

A read-only cryptocurrency market monitoring terminal built on Binance public market data.
It does not place orders and needs no API keys.

Stack: Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui-style primitives, TradingView Lightweight Charts v4, Zustand.

## Run

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npm run typecheck
npm test             # anomaly rule tests
```

Optional configuration is in `.env.example`.
If the browser cannot reach Binance directly (CORS or regional blocking), set
`NEXT_PUBLIC_BINANCE_REST_URL=/api/binance` to use the built-in allow-listed proxy route.

## Data flow

| Need | Source | Cadence |
| --- | --- | --- |
| Tracked universe and 24h stats | `GET /api/v3/ticker/24hr` (weight 80) | Once at load, plus manual Sync (min 10s apart) |
| Live prices | WebSocket `<symbol>@miniTicker` for the top 100 USDT pairs | Pushed, flushed to the UI once per second |
| Candles | `GET /api/v3/klines`, then `<symbol>@kline_<interval>` | On symbol/interval change, re-fetched after a WS reconnect |
| Recent trades | `GET /api/v3/trades`, then `<symbol>@trade` | Live, batched every 400ms, de-duplicated by trade id |
| Order book | `GET /api/v3/depth` | Every 5s while the tab is visible |
| Anomaly scan | `GET /api/v3/klines` (5m, 120 candles) for the 20 most liquid pairs | Every 60s while visible (about 40 request weight) |
| Single price | `fetchLastPrice` wraps `GET /api/v3/ticker/price` | Available in `lib/binance/rest.ts`; not used by the UI because the WS feed already carries prices |

No mock data exists anywhere. If a request fails the UI shows an error state with a retry; if the socket drops it
reconnects with exponential backoff and jitter, and the header shows the connection state.

Live versus derived: panels are tagged `Live` (value comes straight from Binance) or `Derived` (calculated here:
tracked volume, median 24h range, breadth, spread, range position, anomaly flags).

## Architecture

```
app/                    routes (Overview, Markets, Analytics, Watchlist, Settings, asset/[symbol], api/binance proxy)
components/
  layout/               shell, sidebar, header, search, connection status
  market/               metric strip, asset table, breadth
  chart/                Lightweight Charts wrapper
  asset/                asset detail, trades, order book
  analytics/            anomaly panel, rules panel
  ui/                   button, input, skeleton, panel
lib/binance/            REST client (timeouts, rate-limit backoff, request de-dupe), WebSocket client, types
lib/analytics/          pure indicator math, anomaly rules, scanner, tests
store/                  Zustand: market, anomalies, watchlist (persisted)
hooks/                  polling, ticker, scan lifecycle
```

Key decisions:

- One shared WebSocket with reference-counted subscriptions, batched SUBSCRIBE/UNSUBSCRIBE (Binance allows 5 control
  messages per second), a stall watchdog, and an idle close after the last consumer leaves.
- Tick buffering: messages are written to a buffer and flushed once per second, so render rate is independent of message rate.
- The anomaly rules live in one `RULES` object. The detector and the "Detection rules" panel both read it, so the
  documentation cannot drift from the behaviour. Detection is a pure function (`now` is injected) and is unit-tested.
- Only the latest closed candle is evaluated, never the still-forming one.

## Anomaly rules (5-minute candles)

| Rule | Measure | Low / Medium / High |
| --- | --- | --- |
| Volume spike | Last candle quote volume / mean of previous 20 | 3x / 5x / 8x |
| Momentum | Absolute change over 12 candles (60 min) | 2% / 3.5% / 5% |
| Volatility | Stdev of 12 recent log returns / stdev of the 96 before | 2x / 3x / 4x |
| MA deviation | Distance of close from SMA20 | 1.5% / 2.5% / 4% |

Guards: volume spikes are ignored when the baseline averages under $5,000 per candle; volatility is ignored when recent
stdev is under 0.05% per candle. Detections are kept for one hour. These are statistical flags, not trading signals.

## Limitations

- The tracked universe is the top 100 USDT pairs by 24h volume at the time of the snapshot, not every Binance market.
- The 24h change is computed from the stream's 24h open and the last price, so it can differ slightly from the REST field.
- Binance may refuse access from some regions (HTTP 451); the app reports this instead of falling back to anything.
- Watchlist persistence is per browser (localStorage).
