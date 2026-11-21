"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { NAV } from "./nav";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center border-b border-border px-4">
        <Link href="/" onClick={onNavigate} aria-label="DashboardBinance overview">
          <Logo />
        </Link>
      </div>
      <nav aria-label="Primary" className="flex flex-col gap-0.5 p-2">
        {NAV.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-8 items-center gap-2.5 rounded px-2.5 text-[13px] transition-colors",
                active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className={cn("size-4", active ? "text-primary" : "text-dim")} strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>
      <p className="mt-auto border-t border-border p-3 text-xs leading-4 text-dim">
        Read-only market data from Binance public APIs. This application does not place orders.
      </p>
    </div>
  );
}
