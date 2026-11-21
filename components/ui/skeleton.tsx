import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("h-3.5 w-full rounded-sm bg-accent", className)} />;
}
