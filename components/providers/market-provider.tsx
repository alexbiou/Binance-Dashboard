"use client";

import { useEffect } from "react";
import { getStreamClient } from "@/lib/binance/ws";
import type { MiniTickerEvent, Ticker } from "@/lib/binance/types";
import { loadSnapshot } from "@/lib/market/snapshot";
import { miniTickerToTicker } from "@/lib/market/mini-ticker";
import { useMarketStore } from "@/store/market-store";
import { hydrateWatchlist } from "@/store/watchlist-store";

const FLUSH_MS = 1000;

/**
 * Owns the market data lifecycle: REST snapshot once, then WebSocket miniTicker streams
 * for the tracked universe. Incoming ticks are buffered and flushed once per second so the
 * UI re-renders at most once per second regardless of message rate.
 */
export function MarketProvider({ children }: { children: React.ReactNode }) {
  const universeKey = useMarketStore((s) => [...s.universe].sort().join(","));

  useEffect(() => {
    void hydrateWatchlist();
    void loadSnapshot();
    return getStreamClient().onStatus((e) => useMarketStore.getState().setWs({ status: e.status, attempt: e.attempt, reconnects: e.reconnects }));
  }, []);

  useEffect(() => {
    if (!universeKey) return;
    const symbols = universeKey.split(",");
    const client = getStreamClient();
    const buffer = new Map<string, Ticker>();

    const unsubs = symbols.map((symbol) =>
      client.subscribe<MiniTickerEvent>(`${symbol.toLowerCase()}@miniTicker`, (msg) => {
        buffer.set(symbol, miniTickerToTicker(msg));
      }),
    );
    const timer = setInterval(() => {
      if (buffer.size === 0) return;
      useMarketStore.getState().applyTickers([...buffer.values()]);
      buffer.clear();
    }, FLUSH_MS);

    return () => {
      clearInterval(timer);
      unsubs.forEach((u) => u());
    };
  }, [universeKey]);

  return <>{children}</>;
}
