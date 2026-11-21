"use client";

import { useEffect, useState } from "react";
import { errorMessage, fetchTicker24h, isAbortError } from "@/lib/binance/rest";
import { getStreamClient } from "@/lib/binance/ws";
import { miniTickerToTicker } from "@/lib/market/mini-ticker";
import type { MiniTickerEvent, Ticker } from "@/lib/binance/types";
import { useMarketStore } from "@/store/market-store";

/**
 * Ticker for one symbol. Uses the shared market store when the symbol is tracked,
 * otherwise loads it directly (REST once, then its own miniTicker stream).
 */
export function useTicker(symbol: string): { ticker?: Ticker; loading: boolean; error?: string } {
  const fromStore = useMarketStore((s) => s.tickers[symbol]);
  const snapshotReady = useMarketStore((s) => s.snapshot.status === "ready");
  const needsDirect = snapshotReady && !fromStore;

  const [direct, setDirect] = useState<{ symbol: string; ticker?: Ticker; error?: string } | null>(null);

  useEffect(() => {
    if (!needsDirect) return;
    const ctrl = new AbortController();
    fetchTicker24h(symbol, ctrl.signal)
      .then((ticker) => setDirect({ symbol, ticker }))
      .catch((e) => {
        if (!isAbortError(e)) setDirect({ symbol, error: errorMessage(e) });
      });
    const unsub = getStreamClient().subscribe<MiniTickerEvent>(`${symbol.toLowerCase()}@miniTicker`, (msg) => {
      setDirect((d) => (d && d.symbol === symbol ? { symbol, ticker: miniTickerToTicker(msg) } : d));
    });
    return () => {
      ctrl.abort();
      unsub();
    };
  }, [needsDirect, symbol]);

  if (fromStore) return { ticker: fromStore, loading: false };
  if (direct && direct.symbol === symbol) return { ticker: direct.ticker, loading: false, error: direct.error };
  return { loading: true };
}
