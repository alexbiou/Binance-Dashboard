/** Number decimals used for a price of this magnitude. Fixed per magnitude so columns stay aligned. */
export function priceDecimals(value: number): number {
  const abs = Math.abs(value);
  if (abs >= 100) return 2;
  if (abs >= 1) return 4;
  if (abs >= 0.01) return 5;
  return 8;
}

const NA = "\u2014";

export function fmtPrice(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return NA;
  const d = priceDecimals(value);
  return value.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

export function fmtCompact(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return NA;
  return compact.format(value);
}

export function fmtUsdCompact(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return NA;
  return `$${compact.format(value)}`;
}

export function fmtPct(value: number | undefined, digits = 2): string {
  if (value === undefined || !Number.isFinite(value)) return NA;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function fmtQty(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return NA;
  const abs = Math.abs(value);
  const d = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
  return value.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtClock(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-GB", { hour12: false });
}

export function fmtClockShort(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function fmtAgo(ts: number | undefined, now: number): string {
  if (ts === undefined) return NA;
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function trendClass(value: number | undefined): string {
  if (value === undefined || value === 0 || !Number.isFinite(value)) return "text-muted-foreground";
  return value > 0 ? "text-up" : "text-down";
}
