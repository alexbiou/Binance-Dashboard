"use client";

import { useEffect, useState } from "react";
import { Panel, PanelMessage } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage, fetchTrades, isAbortError } from "@/lib/binance/rest";
import type { Trade, TradeEvent } from "@/lib/binance/types";
import { getStreamClient } from "@/lib/binance/ws";
import { fmtClock, fmtPrice, fmtQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMarketStore } from "@/store/market-store";

const MAX_ROWS = 40;
const FLUSH_MS = 400;

function merge(prev: Trade[], incoming: Trade[]): Trade[] {
  const seen = new Set(prev.map((t) => t.id));
  const fresh = incoming.filter((t) => !seen.has(t.id));
  return [...fresh, ...prev].sort((a, b) => b.id - a.id).slice(0, MAX_ROWS);
}

export function TradesPanel({ symbol }: { symbol: string }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [state, setState] = useState<{ loading: boolean; error?: string }>({ loading: true });
  const reconnects = useMarketStore((s) => s.ws.reconnects);

  useEffect(() => {
    setTrades([]);
    setState({ loading: true });
  }, [symbol]);

  useEffect(() => {
    const ctrl = new AbortController();
    const buffer: Trade[] = [];

    // Subscribe first so nothing is missed while the REST snapshot loads; ids de-duplicate the overlap.
    const unsub = getStreamClient().subscribe<TradeEvent>(`${symbol.toLowerCase()}@trade`, (m) => {
      buffer.push({ id: m.t, price: Number(m.p), qty: Number(m.q), time: m.T, isBuyerMaker: m.m });
    });
    const timer = setInterval(() => {
      if (buffer.length === 0) return;
      const batch = buffer.splice(0, buffer.length);
      setTrades((prev) => merge(prev, batch));
    }, FLUSH_MS);

    fetchTrades(symbol, MAX_ROWS, ctrl.signal)
      .then((history) => {
        setTrades((prev) => merge(prev, history));
        setState({ loading: false });
      })
      .catch((e) => {
        if (!isAbortError(e)) setState({ loading: false, error: errorMessage(e) });
      });

    return () => {
      ctrl.abort();
      clearInterval(timer);
      unsub();
    };
  }, [symbol, reconnects]);

  return (
    <Panel title="Recent trades" actions={<span className="text-[11px] text-up/80">Live</span>}>
      {state.error && trades.length === 0 ? (
        <PanelMessage tone="error">Could not load trades. {state.error}</PanelMessage>
      ) : (
        <div className="max-h-[340px] overflow-auto">
          <table className="w-full border-collapse text-[13px] tabular-nums">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Time</th>
                <th className="px-3 py-2 text-right font-medium">Price (USDT)</th>
                <th className="px-3 py-2 text-right font-medium">Size</th>
              </tr>
            </thead>
            <tbody>
              {state.loading && trades.length === 0
                ? Array.from({ length: 12 }, (_, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5"><Skeleton className="w-16" /></td>
                      <td className="px-3 py-1.5"><Skeleton className="ml-auto w-20" /></td>
                      <td className="px-3 py-1.5"><Skeleton className="ml-auto w-14" /></td>
                    </tr>
                  ))
                : trades.map((t) => (
                    <tr key={t.id} className="border-b border-border/40">
                      <td className="px-3 py-1 text-muted-foreground">{fmtClock(t.time)}</td>
                      <td className={cn("px-3 py-1 text-right", t.isBuyerMaker ? "text-down" : "text-up")} title={t.isBuyerMaker ? "Aggressor sold" : "Aggressor bought"}>
                        {fmtPrice(t.price)}
                      </td>
                      <td className="px-3 py-1 text-right text-muted-foreground">{fmtQty(t.qty)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
