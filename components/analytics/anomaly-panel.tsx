"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RulesInfo } from "@/components/analytics/rules-info";
import { Button } from "@/components/ui/button";
import { Panel, PanelMessage } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { SCAN_INTERVAL_MS, SCAN_SIZE, useAnomalyScan } from "@/hooks/use-anomaly-scan";
import { useNow } from "@/hooks/use-now";
import { describeObserved, TYPE_LABEL, type Severity } from "@/lib/analytics/anomalies";
import { fmtAgo, fmtClockShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAnomalyStore } from "@/store/anomaly-store";
import { useMarketStore } from "@/store/market-store";

const LEVEL: Record<Severity, number> = { low: 1, medium: 2, high: 3 };
const SEVERITY_COLOR: Record<Severity, string> = { low: "bg-dim", medium: "bg-warn/70", high: "bg-warn" };

function SeverityMark({ severity }: { severity: Severity }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="flex items-end gap-px" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn("w-[3px] rounded-[1px]", i <= LEVEL[severity] ? SEVERITY_COLOR[severity] : "bg-border")} style={{ height: 4 + i * 3 }} />
        ))}
      </span>
      <span className="capitalize">{severity}</span>
    </span>
  );
}

export function AnomalyPanel({ limit, showRules = false, className }: { limit?: number; showRules?: boolean; className?: string }) {
  useAnomalyScan();
  const { items, status, error, lastScanAt, scanned, failed } = useAnomalyStore();
  const marketStatus = useMarketStore((s) => s.snapshot.status);
  const now = useNow(15_000);
  const [rulesOpen, setRulesOpen] = useState(false);
  const shown = limit ? items.slice(0, limit) : items;
  const firstScan = !lastScanAt && status !== "error";

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <Panel
        title="Market anomalies"
        actions={
          !showRules && (
            <Button variant="ghost" size="icon" className="size-6" onClick={() => setRulesOpen((o) => !o)} aria-expanded={rulesOpen} aria-label="Show detection rules" title="Detection rules">
              <Info />
            </Button>
          )
        }
      >
        {marketStatus === "error" ? (
          <PanelMessage tone="error">Market data is unavailable, so no scan can run.</PanelMessage>
        ) : status === "error" && items.length === 0 ? (
          <PanelMessage tone="error">Scan failed. {error}</PanelMessage>
        ) : firstScan ? (
          <div className="space-y-2.5 p-3" aria-busy>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} />
            ))}
            <p className="text-xs text-dim">Scanning the {SCAN_SIZE} most liquid pairs.</p>
          </div>
        ) : shown.length === 0 ? (
          <PanelMessage>No pair crossed a detection threshold in the last hour of scans.</PanelMessage>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full border-collapse text-[13px] tabular-nums">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Asset</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Observed</th>
                  <th className="px-3 py-2 font-medium">Severity</th>
                  <th className="px-3 py-2 text-right font-medium">Detected</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((a) => (
                  <tr key={a.id} className="border-b border-border/60 align-top">
                    <td className="px-3 py-1.5 font-medium">
                      <Link href={`/asset/${a.symbol}`} className="hover:underline">
                        {a.symbol.replace(/USDT$/, "")}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">{TYPE_LABEL[a.type]}</td>
                    <td className={cn("px-3 py-1.5", a.direction === "up" && "text-up", a.direction === "down" && "text-down")}>{describeObserved(a)}</td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      <SeverityMark severity={a.severity} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right text-muted-foreground" title={new Date(a.detectedAt).toLocaleString()}>
                      {fmtClockShort(a.detectedAt)} <span className="text-dim">{fmtAgo(a.detectedAt, now)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border px-3 py-2 text-xs text-dim">
          <span>
            {status === "scanning" ? "Scanning" : lastScanAt ? `Scanned ${scanned} pairs ${fmtAgo(lastScanAt, now)}` : "Waiting for first scan"}
            {failed > 0 && `, ${failed} failed`}
            {`. Rescans every ${SCAN_INTERVAL_MS / 1000}s.`}
          </span>
          <span>Statistical flags, not trading signals.</span>
        </div>
        {status === "error" && items.length > 0 && <p className="border-t border-border px-3 py-2 text-xs text-warn">Latest scan failed: {error}. Showing earlier results.</p>}
      </Panel>
      {!showRules && rulesOpen && <RulesInfo />}
    </div>
  );
}
