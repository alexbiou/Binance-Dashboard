"use client";

import { SearchBox } from "@/components/layout/search-box";
import { AssetTable } from "@/components/market/asset-table";
import { Panel, PanelMessage } from "@/components/ui/panel";
import { useWatchlistStore } from "@/store/watchlist-store";

export function WatchlistView() {
  const symbols = useWatchlistStore((s) => s.symbols);
  const hydrated = useWatchlistStore((s) => s.hydrated);
  const add = useWatchlistStore((s) => s.add);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-3">
      <Panel title="Add asset">
        <div className="p-3">
          <SearchBox onSelect={add} exclude={symbols} placeholder="Search an asset to add" className="max-w-sm" />
          <p className="mt-2 text-xs text-dim">Saved in this browser only. You can also use the star next to any asset.</p>
        </div>
      </Panel>
      {!hydrated ? (
        <Panel title="Watchlist">
          <PanelMessage>Loading saved assets.</PanelMessage>
        </Panel>
      ) : (
        <AssetTable title={`Watchlist (${symbols.length})`} symbols={symbols} searchable={symbols.length > 8} emptyMessage="Your watchlist is empty. Search above or click the star next to an asset to add it." />
      )}
    </div>
  );
}
