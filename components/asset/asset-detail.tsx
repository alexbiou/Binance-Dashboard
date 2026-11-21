"use client";

import Link from "next/link";
import { MarketChart } from "@/components/chart/market-chart";
import { OrderBook } from "@/components/asset/order-book";
import { TradesPanel } from "@/components/asset/trades-panel";
import { Button } from "@/components/ui/button";
import { Panel, PanelMessage } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { StarButton } from "@/components/watchlist/star-button";
import { useTicker } from "@/hooks/use-ticker";
import { fmtCompact, fmtPct, fmtPrice, fmtUsdCompact, trendClass } from "@/lib/format";
import type { Ticker } from "@/lib/binance/types";

function Stat({ label, kind, children }: { label: string; kind: "live" | "derived"; children: React.ReactNode }) {
  return (
    <div className="min-w-0 bg-card px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        <span className={kind === "live" ? "text-[11px] text-up/80" : "text-[11px] text-dim"}>{kind === "live" ? "Live" : "Derived"}</span>
      </div>
      <div className="mt-1 truncate text-[15px] font-medium tabular-nums">{children}</div>
    </div>
  );
}

function RangeBar({ t }: { t: Ticker }) {
  const span = t.high - t.low;
  const pos = span > 0 ? Math.min(1, Math.max(0, (t.price - t.low) / span)) : 0.5;
  return (
    <div className="mt-1.5" role="img" aria-label={`Price is at ${(pos * 100).toFixed(0)}% of the 24 hour range`}>
      <div className="relative h-1 rounded-sm bg-border">
        <span className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 bg-foreground" style={{ left: `calc(${pos * 100}% - 1px)` }} />
      </div>
    </div>
  );
}

export function AssetDetail({ symbol }: { symbol: string }) {
  const { ticker, loading, error } = useTicker(symbol);
  const base = symbol.replace(/USDT$/, "");

  if (!loading && !ticker) {
    return (
      <Panel title={symbol}>
        <PanelMessage
          tone="error"
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/markets">Back to markets</Link>
            </Button>
          }
        >
          {error ? `Could not load ${symbol}. ${error}` : `${symbol} was not found.`}
        </PanelMessage>
      </Panel>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <StarButton symbol={symbol} className="size-7" />
          <h1 className="text-base font-semibold">
            {base} <span className="font-normal text-dim">/ USDT</span>
          </h1>
        </div>
        {ticker ? (
          <div className="flex items-baseline gap-3 tabular-nums">
            <span className="text-2xl font-medium">{fmtPrice(ticker.price)}</span>
            <span className={`text-sm ${trendClass(ticker.changePct)}`}>{fmtPct(ticker.changePct)}</span>
          </div>
        ) : (
          <Skeleton className="h-7 w-48" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded border border-border bg-border md:grid-cols-3 xl:grid-cols-6">
        <Stat label="24h change" kind="live">
          {ticker ? (
            <span className={trendClass(ticker.changePct)}>
              {fmtPct(ticker.changePct)} <span className="text-xs text-muted-foreground">{ticker.price - ticker.open >= 0 ? "+" : ""}{fmtPrice(ticker.price - ticker.open)}</span>
            </span>
          ) : (
            <Skeleton className="w-24" />
          )}
        </Stat>
        <Stat label="24h high" kind="live">{ticker ? fmtPrice(ticker.high) : <Skeleton className="w-20" />}</Stat>
        <Stat label="24h low" kind="live">{ticker ? fmtPrice(ticker.low) : <Skeleton className="w-20" />}</Stat>
        <Stat label={`Volume (${base})`} kind="live">{ticker ? fmtCompact(ticker.volume) : <Skeleton className="w-20" />}</Stat>
        <Stat label="Volume (USDT)" kind="live">{ticker ? fmtUsdCompact(ticker.quoteVolume) : <Skeleton className="w-20" />}</Stat>
        <Stat label="Position in 24h range" kind="derived">
          {ticker ? (
            <>
              {ticker.high > ticker.low ? `${(((ticker.price - ticker.low) / (ticker.high - ticker.low)) * 100).toFixed(0)}%` : "\u2014"}
              <RangeBar t={ticker} />
            </>
          ) : (
            <Skeleton className="w-16" />
          )}
        </Stat>
      </div>

      <MarketChart symbol={symbol} heightClass="min-h-[320px] max-h-[420px]" />

      <div className="grid gap-3 lg:grid-cols-2">
        <TradesPanel symbol={symbol} />
        <OrderBook symbol={symbol} />
      </div>
    </div>
  );
}
