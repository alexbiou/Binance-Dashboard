import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssetDetail } from "@/components/asset/asset-detail";

type Params = { symbol: string };

const SYMBOL = /^[A-Z0-9]{5,20}$/;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { symbol } = await params;
  return { title: symbol.toUpperCase() };
}

export default async function AssetPage({ params }: { params: Promise<Params> }) {
  const { symbol } = await params;
  const normalized = symbol.toUpperCase();
  if (!SYMBOL.test(normalized)) notFound();
  return <AssetDetail symbol={normalized} />;
}
