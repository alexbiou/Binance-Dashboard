import { Panel } from "@/components/ui/panel";
import { RULES } from "@/lib/analytics/anomalies";

const ROWS = [RULES.volumeSpike, RULES.momentum, RULES.volatility, RULES.maDeviation] as const;

/** Rendered from the same RULES object the detector uses. */
export function RulesInfo({ className }: { className?: string }) {
  return (
    <Panel title="Detection rules" className={className}>
      <div className="space-y-3 p-3 text-xs leading-4 text-muted-foreground">
        <p>
          Rules run on {RULES.candleInterval} candles from the Binance klines endpoint, evaluated on the latest closed candle of each scanned pair. The still-open candle is ignored.
        </p>
        <ul className="space-y-2.5">
          {ROWS.map((r) => (
            <li key={r.label}>
              <p className="font-medium text-foreground">{r.label}</p>
              <p>{r.description}</p>
              <p className="tabular-nums">
                Severity: low at {r.thresholds[0]}, medium at {r.thresholds[1]}, high at {r.thresholds[2]} ({r.unit}).
              </p>
              {"minBaselineQuoteVolume" in r && <p>Ignored when the baseline averages under ${r.minBaselineQuoteVolume.toLocaleString("en-US")} per candle.</p>}
              {"minRecentStdevPct" in r && <p>Ignored when recent stdev is under {r.minRecentStdevPct}% per candle.</p>}
            </li>
          ))}
        </ul>
        <p className="border-t border-border pt-2.5">
          These are statistical flags on past data. They are not trading signals, predictions or advice.
        </p>
      </div>
    </Panel>
  );
}
