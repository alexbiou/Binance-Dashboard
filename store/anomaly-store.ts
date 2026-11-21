import { create } from "zustand";
import { SEVERITY_RANK, type Anomaly } from "@/lib/analytics/anomalies";
import { scanMarket } from "@/lib/analytics/scan";
import { errorMessage } from "@/lib/binance/rest";

const HISTORY_MS = 60 * 60 * 1000;
const MAX_ITEMS = 100;

interface AnomalyState {
  items: Anomaly[];
  status: "idle" | "scanning" | "ready" | "error";
  error?: string;
  lastScanAt?: number;
  scanned: number;
  failed: number;
  scan: (symbols: string[]) => Promise<void>;
}

export const useAnomalyStore = create<AnomalyState>((set, get) => ({
  items: [],
  status: "idle",
  scanned: 0,
  failed: 0,

  scan: async (symbols) => {
    if (get().status === "scanning" || symbols.length === 0) return;
    set((s) => ({ status: "scanning", error: s.status === "error" ? undefined : s.error }));
    try {
      const result = await scanMarket(symbols);
      const now = Date.now();
      // Keep the last hour of detections, de-duplicated per symbol/type/candle.
      const merged = new Map<string, Anomaly>();
      for (const a of get().items) if (now - a.detectedAt < HISTORY_MS) merged.set(a.id, a);
      for (const a of result.anomalies) merged.set(a.id, a);
      const items = [...merged.values()]
        .sort((a, b) => b.detectedAt - a.detectedAt || SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
        .slice(0, MAX_ITEMS);
      set({ items, status: "ready", error: undefined, lastScanAt: now, scanned: result.scanned, failed: result.failed });
    } catch (e) {
      set({ status: "error", error: errorMessage(e) });
    }
  },
}));
