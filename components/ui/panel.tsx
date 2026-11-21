import { cn } from "@/lib/utils";

interface PanelProps {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

/** The one container used for every block of content: 1px border, small radius, a slim title row. */
export function Panel({ title, actions, className, bodyClassName, children }: PanelProps) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded border border-border bg-card", className)}>
      {(title || actions) && (
        <header className="flex min-h-9 items-center justify-between gap-3 border-b border-border px-3">
          <h2 className="text-[13px] font-medium text-foreground">{title}</h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}

export function PanelMessage({ children, tone = "muted", action }: { children: React.ReactNode; tone?: "muted" | "error"; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 px-3 py-6 text-[13px]">
      <p className={tone === "error" ? "text-down" : "text-muted-foreground"}>{children}</p>
      {action}
    </div>
  );
}
