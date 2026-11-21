import { REST_BASE, QUOTE_ASSET, type Interval } from "./config";
import type { Candle, DepthSnapshot, Ticker, Trade } from "./types";

export class BinanceApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "BinanceApiError";
  }
}

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Unknown error";
}

const TIMEOUT_MS = 10_000;
/** After HTTP 429/418 every request fails fast until this time instead of hammering the API. */
let blockedUntil = 0;
/** Identical in-flight GETs (without an abort signal) share one network request. */
const inflight = new Map<string, Promise<unknown>>();

function buildUrl(path: string, params: Record<string, string | number | undefined>): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const url = new URL(`${REST_BASE}${path}`, origin);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function execute<T>(url: string, signal?: AbortSignal): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException("Request timed out", "TimeoutError")), TIMEOUT_MS);
  const onAbort = () => ctrl.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) {
      let code: number | undefined;
      let msg: string | undefined;
      try {
        const body = (await res.json()) as { code?: number; msg?: string };
        code = body.code;
        msg = body.msg;
      } catch {
        /* body was not JSON */
      }
      if (res.status === 429 || res.status === 418) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const wait = (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : res.status === 418 ? 120 : 30) * 1000;
        blockedUntil = Date.now() + wait;
        throw new BinanceApiError(`Binance rate limit reached (HTTP ${res.status}). Pausing requests.`, res.status, code, wait);
      }
      if (res.status === 451) {
        throw new BinanceApiError("Binance market data is not available from this region (HTTP 451).", 451, code);
      }
      throw new BinanceApiError(msg ?? `Binance request failed (HTTP ${res.status})`, res.status, code);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof BinanceApiError) throw e;
    if (signal?.aborted) throw e;
    if (ctrl.signal.aborted) throw new BinanceApiError("Request to Binance timed out");
    throw new BinanceApiError("Network error: could not reach Binance");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

function get<T>(path: string, params: Record<string, string | number | undefined> = {}, signal?: AbortSignal): Promise<T> {
  if (Date.now() < blockedUntil) {
    const wait = blockedUntil - Date.now();
    return Promise.reject(new BinanceApiError(`Rate limited. Retrying in ${Math.ceil(wait / 1000)}s.`, 429, undefined, wait));
  }
  const url = buildUrl(path, params);
  if (signal) return execute<T>(url, signal);

  const existing = inflight.get(url);
  if (existing) return existing as Promise<T>;
  const p = execute<T>(url).finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

/* ----------------------------- 24h tickers ----------------------------- */

interface Raw24hTicker {
  symbol: string;
  lastPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  closeTime: number;
}

export function baseAssetOf(symbol: string): string {
  return symbol.endsWith(QUOTE_ASSET) ? symbol.slice(0, -QUOTE_ASSET.length) : symbol;
}

function toTicker(r: Raw24hTicker): Ticker {
  const price = Number(r.lastPrice);
  const open = Number(r.openPrice);
  return {
    symbol: r.symbol,
    base: baseAssetOf(r.symbol),
    price,
    open,
    changePct: open > 0 ? ((price - open) / open) * 100 : 0,
    high: Number(r.highPrice),
    low: Number(r.lowPrice),
    volume: Number(r.volume),
    quoteVolume: Number(r.quoteVolume),
    updatedAt: r.closeTime,
  };
}

/** GET /api/v3/ticker/24hr for every symbol (request weight 80: call rarely). */
export async function fetchAllTickers24h(signal?: AbortSignal): Promise<Ticker[]> {
  const raw = await get<Raw24hTicker[]>("/api/v3/ticker/24hr", {}, signal);
  return raw.map(toTicker);
}

/** GET /api/v3/ticker/24hr for one symbol. */
export async function fetchTicker24h(symbol: string, signal?: AbortSignal): Promise<Ticker> {
  return toTicker(await get<Raw24hTicker>("/api/v3/ticker/24hr", { symbol }, signal));
}

/* -------------------------------- prices -------------------------------- */

/** GET /api/v3/ticker/price: lightweight latest price for one symbol (weight 2). */
export async function fetchLastPrice(symbol: string, signal?: AbortSignal): Promise<number> {
  const r = await get<{ symbol: string; price: string }>("/api/v3/ticker/price", { symbol }, signal);
  return Number(r.price);
}

/* -------------------------------- klines -------------------------------- */

type RawKline = [number, string, string, string, string, string, number, string, number, ...unknown[]];

/** GET /api/v3/klines. `limit` up to 1000. */
export async function fetchKlines(symbol: string, interval: Interval | "5m", limit = 500, signal?: AbortSignal): Promise<Candle[]> {
  const raw = await get<RawKline[]>("/api/v3/klines", { symbol, interval, limit }, signal);
  return raw.map((k) => ({
    time: Math.floor(k[0] / 1000),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
    closeTime: k[6],
    quoteVolume: Number(k[7]),
  }));
}

/* --------------------------------- depth -------------------------------- */

interface RawDepth {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

/** GET /api/v3/depth. limit 5/10/20/50/100 (weight 5 up to 100). */
export async function fetchDepth(symbol: string, limit = 20, signal?: AbortSignal): Promise<DepthSnapshot> {
  const r = await get<RawDepth>("/api/v3/depth", { symbol, limit }, signal);
  const level = ([p, q]: [string, string]) => ({ price: Number(p), qty: Number(q) });
  return { lastUpdateId: r.lastUpdateId, bids: r.bids.map(level), asks: r.asks.map(level) };
}

/* --------------------------------- trades -------------------------------- */

interface RawTrade {
  id: number;
  price: string;
  qty: string;
  time: number;
  isBuyerMaker: boolean;
}

/** GET /api/v3/trades. Most recent trades, oldest first as returned by Binance. */
export async function fetchTrades(symbol: string, limit = 60, signal?: AbortSignal): Promise<Trade[]> {
  const raw = await get<RawTrade[]>("/api/v3/trades", { symbol, limit }, signal);
  return raw.map((t) => ({ id: t.id, price: Number(t.price), qty: Number(t.qty), time: t.time, isBuyerMaker: t.isBuyerMaker }));
}
