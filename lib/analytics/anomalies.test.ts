import test from "node:test";
import assert from "node:assert/strict";
import { detectAnomalies, severityFor } from "./anomalies";
import type { Candle } from "../binance/types";

const STEP = 300_000;
const T0 = 1_700_000_000_000;

/** Synthetic candles for rule tests only (never shown in the app). */
function series(count: number, make: (i: number) => { close: number; quoteVolume: number }): Candle[] {
  return Array.from({ length: count }, (_, i) => {
    const { close, quoteVolume } = make(i);
    const open = T0 + i * STEP;
    return { time: Math.floor(open / 1000), open: close, high: close, low: close, close, volume: quoteVolume / close, quoteVolume, closeTime: open + STEP - 1 };
  });
}
const NOW = T0 + 1000 * STEP;

test("severityFor maps thresholds to levels", () => {
  assert.equal(severityFor(1, [3, 5, 8]), undefined);
  assert.equal(severityFor(3, [3, 5, 8]), "low");
  assert.equal(severityFor(6, [3, 5, 8]), "medium");
  assert.equal(severityFor(9, [3, 5, 8]), "high");
});

test("a quiet, flat market produces no anomalies", () => {
  const candles = series(120, () => ({ close: 100, quoteVolume: 50_000 }));
  assert.deepEqual(detectAnomalies("TESTUSDT", candles, NOW), []);
});

test("volume spike is detected against the rolling average", () => {
  const candles = series(120, (i) => ({ close: 100, quoteVolume: i === 119 ? 450_000 : 50_000 }));
  const hit = detectAnomalies("TESTUSDT", candles, NOW).find((a) => a.type === "volume_spike");
  assert.ok(hit);
  assert.equal(hit?.severity, "high"); // 450k / 50k = 9x
});

test("illiquid baselines are ignored", () => {
  const candles = series(120, (i) => ({ close: 100, quoteVolume: i === 119 ? 4_000 : 100 }));
  assert.equal(detectAnomalies("TESTUSDT", candles, NOW).some((a) => a.type === "volume_spike"), false);
});

test("momentum and MA deviation fire on a sharp rise", () => {
  const candles = series(120, (i) => ({ close: i < 108 ? 100 : 100 + (i - 107) * 0.5, quoteVolume: 50_000 }));
  const types = detectAnomalies("TESTUSDT", candles, NOW).map((a) => a.type);
  assert.ok(types.includes("momentum"));
  assert.ok(types.includes("ma_deviation"));
});

test("the still-open candle is never evaluated", () => {
  const candles = series(120, (i) => ({ close: i === 119 ? 150 : 100, quoteVolume: 50_000 }));
  const lastClose = candles[119]!.closeTime;
  const result = detectAnomalies("TESTUSDT", candles, lastClose); // last candle not yet closed
  assert.equal(result.every((a) => a.detectedAt < lastClose), true);
  assert.deepEqual(result, []);
});
