/** Domain types (numbers already parsed). Raw Binance payloads are typed next to the parsers. */

export interface Ticker {
  symbol: string;
  base: string;
  price: number;
  /** Price 24h ago (rolling window open). */
  open: number;
  /** Derived from price and open, not a separate API field. */
  changePct: number;
  high: number;
  low: number;
  /** 24h volume in base asset. */
  volume: number;
  /** 24h volume in quote asset (USDT). */
  quoteVolume: number;
  updatedAt: number;
}

export interface Candle {
  /** Open time, UNIX seconds. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  /** Close time, UNIX milliseconds. */
  closeTime: number;
}

export interface Trade {
  id: number;
  price: number;
  qty: number;
  time: number;
  /** true = the buyer was the maker, i.e. the aggressor sold. */
  isBuyerMaker: boolean;
}

export interface DepthLevel {
  price: number;
  qty: number;
}

export interface DepthSnapshot {
  lastUpdateId: number;
  bids: DepthLevel[];
  asks: DepthLevel[];
}

export type ConnectionStatus = "idle" | "connecting" | "live" | "reconnecting" | "offline";

/* WebSocket event payloads (only the fields we read). */
export interface MiniTickerEvent {
  e: "24hrMiniTicker";
  s: string;
  c: string;
  o: string;
  h: string;
  l: string;
  v: string;
  q: string;
}

export interface KlineEvent {
  e: "kline";
  s: string;
  k: { t: number; T: number; i: string; o: string; c: string; h: string; l: string; v: string; q: string };
}

export interface TradeEvent {
  e: "trade";
  s: string;
  t: number;
  p: string;
  q: string;
  T: number;
  m: boolean;
}
