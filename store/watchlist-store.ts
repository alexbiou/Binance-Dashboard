import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WatchlistState {
  symbols: string[];
  /** True once localStorage has been read on the client (avoids SSR/hydration mismatch). */
  hydrated: boolean;
  add: (symbol: string) => void;
  remove: (symbol: string) => void;
  toggle: (symbol: string) => void;
  clear: () => void;
}

const DEFAULTS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      symbols: DEFAULTS,
      hydrated: false,
      add: (symbol) => set((s) => (s.symbols.includes(symbol) ? s : { symbols: [...s.symbols, symbol] })),
      remove: (symbol) => set((s) => ({ symbols: s.symbols.filter((x) => x !== symbol) })),
      toggle: (symbol) => (get().symbols.includes(symbol) ? get().remove(symbol) : get().add(symbol)),
      clear: () => set({ symbols: [] }),
    }),
    {
      name: "dashboardbinance:watchlist",
      version: 1,
      partialize: (s) => ({ symbols: s.symbols }),
      skipHydration: true,
    },
  ),
);

/** Read localStorage after mount. Called once by MarketProvider. */
export async function hydrateWatchlist() {
  await useWatchlistStore.persist.rehydrate();
  useWatchlistStore.setState({ hydrated: true });
}
