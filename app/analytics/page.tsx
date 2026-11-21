import type { Metadata } from "next";
import { AnomalyPanel } from "@/components/analytics/anomaly-panel";
import { RulesInfo } from "@/components/analytics/rules-info";
import { BreadthPanel } from "@/components/market/breadth-panel";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <div className="mx-auto grid max-w-[1600px] items-start gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
      <AnomalyPanel showRules />
      <div className="flex flex-col gap-3">
        <BreadthPanel />
        <RulesInfo />
      </div>
    </div>
  );
}
