"use client";

import Link from "next/link";
import { useState } from "react";
import { AnomalyPanel } from "@/components/analytics/anomaly-panel";
import { MarketChart } from "@/components/chart/market-chart";
import { AssetTable } from "@/components/market/asset-table";
import { MetricStrip } from "@/components/market/metric-strip";
import { DEFAULT_SYMBOL } from "@/lib/binance/config";
import { useMarketStore } from "@/store/market-store";

export function OverviewView() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const universe = useMarketStore((s) => s.universe);
  const options = universe.length ? universe : [DEFAULT_SYMBOL];

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-3">
      <MetricStrip />
      <MarketChart
        symbol={symbol}
        symbols={options}
        onSymbolChange={setSymbol}
        heightClass="min-h-[340px] max-h-[460px]"
      />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
        <AssetTable
          title="Markets"
          limit={25}
          maxHeightClass="max-h-[420px]"
          actions={
            <Link href="/markets" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
              View all
            </Link>
          }
        />
        <AnomalyPanel limit={12} />
      </div>
    </div>
  );
}
