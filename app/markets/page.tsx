import type { Metadata } from "next";
import { AssetTable } from "@/components/market/asset-table";

export const metadata: Metadata = { title: "Markets" };

export default function MarketsPage() {
  return (
    <div className="mx-auto max-w-[1600px]">
      <AssetTable title="Markets, top USDT pairs by 24h volume" maxHeightClass="max-h-[calc(100dvh-12rem)]" />
    </div>
  );
}
