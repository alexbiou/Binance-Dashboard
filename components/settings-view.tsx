"use client";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { useNow } from "@/hooks/use-now";
import { REST_BASE, UNIVERSE_SIZE, WS_URL } from "@/lib/binance/config";
import { fmtAgo } from "@/lib/format";
import { useMarketStore } from "@/store/market-store";
import { useWatchlistStore } from "@/store/watchlist-store";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-border/60 px-3 py-2 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right tabular-nums">{children}</dd>
    </div>
  );
}

export function SettingsView() {
  const snapshot = useMarketStore((s) => s.snapshot);
  const ws = useMarketStore((s) => s.ws);
  const universe = useMarketStore((s) => s.universe);
  const lastTickAt = useMarketStore((s) => s.lastTickAt);
  const watchlist = useWatchlistStore((s) => s.symbols);
  const clear = useWatchlistStore((s) => s.clear);
  const now = useNow(1000);

  return (
    <div className="mx-auto grid max-w-[1100px] gap-3 lg:grid-cols-2">
      <Panel title="Connection diagnostics">
        <dl>
          <Row label="REST endpoint">{REST_BASE}</Row>
          <Row label="WebSocket endpoint">{WS_URL}</Row>
          <Row label="WebSocket state">{ws.status}</Row>
          <Row label="WebSocket reconnects">{ws.reconnects}</Row>
          <Row label="Snapshot">{snapshot.status}{snapshot.error ? `, ${snapshot.error}` : ""}</Row>
          <Row label="Last snapshot">{fmtAgo(snapshot.at, now)}</Row>
          <Row label="Last live tick">{fmtAgo(lastTickAt, now)}</Row>
          <Row label="Tracked pairs">{universe.length} of top {UNIVERSE_SIZE} USDT pairs</Row>
        </dl>
      </Panel>

      <div className="flex flex-col gap-3">
        <Panel title="Local data">
          <div className="space-y-3 p-3">
            <p className="text-muted-foreground">The watchlist is stored in this browser (localStorage). Nothing is sent to a server.</p>
            <div className="flex items-center justify-between gap-3">
              <span className="tabular-nums">{watchlist.length} saved assets</span>
              <Button variant="destructive" size="sm" disabled={watchlist.length === 0} onClick={clear}>
                Clear watchlist
              </Button>
            </div>
          </div>
        </Panel>

        <Panel title="About the data">
          <div className="space-y-2 p-3 text-muted-foreground">
            <p>Prices, 24h statistics, candles, trades and order book levels come from Binance public market-data endpoints. No API key is used.</p>
            <p>Items marked Derived are calculated in this app from that data: tracked volume, volatility range, breadth, spread, range position and anomaly flags.</p>
            <p>DashboardBinance is read-only. It cannot place or manage orders, and nothing shown is investment advice.</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
