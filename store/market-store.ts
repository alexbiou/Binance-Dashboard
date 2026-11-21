import { create } from "zustand";
import type { ConnectionStatus, Ticker } from "@/lib/binance/types";

type SnapshotStatus = "idle" | "loading" | "ready" | "error";

interface MarketState {
  tickers: Record<string, Ticker>;
  /** Tracked symbols ordered by 24h quote volume at snapshot time. */
  universe: string[];
  snapshot: { status: SnapshotStatus; syncing: boolean; error?: string; at?: number };
  ws: { status: ConnectionStatus; attempt: number; reconnects: number };
  lastTickAt?: number;

  snapshotStart: () => void;
  snapshotSuccess: (tickers: Ticker[]) => void;
  snapshotFailure: (message: string) => void;
  applyTickers: (tickers: Ticker[]) => void;
  setWs: (ws: MarketState["ws"]) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  tickers: {},
  universe: [],
  snapshot: { status: "idle", syncing: false },
  ws: { status: "idle", attempt: 0, reconnects: 0 },

  snapshotStart: () =>
    set((s) => ({
      snapshot: { ...s.snapshot, syncing: true, error: undefined, status: s.universe.length ? s.snapshot.status : "loading" },
    })),

  snapshotSuccess: (tickers) =>
    set((s) => ({
      universe: tickers.map((t) => t.symbol),
      tickers: { ...s.tickers, ...Object.fromEntries(tickers.map((t) => [t.symbol, t])) },
      snapshot: { status: "ready", syncing: false, at: Date.now() },
      lastTickAt: Date.now(),
    })),

  snapshotFailure: (message) =>
    set((s) => ({
      // With data already on screen a failed refresh keeps it, but the error stays visible in the header.
      snapshot: { ...s.snapshot, status: s.universe.length ? "ready" : "error", syncing: false, error: message },
    })),

  applyTickers: (tickers) =>
    set((s) => {
      const next = { ...s.tickers };
      for (const t of tickers) next[t.symbol] = t;
      return { tickers: next, lastTickAt: Date.now() };
    }),

  setWs: (ws) => set({ ws }),
}));
