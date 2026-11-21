import { QUOTE_ASSET, UNIVERSE_SIZE } from "./config";
import type { Ticker } from "./types";

/** Stablecoin and fiat bases quoted in USDT: not interesting for market monitoring. */
const EXCLUDED_BASES = new Set(["USDC", "FDUSD", "TUSD", "USDP", "DAI", "BUSD", "USDE", "USD1", "EUR", "EURI", "AEUR", "GBP", "TRY", "BRL"]);

/** The tracked market: the most liquid USDT pairs by 24h quote volume. */
export function selectUniverse(all: Ticker[], size = UNIVERSE_SIZE): Ticker[] {
  return all
    .filter((t) => t.symbol.endsWith(QUOTE_ASSET) && !EXCLUDED_BASES.has(t.base) && t.price > 0 && t.quoteVolume > 0)
    .sort((a, b) => b.quoteVolume - a.quoteVolume)
    .slice(0, size);
}
