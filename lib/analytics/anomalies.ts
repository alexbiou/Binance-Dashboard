import type { Candle } from "../binance/types";
import { logReturns, mean, sma, stdev } from "./indicators";

export type AnomalyType = "volume_spike" | "momentum" | "volatility" | "ma_deviation";
export type Severity = "low" | "medium" | "high";

/**
 * Single source of truth for the detection rules. The UI renders its explanation
 * panel from this object, so the documentation cannot drift from the code.
 * Thresholds are ordered [low, medium, high].
 */
export const RULES = {
  candleInterval: "5m",
  candleLimit: 120,
  volumeSpike: {
    label: "Volume spike",
    window: 20,
    thresholds: [3, 5, 8],
    /** Skip illiquid candles: baseline average quote volume must exceed this (USDT). */
    minBaselineQuoteVolume: 5_000,
    description:
      "Quote volume of the last closed candle divided by the average quote volume of the 20 candles before it.",
    unit: "x baseline",
  },
  momentum: {
    label: "Price momentum",
    lookback: 12,
    thresholds: [2, 3.5, 5],
    description: "Absolute price change over the last 12 closed candles (60 minutes).",
    unit: "% in 60m",
  },
  volatility: {
    label: "Short-term volatility",
    recent: 12,
    baseline: 96,
    thresholds: [2, 3, 4],
    /** Ignore ratios built on a near-flat recent window: recent per-candle stdev must be at least 0.05%. */
    minRecentStdevPct: 0.05,
    description:
      "Standard deviation of 5-minute log returns over the last 12 candles, relative to the preceding 96 candles.",
    unit: "x baseline",
  },
  maDeviation: {
    label: "Deviation from moving average",
    period: 20,
    thresholds: [1.5, 2.5, 4],
    description: "Distance of the last close from its 20-period simple moving average (100 minutes).",
    unit: "% from SMA20",
  },
} as const;

export interface Anomaly {
  /** Stable per symbol, type and candle, so repeated scans do not duplicate entries. */
  id: string;
  symbol: string;
  type: AnomalyType;
  severity: Severity;
  /** Primary observed metric (see RULES[...].unit). */
  value: number;
  /** Reference value the metric was compared with, where applicable. */
  baseline?: number;
  /** Extra context: per-candle stdev (%) for volatility. */
  secondary?: number;
  /** Sign of the move for directional rules. */
  direction?: "up" | "down";
  /** Close time (ms) of the candle the rule was evaluated on. */
  detectedAt: number;
}

const SEVERITIES: Severity[] = ["low", "medium", "high"];

export function severityFor(value: number, thresholds: readonly number[]): Severity | undefined {
  let level = -1;
  thresholds.forEach((t, i) => {
    if (value >= t) level = i;
  });
  return level >= 0 ? SEVERITIES[level] : undefined;
}

export const SEVERITY_RANK: Record<Severity, number> = { low: 1, medium: 2, high: 3 };

/**
 * Evaluate all rules on the latest closed candle of `candles`.
 * Pure function: `now` is injected so results are reproducible.
 */
export function detectAnomalies(symbol: string, candles: readonly Candle[], now: number = Date.now()): Anomaly[] {
  const closed = candles.filter((c) => c.closeTime < now);
  const n = closed.length;
  const last = closed[n - 1];
  if (!last) return [];

  const found: Anomaly[] = [];
  const push = (type: AnomalyType, severity: Severity | undefined, extra: Partial<Anomaly> & { value: number }) => {
    if (!severity) return;
    found.push({ id: `${symbol}:${type}:${last.closeTime}`, symbol, type, severity, detectedAt: last.closeTime, ...extra });
  };

  const closes = closed.map((c) => c.close);

  // 1. Volume spike
  {
    const r = RULES.volumeSpike;
    if (n > r.window) {
      const baseline = mean(closed.slice(n - 1 - r.window, n - 1).map((c) => c.quoteVolume));
      if (baseline >= r.minBaselineQuoteVolume) {
        const ratio = last.quoteVolume / baseline;
        push("volume_spike", severityFor(ratio, r.thresholds), { value: ratio, baseline });
      }
    }
  }

  // 2. Price momentum
  {
    const r = RULES.momentum;
    if (n > r.lookback) {
      const ref = closes[n - 1 - r.lookback] as number;
      if (ref > 0) {
        const pct = (last.close / ref - 1) * 100;
        push("momentum", severityFor(Math.abs(pct), r.thresholds), { value: pct, baseline: ref, direction: pct >= 0 ? "up" : "down" });
      }
    }
  }

  // 3. Short-term volatility versus its own baseline
  {
    const r = RULES.volatility;
    if (n >= r.recent + r.baseline) {
      const rets = logReturns(closes);
      const recent = rets.slice(rets.length - r.recent);
      const base = rets.slice(rets.length - r.recent - r.baseline, rets.length - r.recent);
      const sdRecent = stdev(recent);
      const sdBase = stdev(base);
      if (sdBase > 0 && sdRecent * 100 >= r.minRecentStdevPct) {
        const ratio = sdRecent / sdBase;
        push("volatility", severityFor(ratio, r.thresholds), { value: ratio, baseline: sdBase * 100, secondary: sdRecent * 100 });
      }
    }
  }

  // 4. Deviation from the moving average
  {
    const r = RULES.maDeviation;
    const avg = sma(closes, r.period);
    if (avg !== undefined && avg > 0) {
      const pct = (last.close / avg - 1) * 100;
      push("ma_deviation", severityFor(Math.abs(pct), r.thresholds), { value: pct, baseline: avg, direction: pct >= 0 ? "up" : "down" });
    }
  }

  return found;
}

export const TYPE_LABEL: Record<AnomalyType, string> = {
  volume_spike: RULES.volumeSpike.label,
  momentum: RULES.momentum.label,
  volatility: RULES.volatility.label,
  ma_deviation: RULES.maDeviation.label,
};

/** Human-readable observed metric for the table. */
export function describeObserved(a: Anomaly): string {
  switch (a.type) {
    case "volume_spike":
      return `${a.value.toFixed(1)}x the 20-candle average volume`;
    case "momentum":
      return `${a.value > 0 ? "+" : ""}${a.value.toFixed(2)}% over 60m`;
    case "volatility":
      return `${a.value.toFixed(1)}x baseline, stdev ${(a.secondary ?? 0).toFixed(2)}% per 5m`;
    case "ma_deviation":
      return `${a.value > 0 ? "+" : ""}${a.value.toFixed(2)}% from SMA20`;
  }
}
