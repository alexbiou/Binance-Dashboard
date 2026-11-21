export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <rect x="1" y="7" width="3" height="8" fill="hsl(var(--dim))" />
        <rect x="6.5" y="1" width="3" height="14" fill="hsl(var(--foreground))" />
        <rect x="12" y="4" width="3" height="11" fill="hsl(var(--up))" />
      </svg>
      <span className="text-sm font-semibold tracking-tight">DashboardBinance</span>
    </span>
  );
}
