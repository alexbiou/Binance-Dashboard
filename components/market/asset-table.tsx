"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelMessage } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { StarButton } from "@/components/watchlist/star-button";
import { fmtPct, fmtPrice, fmtUsdCompact, trendClass } from "@/lib/format";
import { loadSnapshot } from "@/lib/market/snapshot";
import type { Ticker } from "@/lib/binance/types";
import { cn } from "@/lib/utils";
import { useMarketStore } from "@/store/market-store";

type SortKey = "symbol" | "price" | "changePct" | "quoteVolume" | "high" | "low";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "symbol", label: "Asset", align: "left" },
  { key: "price", label: "Price", align: "right" },
  { key: "changePct", label: "24h change", align: "right" },
  { key: "quoteVolume", label: "24h volume", align: "right" },
  { key: "high", label: "24h high", align: "right" },
  { key: "low", label: "24h low", align: "right" },
];

interface AssetTableProps {
  title: string;
  /** Restrict to these symbols (watchlist). Defaults to the whole tracked universe. */
  symbols?: string[];
  limit?: number;
  searchable?: boolean;
  emptyMessage?: string;
  actions?: React.ReactNode;
  className?: string;
  maxHeightClass?: string;
}

export function AssetTable({ title, symbols, limit, searchable = true, emptyMessage = "No assets to show.", actions, className, maxHeightClass = "max-h-[440px]" }: AssetTableProps) {
  const tickers = useMarketStore((s) => s.tickers);
  const universe = useMarketStore((s) => s.universe);
  const snapshot = useMarketStore((s) => s.snapshot);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "quoteVolume", dir: "desc" });

  const rows = useMemo(() => {
    const base = symbols ?? universe;
    const q = query.trim().toUpperCase();
    const filtered = base.filter((s) => q === "" || s.includes(q));
    const sign = sort.dir === "asc" ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => {
      if (sort.key === "symbol") return a.localeCompare(b) * sign;
      const av = tickers[a]?.[sort.key] ?? Number.NEGATIVE_INFINITY;
      const bv = tickers[b]?.[sort.key] ?? Number.NEGATIVE_INFINITY;
      return (av - bv) * sign;
    });
    return limit ? sorted.slice(0, limit) : sorted;
  }, [symbols, universe, tickers, query, sort, limit]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "symbol" ? "asc" : "desc" }));
  }

  const loading = snapshot.status === "idle" || snapshot.status === "loading";

  return (
    <Panel
      title={title}
      className={className}
      actions={
        <>
          {actions}
          {searchable && (
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter" aria-label="Filter assets" className="h-7 w-28 sm:w-36" />
          )}
        </>
      }
    >
      {snapshot.status === "error" ? (
        <PanelMessage
          tone="error"
          action={
            <Button variant="outline" size="sm" onClick={() => void loadSnapshot()}>
              Retry
            </Button>
          }
        >
          Could not load market data. {snapshot.error}
        </PanelMessage>
      ) : (
        <div className={cn("overflow-auto", maxHeightClass)}>
          <table className="w-full border-collapse text-[13px] tabular-nums">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border">
                {COLUMNS.map((c) => {
                  const active = sort.key === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      className={cn("whitespace-nowrap px-3 py-2 text-xs font-medium text-muted-foreground", c.align === "right" ? "text-right" : "text-left", c.key === "symbol" && "sticky left-0 bg-card")}
                    >
                      <button type="button" onClick={() => toggleSort(c.key)} className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}>
                        {c.label}
                        {active && (sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 10 }, (_, i) => (
                    <tr key={i} className="border-b border-border/60">
                      {COLUMNS.map((c) => (
                        <td key={c.key} className="px-3 py-2">
                          <Skeleton className={c.key === "symbol" ? "w-20" : "ml-auto w-16"} />
                        </td>
                      ))}
                    </tr>
                  ))
                : rows.map((s) => <AssetRow key={s} symbol={s} ticker={tickers[s]} />)}
            </tbody>
          </table>
          {!loading && rows.length === 0 && <PanelMessage>{query ? "No asset matches this filter." : emptyMessage}</PanelMessage>}
        </div>
      )}
    </Panel>
  );
}

const AssetRow = memo(function AssetRow({ symbol, ticker }: { symbol: string; ticker?: Ticker }) {
  const router = useRouter();
  const base = symbol.replace(/USDT$/, "");
  return (
    <tr onClick={() => router.push(`/asset/${symbol}`)} className="cursor-pointer border-b border-border/60 hover:bg-secondary">
      <td className="sticky left-0 bg-inherit px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <StarButton symbol={symbol} />
          <Link href={`/asset/${symbol}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">
            {base}
          </Link>
          <span className="text-xs text-dim">USDT</span>
        </div>
      </td>
      <td className="px-3 py-1.5 text-right">{fmtPrice(ticker?.price)}</td>
      <td className={cn("px-3 py-1.5 text-right", trendClass(ticker?.changePct))}>{fmtPct(ticker?.changePct)}</td>
      <td className="px-3 py-1.5 text-right text-muted-foreground">{fmtUsdCompact(ticker?.quoteVolume)}</td>
      <td className="px-3 py-1.5 text-right text-muted-foreground">{fmtPrice(ticker?.high)}</td>
      <td className="px-3 py-1.5 text-right text-muted-foreground">{fmtPrice(ticker?.low)}</td>
    </tr>
  );
});
