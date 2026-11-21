"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import { fmtAgo } from "@/lib/format";
import { loadSnapshot } from "@/lib/market/snapshot";
import { cn } from "@/lib/utils";
import { useMarketStore } from "@/store/market-store";

export function SyncButton() {
  const snapshot = useMarketStore((s) => s.snapshot);
  const now = useNow(5000);
  const failed = Boolean(snapshot.error);

  return (
    <div className="flex items-center gap-2">
      <span className={cn("hidden text-xs md:inline", failed ? "text-warn" : "text-dim")} title={snapshot.error}>
        {failed ? "Sync failed" : snapshot.at ? `Synced ${fmtAgo(snapshot.at, now)}` : "Not synced"}
      </span>
      <Button variant="outline" size="sm" onClick={() => void loadSnapshot()} disabled={snapshot.syncing} aria-label="Synchronize market snapshot">
        <RefreshCw className={cn(snapshot.syncing && "animate-spin")} />
        <span className="hidden sm:inline">Sync</span>
      </Button>
    </div>
  );
}
