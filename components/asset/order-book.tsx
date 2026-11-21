"use client";

import { Panel, PanelMessage } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { usePolling } from "@/hooks/use-polling";
import { fetchDepth } from "@/lib/binance/rest";
import type { DepthLevel } from "@/lib/binance/types";
import { fmtPrice, fmtQty } from "@/lib/format";

const LEVELS = 10;
/** Order book depth is a REST snapshot (weight 5), refreshed every 5s while the tab is visible. */
const REFRESH_MS = 5000;

function Side({ levels, tone, max }: { levels: DepthLevel[]; tone: "up" | "down"; max: number }) {
  return (
    <ul className="tabular-nums">
      {levels.map((l) => (
        <li key={l.price} className="relative flex items-center justify-between px-3 py-0.5">
          <span aria-hidden className={`absolute inset-y-0 right-0 ${tone === "up" ? "bg-up/10" : "bg-down/10"}`} style={{ width: `${(l.qty / max) * 100}%` }} />
          <span className={`relative ${tone === "up" ? "text-up" : "text-down"}`}>{fmtPrice(l.price)}</span>
          <span className="relative text-muted-foreground">{fmtQty(l.qty)}</span>
        </li>
      ))}
    </ul>
  );
}

export function OrderBook({ symbol }: { symbol: string }) {
  const { data, error, loading } = usePolling((signal) => fetchDepth(symbol, 20, signal), REFRESH_MS, symbol);

  const bids = data?.bids.slice(0, LEVELS) ?? [];
  const asks = data?.asks.slice(0, LEVELS) ?? [];
  const max = Math.max(1e-12, ...bids.map((l) => l.qty), ...asks.map((l) => l.qty));
  const bestBid = bids[0]?.price;
  const bestAsk = asks[0]?.price;
  const spread = bestBid !== undefined && bestAsk !== undefined ? bestAsk - bestBid : undefined;

  return (
    <Panel title="Order book" actions={<span className="text-[11px] text-dim">Snapshot, {REFRESH_MS / 1000}s refresh</span>}>
      {error && !data ? (
        <PanelMessage tone="error">Could not load order book. {error}</PanelMessage>
      ) : loading && !data ? (
        <div className="space-y-2 p-3">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} />
          ))}
        </div>
      ) : (
        <div>
          <div className="flex justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground">
            <span>Price (USDT)</span>
            <span>Size</span>
          </div>
          <Side levels={[...asks].reverse()} tone="down" max={max} />
          <div className="flex items-center justify-between border-y border-border bg-secondary px-3 py-1.5 text-xs tabular-nums">
            <span className="text-muted-foreground">Spread (derived)</span>
            <span>{spread !== undefined && bestBid ? `${fmtPrice(spread)} (${((spread / bestBid) * 100).toFixed(4)}%)` : "\u2014"}</span>
          </div>
          <Side levels={bids} tone="up" max={max} />
          {error && <p className="border-t border-border px-3 py-2 text-xs text-warn">Refresh failed: {error}. Showing the last snapshot.</p>}
        </div>
      )}
    </Panel>
  );
}
