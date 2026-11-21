"use client";

import { Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConnectionStatus } from "./connection-status";
import { SearchBox } from "./search-box";
import { SyncButton } from "./sync-button";

export function Header({ onMenu }: { onMenu: () => void }) {
  const router = useRouter();
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3 sm:px-4">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open navigation">
        <Menu className="size-4" />
      </Button>
      <SearchBox hotkey onSelect={(s) => router.push(`/asset/${s}`)} className="w-full max-w-xs" />
      <div className="ml-auto flex items-center gap-4">
        <ConnectionStatus />
        <SyncButton />
      </div>
    </header>
  );
}
