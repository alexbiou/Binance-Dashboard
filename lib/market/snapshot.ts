import { errorMessage, fetchAllTickers24h } from "@/lib/binance/rest";
import { selectUniverse } from "@/lib/binance/universe";
import { useMarketStore } from "@/store/market-store";

const MIN_INTERVAL_MS = 10_000;
let inflight: Promise<void> | null = null;

/**
 * Load the 24h ticker snapshot (REST) and select the tracked universe.
 * Live updates afterwards come from WebSocket streams, so this is not polled.
 */
export function loadSnapshot(): Promise<void> {
  if (inflight) return inflight;
  const { snapshot, snapshotStart, snapshotSuccess, snapshotFailure } = useMarketStore.getState();
  if (snapshot.at && Date.now() - snapshot.at < MIN_INTERVAL_MS) return Promise.resolve();

  snapshotStart();
  inflight = fetchAllTickers24h()
    .then((all) => {
      const universe = selectUniverse(all);
      if (universe.length === 0) throw new Error("Binance returned no tradable USDT pairs.");
      snapshotSuccess(universe);
    })
    .catch((e) => snapshotFailure(errorMessage(e)))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
