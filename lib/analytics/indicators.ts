export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Population standard deviation. */
export function stdev(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  let acc = 0;
  for (const v of values) acc += (v - m) ** 2;
  return Math.sqrt(acc / values.length);
}

/** Simple moving average of the last `period` values; undefined if there is not enough data. */
export function sma(values: readonly number[], period: number): number | undefined {
  if (values.length < period || period <= 0) return undefined;
  return mean(values.slice(values.length - period));
}

/** Natural-log returns between consecutive values. */
export function logReturns(values: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1] as number;
    const cur = values[i] as number;
    if (prev > 0 && cur > 0) out.push(Math.log(cur / prev));
  }
  return out;
}
