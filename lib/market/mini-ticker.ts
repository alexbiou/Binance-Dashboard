import { baseAssetOf } from "@/lib/binance/rest";
import type { MiniTickerEvent, Ticker } from "@/lib/binance/types";

export function miniTickerToTicker(e: MiniTickerEvent): Ticker {
  const price = Number(e.c);
  const open = Number(e.o);
  return {
    symbol: e.s,
    base: baseAssetOf(e.s),
    price,
    open,
    changePct: open > 0 ? ((price - open) / open) * 100 : 0,
    high: Number(e.h),
    low: Number(e.l),
    volume: Number(e.v),
    quoteVolume: Number(e.q),
    updatedAt: Date.now(),
  };
}
