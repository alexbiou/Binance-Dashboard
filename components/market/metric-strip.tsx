"use client";

import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtPct, fmtPrice, fmtUsdCompact, trendClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMarketStore } from "@/store/market-store";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

interface CellProps {
  label: string;
  kind: "live" | "derived";
  value?: string;
  valueClass?: string;
  sub?: string;
  hint?: string;
  className?: string;
}

function Cell({ label, kind, value, valueClass, sub, hint, className }: CellProps) {
  return (
    <div className={cn("min-w-0 bg-card px-3 py-2.5", className)} title={hint}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        <span className={cn("text-[11px]", kind === "live" ? "text-up/80" : "text-dim")}>{kind === "live" ? "Live" : "Derived"}</span>
      </div>
      <div className={cn("mt-1 truncate text-lg font-medium tabular-nums leading-6", valueClass)}>{value ?? <Skeleton className="mt-1.5 h-4 w-24" />}</div>
      <div className="truncate text-xs tabular-nums text-muted-foreground">{sub ?? (value === undefined ? <Skeleton className="h-3 w-32" /> : "\u00a0")}</div>
    </div>
  );
}

export function MetricStrip() {
  const tickers = useMarketStore((s) => s.tickers);
  const universe = useMarketStore((s) => s.universe);
  const btc = tickers["BTCUSDT"];
  const eth = tickers["ETHUSDT"];

  const { totalVolume, medianRange } = useMemo(() => {
    let total = 0;
    const ranges: number[] = [];
    for (const s of universe) {
      const t = tickers[s];
      if (!t) continue;
      total += t.quoteVolume;
      if (t.low > 0) ranges.push(((t.high - t.low) / t.low) * 100);
    }
    return { totalVolume: universe.length ? total : undefined, medianRange: ranges.length ? median(ranges) : undefined };
  }, [tickers, universe]);

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded border border-border bg-border md:grid-cols-5">
      <Cell label="BTC / USDT" kind="live" value={btc ? fmtPrice(btc.price) : undefined} sub={btc ? `High ${fmtPrice(btc.high)}  Low ${fmtPrice(btc.low)}` : undefined} />
      <Cell label="ETH / USDT" kind="live" value={eth ? fmtPrice(eth.price) : undefined} sub={eth ? `High ${fmtPrice(eth.high)}  Low ${fmtPrice(eth.low)}` : undefined} />
      <Cell
        label="24h volume, tracked"
        kind="derived"
        value={totalVolume !== undefined ? fmtUsdCompact(totalVolume) : undefined}
        sub={universe.length ? `Sum over top ${universe.length} USDT pairs` : undefined}
        hint="Sum of 24h quote volume across the tracked USDT pairs. Not a whole-market figure."
      />
      <Cell label="BTC 24h change" kind="live" value={btc ? fmtPct(btc.changePct) : undefined} valueClass={trendClass(btc?.changePct)} sub={btc ? `From ${fmtPrice(btc.open)}` : undefined} />
      <Cell
        label="Volatility, 24h range"
        kind="derived"
        value={medianRange !== undefined ? `${medianRange.toFixed(2)}%` : undefined}
        sub={universe.length ? `Median (high - low) / low` : undefined}
        hint="Median of (24h high - 24h low) / 24h low across the tracked pairs."
        className="col-span-2 md:col-span-1"
      />
    </div>
  );
}
