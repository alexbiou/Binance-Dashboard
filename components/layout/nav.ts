import { Activity, LayoutGrid, LineChart, Settings, Star, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutGrid, match: (p) => p === "/" },
  { href: "/markets", label: "Markets", icon: LineChart, match: (p) => p.startsWith("/markets") || p.startsWith("/asset") },
  { href: "/analytics", label: "Analytics", icon: Activity, match: (p) => p.startsWith("/analytics") },
  { href: "/watchlist", label: "Watchlist", icon: Star, match: (p) => p.startsWith("/watchlist") },
  { href: "/settings", label: "Settings", icon: Settings, match: (p) => p.startsWith("/settings") },
];
