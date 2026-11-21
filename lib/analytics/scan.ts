import { fetchKlines, BinanceApiError } from "../binance/rest";
import { detectAnomalies, RULES, type Anomaly } from "./anomalies";

const CONCURRENCY = 4;

export interface ScanResult {
  anomalies: Anomaly[];
  scanned: number;
  failed: number;
}

/**
 * Fetch recent 5m candles for each symbol (REST klines, weight 2 each) and run the rules.
 * Concurrency is capped. A rate-limit response aborts the scan instead of retrying.
 */
export async function scanMarket(symbols: string[]): Promise<ScanResult> {
  const anomalies: Anomaly[] = [];
  let failed = 0;
  let firstError: unknown;
  let rateLimited = false;
  let cursor = 0;

  async function worker() {
    while (cursor < symbols.length && !rateLimited) {
      const symbol = symbols[cursor++] as string;
      try {
        const candles = await fetchKlines(symbol, RULES.candleInterval, RULES.candleLimit);
        anomalies.push(...detectAnomalies(symbol, candles));
      } catch (e) {
        failed += 1;
        firstError ??= e;
        if (e instanceof BinanceApiError && (e.status === 429 || e.status === 418)) rateLimited = true;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, symbols.length) }, worker));

  if (failed === symbols.length && firstError) throw firstError;
  return { anomalies, scanned: symbols.length - failed, failed };
}
