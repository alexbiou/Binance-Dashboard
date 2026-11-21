"use client";

import { useEffect } from "react";
import { useAnomalyStore } from "@/store/anomaly-store";
import { useMarketStore } from "@/store/market-store";

/** Number of most liquid pairs scanned, and how often. 20 pairs x weight 2 = 40 request weight per scan. */
export const SCAN_SIZE = 20;
export const SCAN_INTERVAL_MS = 60_000;

/** Runs the anomaly scan while a consumer is mounted. Skips scans while the tab is hidden. */
export function useAnomalyScan() {
  const ready = useMarketStore((s) => s.snapshot.status === "ready");

  useEffect(() => {
    if (!ready) return;

    const run = () => {
      if (document.hidden) return;
      const { tickers, universe } = useMarketStore.getState();
      const top = [...universe].sort((a, b) => (tickers[b]?.quoteVolume ?? 0) - (tickers[a]?.quoteVolume ?? 0)).slice(0, SCAN_SIZE);
      void useAnomalyStore.getState().scan(top);
    };
    const stale = () => Date.now() - (useAnomalyStore.getState().lastScanAt ?? 0) > SCAN_INTERVAL_MS * 0.9;

    if (stale()) run();
    const timer = setInterval(run, SCAN_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden && stale()) run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready]);
}
