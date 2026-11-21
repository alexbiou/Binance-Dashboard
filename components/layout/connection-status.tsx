"use client";

import { useNow } from "@/hooks/use-now";
import { fmtAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMarketStore } from "@/store/market-store";
import { getStreamClient } from "@/lib/binance/ws";

type Tone = "up" | "warn" | "down";

export function ConnectionStatus() {
  const snapshot = useMarketStore((s) => s.snapshot);
  const ws = useMarketStore((s) => s.ws);
  const lastTickAt = useMarketStore((s) => s.lastTickAt);
  const now = useNow(1000);
  const client = getStreamClient();

  let tone: Tone;
  let label: string;
  if (snapshot.status === "error") {
    tone = "down";
    label = "Data unavailable";
  } else if (client.isMaxAttemptsReached()) {
    tone = "down";
    const code = client.closeCode();
    label = code ? `Stream failed (code ${code})` : "Stream unavailable";
  } else if (ws.status === "live") {
    tone = "up";
    label = "Live";
  } else if (ws.status === "offline") {
    tone = "warn";
    label = ws.attempt > 0 ? `Reconnect failed (attempt ${ws.attempt})` : "Offline";
  } else if (ws.status === "reconnecting") {
    tone = "warn";
    label = ws.attempt > 1 ? `Reconnecting (attempt ${ws.attempt})` : "Reconnecting";
  } else {
    tone = "warn";
    label = "Connecting";
  }

  const dot = { up: "bg-up", warn: "bg-warn", down: "bg-down" }[tone];
  const text = { up: "text-up", warn: "text-warn", down: "text-down" }[tone];

  return (
    <div className="flex items-center gap-3" role="status" aria-live="polite">
      <span className="flex items-center gap-1.5">
        <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
        <span className={cn("text-[13px] font-medium", text)}>{label}</span>
      </span>
      {ws.status === "live" && lastTickAt && <span className="hidden text-xs text-dim xl:inline">Tick {fmtAgo(lastTickAt, now)}</span>}
    </div>
  );
}
