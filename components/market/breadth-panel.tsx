"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Panel, PanelMessage } from "@/components/ui/panel";
import { fmtPct, trendClass } from "@/lib/format";
import { useMarketStore } from "@/store/market-store";

export function BreadthPanel() {
  const tickers = useMarketStore((s) => s.tickers);
  const universe = useMarketStore((s) => s.universe);

  const data = useMemo(() => {
    const list = universe.map((s) => tickers[s]).filter((t): t is NonNullable<typeof t> => Boolean(t));
    const up = list.filter((t) => t.changePct > 0).length;
    const down = list.filter((t) => t.changePct < 0).length;
    const sorted = [...list].sort((a, b) => b.changePct - a.changePct);
    return { total: list.length, up, down, flat: list.length - up - down, gainers: sorted.slice(0, 5), losers: sorted.slice(-5).reverse() };
  }, [tickers, universe]);

  if (data.total === 0) {
    return (
      <Panel title="Market breadth">
        <PanelMessage>Waiting for market data.</PanelMessage>
      </Panel>
    );
  }

  const pct = (n: number) => `${(n / data.total) * 100}%`;
  const list = (items: typeof data.gainers, label: string) => (
    <div>
      <h3 className="mb-1 text-xs text-muted-foreground">{label}</h3>
      <ul className="tabular-nums">
        {items.map((t) => (
          <li key={t.symbol} className="flex items-center justify-between py-0.5">
            <Link href={`/asset/${t.symbol}`} className="hover:underline">
              {t.base}
            </Link>
            <span className={trendClass(t.changePct)}>{fmtPct(t.changePct)}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <Panel title="Market breadth" actions={<span className="text-[11px] text-dim">Derived</span>}>
      <div className="space-y-4 p-3">
        <div>
          <div className="flex h-1.5 overflow-hidden rounded-sm bg-border" role="img" aria-label={`${data.up} advancing, ${data.down} declining, ${data.flat} unchanged`}>
            <div className="bg-up" style={{ width: pct(data.up) }} />
            <div className="bg-dim" style={{ width: pct(data.flat) }} />
            <div className="bg-down" style={{ width: pct(data.down) }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs tabular-nums">
            <span className="text-up">{data.up} advancing</span>
            <span className="text-muted-foreground">{data.flat} flat</span>
            <span className="text-down">{data.down} declining</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {list(data.gainers, "Top gainers, 24h")}
          {list(data.losers, "Top losers, 24h")}
        </div>
      </div>
    </Panel>
  );
}
