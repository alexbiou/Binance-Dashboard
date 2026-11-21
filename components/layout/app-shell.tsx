"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();

  useEffect(() => setDrawer(false), [pathname]);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <div className="flex h-dvh">
      <aside className="hidden w-52 shrink-0 border-r border-border bg-card lg:block">
        <Sidebar />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/60" aria-label="Close navigation" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-60 border-r border-border bg-card">
            <Button variant="ghost" size="icon" className="absolute right-2 top-2" onClick={() => setDrawer(false)} aria-label="Close navigation">
              <X className="size-4" />
            </Button>
            <Sidebar onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenu={() => setDrawer(true)} />
        <main className="min-h-0 flex-1 p-3 sm:p-4">{children}</main>
      </div>
    </div>
  );
}
