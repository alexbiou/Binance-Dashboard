"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWatchlistStore } from "@/store/watchlist-store";

export function StarButton({ symbol, className }: { symbol: string; className?: string }) {
  const hydrated = useWatchlistStore((s) => s.hydrated);
  const active = useWatchlistStore((s) => s.symbols.includes(symbol));
  const toggle = useWatchlistStore((s) => s.toggle);
  const on = hydrated && active;
  const base = symbol.replace(/USDT$/, "");

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggle(symbol);
      }}
      aria-pressed={on}
      aria-label={on ? `Remove ${base} from watchlist` : `Add ${base} to watchlist`}
      title={on ? "Remove from watchlist" : "Add to watchlist"}
      className={cn("inline-flex size-6 items-center justify-center rounded text-dim hover:text-foreground", on && "text-warn hover:text-warn", className)}
    >
      <Star className="size-3.5" fill={on ? "currentColor" : "none"} strokeWidth={1.75} />
    </button>
  );
}
