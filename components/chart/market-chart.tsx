"use client";

import {
  ColorType,
  CrosshairMode,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { INTERVALS, type Interval } from "@/lib/binance/config";
import { errorMessage, fetchKlines, isAbortError } from "@/lib/binance/rest";
import type { Candle, KlineEvent } from "@/lib/binance/types";
import { getStreamClient } from "@/lib/binance/ws";
import { CHART } from "@/lib/chart-theme";
import { fmtCompact, fmtPrice, priceDecimals } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMarketStore } from "@/store/market-store";

interface MarketChartProps {
  symbol: string;
  /** When provided, a symbol selector is shown. */
  symbols?: string[];
  onSymbolChange?: (symbol: string) => void;
  heightClass?: string;
  className?: string;
}

type Load = { status: "loading" } | { status: "ready" } | { status: "error"; message: string };

interface Legend {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

const candleData = (c: Candle): CandlestickData => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close });
const volumeData = (c: Candle): HistogramData => ({ time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? CHART.volumeUp : CHART.volumeDown });

function klineToCandle(k: KlineEvent["k"]): Candle {
  return { time: Math.floor(k.t / 1000), open: Number(k.o), high: Number(k.h), low: Number(k.l), close: Number(k.c), volume: Number(k.v), quoteVolume: Number(k.q), closeTime: k.T };
}

export function MarketChart({ symbol, symbols, onSymbolChange, heightClass = "h-[420px]", className }: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const lastTimeRef = useRef(0);
  const appliedViewRef = useRef("");

  const [interval, setIntervalValue] = useState<Interval>("1h");
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [retry, setRetry] = useState(0);
  const [hover, setHover] = useState<Legend | null>(null);
  const [latest, setLatest] = useState<Legend | null>(null);
  const reconnects = useMarketStore((s) => s.ws.reconnects);

  /* Create the chart once; remove it on unmount. */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    appliedViewRef.current = "";

    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: CHART.text, fontSize: 11, fontFamily: "var(--font-plex), system-ui, sans-serif" },
      grid: { vertLines: { color: CHART.grid }, horzLines: { color: CHART.grid } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: CHART.crosshair, labelBackgroundColor: CHART.border },
        horzLine: { color: CHART.crosshair, labelBackgroundColor: CHART.border },
      },
      rightPriceScale: { borderColor: CHART.border },
      timeScale: { borderColor: CHART.border, timeVisible: true, secondsVisible: false },
    });

    const candles = chart.addCandlestickSeries({ upColor: CHART.up, downColor: CHART.down, wickUpColor: CHART.up, wickDownColor: CHART.down, borderVisible: false });
    candles.priceScale().applyOptions({ scaleMargins: { top: 0.06, bottom: 0.24 } });
    const volume = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "" });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });

    const onMove = (p: MouseEventParams) => {
      const c = p.seriesData.get(candles) as CandlestickData | undefined;
      if (!p.time || !c) return setHover(null);
      const v = p.seriesData.get(volume) as HistogramData | undefined;
      setHover({ open: c.open, high: c.high, low: c.low, close: c.close, volume: v?.value });
    };
    chart.subscribeCrosshairMove(onMove);

    chartRef.current = chart;
    candleSeriesRef.current = candles;
    volumeSeriesRef.current = volume;

    return () => {
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  /* Load history, then follow the live kline stream. Re-runs after a WebSocket reconnect to fill any gap. */
  useEffect(() => {
    const candles = candleSeriesRef.current;
    const volume = volumeSeriesRef.current;
    const chart = chartRef.current;
    if (!candles || !volume || !chart) return;

    const ctrl = new AbortController();
    let unsubscribe: (() => void) | undefined;
    const viewKey = `${symbol}:${interval}`;
    setLoad({ status: "loading" });

    fetchKlines(symbol, interval, 500, ctrl.signal)
      .then((history) => {
        if (ctrl.signal.aborted) return;
        const d = priceDecimals(history.at(-1)?.close ?? 1);
        candles.applyOptions({ priceFormat: { type: "price", precision: d, minMove: 10 ** -d } });
        candles.setData(history.map(candleData));
        volume.setData(history.map(volumeData));
        lastTimeRef.current = history.at(-1)?.time ?? 0;

        if (appliedViewRef.current !== viewKey) {
          appliedViewRef.current = viewKey;
          const n = history.length;
          chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 120), to: n + 4 });
        }

        const last = history.at(-1);
        if (last) {
          setLatest({ open: last.open, high: last.high, low: last.low, close: last.close, volume: last.volume });
        }
        setLoad({ status: "ready" });

        unsubscribe = getStreamClient().subscribe<KlineEvent>(`${symbol.toLowerCase()}@kline_${interval}`, (msg) => {
          const c = klineToCandle(msg.k);
          if (c.time < lastTimeRef.current) return;
          lastTimeRef.current = c.time;
          candles.update(candleData(c));
          volume.update(volumeData(c));
          setLatest({ open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume });
        });
      })
      .catch((e) => {
        if (isAbortError(e)) return;
        setLoad({ status: "error", message: errorMessage(e) });
      });

    return () => {
      ctrl.abort();
      unsubscribe?.();
    };
  }, [symbol, interval, reconnects, retry]);

  const legend = hover ?? latest;
  const base = symbol.replace(/USDT$/, "");

  return (
    <section className={cn("flex min-w-0 flex-col rounded border border-border bg-card", className)} aria-label={`${symbol} candlestick chart`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-3 py-1.5">
        {symbols && onSymbolChange ? (
          <select
            value={symbol}
            onChange={(e) => onSymbolChange(e.target.value)}
            aria-label="Chart symbol"
            className="h-7 rounded border border-input bg-background px-2 text-[13px] font-medium text-foreground"
          >
            {symbols.map((s) => (
              <option key={s} value={s}>
                {s.replace(/USDT$/, "")} / USDT
              </option>
            ))}
          </select>
        ) : (
          <span className="text-[13px] font-medium">{base} / USDT</span>
        )}

        <div role="group" aria-label="Interval" className="flex items-center gap-0.5">
          {INTERVALS.map((i) => (
            <Button key={i} variant="ghost" size="sm" aria-pressed={i === interval} onClick={() => setIntervalValue(i)} className={cn("h-6 px-2 text-xs", i === interval && "bg-accent text-foreground")}>
              {i}
            </Button>
          ))}
        </div>

        {legend && (
          <dl className="ml-auto flex items-center gap-3 text-xs tabular-nums text-muted-foreground">
            {(
              [
                ["O", legend.open],
                ["H", legend.high],
                ["L", legend.low],
                ["C", legend.close],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex gap-1">
                <dt className="text-dim">{k}</dt>
                <dd className={legend.close >= legend.open ? "text-up" : "text-down"}>{fmtPrice(v)}</dd>
              </div>
            ))}
            {legend.volume !== undefined && (
              <div className="hidden gap-1 sm:flex">
                <dt className="text-dim">Vol</dt>
                <dd>{fmtCompact(legend.volume)}</dd>
              </div>
            )}
          </dl>
        )}
      </div>

      <div className={cn("relative min-h-0 w-full", heightClass)}>
        <div ref={containerRef} className="absolute inset-0" />
        {load.status !== "ready" && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-card/80">
            {load.status === "loading" ? (
              <p className="text-muted-foreground">
                Loading {base} {interval} candles
              </p>
            ) : (
              <div className="flex max-w-sm flex-col items-center gap-2 px-4 text-center">
                <p className="text-down">Could not load chart data. {load.message}</p>
                <Button variant="outline" size="sm" onClick={() => setRetry((n) => n + 1)}>
                  Retry
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightweight Charts attribution (required by license). Kept small, non-overlapping, bottom-right. */}
      <div className="absolute right-1 bottom-1 z-20">
        <a
          href="https://www.tradingview.com/lightweight-charts/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-dim/60 hover:text-dim underline decoration-dim/40 hover:decoration-current"
          aria-label="Charting by Lightweight Charts"
        >
          Lightweight Charts
        </a>
      </div>
    </section>
  );
}
