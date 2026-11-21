import { NextRequest, NextResponse } from "next/server";

/**
 * Optional pass-through proxy for Binance public market-data endpoints.
 * Enable by setting NEXT_PUBLIC_BINANCE_REST_URL=/api/binance (see .env.example), for example
 * when the browser cannot reach Binance directly. Only read-only market-data paths are forwarded.
 */
const UPSTREAM = (process.env.BINANCE_UPSTREAM_URL || "https://data-api.binance.vision").replace(/\/$/, "");
const ALLOWED = new Set(["/api/v3/ticker/24hr", "/api/v3/ticker/price", "/api/v3/klines", "/api/v3/depth", "/api/v3/trades"]);

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = `/${path.join("/")}`;
  if (!ALLOWED.has(target)) return NextResponse.json({ msg: "Path not allowed" }, { status: 404 });

  try {
    const res = await fetch(`${UPSTREAM}${target}${req.nextUrl.search}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const headers = new Headers({ "content-type": res.headers.get("content-type") ?? "application/json" });
    const retryAfter = res.headers.get("retry-after");
    if (retryAfter) headers.set("retry-after", retryAfter);
    return new NextResponse(res.body, { status: res.status, headers });
  } catch {
    return NextResponse.json({ msg: "Upstream request failed" }, { status: 502 });
  }
}
