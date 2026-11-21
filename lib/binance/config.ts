/**
 * Public, keyless Binance market-data endpoints.
 * Override with NEXT_PUBLIC_BINANCE_* (see .env.example), e.g. to use the built-in proxy.
 */
export const REST_BASE = (process.env.NEXT_PUBLIC_BINANCE_REST_URL || "https://data-api.binance.vision").replace(/\/$/, "");
export const WS_URL = process.env.NEXT_PUBLIC_BINANCE_WS_URL || "wss://stream.binance.com:9443/ws";

export const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
export type Interval = (typeof INTERVALS)[number];

export const QUOTE_ASSET = "USDT";
export const UNIVERSE_SIZE = 100;
export const DEFAULT_SYMBOL = "BTCUSDT";
